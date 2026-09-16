import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const authStateSchema = "hireme.desktop.auth_state.v1";

export function createDesktopAuthService({
  supabaseUrl,
  supabaseAnonKey,
  userDataDir,
  redirectUrl,
  safeStorage,
  openExternal,
  onStateChange,
} = {}) {
  let client = null;
  let authSubscription = null;
  let state = publicState({
    configured: Boolean(supabaseUrl && supabaseAnonKey),
    status: supabaseUrl && supabaseAnonKey ? "loading" : "unconfigured",
  });
  let stateRevision = 0;

  const publish = (next) => {
    stateRevision += 1;
    state = publicState({ ...next, revision: stateRevision });
    onStateChange?.(state);
    return state;
  };

  const syncSession = async (session, { validate = false } = {}) => {
    if (!session?.user) {
      return publish({ configured: true, status: "unauthenticated" });
    }
    let user = session.user;
    if (validate) {
      const validation = await client.auth.getUser();
      if (validation.error || !validation.data.user) {
        await client.auth.signOut({ scope: "local" }).catch(() => {});
        return publish({
          configured: true,
          status: "unauthenticated",
          error: "저장된 로그인 세션이 만료되었습니다.",
        });
      }
      user = validation.data.user;
    }
    const profile = await readProfile(client, user.id);
    return publish({
      configured: true,
      status: "authenticated",
      user: sanitizeUser(user, profile),
    });
  };

  return {
    async initialize() {
      if (!supabaseUrl || !supabaseAnonKey) return state;
      const storage = createEncryptedAuthStorage({
        root: join(resolve(userDataDir), "auth", "supabase"),
        safeStorage,
      });
      client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: "pkce",
          persistSession: true,
          storage,
        },
      });
      const { data, error } = await client.auth.getSession();
      if (error) {
        publish({ configured: true, status: "unauthenticated", error: error.message });
      } else {
        await syncSession(data.session, { validate: Boolean(data.session) });
      }
      const listener = client.auth.onAuthStateChange((_event, session) => {
        queueMicrotask(() => {
          void syncSession(session).catch((error) => {
            publish({ configured: true, status: "error", error: publicAuthError(error) });
          });
        });
      });
      authSubscription = listener.data.subscription;
      return state;
    },

    getState() {
      return state;
    },

    getUserId() {
      return state.status === "authenticated" ? state.user?.id || null : null;
    },

    getDataClient() {
      return state.status === "authenticated" ? client : null;
    },

    async startGoogleLogin() {
      if (!client) throw new Error("Google 로그인이 아직 구성되지 않았습니다.");
      publish({ configured: true, status: "authenticating" });
      const { data, error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          scopes: "openid email profile",
        },
      });
      if (error || !data?.url) {
        const message = error?.message || "Google 로그인 URL을 만들지 못했습니다.";
        publish({ configured: true, status: "error", error: message });
        throw new Error(message);
      }
      await openExternal(data.url);
      return state;
    },

    async handleCallback(rawUrl) {
      if (!client) return false;
      const url = new URL(String(rawUrl || ""));
      const expected = new URL(redirectUrl);
      if (url.protocol !== expected.protocol || url.host !== expected.host) return false;
      const callbackCode = url.searchParams.get("error");
      const callbackError = callbackCode === "access_denied"
        ? "Google 로그인이 취소되었습니다."
        : url.searchParams.get("error_description") || callbackCode;
      if (callbackError) {
        publish({ configured: true, status: "error", error: callbackError });
        return true;
      }
      const code = url.searchParams.get("code");
      if (!code) {
        publish({
          configured: true,
          status: "error",
          error: "Google 로그인 응답에 인증 코드가 없습니다.",
        });
        return true;
      }
      publish({ configured: true, status: "authenticating" });
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error || !data.session) {
        const message = error?.message || "Google 로그인 세션을 만들지 못했습니다.";
        publish({ configured: true, status: "error", error: message });
        return true;
      }
      await syncSession(data.session);
      return true;
    },

    async signOut() {
      if (!client) return publish({ configured: false, status: "unconfigured" });
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw error;
      return publish({ configured: true, status: "unauthenticated" });
    },

    async updateAiPreferences({ provider, model = null, setupCompleted = true } = {}) {
      if (!client || state.status !== "authenticated" || !state.user?.id) {
        throw new Error("HireMe 로그인이 필요합니다.");
      }
      const normalizedProvider = String(provider || "").trim().toLowerCase();
      if (!["codex", "ollama"].includes(normalizedProvider)) {
        throw new Error("지원하지 않는 AI 연결입니다.");
      }
      const normalizedModel = model ? String(model).trim().slice(0, 120) : null;
      const { data, error } = await client
        .from("profiles")
        .update({
          default_provider: normalizedProvider,
          default_model: normalizedModel,
          ai_setup_completed: setupCompleted === true,
        })
        .eq("id", state.user.id)
        .select("id, display_name, avatar_url, locale, default_provider, default_model, ai_setup_completed")
        .single();
      if (error) throw error;
      return publish({
        configured: true,
        status: "authenticated",
        user: {
          ...state.user,
          displayName: data.display_name || state.user.displayName,
          avatarUrl: data.avatar_url || state.user.avatarUrl,
          locale: data.locale || state.user.locale,
          defaultProvider: data.default_provider,
          defaultModel: data.default_model,
          aiSetupCompleted: data.ai_setup_completed === true,
        },
      });
    },

    destroy() {
      authSubscription?.unsubscribe();
      authSubscription = null;
    },
  };
}

export function createEncryptedAuthStorage({ root, safeStorage } = {}) {
  if (!root) throw new Error("Encrypted auth storage root is required.");
  const storageRoot = resolve(root);
  return {
    async getItem(key) {
      const path = storagePath(storageRoot, key);
      try {
        const encrypted = await readFile(path);
        if (!safeStorage?.isEncryptionAvailable?.()) return null;
        return safeStorage.decryptString(encrypted);
      } catch (error) {
        if (error?.code === "ENOENT") return null;
        await rm(path, { force: true }).catch(() => {});
        return null;
      }
    },
    async setItem(key, value) {
      if (!safeStorage?.isEncryptionAvailable?.()) {
        throw new Error("운영체제 보안 저장소를 사용할 수 없습니다.");
      }
      const path = storagePath(storageRoot, key);
      const temp = `${path}.${randomUUID()}.tmp`;
      await mkdir(dirname(path), { recursive: true });
      await writeFile(temp, safeStorage.encryptString(String(value)));
      await chmod(temp, 0o600).catch(() => {});
      await rename(temp, path);
    },
    async removeItem(key) {
      await rm(storagePath(storageRoot, key), { force: true });
    },
  };
}

export async function readDesktopPublicConfig(path, env = process.env) {
  let fileConfig = {};
  try {
    fileConfig = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const url = String(
    env.HIREME_SUPABASE_URL || env.VITE_SUPABASE_URL || fileConfig.supabase?.url || "",
  ).trim();
  const anonKey = String(
    env.HIREME_SUPABASE_ANON_KEY ||
      env.VITE_SUPABASE_ANON_KEY ||
      fileConfig.supabase?.anonKey ||
      "",
  ).trim();
  return {
    configured: Boolean(url && anonKey),
    url,
    anonKey,
    projectRef: fileConfig.supabase?.projectRef || null,
  };
}

async function readProfile(client, userId) {
  const { data, error } = await client
    .from("profiles")
    .select("id, display_name, avatar_url, locale, default_provider, default_model, ai_setup_completed")
    .eq("id", userId)
    .maybeSingle();
  if (error) return null;
  return data;
}

function sanitizeUser(user, profile) {
  const metadata = user?.user_metadata || {};
  return {
    id: String(user?.id || ""),
    email: typeof user?.email === "string" ? user.email : null,
    displayName: String(
      profile?.display_name || metadata.full_name || metadata.name || user?.email || "HireMe 사용자",
    ).slice(0, 100),
    avatarUrl: firstUrl(profile?.avatar_url, metadata.avatar_url, metadata.picture),
    locale: String(profile?.locale || metadata.locale || "ko-KR").slice(0, 20),
    defaultProvider: String(profile?.default_provider || "codex").slice(0, 40),
    defaultModel: profile?.default_model ? String(profile.default_model).slice(0, 120) : null,
    aiSetupCompleted: profile?.ai_setup_completed === true,
  };
}

function publicState({ configured, status, user = null, error = null, revision = 0 }) {
  return {
    schema: authStateSchema,
    configured: Boolean(configured),
    status,
    user: status === "authenticated" ? user : null,
    error: error ? String(error).slice(0, 500) : null,
    revision,
  };
}

function storagePath(root, key) {
  const digest = createHash("sha256").update(String(key), "utf8").digest("hex");
  return join(root, `${digest}.bin`);
}

function firstUrl(...values) {
  for (const value of values) {
    if (typeof value !== "string" || !value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "https:") return url.toString();
    } catch {
      // Ignore malformed provider metadata.
    }
  }
  return null;
}

function publicAuthError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/network|fetch/i.test(message)) return "로그인 서버에 연결할 수 없습니다.";
  return message.slice(0, 500) || "로그인 처리 중 오류가 발생했습니다.";
}
