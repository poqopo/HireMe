#!/usr/bin/env node

import assert from "node:assert/strict";
import { createDesktopDataService } from "../apps/desktop/data.mjs";
import { stableManagementIpcError } from "../apps/desktop/managementIpcError.mjs";
import {
  createProcessExitError,
  createRunTerminationError,
  readRunErrorCode,
  stableRunIpcError,
} from "../apps/desktop/runIpcError.mjs";
import { expectedRendererDocumentUrl, isTrustedRendererContext, isTrustedRendererDocument } from "../apps/desktop/rendererTrust.mjs";
import { createActiveRunRegistry } from "../apps/desktop/runLifecycle.mjs";

const rendererFilePath = "/tmp/hireme/apps/web/dist/index.html";
const packagedUrl = expectedRendererDocumentUrl({
  isPackaged: true,
  devServerUrl: "http://127.0.0.1:5173/",
  rendererFilePath,
});

assert.equal(packagedUrl, "file:///tmp/hireme/apps/web/dist/index.html");
assert.equal(isTrustedRendererDocument({
  currentUrl: packagedUrl,
  isPackaged: true,
  devServerUrl: "http://127.0.0.1:5173/",
  rendererFilePath,
}), true);
assert.equal(isTrustedRendererDocument({
  currentUrl: "file:///tmp/hireme/apps/web/dist/other.html",
  isPackaged: true,
  rendererFilePath,
}), false);

const devUrl = "http://127.0.0.1:5173/";
assert.equal(isTrustedRendererContext({
  senderId: 7,
  trustedWebContentsId: 7,
  senderUrl: devUrl,
  isPackaged: false,
  devServerUrl: "http://127.0.0.1:5173",
  rendererFilePath,
}), true);
assert.equal(isTrustedRendererContext({
  senderId: 7,
  trustedWebContentsId: 7,
  senderUrl: "http://127.0.0.1:5173.evil.example/",
  isPackaged: false,
  devServerUrl: "http://127.0.0.1:5173",
  rendererFilePath,
}), false);
assert.equal(isTrustedRendererContext({
  senderId: 7,
  trustedWebContentsId: 7,
  senderUrl: "http://127.0.0.1:5173@evil.example/",
  isPackaged: false,
  devServerUrl: devUrl,
  rendererFilePath,
}), false);

const publicManagementError = stableManagementIpcError(Object.assign(
  new Error("관리 모드는 다시 열어야 합니다."),
  { code: "management_session_required" },
));
assert.equal(publicManagementError.message,
  "[management_session_required] 관리 모드는 다시 열어야 합니다.");

const cancelledRunError = stableRunIpcError(createRunTerminationError({
  signal: "SIGTERM",
  cancelReason: "renderer_cancelled",
}));
assert.equal(readRunErrorCode(cancelledRunError), "run_cancelled");
assert.match(cancelledRunError.message, /사용자가 작업을 중지했습니다/);

const interruptedRunError = stableRunIpcError(createRunTerminationError({
  signal: "SIGTERM",
}));
assert.equal(readRunErrorCode(interruptedRunError), "runtime_interrupted");

const providerRunError = createProcessExitError("Codex login is required.", 1);
assert.equal(readRunErrorCode(providerRunError), "provider_connection_required");
assert.equal(providerRunError.exitCode, 1);
assert.equal(isTrustedRendererContext({
  senderId: 8,
  trustedWebContentsId: 7,
  senderUrl: devUrl,
  isPackaged: false,
  devServerUrl: devUrl,
  rendererFilePath,
}), false);
assert.equal(isTrustedRendererContext({
  senderId: 7,
  trustedWebContentsId: 7,
  senderUrl: devUrl,
  isMainFrame: false,
  isPackaged: false,
  devServerUrl: devUrl,
  rendererFilePath,
}), false);

const timers = [];
const registry = createActiveRunRegistry({
  forceKillAfterMs: 1,
  setTimer: (callback) => {
    const timer = { callback, cleared: false, unref() {} };
    timers.push(timer);
    return timer;
  },
  clearTimer: (timer) => {
    timer.cleared = true;
  },
});
const authoringChild = createChild();
const workChild = createChild();
const authoringRun = registry.register("authoring-run", {
  child: authoringChild,
  mode: "agent_authoring",
  userId: "user-a",
  clientId: 7,
  conversationId: "conversation-a",
  managementSessionId: "management-a",
});
registry.register("work-run", {
  child: workChild,
  mode: "work",
  userId: "user-a",
  clientId: 7,
  conversationId: "conversation-a",
});

const cancelled = registry.cancelMatching((run) => (
  run.mode === "agent_authoring"
  && run.userId === "user-a"
  && run.clientId === 7
  && run.managementSessionId === "management-a"
), "management_closed");
assert.deepEqual(cancelled, [authoringRun]);
assert.deepEqual(authoringChild.signals, ["SIGTERM"]);
assert.deepEqual(workChild.signals, []);
timers[0].callback();
assert.deepEqual(authoringChild.signals, ["SIGTERM", "SIGKILL"]);

registry.release("authoring-run", authoringRun);
const replacementChild = createChild();
registry.register("authoring-run", { child: replacementChild, mode: "work" });
timers[0].callback();
assert.deepEqual(replacementChild.signals, []);

const ownershipRows = [
  { id: "11111111-1111-4111-8111-111111111111", creator_id: "owner-a", slug: "owned-agent" },
  { id: "22222222-2222-4222-8222-222222222222", creator_id: "owner-b", slug: "foreign-agent" },
];
const ownershipService = createDesktopDataService({
  getClient: () => createOwnershipClient(ownershipRows),
  getUser: () => ({ id: "owner-a" }),
});
assert.equal((await ownershipService.assertAgentOwnership({
  agentId: "owned-agent",
  databaseId: ownershipRows[0].id,
})).owned, true);
assert.equal((await ownershipService.assertAgentOwnership({
  agentId: "owned-agent",
})).owned, true);
await assert.rejects(
  ownershipService.assertAgentOwnership({
    agentId: "foreign-agent",
    databaseId: ownershipRows[1].id,
  }),
  (error) => error?.code === "agent_management_forbidden",
);
await assert.rejects(
  ownershipService.assertAgentOwnership({
    agentId: "foreign-agent",
    databaseId: ownershipRows[0].id,
  }),
  (error) => error?.code === "agent_management_forbidden",
);

process.stdout.write("Desktop renderer trust and run lifecycle smoke passed.\n");

function createChild() {
  return {
    signals: [],
    kill(signal) {
      this.signals.push(signal);
      return true;
    },
  };
}

function createOwnershipClient(rows) {
  return {
    from(table) {
      assert.equal(table, "agents");
      const filters = new Map();
      return {
        select() { return this; },
        eq(column, value) {
          filters.set(column, value);
          return this;
        },
        async maybeSingle() {
          const matches = rows.filter((row) => (
            [...filters].every(([column, value]) => row[column] === value)
          ));
          return { data: matches[0] || null, error: null };
        },
      };
    },
  };
}
