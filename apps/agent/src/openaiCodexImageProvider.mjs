import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, stat, writeFile, chmod } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { basename, dirname, resolve } from "node:path";

const schemaVersion = "hireme.codex_image_gen.request.v1";
const storeVersion = 1;
const clientId = "app_EMoamEEZ73f0CkXaXp7hrann";
const authorizeUrl = "https://auth.openai.com/oauth/authorize";
const tokenUrl = "https://auth.openai.com/oauth/token";
const defaultCodexResponsesBaseUrl = "https://chatgpt.com/backend-api/codex";
const defaultResponsesModel = "gpt-5.5";
const defaultImageModel = "gpt-image-2";
const defaultTimeoutMs = 180_000;
const maxSseBytes = 64 * 1024 * 1024;
const maxSseEvents = 512;
const maxImageBase64Chars = 64 * 1024 * 1024;
const refreshMarginMs = 60_000;
const callbackHost = "localhost";
const callbackPort = 1455;
const callbackPath = "/auth/callback";
const scope = "openid profile email offline_access";

export function openAICodexAuthPath() {
  return process.env.HIREME_OPENAI_CODEX_AUTH_PATH ||
    resolve(homedir(), ".hireme", "openai-codex-auth.json");
}

export async function getOpenAICodexAuthStatus({ authPath = openAICodexAuthPath() } = {}) {
  const store = await readAuthStore(authPath);
  const profiles = Object.entries(store.profiles || {}).map(([profileId, profile]) => ({
    profileId,
    type: profile.type || null,
    provider: profile.provider || null,
    email: profile.email || null,
    accountId: profile.accountId || null,
    expires: profile.expires || null,
    remainingMs: profile.expires ? profile.expires - Date.now() : null,
    selected: profileId === store.selectedProfileId,
    hasAccessToken: Boolean(profile.access),
    hasRefreshToken: Boolean(profile.refresh),
  }));
  return {
    authPath,
    configured: profiles.some((profile) => profile.hasAccessToken || profile.hasRefreshToken),
    selectedProfileId: store.selectedProfileId || null,
    profiles,
    envAccessToken: Boolean(process.env.HIREME_OPENAI_CODEX_ACCESS_TOKEN),
  };
}

export async function importOpenClawOpenAICodexProfiles({
  authPath = openAICodexAuthPath(),
  sourcePath = defaultOpenClawAuthProfilesPath(),
} = {}) {
  const sources = [];
  const jsonSource = await readJsonIfExists(sourcePath);
  if (jsonSource) {
    sources.push({ sourcePath, source: jsonSource });
  }
  const sqliteSource = await readOpenClawSqliteAuthStore(defaultOpenClawAuthSqlitePath());
  if (sqliteSource) {
    sources.push(sqliteSource);
  }
  const imported = [];
  const store = await readAuthStore(authPath);

  for (const sourceEntry of sources) {
    const sourceProfiles = sourceEntry.source?.profiles && typeof sourceEntry.source.profiles === "object"
      ? sourceEntry.source.profiles
      : {};
    for (const [sourceId, sourceProfile] of Object.entries(sourceProfiles)) {
      if (!isOAuthProfile(sourceProfile)) continue;
      const identity = identityFromProfile(sourceProfile) || identityFromProfileId(sourceId) || "default";
      const profileId = `openai:${identity}`;
      store.profiles[profileId] = normalizeOAuthProfile({
        ...sourceProfile,
        provider: "openai",
        importedFrom: sourceEntry.sourcePath,
        importedAt: new Date().toISOString(),
      });
      if (!imported.includes(profileId)) imported.push(profileId);
    }
  }

  if (imported.length > 0) {
    store.selectedProfileId = chooseBestProfileId(store, imported) || store.selectedProfileId || imported[0];
  }
  store.updatedAt = new Date().toISOString();
  await writeAuthStore(store, authPath);

  return {
    authPath,
    sourcePath,
    sources: sources.map((source) => source.sourcePath),
    importedCount: imported.length,
    selectedProfileId: store.selectedProfileId || null,
    profileIds: imported,
  };
}

export async function loginOpenAICodex({
  authPath = openAICodexAuthPath(),
  originator = "hireme",
  onAuth,
  manualCodeProvider,
  openBrowser = true,
} = {}) {
  const flow = await createAuthorizationFlow(originator);
  const server = await startCallbackServer(flow.state);
  let code = "";

  try {
    await onAuth?.({
      url: flow.url,
      redirectUri: flow.redirectUri,
      callbackListening: server.listening,
    });
    if (openBrowser) openUrl(flow.url);

    const callbackPromise = server.waitForCode();
    const manualPromise = manualCodeProvider
      ? manualCodeProvider({ url: flow.url, state: flow.state }).then((value) => (
          parseAuthorizationInput(value, flow.state)
        ))
      : Promise.resolve("");
    code = await Promise.race([
      callbackPromise.then((value) => value?.code || ""),
      manualPromise,
    ]);
    if (!code) {
      const callbackResult = await Promise.race([
        callbackPromise,
        wait(30_000).then(() => null),
      ]);
      code = callbackResult?.code || "";
    }
    if (!code) throw new Error("OpenAI Codex OAuth authorization code was not received.");

    const token = await exchangeAuthorizationCode({
      code,
      verifier: flow.verifier,
      redirectUri: flow.redirectUri,
    });
    const profile = normalizeOAuthProfile({
      type: "oauth",
      provider: "openai",
      access: token.access,
      refresh: token.refresh,
      expires: token.expires,
      accountId: token.accountId,
      email: token.email,
    });
    const identity = identityFromProfile(profile) || "default";
    const profileId = `openai:${identity}`;
    const store = await readAuthStore(authPath);
    store.profiles[profileId] = profile;
    store.selectedProfileId = profileId;
    store.updatedAt = new Date().toISOString();
    await writeAuthStore(store, authPath);
    return {
      authPath,
      profileId,
      accountId: profile.accountId || null,
      email: profile.email || null,
      expires: profile.expires || null,
    };
  } finally {
    await server.close();
  }
}

export async function runOpenAICodexImageBridgeStdio({
  stdin = process.stdin,
  stdout = process.stdout,
} = {}) {
  const request = JSON.parse(await readStdin(stdin));
  const result = await generateOpenAICodexImageFromRequest(request);
  stdout.write(`${JSON.stringify(result)}\n`);
}

export async function generateOpenAICodexImageFromRequest(
  request,
  {
    authPath = openAICodexAuthPath(),
  } = {},
) {
  if (request.schema !== schemaVersion) {
    throw new Error(`Unexpected schema: ${request.schema || "missing"}`);
  }
  if (!request.prompt || !request.outputPath) {
    throw new Error("prompt and outputPath are required.");
  }

  await mkdir(dirname(request.outputPath), { recursive: true });

  const accessToken = await resolveAccessToken({ authPath });
  const imageModel = normalizeImageModel(
    process.env.HIREME_OPENAI_CODEX_IMAGE_MODEL ||
      request.model ||
      defaultImageModel,
  );
  const responsesModel =
    process.env.HIREME_OPENAI_CODEX_RESPONSES_MODEL || defaultResponsesModel;
  const outputFormat = outputFormatFor(request.mimeType, request.outputPath);
  const inputImages = await readInputImages(request.referenceImages);
  const size = normalizeImageSize(
    request.size || process.env.HIREME_OPENAI_CODEX_IMAGE_SIZE || "1024x1024",
  );
  const quality = nonEmpty(process.env.HIREME_OPENAI_CODEX_IMAGE_QUALITY);
  const background = nonEmpty(process.env.HIREME_OPENAI_CODEX_IMAGE_BACKGROUND);
  const timeoutMs = readPositiveInteger(
    process.env.HIREME_OPENAI_CODEX_IMAGE_TIMEOUT_MS,
    readPositiveInteger(request.timeoutMs, defaultTimeoutMs),
  );

  const body = {
    model: responsesModel,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: request.prompt },
          ...inputImages.map((image) => ({
            type: "input_image",
            image_url: toDataUrl(image),
            detail: "auto",
          })),
        ],
      },
    ],
    instructions: "You are an image generation assistant.",
    tools: [
      {
        type: "image_generation",
        model: imageModel,
        size,
        output_format: outputFormat,
        ...(quality ? { quality } : {}),
        ...(background ? { background } : {}),
      },
    ],
    tool_choice: { type: "image_generation" },
    stream: true,
    store: false,
  };

  const startedAt = Date.now();
  const responseBody = await postCodexResponses({
    accessToken,
    body,
    timeoutMs,
  });
  const image = extractImageGenerationResult({
    body: responseBody,
    outputFormat,
  });
  await writeFile(request.outputPath, image.buffer);
  const outputFile = await inspectImageFile(request.outputPath);

  return {
    status: "completed",
    provider: "openai",
    model: `openai/${imageModel}`,
    auth: "codex-oauth",
    transport: "native/codex-responses",
    responsesModel,
    path: request.outputPath,
    mimeType: outputFile.mimeType,
    bytes: outputFile.bytes,
    durationMs: Date.now() - startedAt,
    revisedPrompt: image.revisedPrompt || null,
  };
}

async function resolveAccessToken({ authPath }) {
  const envToken = nonEmpty(process.env.HIREME_OPENAI_CODEX_ACCESS_TOKEN);
  if (envToken) return envToken;

  const store = await readAuthStore(authPath);
  const selected = selectOAuthProfile(store);
  if (!selected) {
    throw new Error(
      `OpenAI Codex OAuth profile is missing. Run \`hireme image-bridge login-openai-codex\` or \`hireme image-bridge import-openai-codex\`.`,
    );
  }

  const { profileId, profile } = selected;
  if (profile.access && profile.expires && profile.expires > Date.now() + refreshMarginMs) {
    return profile.access;
  }
  if (!profile.refresh) {
    throw new Error(`OpenAI Codex OAuth profile ${profileId} has no refresh token.`);
  }

  const refreshed = await refreshOAuthProfile(profile);
  store.profiles[profileId] = normalizeOAuthProfile({
    ...profile,
    ...refreshed,
    refreshedAt: new Date().toISOString(),
  });
  store.updatedAt = new Date().toISOString();
  await writeAuthStore(store, authPath);
  return store.profiles[profileId].access;
}

async function postCodexResponses({ accessToken, body, timeoutMs }) {
  const baseUrl = normalizeBaseUrl(
    process.env.HIREME_OPENAI_CODEX_RESPONSES_BASE_URL ||
      defaultCodexResponsesBaseUrl,
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await readBoundedResponseText(response);
    if (!response.ok) {
      throw new Error(
        `OpenAI Codex image generation failed (${response.status}): ${text.slice(0, 1000)}`,
      );
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function extractImageGenerationResult({ body, outputFormat }) {
  const events = parseSseEvents(body);
  const failure = events.find((event) => event.type === "response.failed" || event.type === "error");
  if (failure) {
    const message = failure.error?.message || failure.message || "OpenAI Codex image generation failed.";
    throw new Error(message);
  }

  const outputItem = events.find((event) => (
    event.type === "response.output_item.done" &&
      event.item?.type === "image_generation_call" &&
      typeof event.item.result === "string" &&
      event.item.result
  ))?.item;
  const completed = events.find((event) => event.type === "response.completed");
  const completedItem = completed?.response?.output?.find((item) => (
    item.type === "image_generation_call" &&
      typeof item.result === "string" &&
      item.result
  ));
  const item = outputItem || completedItem;
  if (!item) {
    throw new Error("OpenAI Codex image generation completed without an image payload.");
  }
  if (item.result.length > maxImageBase64Chars) {
    throw new Error("OpenAI Codex image payload exceeded size limit.");
  }
  return {
    buffer: Buffer.from(item.result, "base64"),
    mimeType: mimeTypeForOutputFormat(outputFormat),
    revisedPrompt: item.revised_prompt || null,
  };
}

function parseSseEvents(text) {
  const events = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6).trim();
    if (!data || data === "[DONE]") continue;
    try {
      events.push(JSON.parse(data));
    } catch {
      continue;
    }
    if (events.length > maxSseEvents) {
      throw new Error("OpenAI Codex image generation response exceeded event limit.");
    }
  }
  return events;
}

async function readBoundedResponseText(response) {
  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxSseBytes) {
      throw new Error("OpenAI Codex image generation response exceeded size limit.");
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks = [];
  let byteLength = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (value) {
        byteLength += value.byteLength;
        if (byteLength > maxSseBytes) {
          await reader.cancel().catch(() => {});
          throw new Error("OpenAI Codex image generation response exceeded size limit.");
        }
        chunks.push(decoder.decode(value, { stream: !done }));
      }
      if (done) {
        const tail = decoder.decode();
        if (tail) chunks.push(tail);
        return chunks.join("");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function refreshOAuthProfile(profile) {
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: profile.refresh,
      client_id: clientId,
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI Codex token refresh failed (${response.status}): ${text}`);
  }
  const json = parseJson(text);
  if (!json?.access_token || !json?.refresh_token || !json?.expires_in) {
    throw new Error("OpenAI Codex token refresh response was missing required fields.");
  }
  return tokenResponseToProfile(json);
}

async function exchangeAuthorizationCode({ code, verifier, redirectUri }) {
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI Codex token exchange failed (${response.status}): ${text}`);
  }
  const json = parseJson(text);
  if (!json?.access_token || !json?.refresh_token || !json?.expires_in) {
    throw new Error("OpenAI Codex token exchange response was missing required fields.");
  }
  return tokenResponseToProfile(json);
}

function tokenResponseToProfile(json) {
  const access = json.access_token;
  const payload = decodeJwtPayload(access);
  return {
    access,
    refresh: json.refresh_token,
    expires: Date.now() + Number(json.expires_in) * 1000,
    accountId: resolveStableSubject(payload),
    email: typeof payload?.email === "string" ? payload.email : null,
  };
}

async function createAuthorizationFlow(originator) {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  const state = base64Url(randomBytes(24));
  const redirectUri = `http://${callbackHost}:${callbackPort}${callbackPath}`;
  const url = new URL(authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("id_token_add_organizations", "true");
  url.searchParams.set("codex_cli_simplified_flow", "true");
  url.searchParams.set("originator", originator);
  return { verifier, redirectUri, state, url: url.toString() };
}

function startCallbackServer(state) {
  let settleWait;
  let listening = false;
  const waitForCodePromise = new Promise((resolveWait) => {
    let settled = false;
    settleWait = (value) => {
      if (settled) return;
      settled = true;
      resolveWait(value);
    };
  });
  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url || "", `http://${callbackHost}`);
      if (url.pathname !== callbackPath) {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>Callback route not found.</h1>");
        return;
      }
      if (url.searchParams.get("state") !== state) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>State mismatch.</h1>");
        return;
      }
      const code = url.searchParams.get("code");
      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>Missing authorization code.</h1>");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h1>OpenAI authentication completed. You can close this window.</h1>");
      settleWait?.({ code });
    } catch {
      res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h1>Internal OAuth callback error.</h1>");
    }
  });

  return new Promise((resolveStart) => {
    server
      .listen(callbackPort, callbackHost, () => {
        listening = true;
        resolveStart({
          listening,
          waitForCode: () => waitForCodePromise,
          close: () => closeServer(server),
        });
      })
      .on("error", () => {
        settleWait?.(null);
        resolveStart({
          listening,
          waitForCode: () => waitForCodePromise,
          close: () => closeServer(server),
        });
      });
  });
}

function closeServer(server) {
  return new Promise((resolveClose) => {
    server.close(() => resolveClose());
  }).catch(() => {});
}

function parseAuthorizationInput(value, expectedState) {
  const text = String(value || "").trim();
  if (!text) return "";
  let parsedUrl = null;
  try {
    parsedUrl = new URL(text);
  } catch {
    parsedUrl = null;
  }
  if (parsedUrl) {
    if (parsedUrl.searchParams.get("state") && parsedUrl.searchParams.get("state") !== expectedState) {
      throw new Error("OpenAI Codex OAuth state mismatch.");
    }
    return parsedUrl.searchParams.get("code") || "";
  }
  return text;
}

function openUrl(url) {
  const command = process.platform === "darwin"
    ? "open"
    : process.platform === "win32"
      ? "cmd"
      : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, {
    stdio: "ignore",
    detached: true,
  });
  child.on("error", () => {});
  child.unref();
}

async function readAuthStore(authPath) {
  try {
    const parsed = JSON.parse(await readFile(authPath, "utf8"));
    return {
      version: storeVersion,
      profiles: parsed.profiles && typeof parsed.profiles === "object" ? parsed.profiles : {},
      selectedProfileId: parsed.selectedProfileId || null,
      updatedAt: parsed.updatedAt || null,
    };
  } catch (err) {
    if (err?.code === "ENOENT") {
      return { version: storeVersion, profiles: {}, selectedProfileId: null, updatedAt: null };
    }
    throw err;
  }
}

async function writeAuthStore(store, authPath) {
  await mkdir(dirname(authPath), { recursive: true });
  await writeFile(authPath, `${JSON.stringify({
    version: storeVersion,
    profiles: store.profiles || {},
    selectedProfileId: store.selectedProfileId || null,
    updatedAt: store.updatedAt || new Date().toISOString(),
  }, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(authPath, 0o600).catch(() => {});
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (err) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

function selectOAuthProfile(store) {
  const profiles = store.profiles || {};
  if (store.selectedProfileId && isOAuthProfile(profiles[store.selectedProfileId])) {
    return { profileId: store.selectedProfileId, profile: profiles[store.selectedProfileId] };
  }
  const entry = Object.entries(profiles).find(([, profile]) => isOAuthProfile(profile));
  return entry ? { profileId: entry[0], profile: entry[1] } : null;
}

function normalizeOAuthProfile(profile) {
  const payload = decodeJwtPayload(profile.access);
  return {
    type: "oauth",
    provider: "openai",
    access: String(profile.access || ""),
    refresh: String(profile.refresh || ""),
    expires: Number(profile.expires || 0) || null,
    email: profile.email || payload?.email || null,
    accountId: profile.accountId || resolveStableSubject(payload) || null,
    importedFrom: profile.importedFrom || null,
    importedAt: profile.importedAt || null,
    refreshedAt: profile.refreshedAt || null,
  };
}

function isOAuthProfile(profile) {
  return profile?.type === "oauth" &&
    ["openai", "openai-codex"].includes(String(profile.provider || "").toLowerCase()) &&
    Boolean(profile.access || profile.refresh);
}

function identityFromProfile(profile) {
  return safeProfileIdentity(profile.email || profile.accountId || "");
}

function identityFromProfileId(profileId) {
  const suffix = String(profileId || "").split(":").pop();
  return safeProfileIdentity(suffix || "");
}

function safeProfileIdentity(value) {
  return String(value || "")
    .trim()
    .replace(/[^\w.@-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function defaultOpenClawAuthProfilesPath() {
  return resolve(homedir(), ".openclaw", "agents", "main", "agent", "auth-profiles.json");
}

function defaultOpenClawAuthSqlitePath() {
  return resolve(homedir(), ".openclaw", "agents", "main", "agent", "openclaw-agent.sqlite");
}

async function readOpenClawSqliteAuthStore(sqlitePath) {
  const stdout = await runOptionalProcess("sqlite3", [
    "-json",
    sqlitePath,
    "SELECT store_json FROM auth_profile_store WHERE store_key='primary';",
  ]);
  if (!stdout) return null;
  const rows = parseJson(stdout);
  const rawStore = Array.isArray(rows) ? rows[0]?.store_json : null;
  if (!rawStore) return null;
  const source = parseJson(rawStore);
  return source ? { sourcePath: sqlitePath, source } : null;
}

function runOptionalProcess(command, args) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.on("error", () => resolveRun(""));
    child.on("exit", (exitCode) => {
      resolveRun(exitCode === 0 ? stdout : "");
    });
  });
}

function chooseBestProfileId(store, profileIds) {
  return profileIds
    .map((profileId) => ({
      profileId,
      expires: Number(store.profiles?.[profileId]?.expires || 0),
    }))
    .sort((a, b) => b.expires - a.expires)[0]?.profileId || null;
}

function decodeJwtPayload(token) {
  const segment = String(token || "").split(".")[1];
  if (!segment) return null;
  try {
    return JSON.parse(Buffer.from(fromBase64Url(segment), "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function resolveStableSubject(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (typeof payload["https://api.openai.com/auth"] === "object") {
    const auth = payload["https://api.openai.com/auth"];
    if (typeof auth.user_id === "string") return auth.user_id;
    if (typeof auth.account_id === "string") return auth.account_id;
  }
  return typeof payload.sub === "string" ? payload.sub : null;
}

function base64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const text = String(value || "").replaceAll("-", "+").replaceAll("_", "/");
  return `${text}${"=".repeat((4 - (text.length % 4)) % 4)}`;
}

async function readInputImages(referenceImages) {
  const paths = Array.isArray(referenceImages)
    ? referenceImages.map((item) => item?.path).filter(Boolean).slice(0, 5)
    : [];
  return Promise.all(paths.map(async (filePath, index) => {
    const buffer = await readFile(filePath);
    const mimeType = detectImageMimeType(buffer);
    if (!mimeType) {
      throw new Error(`Reference image ${index + 1} is not a supported PNG/JPEG/WebP file.`);
    }
    return {
      buffer,
      mimeType,
      fileName: basename(filePath),
    };
  }));
}

function toDataUrl(image) {
  return `data:${image.mimeType};base64,${image.buffer.toString("base64")}`;
}

async function inspectImageFile(filePath) {
  const [fileStat, bytes] = await Promise.all([stat(filePath), readFile(filePath)]);
  if (!fileStat.isFile() || fileStat.size <= 0) {
    throw new Error("Generated image file is empty or not a file.");
  }
  const mimeType = detectImageMimeType(bytes);
  if (!mimeType) {
    throw new Error("Generated file is not a supported image type.");
  }
  return { bytes: fileStat.size, mimeType };
}

function detectImageMimeType(bytes) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes.slice(0, 4).toString("ascii") === "RIFF" &&
    bytes.slice(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return "";
}

function outputFormatFor(mimeType, outputPath) {
  const text = String(mimeType || "").toLowerCase();
  const path = String(outputPath || "").toLowerCase();
  if (text === "image/jpeg" || /\.jpe?g$/.test(path)) return "jpeg";
  if (text === "image/webp" || /\.webp$/.test(path)) return "webp";
  return "png";
}

function mimeTypeForOutputFormat(format) {
  if (format === "jpeg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  return "image/png";
}

function normalizeImageModel(value) {
  const text = String(value || defaultImageModel).trim();
  return text.includes("/") ? text.split("/").pop() : text;
}

function normalizeImageSize(value) {
  const text = String(value || "").trim();
  return /^\d+x\d+$/i.test(text) ? text.toLowerCase() : "1024x1024";
}

function normalizeBaseUrl(value) {
  return String(value || defaultCodexResponsesBaseUrl).replace(/\/+$/g, "");
}

function readPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonEmpty(value) {
  const text = String(value || "").trim();
  return text || "";
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readStdin(stdin) {
  return new Promise((resolveRead, rejectRead) => {
    let text = "";
    stdin.setEncoding("utf8");
    stdin.on("data", (chunk) => {
      text += chunk;
    });
    stdin.on("end", () => resolveRead(text));
    stdin.on("error", rejectRead);
  });
}

function wait(ms) {
  return new Promise((resolveWait) => {
    setTimeout(resolveWait, ms);
  });
}
