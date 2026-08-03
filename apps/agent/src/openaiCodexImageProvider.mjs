import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile, chmod } from "node:fs/promises";
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
const defaultTimeoutMs = 600_000;
const defaultTextTimeoutMs = 180_000;
const defaultLoginTimeoutMs = 10 * 60_000;
const maxSseBytes = 64 * 1024 * 1024;
const maxSseEvents = 8192;
const maxImageBase64Chars = 64 * 1024 * 1024;
const refreshMarginMs = 60_000;
const fallbackRateLimitCooldownMs = 60_000;
const slowDownCooldownMs = 15 * 60_000;
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
  signal,
  timeoutMs = defaultLoginTimeoutMs,
} = {}) {
  if (signal?.aborted) throw signal.reason || new Error("OpenAI account connection was cancelled.");
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

    code = await waitForAuthorizationCode({
      server,
      manualCodeProvider,
      flow,
      signal,
      timeoutMs,
    });
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

async function waitForAuthorizationCode({ server, manualCodeProvider, flow, signal, timeoutMs }) {
  let timeout;
  let abortListener;
  const candidates = [server.waitForCode().then((value) => value?.code || "")];
  if (manualCodeProvider) {
    candidates.push(manualCodeProvider({ url: flow.url, state: flow.state }).then((value) => (
      parseAuthorizationInput(value, flow.state)
    )));
  }
  if (signal) {
    candidates.push(new Promise((_, reject) => {
      abortListener = () => reject(
        signal.reason || new Error("OpenAI account connection was cancelled."),
      );
      signal.addEventListener("abort", abortListener, { once: true });
    }));
  }
  candidates.push(new Promise((_, reject) => {
    timeout = setTimeout(() => reject(Object.assign(
      new Error("OpenAI account connection timed out."),
      { code: "openai_codex_oauth_timeout" },
    )), timeoutMs);
  }));
  try {
    return await Promise.race(candidates);
  } finally {
    clearTimeout(timeout);
    if (abortListener) signal?.removeEventListener?.("abort", abortListener);
  }
}

export async function logoutOpenAICodex({ authPath = openAICodexAuthPath() } = {}) {
  await rm(authPath, { force: true });
  await rm(imageRateLimitStatePath(authPath), { force: true });
}

export async function completeOpenAICodexResponse({
  instructions,
  input,
  model = process.env.HIREME_OPENAI_CODEX_RESPONSES_MODEL || defaultResponsesModel,
  authPath = openAICodexAuthPath(),
  timeoutMs = readPositiveInteger(
    process.env.HIREME_OPENAI_CODEX_TEXT_TIMEOUT_MS,
    defaultTextTimeoutMs,
  ),
  signal,
} = {}) {
  if (!String(instructions || "").trim()) {
    throw new Error("OpenAI Codex instructions are required.");
  }
  const accessToken = await resolveAccessToken({
    authPath,
    timeoutMs: Math.min(timeoutMs, 30_000),
  });
  const body = {
    model,
    instructions: String(instructions),
    input: [{
      role: "user",
      content: [{
        type: "input_text",
        text: typeof input === "string" ? input : JSON.stringify(input ?? {}, null, 2),
      }],
    }],
    stream: true,
    store: false,
  };
  const responseBody = await postCodexResponses({
    accessToken,
    body,
    timeoutMs,
    signal,
    operation: "text",
  });
  return extractCodexTextResult(responseBody);
}

export async function runOpenAICodexImageBridgeStdio({
  stdin = process.stdin,
  stdout = process.stdout,
} = {}) {
  try {
    const request = JSON.parse(await readStdin(stdin));
    const result = await generateOpenAICodexImageFromRequest(request);
    stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    stdout.write(`${JSON.stringify({
      status: "failed",
      error: error?.message || String(error),
      code: error?.code || "openai_codex_image_failed",
      httpStatus: Number(error?.status || 0) || null,
      retryAfterMs: Number(error?.retryAfterMs || 0) || null,
    })}\n`);
  }
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

  const timeoutMs = readPositiveInteger(
    process.env.HIREME_OPENAI_CODEX_IMAGE_TIMEOUT_MS,
    readPositiveInteger(request.timeoutMs, defaultTimeoutMs),
  );
  await assertImageRateLimitIsReady(authPath);
  const accessToken = await resolveAccessToken({
    authPath,
    timeoutMs: Math.min(timeoutMs, 30_000),
  });
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
  let responseBody;
  try {
    responseBody = await postCodexResponses({
      accessToken,
      body,
      timeoutMs,
    });
  } catch (error) {
    const cooldown = imageCooldownForError(error);
    if (!cooldown) throw error;

    await writeImageRateLimitState(authPath, {
      cooldownMs: cooldown,
      reason: error.code,
      status: error.status,
    });
    throw Object.assign(
      new Error(`OpenAI image generation is temporarily rate limited. Try again in ${formatDuration(cooldown)}.`),
      {
        code: error.code,
        status: error.status,
        retryAfterMs: cooldown,
      },
    );
  }
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

async function resolveAccessToken({ authPath, timeoutMs = 30_000 }) {
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

  const refreshed = await refreshOAuthProfile(profile, { timeoutMs });
  store.profiles[profileId] = normalizeOAuthProfile({
    ...profile,
    ...refreshed,
    refreshedAt: new Date().toISOString(),
  });
  store.updatedAt = new Date().toISOString();
  await writeAuthStore(store, authPath);
  return store.profiles[profileId].access;
}

async function postCodexResponses({ accessToken, body, timeoutMs, signal, operation = "image" }) {
  const baseUrl = normalizeBaseUrl(
    process.env.HIREME_OPENAI_CODEX_RESPONSES_BASE_URL ||
      defaultCodexResponsesBaseUrl,
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromSignal = () => controller.abort(signal?.reason);
  signal?.addEventListener?.("abort", abortFromSignal, { once: true });
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
      const label = operation === "image" ? "image generation" : "text request";
      const error = new Error(`OpenAI Codex ${label} failed (${response.status}): ${text.slice(0, 1000)}`);
      error.status = response.status;
      error.retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      error.responseText = text;
      const codePrefix = operation === "image" ? "openai_codex_image" : "openai_codex_text";
      error.code = response.status === 429
        ? `${codePrefix}_rate_limited`
        : response.status === 503 && isSlowDownResponse(text)
          ? `${codePrefix}_slow_down`
          : `${codePrefix}_http_error`;
      throw error;
    }
    return text;
  } catch (error) {
    if (error?.name === "AbortError") {
      if (signal?.aborted) {
        throw signal.reason || Object.assign(new Error("OpenAI Codex request was cancelled."), {
          name: "AbortError",
          code: "ABORT_ERR",
        });
      }
      const label = operation === "image" ? "image generation" : "text request";
      throw Object.assign(
        new Error(`OpenAI Codex ${label} timed out after ${timeoutMs}ms.`),
        { code: operation === "image" ? "openai_codex_image_timeout" : "openai_codex_text_timeout" },
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener?.("abort", abortFromSignal);
  }
}

function extractCodexTextResult(body) {
  const events = parseSseEvents(body);
  const failure = events.find((event) => event.type === "response.failed" || event.type === "error");
  if (failure) {
    const message = failure.error?.message || failure.response?.error?.message || failure.message;
    throw Object.assign(new Error(message || "OpenAI Codex text request failed."), {
      code: "openai_codex_text_failed",
    });
  }

  const completed = events.findLast?.((event) => event.type === "response.completed") ||
    [...events].reverse().find((event) => event.type === "response.completed");
  const completedText = textFromResponse(completed?.response);
  if (completedText) return completedText;

  const doneText = [...events].reverse().find((event) => (
    event.type === "response.output_text.done" && typeof event.text === "string"
  ))?.text;
  if (doneText?.trim()) return doneText.trim();

  const deltaText = events
    .filter((event) => event.type === "response.output_text.delta" && typeof event.delta === "string")
    .map((event) => event.delta)
    .join("")
    .trim();
  if (deltaText) return deltaText;
  throw new Error("OpenAI Codex text request completed without output text.");
}

function textFromResponse(response) {
  const parts = [];
  for (const item of Array.isArray(response?.output) ? response.output : []) {
    if (item?.type !== "message") continue;
    for (const content of Array.isArray(item.content) ? item.content : []) {
      if ((content?.type === "output_text" || content?.type === "text") && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n").trim();
}

function imageRateLimitStatePath(authPath) {
  return resolve(dirname(authPath), "hireme-image-rate-limit.json");
}

async function assertImageRateLimitIsReady(authPath) {
  const state = await readJsonIfExists(imageRateLimitStatePath(authPath));
  const cooldownUntil = Number(state?.cooldownUntil || 0);
  const remainingMs = cooldownUntil - Date.now();
  if (remainingMs <= 0) return;

  throw Object.assign(
    new Error(`OpenAI image generation is temporarily rate limited. Try again in ${formatDuration(remainingMs)}.`),
    {
      code: state?.reason || "openai_codex_image_rate_limited",
      status: state?.status || 429,
      retryAfterMs: remainingMs,
    },
  );
}

async function writeImageRateLimitState(authPath, { cooldownMs, reason, status }) {
  const statePath = imageRateLimitStatePath(authPath);
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify({
    version: 1,
    cooldownUntil: Date.now() + cooldownMs,
    reason,
    status,
    updatedAt: new Date().toISOString(),
  }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await chmod(statePath, 0o600).catch(() => {});
}

function imageCooldownForError(error) {
  if (error?.status === 429 && !isQuotaError(error.responseText)) {
    // Retry-After is authoritative when present. Otherwise, avoid an immediate
    // repeat request without inventing a long, fixed provider cooldown.
    return error.retryAfterMs || fallbackRateLimitCooldownMs;
  }
  if (error?.status === 503 && isSlowDownResponse(error.responseText)) {
    return error.retryAfterMs || slowDownCooldownMs;
  }
  return 0;
}

function parseRetryAfterMs(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  const seconds = Number(text);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const dateMs = Date.parse(text);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : 0;
}

function isQuotaError(value) {
  return /insufficient[_\s-]?quota|exceeded (?:your )?(?:quota|credits)|billing/i.test(
    String(value || ""),
  );
}

function isSlowDownResponse(value) {
  return /slow\s+down/i.test(String(value || ""));
}

function formatDuration(value) {
  const totalSeconds = Math.max(1, Math.ceil(Number(value || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (!minutes) return `${seconds}s`;
  if (!seconds) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
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
      throw new Error("OpenAI Codex response exceeded event limit.");
    }
  }
  return events;
}

async function readBoundedResponseText(response) {
  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxSseBytes) {
      throw new Error("OpenAI Codex response exceeded size limit.");
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
          throw new Error("OpenAI Codex response exceeded size limit.");
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

async function refreshOAuthProfile(profile, { timeoutMs = 30_000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: profile.refresh,
        client_id: clientId,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw Object.assign(new Error(`OpenAI Codex OAuth refresh timed out after ${timeoutMs}ms.`), {
        code: "openai_codex_oauth_refresh_timeout",
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI Codex token refresh failed (${response.status}): ${text}`);
  }
  const json = parseJson(text);
  if (!json?.access_token || !json?.expires_in) {
    throw new Error("OpenAI Codex token refresh response was missing required fields.");
  }
  return tokenResponseToProfile(json, profile.refresh);
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

function tokenResponseToProfile(json, fallbackRefresh = "") {
  const access = json.access_token;
  const payload = decodeJwtPayload(access);
  return {
    access,
    refresh: json.refresh_token || fallbackRefresh,
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
      res.end(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>HireMe 로그인 완료</title>
        <style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f4f1;color:#20221f;font:16px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.content{text-align:center}.mark{font-size:32px;margin-bottom:16px}h1{font-size:22px;margin:0 0 10px}p{color:#686b66;margin:0 0 24px}button{border:0;border-radius:6px;background:#177a62;color:white;font:inherit;padding:11px 22px;cursor:pointer}</style>
      </head><body><main class="content"><div class="mark">HireMe</div><h1>로그인이 완료되었습니다</h1><p>이 창을 닫고 HireMe에서 계속하세요.</p><button type="button" onclick="window.close()">확인</button></main></body></html>`);
      settleWait?.({ code });
    } catch {
      res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h1>Internal OAuth callback error.</h1>");
    }
  });

  return new Promise((resolveStart, rejectStart) => {
    server
      .listen(callbackPort, callbackHost, () => {
        listening = true;
        resolveStart({
          listening,
          waitForCode: () => waitForCodePromise,
          close: () => closeServer(server),
        });
      })
      .once("error", (error) => {
        settleWait?.(null);
        rejectStart(Object.assign(
          new Error("ChatGPT 로그인 콜백을 열지 못했습니다. 잠시 후 다시 시도해 주세요."),
          { code: "openai_codex_oauth_callback_unavailable", cause: error },
        ));
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
