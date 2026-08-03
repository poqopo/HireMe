#!/usr/bin/env node

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { createModelProvider } from "../apps/agent/src/providers.mjs";
import { createAiProviderService, readOllamaModels } from "../apps/desktop/aiProviders.mjs";
import { createOpenAICodexProviderAdapter } from "../apps/desktop/providerAdapters.mjs";

const tempRoot = resolve(".hireme/tmp/desktop-ai-settings-smoke");
const userId = randomUUID();
const secondUserId = randomUUID();
await rm(tempRoot, { recursive: true, force: true });

const user = {
  id: userId,
  defaultProvider: "codex",
  defaultModel: null,
  aiSetupCompleted: false,
};
const ollamaFetch = async (url) => {
  assert.equal(url, "http://127.0.0.1:11434/api/tags");
  await delay(80);
  return new Response(JSON.stringify({
    models: [
      { name: "qwen3:8b", size: 5_000_000_000 },
      { name: "gemma3:4b", size: 3_000_000_000 },
    ],
  }), { status: 200, headers: { "content-type": "application/json" } });
};

try {
  const openedUrls = [];
  const changes = [];
  const service = createAiProviderService({
    userDataDir: tempRoot,
    fetchImpl: ollamaFetch,
    openAICodexAdapter: fixtureOpenAICodexAdapter({ openedUrls }),
    imageBridgeCommand: process.execPath,
    imageBridgeArgs: ["image-bridge-fixture.mjs"],
    onStateChange: (state) => changes.push(state),
  });

  const initial = await service.getSettings({ user });
  assert.equal(initial.schema, "hireme.desktop.ai_settings.v1");
  assert.equal(initial.codex.installed, true);
  assert.equal(initial.codex.connected, false);
  assert.equal(initial.ollama.available, true);
  assert.deepEqual(initial.ollama.models.map((model) => model.id), ["qwen3:8b", "gemma3:4b"]);

  const connected = await service.connectCodex({ user });
  assert.equal(connected.codex.connected, true);
  assert.ok(changes.some((state) => state.codex.connecting));
  assert.equal(openedUrls.length, 1);

  const authPath = join(tempRoot, "providers", userId, "codex", "hireme-image-auth.json");
  const auth = JSON.parse(await readFile(authPath, "utf8"));
  assert.equal(auth.profiles[auth.selectedProfileId].provider, "openai");
  assert.equal(auth.profiles[auth.selectedProfileId].refresh, "fixture-refresh-token");

  const codexSelection = await service.saveDeviceSettings({ user, provider: "codex" });
  assert.deepEqual(codexSelection, { provider: "codex", model: null });
  const codexRuntime = await service.resolveRuntime({
    user: { ...user, aiSetupCompleted: true },
  });
  assert.equal(codexRuntime.provider, "openai-codex");
  assert.equal(codexRuntime.env.OPENAI_API_KEY, "");
  assert.equal(codexRuntime.env.HIREME_OPENAI_CODEX_AUTH_PATH, authPath);
  assert.equal(codexRuntime.env.HIREME_CODEX_IMAGE_GEN_COMMAND, process.execPath);
  assert.equal("HIREME_CODEX_COMMAND" in codexRuntime.env, false);
  assert.equal("CODEX_HOME" in codexRuntime.env, false);

  await verifyNativeTextTransport(codexRuntime);

  const localSelection = await service.saveDeviceSettings({
    user,
    provider: "ollama",
    model: "gemma3:4b",
  });
  assert.deepEqual(localSelection, { provider: "ollama", model: "gemma3:4b" });
  const localRuntime = await service.resolveRuntime({
    user: {
      ...user,
      defaultProvider: "ollama",
      defaultModel: "gemma3:4b",
      aiSetupCompleted: true,
    },
  });
  assert.equal(localRuntime.provider, "ollama");
  assert.equal(localRuntime.model, "gemma3:4b");
  assert.equal(localRuntime.env.OLLAMA_API_KEY, "");
  assert.equal(localRuntime.env.HIREME_OLLAMA_BASE_URL, "http://127.0.0.1:11434");

  const deviceSettings = await readFile(join(tempRoot, "ai-settings.json"), "utf8");
  assert.ok(!deviceSettings.includes("fixture-refresh-token"));
  assert.ok(!deviceSettings.includes("access_token"));
  assert.match(deviceSettings, /gemma3:4b/);

  const secondUser = { ...user, id: secondUserId };
  const isolated = await service.getSettings({ user: secondUser });
  assert.equal(isolated.codex.connected, false);

  const disconnected = await service.disconnectCodex({ user });
  assert.equal(disconnected.codex.connected, false);
  await assert.rejects(() => readFile(authPath, "utf8"), { code: "ENOENT" });
  service.destroy();

  await assert.rejects(
    () => readOllamaModels("https://example.com:11434", { fetchImpl: ollamaFetch }),
    /로컬 주소/,
  );

  const cancelService = createAiProviderService({
    userDataDir: join(tempRoot, "cancel"),
    fetchImpl: async () => new Response(JSON.stringify({ models: [] }), { status: 200 }),
    openAICodexAdapter: fixtureOpenAICodexAdapter({ loginDelayMs: 3000 }),
  });
  const cancelUser = { ...user, id: randomUUID() };
  const loginPromise = cancelService.connectCodex({ user: cancelUser });
  await delay(100);
  assert.equal(await cancelService.cancelConnection({ user: cancelUser }), true);
  await assert.rejects(loginPromise, /취소/);
  cancelService.destroy();

  console.log("Desktop AI settings smoke passed");
  console.log("Verified: UUID-isolated native OAuth -> native text/image runtime -> local Ollama -> disconnect/cancel");
} finally {
  await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
}

function fixtureOpenAICodexAdapter({ openedUrls = [], loginDelayMs = 0 } = {}) {
  return createOpenAICodexProviderAdapter({
    openExternal: async (url) => openedUrls.push(url),
    getAuthStatus: async ({ authPath }) => {
      const store = await readJson(authPath);
      return { configured: Boolean(store?.profiles?.[store.selectedProfileId]) };
    },
    login: async ({ authPath, onAuth, signal }) => {
      await onAuth?.({ url: "https://auth.openai.com/fixture", redirectUri: "http://localhost/fixture" });
      await abortableDelay(loginDelayMs, signal);
      await mkdir(dirname(authPath), { recursive: true });
      await writeFile(authPath, `${JSON.stringify({
        version: 1,
        selectedProfileId: "openai:fixture@example.com",
        profiles: {
          "openai:fixture@example.com": {
            type: "oauth",
            provider: "openai",
            access: fixtureJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }),
            refresh: "fixture-refresh-token",
            expires: Date.now() + 3600_000,
            email: "fixture@example.com",
            accountId: "account-fixture",
          },
        },
      }, null, 2)}\n`, { mode: 0o600 });
    },
    logout: async ({ authPath }) => rm(authPath, { force: true }),
  });
}

async function verifyNativeTextTransport(runtime) {
  const server = createServer(async (request, response) => {
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/responses");
    assert.match(String(request.headers.authorization), /^Bearer /);
    const body = JSON.parse(await readRequest(request));
    assert.equal(body.stream, true);
    assert.equal(body.store, false);
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(`data: ${JSON.stringify({
      type: "response.completed",
      response: {
        output: [{ type: "message", content: [{ type: "output_text", text: "native-provider-fixture-ok" }] }],
      },
    })}\n\ndata: [DONE]\n\n`);
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  const previous = {
    authPath: process.env.HIREME_OPENAI_CODEX_AUTH_PATH,
    baseUrl: process.env.HIREME_OPENAI_CODEX_RESPONSES_BASE_URL,
  };
  process.env.HIREME_OPENAI_CODEX_AUTH_PATH = runtime.env.HIREME_OPENAI_CODEX_AUTH_PATH;
  process.env.HIREME_OPENAI_CODEX_RESPONSES_BASE_URL = `http://127.0.0.1:${address.port}`;
  try {
    const provider = createModelProvider({ provider: runtime.provider });
    assert.equal(provider.provider, "openai-codex");
    assert.equal(await provider.complete({
      instructions: "Return the fixture response.",
      input: { task: "Verify native transport." },
    }), "native-provider-fixture-ok");
  } finally {
    restoreEnv("HIREME_OPENAI_CODEX_AUTH_PATH", previous.authPath);
    restoreEnv("HIREME_OPENAI_CODEX_RESPONSES_BASE_URL", previous.baseUrl);
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function fixtureJwt(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.fixture`;
}

function abortableDelay(ms, signal) {
  if (signal?.aborted) return Promise.reject(signal.reason);
  return new Promise((resolveDelay, rejectDelay) => {
    const timer = setTimeout(resolveDelay, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      rejectDelay(signal.reason);
    }, { once: true });
  });
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function readRequest(request) {
  return new Promise((resolveRead, rejectRead) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => resolveRead(body));
    request.on("error", rejectRead);
  });
}

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
