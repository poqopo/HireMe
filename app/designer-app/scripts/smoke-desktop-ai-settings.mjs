#!/usr/bin/env node

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createModelProvider } from "../../../hireme-agent/runtime/src/providers.mjs";
import {
  createAiProviderService,
  readOllamaModels,
} from "../electron/aiProviders.mjs";

const tempRoot = resolve(".hireme/tmp/desktop-ai-settings-smoke");
const fixturePath = resolve("scripts/fixtures/codex-login-fixture.mjs");
const execFixturePath = resolve("scripts/fixtures/codex-exec-fixture.mjs");
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
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 80));
  return new Response(JSON.stringify({
    models: [
      { name: "qwen3:8b", size: 5_000_000_000 },
      { name: "gemma3:4b", size: 3_000_000_000 },
    ],
  }), { status: 200, headers: { "content-type": "application/json" } });
};

try {
  const changes = [];
  const service = createAiProviderService({
    userDataDir: tempRoot,
    fetchImpl: ollamaFetch,
    codexCommandResolver: async () => ({ command: process.execPath, args: [fixturePath] }),
    imageBridgeCommand: process.execPath,
    imageBridgeArgs: ["image-bridge-fixture.mjs"],
    onStateChange: (state) => changes.push(state),
    commandTimeoutMs: 5000,
    loginTimeoutMs: 5000,
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

  const imageAuthPath = join(tempRoot, "providers", userId, "codex", "hireme-image-auth.json");
  await rm(imageAuthPath, { force: true });
  const repaired = await service.getSettings({ user });
  assert.equal(repaired.codex.connected, true);
  assert.equal(JSON.parse(await readFile(imageAuthPath, "utf8")).selectedProfileId, "openai:fixture@example.com");

  const codexSelection = await service.saveDeviceSettings({ user, provider: "codex" });
  assert.deepEqual(codexSelection, { provider: "codex", model: null });
  const codexRuntime = await service.resolveRuntime({
    user: { ...user, aiSetupCompleted: true },
  });
  assert.equal(codexRuntime.provider, "codex");
  assert.equal(codexRuntime.env.HIREME_CODEX_COMMAND, process.execPath);
  assert.equal(codexRuntime.env.OPENAI_API_KEY, "");
  assert.match(codexRuntime.env.CODEX_HOME, new RegExp(userId));
  assert.equal(codexRuntime.env.HIREME_CODEX_IMAGE_GEN_COMMAND, process.execPath);

  const imageAuth = JSON.parse(await readFile(codexRuntime.env.HIREME_OPENAI_CODEX_AUTH_PATH, "utf8"));
  assert.equal(imageAuth.profiles[imageAuth.selectedProfileId].provider, "openai");
  assert.equal(imageAuth.profiles[imageAuth.selectedProfileId].refresh, "fixture-refresh-token");

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
  assert.doesNotThrow(() => createModelProvider({
    provider: "ollama",
    model: "gemma3:4b",
    baseUrl: "http://127.0.0.1:11434",
    apiKey: "",
  }));

  const codexWrapperPath = join(tempRoot, "codex-exec-fixture");
  await writeFile(
    codexWrapperPath,
    `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(execFixturePath)} "$@"\n`,
    "utf8",
  );
  await chmod(codexWrapperPath, 0o700);
  const previousCodexCommand = process.env.HIREME_CODEX_COMMAND;
  process.env.HIREME_CODEX_COMMAND = codexWrapperPath;
  try {
    const nonGitWorkspace = join(tempRoot, "ordinary-non-git-workspace");
    await mkdir(nonGitWorkspace, { recursive: true });
    const codexProvider = createModelProvider({
      provider: "codex",
      workspaceDir: nonGitWorkspace,
    });
    const completion = await codexProvider.complete({
      instructions: "Return the fixture response.",
      input: { task: "Verify a non-Git workspace." },
    });
    assert.equal(completion, "codex-provider-fixture-ok");
  } finally {
    if (previousCodexCommand === undefined) delete process.env.HIREME_CODEX_COMMAND;
    else process.env.HIREME_CODEX_COMMAND = previousCodexCommand;
  }

  const deviceSettings = await readFile(join(tempRoot, "ai-settings.json"), "utf8");
  assert.ok(!deviceSettings.includes("fixture-refresh-token"));
  assert.ok(!deviceSettings.includes("access_token"));
  assert.match(deviceSettings, /gemma3:4b/);

  const secondUser = { ...user, id: secondUserId };
  const isolated = await service.getSettings({ user: secondUser });
  assert.equal(isolated.codex.connected, false);

  const disconnected = await service.disconnectCodex({ user });
  assert.equal(disconnected.codex.connected, false);
  service.destroy();

  await assert.rejects(
    () => readOllamaModels("https://example.com:11434", { fetchImpl: ollamaFetch }),
    /로컬 주소/,
  );

  const cancelService = createAiProviderService({
    userDataDir: join(tempRoot, "cancel"),
    env: { ...process.env, HIREME_FIXTURE_LOGIN_DELAY_MS: "3000" },
    fetchImpl: async () => new Response(JSON.stringify({ models: [] }), { status: 200 }),
    codexCommandResolver: async () => ({ command: process.execPath, args: [fixturePath] }),
    loginTimeoutMs: 5000,
  });
  const cancelUser = { ...user, id: randomUUID() };
  const loginPromise = cancelService.connectCodex({ user: cancelUser });
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  assert.equal(await cancelService.cancelConnection({ user: cancelUser }), true);
  await assert.rejects(loginPromise, /취소/);
  cancelService.destroy();

  console.log("Desktop AI settings smoke passed");
  console.log("Verified: UUID-isolated Codex OAuth -> image auth handoff -> local Ollama -> runtime routing -> disconnect/cancel");
} finally {
  await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}
