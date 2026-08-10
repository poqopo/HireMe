import { randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createOpenAICodexProviderAdapter } from "./providerAdapters.mjs";

const settingsSchema = "hireme.desktop.ai_settings.v1";
const deviceSettingsSchema = "hireme.desktop.ai_device_settings.v1";
const defaultOllamaEndpoint = "http://127.0.0.1:11434";
const defaultImageGenerationTimeoutMs = 600_000;

export function createAiProviderService({
  userDataDir,
  fetchImpl = globalThis.fetch,
  openExternal,
  openAICodexAdapter,
  imageBridgeCommand = "",
  imageBridgeArgs = [],
  imageGenerationTimeoutMs = defaultImageGenerationTimeoutMs,
  onStateChange,
  loginTimeoutMs = 10 * 60_000,
} = {}) {
  if (!userDataDir) throw new Error("AI provider user data directory is required.");
  const dataRoot = resolve(userDataDir);
  const activeConnections = new Map();
  const knownUsers = new Map();
  let writeQueue = Promise.resolve();
  let revision = 0;
  const codexAdapter = openAICodexAdapter || createOpenAICodexProviderAdapter({
    openExternal,
    loginTimeoutMs,
  });
  const imageTimeoutMs = Number.isFinite(Number(imageGenerationTimeoutMs))
    ? Math.max(60_000, Math.round(Number(imageGenerationTimeoutMs)))
    : defaultImageGenerationTimeoutMs;

  const providerPaths = (userId) => {
    const safeId = requireUserId(userId);
    const providerRoot = join(dataRoot, "providers", safeId, "codex");
    return {
      providerRoot,
      authPath: join(providerRoot, "hireme-image-auth.json"),
    };
  };

  const inspectCodex = async (userId) => {
    const connecting = activeConnections.has(userId);
    const paths = providerPaths(userId);
    await mkdir(paths.providerRoot, { recursive: true });
    return codexAdapter.inspect({ authPath: paths.authPath, connecting });
  };

  const inspectOllama = async (userId, user) => {
    const saved = await readUserDeviceSettings(dataRoot, userId);
    const endpoint = normalizeOllamaEndpoint(saved.ollamaEndpoint || defaultOllamaEndpoint);
    const result = await readOllamaModels(endpoint, { fetchImpl });
    const preferredModel = firstAvailableModel(
      saved.ollamaModel,
      user?.defaultProvider === "ollama" ? user.defaultModel : null,
      result.models,
    );
    return {
      available: result.available,
      status: result.available ? "available" : "not_running",
      endpoint,
      models: result.models,
      selectedModel: preferredModel,
      error: result.error,
    };
  };

  const getSettings = async ({ user } = {}) => {
    const userId = requireUserId(user?.id);
    knownUsers.set(userId, { ...user });
    const [codex, ollama] = await Promise.all([
      inspectCodex(userId),
      inspectOllama(userId, user),
    ]);
    const selected = ["codex", "ollama"].includes(user?.defaultProvider)
      ? user.defaultProvider
      : "codex";
    return {
      schema: settingsSchema,
      revision,
      selected,
      setupCompleted: user?.aiSetupCompleted === true,
      codex,
      ollama,
    };
  };

  const publish = async (userId) => {
    const user = knownUsers.get(userId);
    if (!user) return;
    revision += 1;
    const next = await getSettings({ user });
    onStateChange?.({ ...next, revision });
  };

  const saveDeviceSettings = async ({ user, provider, model = null } = {}) => {
    const userId = requireUserId(user?.id);
    const selected = normalizeProvider(provider);
    if (selected === "codex") {
      const codex = await inspectCodex(userId);
      if (!codex.connected) {
        throw new Error("ChatGPT 계정을 먼저 연결해 주세요.");
      }
    } else {
      const ollama = await inspectOllama(userId, user);
      const selectedModel = String(model || "").trim();
      if (!ollama.available) {
        throw new Error("이 컴퓨터에서 실행 중인 로컬 AI를 찾지 못했습니다.");
      }
      if (!ollama.models.some((item) => item.id === selectedModel)) {
        throw new Error("사용할 로컬 AI 모델을 선택해 주세요.");
      }
      await queueDeviceSettingsWrite({
        root: dataRoot,
        userId,
        patch: {
          ollamaEndpoint: ollama.endpoint,
          ollamaModel: selectedModel,
        },
      });
    }
    knownUsers.set(userId, {
      ...user,
      defaultProvider: selected,
      defaultModel: selected === "ollama" ? String(model) : null,
      aiSetupCompleted: true,
    });
    await publish(userId);
    return {
      provider: selected,
      model: selected === "ollama" ? String(model) : null,
    };
  };

  const queueDeviceSettingsWrite = (options) => {
    writeQueue = writeQueue.catch(() => {}).then(() => writeUserDeviceSettings(options));
    return writeQueue;
  };

  return {
    getSettings,

    async connectCodex({ user } = {}) {
      const userId = requireUserId(user?.id);
      knownUsers.set(userId, { ...user });
      if (activeConnections.has(userId)) {
        throw new Error("ChatGPT 계정 연결이 이미 진행 중입니다.");
      }
      const paths = providerPaths(userId);
      await mkdir(paths.providerRoot, { recursive: true });
      const controller = new AbortController();
      activeConnections.set(userId, controller);
      try {
        await publish(userId);
        await codexAdapter.connect({
          authPath: paths.authPath,
          signal: controller.signal,
        });
        activeConnections.delete(userId);
        const status = await inspectCodex(userId);
        if (!status.connected) {
          throw new Error("로그인은 완료됐지만 연결 상태를 확인하지 못했습니다.");
        }
        return await getSettings({ user });
      } finally {
        activeConnections.delete(userId);
        await publish(userId).catch(() => {});
      }
    },

    async cancelConnection({ user } = {}) {
      const userId = requireUserId(user?.id);
      const controller = activeConnections.get(userId);
      if (!controller) return false;
      controller.abort(Object.assign(new Error("ChatGPT 계정 연결을 취소했습니다."), {
        code: "openai_codex_oauth_cancelled",
      }));
      return true;
    },

    async disconnectCodex({ user } = {}) {
      const userId = requireUserId(user?.id);
      knownUsers.set(userId, { ...user });
      const paths = providerPaths(userId);
      await codexAdapter.disconnect({ authPath: paths.authPath });
      await publish(userId);
      return await getSettings({ user });
    },

    saveDeviceSettings,

    async resolveRuntime({ user } = {}) {
      const userId = requireUserId(user?.id);
      const provider = normalizeProvider(user?.defaultProvider || "codex");
      if (user?.aiSetupCompleted !== true) {
        throw new Error("먼저 작업에 사용할 AI를 설정해 주세요.");
      }
      if (provider === "codex") {
        const codex = await inspectCodex(userId);
        if (!codex.connected) {
          throw new Error("설정에서 ChatGPT 계정을 다시 연결해 주세요.");
        }
        const paths = providerPaths(userId);
        return codexAdapter.runtime({
          authPath: paths.authPath,
          imageBridgeCommand,
          imageBridgeArgs,
          imageTimeoutMs,
        });
      }

      const ollama = await inspectOllama(userId, user);
      if (!ollama.available || !ollama.selectedModel) {
        throw new Error("로컬 AI가 꺼져 있거나 사용할 모델이 없습니다.");
      }
      return {
        provider: "ollama",
        model: ollama.selectedModel,
        env: {
          HIREME_OLLAMA_BASE_URL: ollama.endpoint,
          OLLAMA_BASE_URL: ollama.endpoint,
          HIREME_OLLAMA_MODEL: ollama.selectedModel,
          OLLAMA_API_KEY: "",
          HIREME_CODEX_IMAGE_GEN_COMMAND: "",
          HIREME_CODEX_IMAGE_GEN_ARGS: "[]",
        },
      };
    },

    destroy() {
      for (const controller of activeConnections.values()) {
        controller.abort(new Error("HireMe provider service stopped."));
      }
      activeConnections.clear();
    },
  };
}

export async function readOllamaModels(
  endpoint = defaultOllamaEndpoint,
  { fetchImpl = globalThis.fetch, timeoutMs = 2500 } = {},
) {
  const safeEndpoint = normalizeOllamaEndpoint(endpoint);
  if (typeof fetchImpl !== "function") {
    return { available: false, models: [], error: "로컬 AI 연결 기능을 사용할 수 없습니다." };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${safeEndpoint}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      return { available: false, models: [], error: "로컬 AI가 응답하지 않습니다." };
    }
    const data = await response.json();
    const models = Array.isArray(data?.models)
      ? data.models
          .map((model) => ({
            id: String(model?.name || model?.model || "").trim(),
            name: String(model?.name || model?.model || "").trim(),
            size: Number(model?.size || 0) || null,
          }))
          .filter((model) => model.id)
      : [];
    return { available: true, models, error: null };
  } catch (error) {
    const message = error?.name === "AbortError"
      ? "로컬 AI 응답 시간이 초과되었습니다."
      : "이 컴퓨터에서 실행 중인 로컬 AI를 찾지 못했습니다.";
    return { available: false, models: [], error: message };
  } finally {
    clearTimeout(timer);
  }
}

async function readUserDeviceSettings(root, userId) {
  const store = await readJson(join(root, "ai-settings.json"), {
    schema: deviceSettingsSchema,
    users: {},
  });
  return store.users?.[requireUserId(userId)] || {};
}

async function writeUserDeviceSettings({ root, userId, patch }) {
  const path = join(root, "ai-settings.json");
  const store = await readJson(path, { schema: deviceSettingsSchema, users: {} });
  const safeId = requireUserId(userId);
  const next = {
    schema: deviceSettingsSchema,
    users: {
      ...(store.users || {}),
      [safeId]: {
        ...(store.users?.[safeId] || {}),
        ...patch,
        updatedAt: new Date().toISOString(),
      },
    },
  };
  await atomicWriteJson(path, next, 0o600);
}

async function atomicWriteJson(path, value, mode = 0o600) {
  const temp = `${path}.${randomUUID()}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode });
  await chmod(temp, mode).catch(() => {});
  await rename(temp, path);
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    return fallback;
  }
}

function normalizeOllamaEndpoint(value) {
  const url = new URL(String(value || defaultOllamaEndpoint));
  const loopback = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "http:" || !loopback || url.username || url.password) {
    throw new Error("로컬 AI 주소는 이 컴퓨터의 안전한 로컬 주소여야 합니다.");
  }
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function normalizeProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  if (!["codex", "ollama"].includes(provider)) {
    throw new Error("지원하지 않는 AI 연결입니다.");
  }
  return provider;
}

function firstAvailableModel(saved, profile, models) {
  const ids = new Set(models.map((model) => model.id));
  if (saved && ids.has(saved)) return saved;
  if (profile && ids.has(profile)) return profile;
  return models[0]?.id || null;
}

function requireUserId(value) {
  const userId = String(value || "").trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(userId)) {
    throw new Error("유효한 HireMe 사용자 계정이 필요합니다.");
  }
  return userId;
}
