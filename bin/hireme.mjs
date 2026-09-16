#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  hiremeConfigPath,
  publicImageBridgeStatus,
  readHireMeConfig,
  resolveImageBridgeConfig,
  writeHireMeConfig,
} from "../apps/agent/src/hiremeConfig.mjs";
import {
  applyComposerKey,
  commitComposerHistory,
  composerRenderModel,
  createComposerState,
  extractResultArtifacts,
  formatContextPrompt,
  formatResumeNotice,
  friendlyToolLabel,
  renderArtifactBlocks,
  renderTerminalMarkdown,
  styleTerminal,
  terminalColorEnabled,
} from "../apps/agent/src/cliUi.mjs";
import { createAgentMemory } from "../apps/agent/src/memory.mjs";
import { extractManagementPolicyText } from "../apps/agent/src/managementModePolicy.mjs";
import {
  getOpenAICodexAuthStatus,
  importOpenClawOpenAICodexProfiles,
  loginOpenAICodex,
  openAICodexAuthPath,
} from "../apps/agent/src/openaiCodexImageProvider.mjs";
import { createModelProvider } from "../apps/agent/src/providers.mjs";
import {
  createStandaloneAgent,
  loadStandaloneAgentProfile,
} from "../apps/agent/src/runtime.mjs";
import { createDefaultTools } from "../apps/agent/src/tools.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFiles([resolve(process.cwd(), ".env"), resolve(process.cwd(), ".env.local"), resolve(repoRoot, ".env"), resolve(repoRoot, ".env.local")]);

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  printHelp();
  process.exit(0);
}

const subcommand = options._[0] || "";
const runtimeMode = normalizeRuntimeMode(options.runtimeMode);
const managementRuntimeToolNames = new Set([
  "hireme_list_local_specialist_agent_files",
  "hireme_update_local_specialist_agent_file",
  "hireme_get_agent_authoring_status",
  "hireme_read_agent_draft_file",
  "hireme_update_agent_draft_file",
  "hireme_create_agent_skill",
  "hireme_validate_agent_draft",
  "hireme_get_agent_bootstrap_memory_status",
  "hireme_add_agent_bootstrap_memory",
  "hireme_test_agent_draft",
  "hireme_evaluate_agent_draft",
]);
if (
  runtimeMode === "agent_authoring" &&
  !["agent", "agents"].includes(subcommand) &&
  !/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(String(options.authoringTargetAgentId || ""))
) {
  throw new Error("Agent authoring runtime mode requires --authoring-target-agent-id.");
}
if (["login", "logout", "doctor"].includes(subcommand)) {
  const passthrough = options._.slice(1);
  const command = subcommand === "doctor" ? ["doctor", ...passthrough] : [subcommand, ...passthrough];
  const code = await runCodexPassthrough(command);
  process.exit(code);
}
if (subcommand === "model" || subcommand === "models") {
  await handleModelCommand(options._.slice(1), options);
  process.exit(0);
}
if (subcommand === "image-bridge" || subcommand === "bridge") {
  await handleImageBridgeCommand(options._.slice(1), options);
  process.exit(0);
}

const workspaceDir = resolve(options.workspace || process.cwd());
const agentDir = resolve(options.agent || repoRoot, options.agent ? "" : "apps/agent/agents/hireme-operator");
const profile = await loadStandaloneAgentProfile(agentDir);
const stateDir = resolve(
  options.stateDir || workspaceDir,
  options.stateDir ? "" : `.hireme/standalone-agent/${profile.id}`,
);
const sessionId = options.session || `session_${new Date().toISOString().replace(/[:.]/g, "-")}`;
const transcriptPath = resolve(stateDir, "sessions", `${safeName(sessionId)}.jsonl`);
const hiremeConfig = await readHireMeConfig({ configPath: options.config });
const providerName = normalizeSavedProvider(options.provider || hiremeConfig.provider || chooseDefaultProvider());
let activeProvider = createModelProvider({
  provider: providerName,
  model: options.model || hiremeConfig.model,
  baseUrl: options.baseUrl,
  apiKey: options.apiKey,
  workspaceDir,
});
const memory = createAgentMemory({ stateDir });
let activeImageBridge = resolveImageBridgeConfig({
  config: hiremeConfig,
  cliOptions: options,
});
let tools = createRuntimeTools();
let activeAgent = createRuntimeAgent();
let activeAgentMention = null;
let mentionCatalogCache = null;
let activeFileMention = null;
let fileMentionCache = null;
let lastRetryRequest = null;
let lastRunActivity = null;
let activeTtySessionInput = null;
let currentRunControl = null;

if (subcommand === "marketplace" || subcommand === "market") {
  await handleMarketplaceCommand(options._.slice(1), options);
  process.exit(0);
}
if (subcommand === "agent" || subcommand === "agents") {
  await handleAgentCommand(options._.slice(1), options);
  process.exit(0);
}

const initialPrompt = options._.join(" ").trim();
if (initialPrompt && options.chat !== true) {
  const shortcutResult = await handlePrefixShortcut(initialPrompt, { turns: [], oneShot: true });
  if (shortcutResult === "handled") process.exit(0);
  const startedAt = Date.now();
  const result = await runTurn(initialPrompt, []);
  printAgentOutput(result, {
    json: options.json === true,
    timing: buildRunTiming(result, startedAt),
  });
  process.exit(0);
}

await runInteractiveSession(initialPrompt);

function createRuntimeTools({
  mode = runtimeMode,
  targetAgentId = options.authoringTargetAgentId,
  explicitAgentControl = ["agent", "agents"].includes(subcommand),
} = {}) {
  const authoringEnabled = explicitAgentControl || mode === "agent_authoring";
  const runtimeTools = createDefaultTools({
    workspaceDir,
    stateDir,
    modelProvider: activeProvider,
    allowShell: options.allowShell === true && explicitAgentControl,
    enableHireMeTools: options.noHiremeTools !== true,
    enableLocalSpecialistCreatorTools: authoringEnabled,
    enableAgentAuthoringTools: authoringEnabled,
    authoringTargetAgentId: mode === "agent_authoring" ? targetAgentId : null,
    runtimeMode: mode,
    imageArtifactOptions: activeImageBridge.imageArtifactOptions,
    marketplaceOptions: {
      currentUserId: options.userId,
    },
    localSpecialistOptions: {
      defaultConversationId: sessionId,
    },
    specialistMemoryOptions: {
      defaultConversationId: sessionId,
    },
    agentSourceLayerOptions: {
      defaultConversationId: sessionId,
    },
  });
  const configuredAllowlist = String(process.env.HIREME_TOOL_ALLOWLIST || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (configuredAllowlist.length) {
    const allowed = new Set(configuredAllowlist);
    const selected = runtimeTools.filter((tool) => allowed.has(tool.name));
    const available = new Set(runtimeTools.map((tool) => tool.name));
    const unknown = configuredAllowlist.filter((name) => !available.has(name));
    if (unknown.length) throw new Error(`Unknown HIREME_TOOL_ALLOWLIST entries: ${unknown.join(", ")}`);
    return selected;
  }
  if (mode !== "agent_authoring" || explicitAgentControl) return runtimeTools;
  return runtimeTools.filter((tool) => managementRuntimeToolNames.has(tool.name));
}

function createRuntimeAgent() {
  return createStandaloneAgent({
    profile,
    model: activeProvider,
    memory,
    tools,
    limits: {
      maxIterations: readInteger(options.maxIterations, 8),
      maxToolCalls: readInteger(options.maxToolCalls, 10),
    },
  });
}

async function runInteractiveSession(initialPrompt = "") {
  await mkdir(dirnameSafe(transcriptPath), { recursive: true });
  const priorTurns = await readTranscript(transcriptPath);
  const turns = [...priorTurns];
  printBanner({
    agentName: profile.name,
    provider: activeProvider.provider,
    model: activeProvider.model,
    sessionId,
    stateDir,
    imageBridge: activeImageBridge,
  });
  const resumeNotice = formatResumeNotice(priorTurns);
  if (resumeNotice && useTerminalUi()) {
    output.write(`  ${resumeNotice} · /context for active selections\n\n`);
  }
  await Promise.all([
    refreshMentionCatalogCache(),
    refreshFileMentionCache(),
  ]).catch(() => {});

  if (input.isTTY) {
    const ttyInput = createQueuedTtySessionInput({
      history: priorTurns
        .filter((turn) => turn.role === "user")
        .map((turn) => turn.text),
      onCancel: requestActiveRunCancel,
    });
    activeTtySessionInput = ttyInput;
    ttyInput.start();
    if (initialPrompt) ttyInput.enqueue(initialPrompt);
    try {
      while (true) {
        const line = String(await ttyInput.nextLine()).trim();
        if (!line) continue;
        ttyInput.setBusy(true);
        let shouldExit = false;
        try {
          if (line.startsWith("/")) {
            ttyInput.clearRendered();
            const commandResult = await handleCommand(line, { rl: ttyInput, turns });
            shouldExit = commandResult === "exit";
          } else if (line.startsWith("!") || line.startsWith("@")) {
            ttyInput.clearRendered();
            const shortcutResult = await handlePrefixShortcut(line, { turns });
            if (shortcutResult !== "handled") await handleUserMessage(line, turns);
          } else {
            await handleUserMessage(line, turns);
          }
        } catch (err) {
          printRunError(err, { elapsedMs: 0 });
        } finally {
          ttyInput.setBusy(false);
        }
        if (shouldExit) break;
      }
    } finally {
      ttyInput.close();
      activeTtySessionInput = null;
    }
    return;
  }

  const rl = createInterface({
    input,
    output,
    completer: completeInputLine,
  });
  try {
    if (initialPrompt) {
      const shortcutResult = await handlePrefixShortcut(initialPrompt, { turns });
      if (shortcutResult !== "handled") {
        await handleUserMessage(initialPrompt, turns);
      }
    }
    for await (const rawLine of rl) {
      const line = String(rawLine || "").trim();
      if (!line) continue;
      const commandResult = await handleCommand(line, { rl, turns });
      if (commandResult === "exit") break;
      if (commandResult === "handled") continue;
      const shortcutResult = await handlePrefixShortcut(line, { turns });
      if (shortcutResult === "handled") continue;
      await handleUserMessage(line, turns);
    }
  } finally {
    rl.close();
  }
}

async function handleCommand(line, { rl, turns }) {
  if (!line.startsWith("/")) return false;
  const [command, ...rest] = line.slice(1).split(/\s+/);
  switch (command.toLowerCase()) {
    case "exit":
    case "quit":
    case "q":
      output.write("bye\n");
      return "exit";
    case "help":
    case "?":
      printSessionHelp();
      return "handled";
    case "clear":
      turns.length = 0;
      output.write("session context cleared; durable memory remains.\n");
      return "handled";
    case "state":
      output.write(`${JSON.stringify({ stateDir, transcriptPath, sessionId }, null, 2)}\n`);
      return "handled";
    case "context":
    case "ctx":
      printActiveContext(turns);
      return "handled";
    case "logs":
    case "log":
      printLastRunLogs();
      return "handled";
    case "queue":
      output.write(formatQueueControlResult(line, {
        snapshot: () => rl?.queueSnapshot?.() || [],
        drop: (index) => rl?.dropQueued?.(index) || null,
        clear: () => rl?.clearQueue?.() || [],
      }));
      return "handled";
    case "drop":
      output.write(formatQueueControlResult(line, {
        snapshot: () => rl?.queueSnapshot?.() || [],
        drop: (index) => rl?.dropQueued?.(index) || null,
        clear: () => rl?.clearQueue?.() || [],
      }));
      return "handled";
    case "clear-queue":
    case "queue-clear":
      output.write(formatQueueControlResult(line, {
        snapshot: () => rl?.queueSnapshot?.() || [],
        drop: (index) => rl?.dropQueued?.(index) || null,
        clear: () => rl?.clearQueue?.() || [],
      }));
      return "handled";
    case "retry":
      if (!lastRetryRequest) {
        output.write("nothing to retry\n");
        return "handled";
      }
      await handleUserMessage(lastRetryRequest.text, turns, {
        agentMention: lastRetryRequest.agentMention,
        fileMention: lastRetryRequest.fileMention,
        rawText: lastRetryRequest.rawText,
        retry: true,
      });
      return "handled";
    case "provider":
      if (!input.isTTY || rest[0] === "show") {
        output.write(`${formatProviderModel(activeProvider)}\n`);
        return "handled";
      }
      await selectProviderAndModel(rl);
      return "handled";
    case "image-bridge":
    case "bridge":
      await handleImageBridgeCommand(rest, options, { interactive: true });
      return "handled";
    case "remember":
      await memory.remember([{ type: "note", text: rest.join(" "), tags: ["manual"] }]);
      output.write("remembered\n");
      return "handled";
    default:
      output.write(`unknown command: /${command}\n`);
      printSessionHelp();
      return "handled";
  }
}

function createQueuedTtySessionInput({ history = [], onCancel = null } = {}) {
  let commandHistory = [...history];
  let state = createComposerState({ history: commandHistory });
  let renderedCursorRow = 0;
  let hasRendered = false;
  let started = false;
  let closed = false;
  let busy = false;
  let busyStartedAt = null;
  let cancelRequested = false;
  let lastCtrlCAt = 0;
  let activityLines = [];
  let modal = null;
  const lineQueue = [];
  const lineWaiters = [];
  const wasRaw = Boolean(input.isRaw);
  let lineSerial = 0;

  const clearRendered = () => {
    if (!hasRendered) return;
    output.write("\r");
    if (renderedCursorRow > 0) output.write(`\x1b[${renderedCursorRow}A`);
    output.write("\x1b[J");
    hasRendered = false;
  };
  const promptForState = () => {
    if (modal) return modal.prompt;
    const queueCount = lineQueue.length;
    const status = busy
      ? [
          "running",
          busyStartedAt ? formatElapsed(Date.now() - busyStartedAt) : null,
          queueCount ? `${queueCount} queued` : "Enter queues",
          cancelRequested ? "cancelling" : "Esc cancel",
        ].filter(Boolean).join(" · ")
      : queueCount
        ? `${queueCount} queued`
        : null;
    return formatContextPrompt({
      agent: activeAgentMention,
      file: activeFileMention,
      columns: output.columns || 80,
      label: busy ? "queue" : "you",
      status,
    });
  };
  const render = () => {
    if (!started || closed) return;
    clearRendered();
    const suggestions = modal ? [] : suggestionItemsForLine(state.value);
    if (suggestions.length && state.suggestionIndex >= suggestions.length) {
      state = { ...state, suggestionIndex: 0 };
    }
    const activity = activityLines.length ? `${activityLines.join("\n")}\n` : "";
    const model = composerRenderModel({
      prompt: `${activity}${promptForState()}`,
      state,
      suggestions,
      columns: output.columns || 80,
    });
    output.write(model.text);
    const rowsUp = model.endRow - model.cursorRow;
    if (rowsUp > 0) output.write(`\x1b[${rowsUp}A`);
    output.write("\r");
    if (model.cursorColumn > 0) output.write(`\x1b[${model.cursorColumn}C`);
    renderedCursorRow = model.cursorRow;
    hasRendered = true;
  };
  const printAbove = (value) => {
    clearRendered();
    const text = String(value || "");
    if (text) output.write(text.endsWith("\n") ? text : `${text}\n`);
    render();
  };
  const deliverLine = (value) => {
    const entry = {
      id: ++lineSerial,
      value,
      queuedAt: Date.now(),
    };
    const waiter = lineWaiters.shift();
    if (waiter) {
      busy = true;
      busyStartedAt = Date.now();
      cancelRequested = false;
      waiter(entry.value);
    } else {
      lineQueue.push(entry);
    }
  };
  const submit = (value, { echo = true } = {}) => {
    const text = String(value || "");
    if (!text.trim()) {
      state = createComposerState({ history: commandHistory });
      render();
      return;
    }
    commandHistory = commitComposerHistory(commandHistory, text);
    const submittedPrompt = promptForState();
    clearRendered();
    if (echo) output.write(`${submittedPrompt}${text}\n`);

    if (modal) {
      const currentModal = modal;
      modal = null;
      state = currentModal.savedState;
      currentModal.resolve(text);
      return;
    }

    if (busy && isQueueControlCommand(text)) {
      state = createComposerState({ history: commandHistory });
      output.write(formatQueueControlResult(text, {
        snapshot: queueSnapshot,
        drop: dropQueued,
        clear: clearQueue,
      }));
      render();
      return;
    }

    state = createComposerState({ history: commandHistory });
    deliverLine(text);
    render();
  };
  const onKeypress = (str, key = {}) => {
    const name = String(key.name || "").toLowerCase();
    if (busy && !modal && (name === "escape" || name === "esc")) {
      cancelRequested = Boolean(onCancel?.("escape") ?? true);
      render();
      return;
    }
    if (key.ctrl && name === "c") {
      if (busy && !modal) {
        const now = Date.now();
        if (cancelRequested && now - lastCtrlCAt < 3000) {
          submit("/exit", { echo: false });
          return;
        }
        lastCtrlCAt = now;
        cancelRequested = Boolean(onCancel?.("ctrl_c") ?? true);
        render();
        return;
      }
      submit("/exit");
      return;
    }
    if (key.ctrl && key.name === "d" && !state.value) {
      submit("/exit");
      return;
    }
    const transition = applyComposerKey(state, {
      str,
      key,
      suggestions: modal ? [] : suggestionItemsForLine(state.value),
    });
    state = transition.state;
    if (transition.action === "submit") submit(state.value);
    else render();
  };
  const onResize = () => render();

  return {
    start() {
      if (started) return;
      started = true;
      emitKeypressEvents(input);
      input.setRawMode?.(true);
      input.resume();
      input.on("keypress", onKeypress);
      output.on?.("resize", onResize);
      render();
    },
    enqueue(value) {
      submit(value);
    },
    nextLine() {
      if (lineQueue.length) {
        const value = lineQueue.shift().value;
        render();
        return Promise.resolve(value);
      }
      return new Promise((resolveLine) => lineWaiters.push(resolveLine));
    },
    question(prompt) {
      if (modal) throw new Error("A terminal question is already active.");
      return new Promise((resolveQuestion) => {
        modal = {
          prompt: String(prompt || "> "),
          resolve: resolveQuestion,
          savedState: state,
        };
        state = createComposerState({ history: commandHistory });
        render();
      });
    },
    setBusy(value) {
      busy = value === true;
      busyStartedAt = busy ? Date.now() : null;
      if (!busy) {
        cancelRequested = false;
        lastCtrlCAt = 0;
      }
      render();
    },
    markCancelRequested() {
      cancelRequested = true;
      render();
    },
    setActivity(lines = []) {
      activityLines = Array.isArray(lines) ? lines.map(String) : [];
      render();
    },
    clearActivity() {
      activityLines = [];
      render();
    },
    clearRendered,
    render,
    printAbove,
    queuedCount() {
      return lineQueue.length;
    },
    queueSnapshot,
    dropQueued,
    clearQueue,
    close() {
      if (closed) return;
      closed = true;
      clearRendered();
      input.off("keypress", onKeypress);
      output.off?.("resize", onResize);
      input.setRawMode?.(wasRaw);
      input.pause();
      if (modal) modal.resolve("");
      for (const waiter of lineWaiters.splice(0)) waiter("/exit");
    },
  };

  function queueSnapshot() {
    return lineQueue.map((entry, index) => ({
      index: index + 1,
      id: entry.id,
      text: entry.value,
      queuedMs: Math.max(0, Date.now() - entry.queuedAt),
    }));
  }

  function dropQueued(index = 1) {
    const position = Math.max(1, Number(index) || 1) - 1;
    if (position < 0 || position >= lineQueue.length) return null;
    const [removed] = lineQueue.splice(position, 1);
    render();
    return removed ? {
      index: position + 1,
      id: removed.id,
      text: removed.value,
    } : null;
  }

  function clearQueue() {
    const removed = lineQueue.splice(0);
    render();
    return removed.map((entry, index) => ({
      index: index + 1,
      id: entry.id,
      text: entry.value,
    }));
  }
}

function isQueueControlCommand(line) {
  const text = String(line || "").trim().toLowerCase();
  return (
    text === "/queue" ||
    text.startsWith("/queue ") ||
    text === "/drop" ||
    text.startsWith("/drop ") ||
    text === "/clear-queue" ||
    text === "/queue-clear"
  );
}

function formatQueueControlResult(line, queue) {
  const text = String(line || "").trim();
  const [command, ...rest] = text.slice(1).split(/\s+/);
  const action = String(command || "").toLowerCase();
  const subcommand = String(rest[0] || "").toLowerCase();

  if (action === "clear-queue" || action === "queue-clear" || (action === "queue" && subcommand === "clear")) {
    const removed = queue.clear();
    return removed.length
      ? `cleared ${removed.length} queued request(s)\n`
      : "queue is already empty\n";
  }

  if (action === "drop" || (action === "queue" && subcommand === "drop")) {
    const index = action === "drop" ? rest[0] : rest[1];
    const removed = queue.drop(index || 1);
    return removed
      ? `dropped queued request #${removed.index}: ${summarizeQueueText(removed.text)}\n`
      : "no queued request at that index\n";
  }

  return formatQueueSnapshot(queue.snapshot());
}

function formatQueueSnapshot(entries = []) {
  if (!entries.length) return "queue is empty\n";
  return [
    "Queued requests:",
    ...entries.map((entry) =>
      `  ${entry.index}. ${summarizeQueueText(entry.text)} · waiting ${formatElapsed(entry.queuedMs)}`,
    ),
    "",
  ].join("\n");
}

function summarizeQueueText(value, maxChars = 90) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 3)).trim()}...`;
}

function suggestionItemsForLine(line) {
  const text = String(line || "");
  if (
    !text ||
    /\s/.test(text) ||
    (!text.startsWith("!") && !text.startsWith("@") && !text.startsWith("/"))
  ) {
    return [];
  }
  if (text.startsWith("!")) {
    if (normalizeMentionToken(text).length < 1) return [];
    const agents = filterAgentsForPrefix(text).slice(0, 8);
    return agents.map((agent) => ({
      kind: "agent",
      label: `${formatMentionHandle(agent)}  ${agent.name}`,
      insert: `${formatMentionHandle(agent)} `,
    }));
  }
  if (text.startsWith("/")) {
    const normalized = text.toLowerCase();
    return interactiveCommandCatalog()
      .filter((command) => command.command.startsWith(normalized))
      .slice(0, 10)
      .map((command) => ({
        kind: "command",
        label: `${command.command}  ${command.title}`,
        insert: `${command.command} `,
      }));
  }
  const files = filterFilesForPrefix(text).slice(0, 10);
  return files.map((file) => ({
    kind: "file",
    label: formatFileMentionHandle(file),
    insert: `${formatFileMentionHandle(file)} `,
  }));
}

function interactiveCommandCatalog() {
  return [
    { command: "/context", title: "Show active context" },
    { command: "/logs", title: "Show the latest run log" },
    { command: "/queue", title: "Show queued requests" },
    { command: "/drop", title: "Drop a queued request by index" },
    { command: "/clear-queue", title: "Clear queued requests" },
    { command: "/retry", title: "Retry the previous failed request" },
    { command: "/provider", title: "Select provider and model" },
    { command: "/image-bridge", title: "Manage the image provider" },
    { command: "/remember", title: "Store a durable note" },
    { command: "/clear", title: "Clear in-session conversation context" },
    { command: "/state", title: "Show state and transcript paths" },
    { command: "/help", title: "Show commands and shortcuts" },
    { command: "/exit", title: "Exit HireMe" },
  ];
}

function filterAgentsForPrefix(prefix) {
  const normalized = normalizeMentionToken(prefix);
  const catalog = mentionCatalogCache || { local: [], remote: [] };
  return [...catalog.local, ...catalog.remote].filter((agent) =>
    mentionAliases(agent).some((alias) =>
      normalizeMentionToken(alias).startsWith(normalized),
    ),
  );
}

function filterFilesForPrefix(prefix) {
  const normalized = normalizeFileMentionToken(prefix);
  const catalog = fileMentionCache || { files: [] };
  return catalog.files.filter((file) =>
    fileMentionAliases(file).some((alias) =>
      normalizeFileMentionToken(alias).startsWith(normalized),
    ),
  );
}

async function handlePrefixShortcut(line, { turns, oneShot = false } = {}) {
  const agentShortcut = await handleAgentShortcut(line, { turns, oneShot });
  if (agentShortcut === "handled") return "handled";
  const fileShortcut = await handleFileShortcut(line, { turns });
  if (fileShortcut === "handled") return "handled";
  return false;
}

async function handleAgentShortcut(line, { turns, oneShot = false } = {}) {
  const shortcut = parseAgentShortcut(line);
  if (!shortcut) return false;
  if (shortcut.action === "list") {
    await printAgentMentionList();
    return "handled";
  }
  if (shortcut.action === "clear") {
    activeAgentMention = null;
    output.write("cleared active !agent selection\n");
    return "handled";
  }

  const agent = await resolveMentionAgent(shortcut.token);
  if (!agent) {
    output.write(`unknown !agent: !${shortcut.token}\n`);
    await printAgentMentionList({ compact: true });
    return "handled";
  }

  activeAgentMention = agent;
  if (!shortcut.task) {
    printMentionAgentSelection(agent, { oneShot });
    return "handled";
  }

  await handleUserMessage(shortcut.task, turns || [], {
    agentMention: agent,
    rawText: line,
  });
  return "handled";
}

async function handleFileShortcut(line, { turns } = {}) {
  const shortcut = parseFileShortcut(line);
  if (!shortcut) return false;
  if (shortcut.action === "list") {
    await printFileMentionList();
    return "handled";
  }
  if (shortcut.action === "clear") {
    activeFileMention = null;
    output.write("cleared active @file selection\n");
    return "handled";
  }

  const file = await resolveMentionFile(shortcut.token);
  if (!file) {
    output.write(`unknown @file: @${shortcut.token}\n`);
    await printFileMentionList({ compact: true });
    return "handled";
  }

  activeFileMention = file;
  if (!shortcut.task) {
    printFileMentionSelection(file);
    return "handled";
  }

  await handleUserMessage(shortcut.task, turns || [], {
    fileMention: file,
    rawText: line,
  });
  return "handled";
}

async function handleUserMessage(
  text,
  turns,
  { agentMention, fileMention, rawText, retry = false } = {},
) {
  const startedAt = Date.now();
  const controller = new AbortController();
  let selectedMention = agentMention || activeAgentMention;
  const selectedFile = fileMention || activeFileMention;
  if (!selectedMention) {
    selectedMention = await maybeAutoRouteAgent(text);
  }
  const transcriptText = rawText || formatTranscriptUserText(text, {
    agent: selectedMention,
    file: selectedFile,
  });
  await appendTranscript({ role: "user", text: transcriptText });
  turns.push({ role: "user", text: transcriptText });
  if (retry && useTerminalUi()) output.write("retrying previous request\n");
  currentRunControl = {
    controller,
    startedAt,
    text,
    agentMention: selectedMention,
    fileMention: selectedFile,
    rawText,
    cancelRequested: false,
    cancelReason: null,
    cancelRequestedAt: null,
  };
  const thinking = startThinkingIndicator({ agent: selectedMention, startedAt });
  let result;
  let runError = null;
  let activitySummary = null;
  try {
    result = await runTurn(text, turns, {
      agentMention: selectedMention,
      fileMention: selectedFile,
      onEvent: thinking.onEvent,
      signal: controller.signal,
    });
    throwIfRunCancelled(controller.signal);
  } catch (err) {
    runError = err;
  } finally {
    activitySummary = thinking.stop({ failed: Boolean(runError) });
    lastRunActivity = activitySummary;
    if (currentRunControl?.controller === controller) {
      currentRunControl = null;
    }
  }
  if (isRunCancelled(runError)) {
    removeLastUserTurn(turns, transcriptText);
    if (activitySummary) activitySummary.cancelled = true;
    lastRetryRequest = {
      text,
      agentMention: selectedMention,
      fileMention: selectedFile,
      rawText,
    };
    await appendTranscript({
      role: "cancelled",
      text: transcriptText,
      elapsedMs: Date.now() - startedAt,
    });
    printRunCancelled({
      elapsedMs: Date.now() - startedAt,
      agent: selectedMention,
      activity: activitySummary,
    });
    return {
      status: "cancelled",
      error: "Run cancelled.",
    };
  }
  if (runError) {
    const errorText = publicCliErrorMessage(runError);
    lastRetryRequest = {
      text,
      agentMention: selectedMention,
      fileMention: selectedFile,
      rawText,
    };
    await appendTranscript({
      role: "error",
      text: errorText,
      elapsedMs: Date.now() - startedAt,
    });
    printRunError(runError, {
      elapsedMs: Date.now() - startedAt,
      agent: selectedMention,
      activity: activitySummary,
    });
    return {
      status: "failed",
      error: errorText,
    };
  }
  lastRetryRequest = null;
  turns.push({ role: "assistant", text: result.outputText });
  await appendTranscript({
    role: "assistant",
    text: result.outputText,
    runId: result.runId,
    provider: result.provider,
    model: result.model,
    elapsedMs: Date.now() - startedAt,
  });
  printAgentOutput(result, {
    json: options.json === true,
    timing: buildRunTiming(result, startedAt),
    agent: selectedMention,
    activity: activitySummary,
  });
  return result;
}

async function runTurn(text, turns, { agentMention, fileMention, onEvent, signal } = {}) {
  const goal = applyMentionsToGoal(text, {
    agent: agentMention,
    file: fileMention,
  });
  return activeAgent.run({
    goal,
    signal,
    onEvent,
    context: {
      workspaceDir,
      stateDir,
      sessionId,
      runtimeMode,
      managementPolicyText: extractManagementPolicyText(goal),
      authoringTargetAgentId:
        runtimeMode === "agent_authoring"
          ? String(options.authoringTargetAgentId || "").trim() || null
          : null,
      priorTurns: turns.slice(-12),
      agentMention: agentMention ? publicMentionContext(agentMention) : null,
      fileMention: fileMention ? publicFileMentionContext(fileMention) : null,
      cli: {
        command: "hireme",
        allowShell: options.allowShell === true,
        hireMeTools: options.noHiremeTools !== true,
        imageBridge: {
          configured: activeImageBridge.configured,
          source: activeImageBridge.source,
          command: activeImageBridge.command || null,
        },
        mentionSyntax:
          "! lists Agents; !<agent-id> selects an Agent; @ lists files; @<path> selects a file.",
      },
    },
  });
}

function requestActiveRunCancel(source = "user") {
  if (!currentRunControl) {
    writeInteractiveOutput("no active run to cancel\n");
    return false;
  }
  if (currentRunControl.controller.signal.aborted) {
    writeInteractiveOutput("cancellation is already in progress\n");
    return true;
  }
  currentRunControl.cancelRequested = true;
  currentRunControl.cancelReason = source;
  currentRunControl.cancelRequestedAt = Date.now();
  const err = createRunCancelledError(source);
  currentRunControl.controller.abort(err);
  activeTtySessionInput?.markCancelRequested?.();
  writeInteractiveOutput("cancelling current run; queued requests will continue after cleanup\n");
  return true;
}

function createRunCancelledError(reason = "user_cancelled") {
  const err = new Error("Run cancelled.");
  err.name = "AbortError";
  err.code = "run_cancelled";
  err.cancelled = true;
  err.reason = reason;
  return err;
}

function throwIfRunCancelled(signal) {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  throw createRunCancelledError(signal.reason || "user_cancelled");
}

function isRunCancelled(err) {
  return Boolean(
    err &&
      (
        err.cancelled === true ||
        err.code === "run_cancelled" ||
        err.name === "AbortError" ||
        /abort|cancel/i.test(String(err.message || ""))
      ),
  );
}

function removeLastUserTurn(turns, text) {
  if (!Array.isArray(turns) || !turns.length) return;
  const last = turns.at(-1);
  if (last?.role === "user" && last.text === text) {
    turns.pop();
  }
}

function parseAgentShortcut(line) {
  const text = String(line || "").trim();
  if (!text.startsWith("!")) return null;
  const rest = text.slice(1).trim();
  if (!rest || /^(?:\?|list|agents|agent|ls|목록|에이전트)$/i.test(rest)) {
    return { action: "list" };
  }
  const [token, ...taskParts] = rest.split(/\s+/);
  if (/^(?:clear|none|reset|off|해제|취소)$/i.test(token)) {
    return { action: "clear" };
  }
  return {
    action: "select",
    token,
    task: taskParts.join(" ").trim(),
  };
}

function parseFileShortcut(line) {
  const text = String(line || "").trim();
  if (!text.startsWith("@")) return null;
  const rest = text.slice(1).trim();
  if (!rest || /^(?:\?|list|files|file|ls|목록|파일)$/i.test(rest)) {
    return { action: "list" };
  }
  const [token, ...taskParts] = rest.split(/\s+/);
  if (/^(?:clear|none|reset|off|해제|취소)$/i.test(token)) {
    return { action: "clear" };
  }
  return {
    action: "select",
    token,
    task: taskParts.join(" ").trim(),
  };
}

async function refreshMentionCatalogCache() {
  mentionCatalogCache = await getMentionAgentCatalog();
  return mentionCatalogCache;
}

function completeInputLine(line) {
  const text = String(line || "");
  if ((!text.startsWith("!") && !text.startsWith("@")) || /\s/.test(text)) {
    return [[], text];
  }
  const handles = completionCandidatesForPrefix(text);
  const normalized = text.toLowerCase();
  const matches = handles.filter((handle) => handle.toLowerCase().startsWith(normalized));
  return [matches.length ? matches : handles, text];
}

function completionCandidatesForPrefix(text) {
  if (text.startsWith("!")) {
    const catalog = mentionCatalogCache || { local: [], remote: [] };
    return [...catalog.local, ...catalog.remote]
      .map((agent) => `${formatMentionHandle(agent)} `)
      .sort((a, b) => a.localeCompare(b));
  }
  if (text.startsWith("@")) {
    const catalog = fileMentionCache || { files: [] };
    return catalog.files
      .map((file) => `${formatFileMentionHandle(file)} `)
      .sort((a, b) => a.localeCompare(b));
  }
  return [];
}

async function printAgentMentionList({ compact = false } = {}) {
  const catalog = await refreshMentionCatalogCache();
  output.write("Available !agents:\n");
  if (catalog.local.length) {
    output.write("  Local specialist Agents:\n");
    for (const agent of catalog.local) {
      output.write(`    ${formatMentionHandle(agent)}  ${agent.name}\n`);
    }
  }
  if (catalog.remote.length) {
    output.write("  DB / remote Agents:\n");
    for (const agent of catalog.remote) {
      output.write(`    ${formatMentionHandle(agent)}  ${agent.name}\n`);
    }
  }
  if (!catalog.local.length && !catalog.remote.length) {
    output.write("  no agents available\n");
  }
  output.write("\nUsage:\n");
  output.write("  !                         list agents\n");
  output.write("  !dokpami-create-agent      select an Agent for following turns\n");
  output.write("  !dokpami-create-agent make a wizard Dokpami image\n");
  output.write("  !clear                     clear active Agent selection\n\n");
}

async function resolveMentionAgent(token) {
  const normalized = normalizeMentionToken(token);
  if (!normalized) return null;
  const catalog = await getMentionAgentCatalog();
  return [...catalog.local, ...catalog.remote].find((agent) =>
    mentionAliases(agent).some((alias) => normalizeMentionToken(alias) === normalized),
  ) || null;
}

async function getMentionAgentCatalog() {
  const sourceListTool = tools.find((tool) => tool.name === "hireme_list_agent_sources");
  if (sourceListTool) {
    const result = await sourceListTool.handler({
      current_user_id: options.userId,
    }).catch((err) => ({
      error: err?.message || String(err),
      sources: [],
    }));
    const local = [];
    const remote = [];
    for (const source of result.sources || []) {
      const agent = source.publicCard || {};
      const item = {
        source: source.source === "local"
          ? "local_specialist"
          : source.canCall
            ? "db_hired"
            : "db_available",
        id: source.agentId,
        handle: agent.handle || `!${source.agentId}`,
        name: source.name || agent.name || source.agentId,
        category: agent.category,
        status: source.source === "local"
          ? agent.status
          : source.canCall
            ? "Hired"
            : "Available",
        headline: agent.headline,
        publicSummary: agent.publicSummary,
        publicSkills: agent.publicSkills,
        manifest: agent.manifest || null,
        pricing: agent.pricing || null,
        entitlement: source.entitlement || agent.entitlement || null,
        protection: agent.protection || null,
        runtime: source.runtimeBoundary || agent.runtime || null,
        authoring: source.authoring || null,
        callTool: "hireme_call_agent_source",
      };
      if (source.source === "local") local.push(item);
      else remote.push(item);
    }
    return { local, remote };
  }

  const localTool = tools.find((tool) => tool.name === "hireme_list_local_specialist_agents");
  const marketplaceTool = tools.find((tool) => tool.name === "hireme_marketplace_list_agents");
  const protectedRuntimeTool = tools.find((tool) => tool.name === "hireme_list_protected_runtime_agents");
  const remoteTool = tools.find((tool) => tool.name === "hireme_list_hired_agents");
  const local = [];
  const remote = [];

  if (localTool) {
    const result = await localTool.handler({}).catch((err) => ({
      error: err?.message || String(err),
    }));
    for (const agent of result.agents || []) {
      local.push({
        source: "local_specialist",
        id: agent.id,
        name: agent.name,
        category: agent.category,
        status: agent.status,
        headline: agent.headline,
        publicSummary: agent.publicSummary,
        publicSkills: agent.publicSkills,
        manifest: agent.manifest || null,
        callTool: "hireme_call_local_specialist_agent",
      });
    }
  }

  if (marketplaceTool) {
    const result = await marketplaceTool.handler({
      current_user_id: options.userId,
    }).catch((err) => ({
      error: err?.message || String(err),
    }));
    for (const agent of result.agents || []) {
      const hired = Boolean(agent.entitlement);
      remote.push({
        source: hired ? "db_hired" : "db_available",
        id: agent.id,
        handle: agent.handle,
        name: agent.name,
        category: agent.category,
        status: hired ? "Hired" : "Available",
        headline: agent.headline,
        publicSummary: agent.publicSummary,
        publicSkills: agent.publicSkills,
        manifest: agent.manifest || null,
        pricing: agent.pricing || null,
        protection: agent.protection || null,
        runtime: agent.runtime || null,
        entitlement: agent.entitlement || null,
        callTool: hired ? "hireme_call_protected_agent_runtime" : "hireme_marketplace_get_agent",
      });
    }
  }

  if (protectedRuntimeTool && !marketplaceTool) {
    const result = await protectedRuntimeTool.handler({}).catch((err) => ({
      error: err?.message || String(err),
    }));
    for (const agent of result.agents || []) {
      remote.push({
        source: "protected_runtime",
        id: agent.id,
        handle: agent.handle,
        name: agent.name,
        category: agent.category,
        status: agent.status,
        headline: agent.headline,
        publicSummary: agent.publicSummary,
        publicSkills: agent.publicSkills,
        manifest: agent.manifest || null,
        protection: agent.protection || null,
        runtime: agent.runtime || null,
        callTool: "hireme_call_protected_agent_runtime",
      });
    }
  }

  if (remoteTool) {
    const result = await remoteTool.handler({}).catch((err) => ({
      error: err?.message || String(err),
    }));
    for (const agent of result.hiredAgents || result.agents || []) {
      remote.push({
        source: "remote_hireme",
        id: agent.id,
        handle: agent.handle,
        name: agent.name,
        category: agent.category,
        status: agent.status,
        headline: agent.headline,
        publicSummary: agent.publicSummary,
        publicSkills: agent.publicSkills,
        manifest: agent.manifest || null,
        callTool: "hireme_call_agent",
      });
    }
  }

  return { local, remote };
}

async function maybeAutoRouteAgent(text) {
  if (process.env.HIREME_DISABLE_AUTO_AGENT_ROUTING === "1") return null;
  const routeTool = tools.find((tool) => tool.name === "hireme_route_local_specialist_agent");
  if (!routeTool) return null;
  const route = await routeTool.handler({
    task: text,
    max_candidates: 3,
  }).catch(() => null);
  if (
    route?.recommendedAction !== "delegate" ||
    !route.selected?.agent ||
    Number(route.confidence || 0) < 0.42
  ) {
    return null;
  }
  const agent = {
    ...route.selected.agent,
    source: "local_specialist",
    callTool: "hireme_call_local_specialist_agent",
    autoRouted: true,
    route: {
      confidence: route.confidence,
      score: route.selected.score,
      reasons: route.selected.reasons || [],
    },
  };
  if (input.isTTY && process.env.HIREME_QUIET_AUTO_AGENT_ROUTING !== "1") {
    writeInteractiveOutput(
      `auto-routed ${formatMentionHandle(agent)} (${Math.round(route.confidence * 100)}%)\n`,
    );
  }
  return agent;
}

function printMentionAgentSelection(agent, { oneShot = false } = {}) {
  output.write(
    [
      `selected ${formatMentionHandle(agent)} (${agent.source})`,
      `name: ${agent.name}`,
      agent.category ? `category: ${agent.category}` : null,
      agent.headline ? `headline: ${agent.headline}` : null,
      oneShot
        ? `run again with "${formatMentionHandle(agent)} <task>" to call it from one-shot mode`
        : "following messages will prefer this Agent until !clear",
      "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

async function refreshFileMentionCache() {
  fileMentionCache = await getFileMentionCatalog();
  return fileMentionCache;
}

async function printFileMentionList({ compact = false } = {}) {
  const catalog = await refreshFileMentionCache();
  output.write("Available @files:\n");
  const files = catalog.files.slice(0, compact ? 12 : 30);
  for (const file of files) {
    output.write(`    ${formatFileMentionHandle(file)}${compact ? "" : `  ${file.bytes ? `${file.bytes} bytes` : ""}`}\n`);
  }
  if (!files.length) output.write("  no files available\n");
  output.write("\nUsage:\n");
  output.write("  @                         list files\n");
  output.write("  @apps/agent/src/tools.mjs  select a file for following turns\n");
  output.write("  @apps/agent/src/tools.mjs explain this file\n");
  output.write("  @clear                     clear active file selection\n\n");
}

async function resolveMentionFile(token) {
  const normalized = normalizeFileMentionToken(token);
  if (!normalized) return null;
  const catalog = await refreshFileMentionCache();
  const exact = catalog.files.find((file) =>
    fileMentionAliases(file).some((alias) => normalizeFileMentionToken(alias) === normalized),
  );
  if (exact) return exact;
  const prefixMatches = catalog.files.filter((file) =>
    fileMentionAliases(file).some((alias) =>
      normalizeFileMentionToken(alias).startsWith(normalized),
    ),
  );
  return prefixMatches.length === 1 ? prefixMatches[0] : null;
}

async function getFileMentionCatalog() {
  const listTool = tools.find((tool) => tool.name === "list_files");
  if (!listTool) return { files: [] };
  const result = await listTool.handler({ limit: 300 }).catch(() => ({ files: [] }));
  return {
    files: (result.files || []).map((path) => ({
      path,
      name: path.split("/").at(-1) || path,
    })),
  };
}

function printFileMentionSelection(file) {
  output.write(
    [
      `selected ${formatFileMentionHandle(file)}`,
      "following messages will include this file reference until @clear",
      "",
    ].join("\n"),
  );
}

function startThinkingIndicator({ agent, startedAt = Date.now() } = {}) {
  const label = agent ? `Thinking with ${formatMentionHandle(agent)}` : "Thinking";
  const tracker = createProgressTracker(startedAt);
  if (activeTtySessionInput) {
    const frames = [".  ", " . ", "  .", " . "];
    let index = 0;
    let stopped = false;
    const render = () => {
      if (stopped) return;
      activeTtySessionInput.setActivity(formatThinkingSurfaceLines({
        label,
        frame: frames[index % frames.length],
        startedAt,
        tracker,
      }));
      index += 1;
    };
    render();
    const timer = setInterval(render, 160);
    timer.unref?.();
    return {
      onEvent(event) {
        tracker.record(event);
        render();
      },
      stop({ failed = false } = {}) {
        if (!stopped) {
          stopped = true;
          clearInterval(timer);
          activeTtySessionInput?.clearActivity();
        }
        return tracker.snapshot({ failed });
      },
    };
  }
  if (!output.isTTY || options.json === true) {
    output.write(`${label}...\n`);
    return {
      onEvent(event) {
        tracker.record(event);
      },
      stop({ failed = false } = {}) {
        return tracker.snapshot({ failed });
      },
    };
  }

  const frames = [
    ".  ",
    " . ",
    "  .",
    " . ",
  ];
  let index = 0;
  let stopped = false;
  let renderedLines = 0;
  output.write("\x1b[?25l");
  const clearRendered = () => {
    if (!renderedLines) return;
    output.write(`\r${renderedLines > 1 ? `\x1b[${renderedLines - 1}A` : ""}\x1b[J`);
  };
  const render = () => {
    if (stopped) return;
    clearRendered();
    const lines = formatThinkingSurfaceLines({
      label,
      frame: frames[index % frames.length],
      startedAt,
      tracker,
    });
    output.write(lines.join("\n"));
    renderedLines = lines.length;
    index += 1;
  };
  render();
  const timer = setInterval(render, 160);
  timer.unref?.();

  return {
    onEvent(event) {
      tracker.record(event);
      render();
    },
    stop({ failed = false } = {}) {
      if (stopped) return tracker.snapshot({ failed });
      stopped = true;
      clearInterval(timer);
      clearRendered();
      output.write("\x1b[?25h");
      return tracker.snapshot({ failed });
    },
  };
}

function formatThinkingSurfaceLines({ label, frame, startedAt, tracker }) {
  const elapsed = formatElapsed(Date.now() - startedAt);
  const activity = tracker.activity;
  const counters = [
    activity.iteration ? `step ${activity.iteration}` : null,
    activity.toolCalls
      ? `tools ${activity.toolsCompleted}/${activity.toolCalls}`
      : null,
    activity.toolsFailed ? `failed ${activity.toolsFailed}` : null,
  ].filter(Boolean).join(" · ");
  const width = Math.max(40, output.columns || 80);
  const color = terminalUiColors();
  const header = fitText(
    `${label} ${frame} ${elapsed}${counters ? ` · ${counters}` : ""}`,
    width,
  );
  return [
    styleTerminal(header, "cyan", { enabled: color }),
    `  ${styleTerminal(
      fitText(activity.phase, Math.max(1, width - 2)),
      "dim",
      { enabled: color },
    )}`,
    ...tracker.logs.slice(-3).map((line) => {
      const tone = line.startsWith("[failed]")
        ? "red"
        : line.startsWith("[done]")
          ? "green"
          : "dim";
      return `  ${styleTerminal(
        fitText(line, Math.max(1, width - 2)),
        tone,
        { enabled: color },
      )}`;
    }),
  ];
}

function createProgressTracker(startedAt) {
  const logs = [];
  const toolStartedAt = new Map();
  const activity = {
    phase: "Preparing request",
    iteration: 0,
    toolCalls: 0,
    toolsCompleted: 0,
    toolsFailed: 0,
    provider: null,
  };
  return {
    activity,
    logs,
    record(event) {
      if (event.type === "tool_observed" || event.type === "tool_failed") {
        const runningLine = `[running] ${friendlyToolLabel(event.tool)}`;
        const runningIndex = logs.lastIndexOf(runningLine);
        if (runningIndex >= 0) logs.splice(runningIndex, 1);
      }
      const line = updateProgressActivity({ activity, event, toolStartedAt });
      if (line && logs.at(-1) !== line) logs.push(line);
    },
    snapshot({ failed = false } = {}) {
      return {
        ...activity,
        failed,
        elapsedMs: Math.max(0, Date.now() - startedAt),
        logs: [...logs],
      };
    },
  };
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateProgressActivity({ activity, event = {}, toolStartedAt }) {
  switch (event.type) {
    case "run_started":
      activity.provider = `${event.provider}${event.model ? `:${event.model}` : ""}`;
      activity.phase = `Connected to ${activity.provider}`;
      return null;
    case "model_deciding":
      activity.iteration = Number(event.iteration || activity.iteration);
      activity.phase = "Planning the next action";
      return null;
    case "decision":
      activity.iteration = Number(event.iteration || activity.iteration);
      if (event.action === "tool") {
        activity.phase = friendlyToolLabel(event.tool);
        return null;
      }
      activity.phase = event.action === "final"
        ? "Preparing the response"
        : `Processing ${event.action}`;
      return null;
    case "tool_started": {
      const tool = String(event.tool || "tool");
      activity.toolCalls += 1;
      activity.phase = friendlyToolLabel(tool);
      toolStartedAt.set(tool, Date.now());
      return `[running] ${friendlyToolLabel(tool)}`;
    }
    case "tool_observed": {
      const tool = String(event.tool || "tool");
      const duration = Date.now() - Number(toolStartedAt.get(tool) || Date.now());
      toolStartedAt.delete(tool);
      activity.toolsCompleted += 1;
      activity.phase = "Reviewing tool result";
      return `[done] ${friendlyToolLabel(tool)} (${formatElapsedPrecise(duration)})`;
    }
    case "tool_failed": {
      const tool = String(event.tool || "tool");
      const duration = Date.now() - Number(toolStartedAt.get(tool) || Date.now());
      toolStartedAt.delete(tool);
      activity.toolsFailed += 1;
      activity.phase = "Recovering from a tool error";
      return `[failed] ${friendlyToolLabel(tool)} (${formatElapsedPrecise(duration)})`;
    }
    case "memory_written":
      activity.phase = "Saving durable context";
      return `[done] Saved ${event.count || 0} memory item(s)`;
    case "skill_written":
      activity.phase = "Updating learned workflow";
      return event.written ? `[done] Updated skill ${event.title || ""}`.trim() : null;
    case "policy_refusal":
      activity.phase = "Applying the privacy boundary";
      return "[done] Protected private Agent material";
    case "run_completed":
      activity.phase = "Preparing the response";
      return null;
    default:
      return null;
  }
}

function applyMentionsToGoal(text, { agent, file } = {}) {
  if (!agent && !file) return text;
  const lines = [];
  if (agent) {
    const callHint = agentCallHint(agent);
    lines.push(`!agent selected: ${formatMentionHandle(agent)} (${agent.name})`, callHint);
    if (agent.autoRouted && agent.route) {
      lines.push(
        `Agent routing: auto-selected by Manifest v1 with confidence ${Math.round(Number(agent.route.confidence || 0) * 100)}%.`,
        ...(Array.isArray(agent.route.reasons) && agent.route.reasons.length
          ? [`Routing reasons: ${agent.route.reasons.join("; ")}`]
          : []),
      );
    }
  }
  if (file) {
    lines.push(
      `@file selected: ${file.path}`,
      `Use workspace file "${file.path}" as referenced context. Read it with read_file if its contents are needed.`,
    );
  }
  lines.push(`User task: ${text}`);
  return lines.join("\n");
}

function agentCallHint(agent) {
  if (agent.source === "local_specialist") {
    return `Use local filesystem Agent "${agent.id}" via hireme_call_agent_source. This !agent conversation is work mode: do not edit its Harness, skills, evals, or Bootstrap Memory. Let safe result memory deltas update Session Memory. Use explicit Agent management/authoring commands for Harness changes.`;
  }
  if (agent.source === "db_hired") {
    return `Use hired DB Agent "${agent.id}" via hireme_call_agent_source. It must run through the protected runtime; do not import, extract, cache, or request its private Harness.`;
  }
  if (agent.source === "db_available") {
    return `DB Agent "${agent.id}" is not hired yet. Use hireme_marketplace_get_agent for public profile only, or tell the user to run hireme marketplace hire ${agent.id} before calling it.`;
  }
  if (agent.source === "protected_runtime") {
    return `Use protected runtime Agent "${agent.id}" via hireme_call_protected_agent_runtime. Do not import, extract, cache, or request its private Harness.`;
  }
  return `Use remote HireMe Agent "${agent.id}" via hireme_call_agent unless the request is only about public profile.`;
}

function publicMentionContext(agent) {
  return {
    source: agent.source,
    id: agent.id,
    handle: formatMentionHandle(agent),
    name: agent.name,
    category: agent.category || null,
    headline: agent.headline || null,
    manifest: agent.manifest || null,
    autoRouted: agent.autoRouted === true,
    route: agent.route || null,
    pricing: agent.pricing || null,
    entitlement: agent.entitlement || null,
    protection: agent.protection || null,
    runtime: agent.runtime || null,
    authoring: agent.authoring || null,
    callTool: agent.callTool,
  };
}

function publicFileMentionContext(file) {
  return {
    path: file.path,
    name: file.name,
    handle: formatFileMentionHandle(file),
  };
}

function formatTranscriptUserText(text, { agent, file } = {}) {
  return [
    agent ? formatMentionHandle(agent) : null,
    file ? formatFileMentionHandle(file) : null,
    text,
  ]
    .filter(Boolean)
    .join(" ");
}

function formatMentionHandle(agent) {
  return `!${agent?.id || "agent"}`;
}

function mentionAliases(agent) {
  return [
    agent.id,
    agent.name,
    agent.handle,
    agent.handle?.replace(/^@/, ""),
    `!${agent.id}`,
    `local/${agent.id}`,
    `!local/${agent.id}`,
  ].filter(Boolean);
}

function normalizeMentionToken(value) {
  return String(value || "")
    .trim()
    .replace(/^[!@]/, "")
    .toLowerCase();
}

function formatFileMentionHandle(file) {
  return `@${file?.path || "file"}`;
}

function fileMentionAliases(file) {
  return [
    file.path,
    file.name,
    `@${file.path}`,
    `@${file.name}`,
  ].filter(Boolean);
}

function normalizeFileMentionToken(value) {
  return String(value || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
}

async function selectProviderAndModel(rl) {
  const providers = providerChoices();
  output.write(`current: ${formatProviderModel(activeProvider)}\n`);
  output.write("Providers:\n");
  providers.forEach((item, index) => {
    output.write(`  ${index + 1}. ${item.label}${item.note ? ` - ${item.note}` : ""}\n`);
  });
  const providerAnswer = (await rl.question("select provider: ")).trim();
  if (!providerAnswer) {
    output.write("provider selection cancelled\n");
    return;
  }
  const providerChoice = chooseByAnswer(providers, providerAnswer);
  if (!providerChoice) {
    output.write(`unknown provider: ${providerAnswer}\n`);
    return;
  }

  const models = modelChoicesForProvider(providerChoice.key);
  output.write(`Models for ${providerChoice.label}:\n`);
  models.forEach((item, index) => {
    output.write(`  ${index + 1}. ${item.label}${item.model ? ` (${item.model})` : ""}\n`);
  });
  output.write("  custom. Type a model id directly\n");
  const modelAnswer = (await rl.question("select model: ")).trim();
  if (!modelAnswer) {
    output.write("model selection cancelled\n");
    return;
  }
  const modelChoice = chooseByAnswer(models, modelAnswer);
  const selectedModel = modelChoice ? modelChoice.model : modelAnswer;
  try {
    await activateProviderModel({
      provider: providerChoice.key,
      model: selectedModel || null,
      save: true,
    });
    output.write(`active provider: ${formatProviderModel(activeProvider)}\n`);
  } catch (err) {
    output.write(`provider not changed: ${err?.message || String(err)}\n`);
  }
}

async function activateProviderModel({ provider, model, save = false }) {
  const normalizedProvider = normalizeSavedProvider(provider);
  const nextProvider = createModelProvider({
    provider: normalizedProvider,
    model,
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    workspaceDir,
  });
  activeProvider = nextProvider;
  tools = createRuntimeTools();
  activeAgent = createRuntimeAgent();
  if (save) {
    await writeHireMeConfig({
      ...(await readHireMeConfig({ configPath: options.config })),
      provider: normalizedProvider,
      model: model || null,
      updatedAt: new Date().toISOString(),
    }, { configPath: options.config });
  }
}

function providerChoices() {
  return [
    {
      key: "codex",
      label: "OpenAI (Codex OAuth)",
      aliases: ["openai", "codex", "oauth", "chatgpt"],
      note: "uses hireme login / codex login, no API key",
    },
    {
      key: "openai",
      label: "OpenAI API",
      aliases: ["openai-api", "api"],
      note: "requires OPENAI_API_KEY",
    },
    {
      key: "ollama",
      label: "Ollama-compatible",
      aliases: ["ollama"],
    },
    {
      key: "fixture",
      label: "Fixture",
      aliases: ["fixture", "test"],
    },
  ];
}

function modelChoicesForProvider(provider) {
  const optionsForProvider = defaultModelOptions()[provider] || [];
  return optionsForProvider.map((item) => {
    if (typeof item === "string") {
      return { model: item, label: item, aliases: [item] };
    }
    return {
      model: item.model || null,
      label: item.label || item.model || "Default",
      aliases: [item.model, item.label].filter(Boolean),
    };
  });
}

function chooseByAnswer(choices, answer) {
  const trimmed = String(answer || "").trim();
  const numeric = Number.parseInt(trimmed, 10);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= choices.length) {
    return choices[numeric - 1];
  }
  const normalized = trimmed.toLowerCase();
  return choices.find((choice) =>
    [choice.key, choice.model, choice.label, ...(choice.aliases || [])]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase())
      .includes(normalized),
  );
}

function formatProviderModel(provider) {
  const label =
    provider.provider === "codex"
      ? "OpenAI (Codex OAuth)"
      : provider.provider === "openai"
        ? "OpenAI API"
        : provider.provider;
  return `${label}${provider.model ? `:${provider.model}` : ""}`;
}

function useTerminalUi() {
  return Boolean(output.isTTY && options.json !== true);
}

function printActiveContext(turns = []) {
  output.write([
    "Active context",
    `  agent    ${activeAgentMention ? `${formatMentionHandle(activeAgentMention)} (${activeAgentMention.name})` : "automatic routing"}`,
    `  file     ${activeFileMention ? formatFileMentionHandle(activeFileMention) : "none"}`,
    `  provider ${formatProviderModel(activeProvider)}`,
    `  session  ${sessionId}`,
    `  turns    ${turns.length}`,
    `  image    ${activeImageBridge.configured ? `bridge:${activeImageBridge.source}` : "local-preview"}`,
    "",
  ].join("\n"));
}

function printLastRunLogs() {
  if (!lastRunActivity) {
    output.write("no run activity available\n");
    return;
  }
  const color = terminalUiColors();
  const status = lastRunActivity.cancelled
    ? styleTerminal("cancelled", "yellow", { enabled: color })
    : lastRunActivity.failed
      ? styleTerminal("failed", "red", { enabled: color })
      : lastRunActivity.toolsFailed
      ? styleTerminal("completed with warnings", "yellow", { enabled: color })
      : styleTerminal("completed", "green", { enabled: color });
  output.write(`Run activity · ${status} · ${formatElapsedPrecise(lastRunActivity.elapsedMs)}\n`);
  output.write(`  steps ${lastRunActivity.iteration || 0} · tools ${lastRunActivity.toolsCompleted || 0}/${lastRunActivity.toolCalls || 0}`);
  if (lastRunActivity.toolsFailed) {
    output.write(` · failed ${lastRunActivity.toolsFailed}`);
  }
  output.write("\n");
  for (const line of lastRunActivity.logs || []) {
    const tone = line.startsWith("[failed]")
      ? "red"
      : line.startsWith("[done]")
        ? "green"
        : "dim";
    output.write(`  ${styleTerminal(line, tone, { enabled: color })}\n`);
  }
  if (!lastRunActivity.logs?.length) output.write("  no tool activity\n");
  output.write("\n");
}

function formatBanner({ agentName, provider, model, sessionId, stateDir, imageBridge }) {
  const width = Math.min(Math.max(48, output.columns || 80), 100);
  const color = terminalUiColors();
  const lines = [
    styleTerminal("HireMe Agent", "bold", { enabled: color }),
    styleTerminal(
      `  ${fitText(`${agentName} · ${provider}${model ? `:${model}` : ""} · image ${imageBridge?.configured ? imageBridge.source : "local-preview"}`, width - 2)}`,
      "dim",
      { enabled: color },
    ),
    styleTerminal(
      `  ${fitText(`session ${sessionId} · state ${stateDir}`, width - 2)}`,
      "dim",
      { enabled: color },
    ),
    styleTerminal("  !agent  @file  /context  /help", "cyan", { enabled: color }),
  ];
  return `${lines.join("\n")}\n\n`;
}

function fitText(value, width) {
  const text = String(value || "");
  if (text.length <= width) return text;
  if (width <= 3) return text.slice(0, width);
  return `${text.slice(0, width - 3)}...`;
}

function formatChatBlock(label, text, { tone = "cyan" } = {}) {
  const color = terminalUiColors();
  const body = renderTerminalMarkdown(text, {
    width: Math.max(24, (output.columns || 80) - 4),
    color,
  }).trimEnd();
  const lines = body ? body.split("\n") : [""];
  const rail = styleTerminal("|", "dim", { enabled: color });
  const formatted = lines.map((line) => `  ${rail} ${line}`).join("\n");
  return `\n${styleTerminal(label, tone, { enabled: color })}\n${formatted}\n`;
}

function printAgentOutput(
  result,
  { json = false, timing = null, agent = null, activity = null } = {},
) {
  if (json) {
    output.write(`${JSON.stringify(timing ? { ...result, cliTiming: timing } : result, null, 2)}\n`);
    return;
  }
  if (useTerminalUi()) {
    const label = agent ? `hireme · ${formatMentionHandle(agent)}` : "hireme";
    let chunk = formatChatBlock(label, result.outputText);
    const artifacts = extractResultArtifacts(result);
    if (artifacts.length) {
      chunk += renderArtifactBlocks(artifacts, {
        color: terminalUiColors(),
        linkPath: terminalPathLink,
      });
    }
    if (timing) chunk += `${formatCollapsedRunSummary(timing, activity)}\n`;
    chunk += "\n";
    writeInteractiveOutput(chunk);
    return;
  }
  output.write(`\n${result.outputText}\n`);
  if (timing) output.write(`${formatPlainTimingLine(timing)}\n`);
  output.write("\n");
}

function printRunError(err, { elapsedMs = 0, agent, activity = null } = {}) {
  const message = publicCliErrorMessage(err);
  const hint = errorRecoveryHint(message);
  if (options.json === true) {
    output.write(`${JSON.stringify({
      status: "failed",
      error: message,
      elapsedMs,
      retryAvailable: true,
    }, null, 2)}\n`);
    return;
  }
  const body = [
    message,
    agent ? `Agent: ${formatMentionHandle(agent)}` : null,
    hint,
    "Use /retry to run the same request again.",
  ].filter(Boolean).join("\n");
  if (useTerminalUi()) {
    let chunk = formatChatBlock("hireme · error", body, { tone: "red" });
    chunk += `${formatCollapsedRunSummary({
      elapsed: formatElapsedPrecise(elapsedMs),
      iterations: activity?.iteration || 0,
      toolCalls: activity?.toolCalls || 0,
    }, { ...activity, failed: true })}\n\n`;
    writeInteractiveOutput(chunk);
    return;
  }
  output.write(`\n${body}\nelapsed ${formatElapsedPrecise(elapsedMs)}\n\n`);
}

function printRunCancelled({ elapsedMs = 0, agent, activity = null } = {}) {
  const message = "Run cancelled.";
  if (options.json === true) {
    output.write(`${JSON.stringify({
      status: "cancelled",
      error: message,
      elapsedMs,
      retryAvailable: true,
    }, null, 2)}\n`);
    return;
  }
  const body = [
    message,
    agent ? `Agent: ${formatMentionHandle(agent)}` : null,
    "Use /retry to run the cancelled request again.",
  ].filter(Boolean).join("\n");
  if (useTerminalUi()) {
    let chunk = formatChatBlock("hireme · cancelled", body, { tone: "yellow" });
    chunk += `${formatCollapsedRunSummary({
      elapsed: formatElapsedPrecise(elapsedMs),
      iterations: activity?.iteration || 0,
      toolCalls: activity?.toolCalls || 0,
    }, { ...activity, cancelled: true })}\n\n`;
    writeInteractiveOutput(chunk);
    return;
  }
  output.write(`\n${body}\nelapsed ${formatElapsedPrecise(elapsedMs)}\n\n`);
}

function formatCollapsedRunSummary(timing, activity = null) {
  const color = terminalUiColors();
  const failed = activity?.failed === true;
  const cancelled = activity?.cancelled === true;
  const warned = !failed && activity?.toolsFailed > 0;
  const marker = cancelled ? "[cancelled]" : failed ? "[failed]" : warned ? "[warning]" : "[done]";
  const tone = cancelled ? "yellow" : failed ? "red" : warned ? "yellow" : "green";
  const tools = Number(activity?.toolCalls ?? timing.toolCalls ?? 0);
  const completed = Number(activity?.toolsCompleted ?? tools);
  return [
    `  ${styleTerminal(marker, tone, { enabled: color })}`,
    `${completed}/${tools} tools`,
    `in ${timing.elapsed}`,
    `· ${timing.iterations || 0} steps`,
    "· /logs",
  ].join(" ");
}

function terminalPathLink(path) {
  const label = String(path || "");
  if (
    !useTerminalUi() ||
    process.env.HIREME_DISABLE_TERMINAL_LINKS === "1"
  ) {
    return label;
  }
  const target = resolve(workspaceDir, label);
  const rel = relative(workspaceDir, target);
  if (!rel || rel.startsWith("..") || /^[A-Za-z]:/.test(rel)) return label;
  const url = pathToFileURL(target).href;
  return `\x1b]8;;${url}\x1b\\${label}\x1b]8;;\x1b\\`;
}

function terminalUiColors() {
  return terminalColorEnabled({ isTTY: useTerminalUi(), env: process.env });
}

function writeInteractiveOutput(value) {
  if (activeTtySessionInput && useTerminalUi()) {
    activeTtySessionInput.printAbove(value);
    return;
  }
  output.write(value);
}

function publicCliErrorMessage(err) {
  return String(err?.message || err || "The request failed.")
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [redacted]")
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[redacted]")
    .replace(/("?(?:access|refresh)_token"?\s*[:=]\s*)[^\s,}]+/gi, "$1[redacted]")
    .slice(0, 600);
}

function errorRecoveryHint(message) {
  const text = String(message || "").toLowerCase();
  if (/oauth|auth|login|unauthorized|forbidden|token/.test(text)) {
    return "Authentication needs attention. Run `hireme login`, then retry.";
  }
  if (/provider|model/.test(text)) {
    return "Check the active model with `/provider` before retrying.";
  }
  if (/timeout|timed out|temporar|network|fetch/.test(text)) {
    return "The provider did not finish normally; retrying is safe.";
  }
  if (/iteration|tool-call budget|tool call budget/.test(text)) {
    return "Narrow the request or increase the configured run limits.";
  }
  return "The conversation is still active; adjust the request or retry it.";
}

function buildRunTiming(result, startedAt) {
  const elapsedMs = Math.max(0, Date.now() - Number(startedAt || Date.now()));
  const events = Array.isArray(result?.events) ? result.events : [];
  const memoryWrites = events
    .filter((event) => event.type === "memory_written")
    .reduce((total, event) => total + (Number(event.count) || 0), 0);
  return {
    elapsedMs,
    elapsed: formatElapsedPrecise(elapsedMs),
    iterations: Number(result?.iterationsRun || 0),
    toolCalls: Number(result?.toolCalls || 0),
    memoryWrites,
    provider: result?.provider || null,
    model: result?.model || null,
    runId: result?.runId || null,
  };
}

function formatTimingLine(timing) {
  return [
    "  elapsed",
    timing.elapsed,
    "· steps",
    String(timing.iterations || 0),
    "· tools",
    String(timing.toolCalls || 0),
    timing.memoryWrites ? `· memory ${timing.memoryWrites}` : null,
    timing.provider ? `· ${timing.provider}${timing.model ? `:${timing.model}` : ""}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function formatPlainTimingLine(timing) {
  return formatTimingLine(timing).trim();
}

function formatElapsedPrecise(ms) {
  const safeMs = Math.max(0, Number(ms) || 0);
  if (safeMs < 1000) return `${safeMs}ms`;
  const totalSeconds = safeMs / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(totalSeconds < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

async function readTranscript(path) {
  let text = "";
  try {
    text = await readFile(path, "utf8");
  } catch (err) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function appendTranscript(turn) {
  await mkdir(dirnameSafe(transcriptPath), { recursive: true });
  await appendFile(
    transcriptPath,
    `${JSON.stringify({ ...turn, at: new Date().toISOString() })}\n`,
    "utf8",
  );
}

function printBanner({ agentName, provider, model, sessionId, stateDir }) {
  if (useTerminalUi()) {
    output.write(formatBanner({
      agentName,
      provider,
      model,
      sessionId,
      stateDir,
      imageBridge: activeImageBridge,
    }));
    return;
  }
  output.write(
    [
      `HireMe Agent (${agentName})`,
      `provider: ${provider}${model ? `:${model}` : ""}`,
      `image: ${activeImageBridge.configured ? `bridge:${activeImageBridge.source}` : "local-preview"}`,
      `session: ${sessionId}`,
      `state: ${stateDir}`,
      "type /help for commands, /exit to quit",
      "",
    ].join("\n"),
  );
}

function printSessionHelp() {
  output.write(
    [
      "Commands:",
      "  /help          Show this help",
      "  /state         Show state and transcript paths",
      "  /context       Show active Agent, file, provider, and session",
      "  /logs          Expand the latest run's tool activity",
      "  /queue         Show queued requests",
      "  /drop <n>      Drop queued request number n",
      "  /clear-queue   Clear all queued requests",
      "  /retry         Retry the most recent request after a failure",
      "  /provider      Select provider and model",
      "  /provider show Show active provider and model",
      "  /image-bridge  Show OpenAI Codex image provider status",
      "  /image-bridge set <command> [args...]",
      "                 Save a custom image provider command",
      "  /image-bridge test",
      "                 Validate the configured provider writes an image file",
      "  /remember ...  Store a manual durable memory",
      "  /clear         Clear in-session context only",
      "  /exit          Quit",
      "",
      "Mentions:",
      "  !              List available Agents",
      "  ! + Tab        Complete an Agent handle",
      "  !agent-id      Select an Agent for following turns",
      "  !agent-id ...  Route this turn to the selected Agent",
      "  !clear         Clear active Agent selection",
      "  @              List workspace files",
      "  @ + Tab        Complete a file path",
      "  @path ...      Reference a workspace file for this turn",
      "  @clear         Clear active file selection",
      "",
      "Composer:",
      "  Shift+Enter    Insert a line break",
      "  Up/Down       Select suggestions or browse input history",
      "  Tab/Enter     Apply the selected !agent, @file, or /command",
      "  / + typing    Search the interactive command palette",
      "  Left/Right    Move the cursor; Home/End move within a line",
      "  While running, Enter adds the current message to the FIFO queue",
      "  While running, /queue, /drop, /clear-queue, Esc, and Ctrl+C act immediately",
      "",
    ].join("\n"),
  );
}

function printHelp() {
  output.write(`Usage:
  hireme
  hireme "one-shot request"
  hireme --chat "start with this first message"
  hireme login
  hireme logout
  hireme doctor
  hireme marketplace list
  hireme marketplace inspect <agent-id>
  hireme marketplace hire <agent-id>
  hireme marketplace try <agent-id>
  hireme marketplace entitlements
  hireme marketplace usage
  hireme agent list
  hireme agent templates
  hireme agent init <agent-id> --brief "What this Agent should do"
  hireme agent create <agent-id> --name NAME [--template basic]
  hireme agent status <agent-id>
  hireme agent memory <agent-id>
  hireme agent memory add <agent-id> --content TEXT [--key KEY]
  hireme agent memory replace <agent-id> --content TEXT [--key KEY]
  hireme agent skill add <agent-id> <skill-name> --purpose TEXT
  hireme agent files <agent-id>
  hireme agent read <agent-id> <private-path>
  hireme agent edit <agent-id> <path> --content TEXT --overwrite
  hireme agent manage <agent-id> "authoring instruction"
  hireme agent validate <agent-id>
  hireme agent test <agent-id> <task>
  hireme agent eval <agent-id> [--task TEXT]
  hireme agent package <agent-id> [--output PATH] [--overwrite]
  hireme agent resolve <agent-id>
  hireme agent export <agent-id> [--output PATH] [--overwrite]
  hireme agent import <package-path> [--overwrite]
  hireme agent call <agent-id> <task>
  hireme model
  hireme model list
  hireme model set codex gpt-5.5
  hireme image-bridge show
  hireme image-bridge set-openai-codex
  hireme image-bridge login-openai-codex
  hireme image-bridge import-openai-codex
  hireme image-bridge set /path/to/image-provider-command
  hireme image-bridge test

Options:
  --provider NAME       codex, fixture, openai, or ollama. Default: codex
  --model NAME          Provider model override
  --model overrides the saved default from hireme model set.
  --config PATH         HireMe config path. Default: ~/.hireme/config.json
  --workspace PATH      Workspace root. Default: current directory
  --state-dir PATH      Durable state directory
  --session ID          Resume/write a named CLI session
  --output PATH         Output path for agent export
  --package-mode MODE   full, public, local_protected, or hosted_secure. Default: full
  --user-id ID          Current HireMe user id for creator-owned import checks
  --creator-id ID       Creator id to stamp on exported Agent packages
  --template NAME       Agent template: basic, artifact, image_spec, or command
  --brief TEXT          Creator brief used by agent init to tailor Harness, memory, and evals
  --success-criteria TEXT
                        Pipe-separated quality criteria for agent init
  --non-goals TEXT      Pipe-separated boundaries or out-of-scope rules for agent init
  --example-task TEXT   Representative task for agent init's functional evaluation
  --max-cases NUMBER    Maximum private eval cases to run (default: all)
  --purpose TEXT        Reusable private procedure for agent skill add
  --triggers TEXT       Pipe-separated trigger signals for agent skill add
  --inputs TEXT         Pipe-separated inputs to collect for agent skill add
  --steps TEXT          Pipe-separated procedure steps for agent skill add
  --quality-checks TEXT Pipe-separated quality checks for agent skill add
  --boundaries TEXT     Pipe-separated private-skill boundaries for agent skill add
  --name NAME           Display name for agent create
  --content TEXT        UTF-8 content for agent edit
  --key KEY             Stable Bootstrap Memory key for agent memory add
  --kind KIND           Memory kind: principle, preference, case, failure, fact, or note
  --tags CSV            Comma-separated Bootstrap Memory tags
  --priority NUMBER     Bootstrap Memory priority from 0 to 100
  --from-file PATH      Read agent edit content from a workspace file
  --skills CSV          Comma-separated public skill labels for agent create
  --skip-test           Allow agent package without a current successful test
  --skip-eval           Development-only: allow package without a current passing eval suite
  --no-validate         Skip automatic validation immediately after agent edit
  --try                 Grant a trial entitlement for marketplace hire
  --public              Export public-safe files only
  --overwrite           Allow replacing export/import targets
  --image-bridge-command PATH
                        Use a custom image provider command for this run
  --image-bridge-args JSON
                        JSON array of bridge args for this run
  --image-bridge-timeout-ms MS
                        Image provider timeout. Default: 120000
  --allow-shell         Expose run_command tool
  --no-hireme-tools     Disable local HireMe Agent tools
  --json                Print JSON results
  --help                Show this help

Mentions:
  !                         List available Agents
  ! + Tab                   Complete an Agent handle in chat mode
  !dokpami-create-agent      Select a local specialist Agent
  !dokpami-create-agent ...  Route this turn to that Agent
  !clear                     Clear active Agent selection
  @                         List workspace files
  @ + Tab                   Complete a file path in chat mode
  @apps/agent/src/tools.mjs  Reference a file
  @clear                     Clear active file selection

Environment:
  HIREME_AGENT_PROVIDER=codex|openai|ollama|fixture
  HIREME_LOCAL_SPECIALIST_ROOT=examples/local-specialist-agents
  HIREME_USER_ID=local-dev-user sets the local marketplace identity
  HIREME_CODEX_IMAGE_GEN_COMMAND=/path/to/image-provider-command
  HIREME_CODEX_IMAGE_GEN_ARGS='["--optional-arg"]'
  Codex default uses your existing codex login OAuth session, not an API key.
`);
}

async function handleMarketplaceCommand(args, cliOptions = {}) {
  const action = args[0] || "list";
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const listTool = byName.get("hireme_marketplace_list_agents");
  const getTool = byName.get("hireme_marketplace_get_agent");
  const hireTool = byName.get("hireme_marketplace_hire_agent");
  const entitlementListTool = byName.get("hireme_marketplace_list_entitlements");
  const usageListTool = byName.get("hireme_list_usage_ledger");
  if (!listTool || !getTool || !hireTool || !entitlementListTool || !usageListTool) {
    throw new Error("Marketplace tools are not available. Remove --no-hireme-tools and try again.");
  }

  if (action === "list" || action === "ls" || action === "browse") {
    const result = await listTool.handler({
      query: cliOptions.query,
      category: cliOptions.category,
      current_user_id: cliOptions.userId,
    });
    if (cliOptions.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    output.write("DB Agents:\n");
    for (const agent of result.agents || []) {
      const access = agent.entitlement
        ? formatEntitlementAccess(agent.entitlement)
        : "not hired";
      const price = agent.pricing
        ? `${agent.pricing.amount} ${agent.pricing.currency}/${agent.pricing.unit}`
        : "price n/a";
      output.write(`  !${agent.id}  ${agent.name}  ${access}  ${price}\n`);
    }
    if (!result.agents?.length) output.write("  none\n");
    output.write("\nRun `hireme marketplace inspect <agent-id>` or `hireme marketplace hire <agent-id>`.\n");
    return;
  }

  if (action === "inspect" || action === "show" || action === "get") {
    const agentId = args[1] || cliOptions.agentId;
    if (!agentId) {
      output.write("usage: hireme marketplace inspect <agent-id>\n");
      return;
    }
    const result = await getTool.handler({
      agent_id: agentId,
      current_user_id: cliOptions.userId,
    });
    if (cliOptions.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    const agent = result.agent;
    output.write([
      `${agent.name} (${agent.id})`,
      `creator: ${agent.creator}`,
      `category: ${agent.category}`,
      `headline: ${agent.headline}`,
      `skills: ${(agent.publicSkills || []).join(", ") || "none"}`,
      agent.pricing
        ? `price: ${agent.pricing.amount} ${agent.pricing.currency}/${agent.pricing.unit}`
        : "price: n/a",
      `access: ${agent.entitlement ? formatEntitlementAccess(agent.entitlement) : "not hired"}`,
      `runtime: ${agent.runtime?.executionMode || "remote_trusted_executor"}`,
      `localHarnessMaterialized: ${agent.runtime?.localHarnessMaterialized}`,
      "private harness: not available through marketplace inspection",
      "",
    ].join("\n"));
    return;
  }

  if (action === "hire" || action === "buy" || action === "try") {
    const agentId = args[1] || cliOptions.agentId;
    if (!agentId) {
      output.write(`usage: hireme marketplace ${action} <agent-id>\n`);
      return;
    }
    const result = await hireTool.handler({
      agent_id: agentId,
      access_type: action === "try" || cliOptions.try === true ? "try" : "hire",
      current_user_id: cliOptions.userId,
    });
    mentionCatalogCache = null;
    if (cliOptions.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    output.write([
      `${result.entitlement.access === "try" ? "trial enabled" : "hired"} ${result.agent.id}`,
      `user: ${result.entitlement.userId}`,
      result.entitlement.access === "try"
        ? `remainingTrialCalls: ${result.entitlement.remainingTrialCalls}`
        : null,
      `runtimeOnly: ${result.entitlement.runtimeOnly}`,
      `next: ${result.nextAction}`,
      "",
    ].filter(Boolean).join("\n"));
    return;
  }

  if (action === "entitlements" || action === "hired" || action === "mine" || action === "my") {
    const result = await entitlementListTool.handler({
      current_user_id: cliOptions.userId,
    });
    if (cliOptions.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    output.write("Marketplace Entitlements:\n");
    for (const entitlement of result.entitlements || []) {
      output.write(`  !${entitlement.agentId}  ${formatEntitlementAccess(entitlement)}\n`);
    }
    if (!result.entitlements?.length) output.write("  none\n");
    return;
  }

  if (action === "usage" || action === "ledger" || action === "calls") {
    const result = await usageListTool.handler({
      current_user_id: cliOptions.userId,
      agent_id: args[1] || cliOptions.agentId,
      limit: cliOptions.limit,
    });
    if (cliOptions.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    output.write("Usage Ledger:\n");
    for (const entry of result.entries || []) {
      output.write(
        `  ${entry.at}  !${entry.agentId}  ${entry.source}:${entry.callMode || "none"}  ${entry.status}` +
        `  trial-${entry.trialCallsConsumed || 0}` +
        `${entry.remainingTrialCalls === null ? "" : ` remaining=${entry.remainingTrialCalls}`}\n`,
      );
    }
    if (!result.entries?.length) output.write("  none\n");
    return;
  }

  output.write(`unknown marketplace command: ${action}\n`);
  output.write("usage: hireme marketplace list|inspect <agent-id>|hire <agent-id>|try <agent-id>|entitlements|usage\n");
}

function formatEntitlementAccess(entitlement = {}) {
  const access = entitlement.access || "unknown";
  const reason = entitlement.callReason && entitlement.callReason !== "active_entitlement"
    ? ` ${entitlement.callReason}`
    : "";
  if (access === "try") {
    return `try:active remaining=${entitlement.remainingTrialCalls ?? 0}${reason}`;
  }
  return `${access}:active${reason}`;
}

async function handleAgentCommand(args, cliOptions = {}) {
  const action = args[0] || "list";
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  if (action === "templates" || action === "template") {
    const templateTool = byName.get("hireme_list_agent_authoring_templates");
    if (!templateTool) throw new Error("Agent Authoring Layer is not available.");
    const result = await templateTool.handler({});
    if (cliOptions.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    output.write("Agent templates:\n");
    for (const template of result.templates || []) {
      output.write(`  ${template.id}  ${template.title}\n`);
    }
    return;
  }

  if (action === "create" || action === "new") {
    const agentId = args[1] || cliOptions.agentId;
    if (!agentId) {
      output.write("usage: hireme agent create <agent-id> --name <name> [--template basic]\n");
      return;
    }
    const createTool = byName.get("hireme_create_agent_draft");
    if (!createTool) throw new Error("Agent Authoring Layer is not available.");
    const result = await createTool.handler({
      agent_id: agentId,
      name: cliOptions.name || args[2] || humanizeAgentId(agentId),
      category: cliOptions.category,
      description: cliOptions.description,
      creator: cliOptions.creator,
      headline: cliOptions.headline,
      public_summary: cliOptions.summary || cliOptions.publicSummary,
      public_contract: cliOptions.publicContract,
      template: cliOptions.template,
      skills: parseCommaList(cliOptions.skills),
      overwrite: cliOptions.overwrite === true,
    });
    mentionCatalogCache = null;
    if (cliOptions.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    output.write([
      `created ${result.workflow.agentId}`,
      `template: ${result.workflow.template}`,
      `folder: ${result.creation.folderPath}`,
      `phase: ${result.workflow.phase}`,
      `revision: ${result.workflow.revision}`,
      `next: ${result.nextAction}`,
      "",
    ].join("\n"));
    return;
  }

  if (action === "init" || action === "initialize") {
    const agentId = args[1] || cliOptions.agentId;
    const brief = String(cliOptions.brief || args.slice(2).join(" ") || "").trim();
    if (!agentId || !brief) {
      output.write("usage: hireme agent init <agent-id> --brief <what the Agent should do> [--name <name>]\n");
      return;
    }
    const initializeTool = byName.get("hireme_initialize_agent_draft");
    if (!initializeTool) throw new Error("Guided Agent initialization is not available.");
    const result = await initializeTool.handler({
      agent_id: agentId,
      name: cliOptions.name || humanizeAgentId(agentId),
      brief,
      template: cliOptions.template,
      category: cliOptions.category,
      creator: cliOptions.creator,
      skills: parseCommaList(cliOptions.skills),
      success_criteria: parseDetailList(cliOptions.successCriteria),
      non_goals: parseDetailList(cliOptions.nonGoals),
      representative_tasks: parseDetailList(cliOptions.exampleTask),
      overwrite: cliOptions.overwrite === true,
    });
    mentionCatalogCache = null;
    if (cliOptions.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    output.write([
      `initialized ${result.workflow.agentId}`,
      `template: ${result.blueprint?.template || result.workflow.template}`,
      `folder: ${result.creation?.folderPath || "created"}`,
      `custom Bootstrap Memory: ${result.memory?.added || 0} record(s)`,
      `private eval cases: ${result.blueprint?.representativeTaskCount || 0} representative + boundary`,
      `phase: ${result.workflow.phase}`,
      `revision: ${result.workflow.revision}`,
      `next: ${result.nextAction}`,
      "",
    ].join("\n"));
    return;
  }

  if (action === "memory") {
    const requestedAction = args[1] || "status";
    const memoryAction = ["add", "replace", "status"].includes(requestedAction)
      ? requestedAction
      : "status";
    const agentId = memoryAction === "status"
      ? (requestedAction === "status" ? args[2] : args[1]) || cliOptions.agentId
      : args[2] || cliOptions.agentId;
    if (!agentId) {
      output.write("usage: hireme agent memory <agent-id> | memory add|replace <agent-id> --content <text> [--key KEY]\n");
      return;
    }

    if (memoryAction === "status") {
      const statusTool = byName.get("hireme_get_agent_bootstrap_memory_status");
      if (!statusTool) throw new Error("Agent Bootstrap Memory tools are not available.");
      const result = await statusTool.handler({ agent_id: agentId });
      if (cliOptions.json) {
        output.write(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }
      output.write([
        `${result.agentId} Bootstrap Memory`,
        `ready: ${result.memory?.valid === true}`,
        `items: ${result.memory?.count || 0}`,
        `starter: ${result.memory?.starterCount || 0}`,
        `custom: ${result.memory?.customCount || 0}`,
        `digest: ${result.memory?.digest || "none"}`,
        "",
      ].join("\n"));
      return;
    }

    const content = String(cliOptions.content || args.slice(3).join(" ")).trim();
    if (!content) {
      output.write(`usage: hireme agent memory ${memoryAction} <agent-id> --content <text> [--key KEY]\n`);
      return;
    }
    const memoryTool = byName.get("hireme_add_agent_bootstrap_memory");
    if (!memoryTool) throw new Error("Agent Bootstrap Memory tools are not available.");
    const priority = cliOptions.priority === undefined
      ? undefined
      : Number(cliOptions.priority);
    if (priority !== undefined && !Number.isFinite(priority)) {
      throw new Error("--priority must be a number from 0 to 100.");
    }
    const result = await memoryTool.handler({
      agent_id: agentId,
      replace: memoryAction === "replace" || cliOptions.replace === true,
      records: [{
        key: cliOptions.key,
        kind: cliOptions.kind,
        text: content,
        tags: parseCommaList(cliOptions.tags),
        priority,
      }],
    });
    if (cliOptions.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    output.write([
      `updated ${result.workflow?.agentId || agentId} Bootstrap Memory`,
      `items: ${result.memory?.count || 0}`,
      `added: ${result.memory?.added || 0}`,
      `digest: ${result.memory?.digest || "none"}`,
      `phase: ${result.workflow?.phase}`,
      `revision: ${result.workflow?.revision}`,
      `next: ${result.nextAction}`,
      "",
    ].join("\n"));
    return;
  }

  if (action === "skill" || action === "skills") {
    const skillAction = args[1] || "add";
    if (!["add", "create"].includes(skillAction)) {
      output.write("usage: hireme agent skill add <agent-id> <skill-name> --purpose <reusable procedure>\n");
      return;
    }
    const agentId = args[2] || cliOptions.agentId;
    const skillName = args[3] || cliOptions.skillName;
    const purpose = String(cliOptions.purpose || args.slice(4).join(" ") || "").trim();
    if (!agentId || !skillName || !purpose) {
      output.write("usage: hireme agent skill add <agent-id> <skill-name> --purpose <reusable procedure>\n");
      return;
    }
    const skillTool = byName.get("hireme_create_agent_skill");
    if (!skillTool) throw new Error("Agent skill authoring is not available.");
    const result = await skillTool.handler({
      agent_id: agentId,
      skill_name: skillName,
      purpose,
      trigger_signals: parseDetailList(cliOptions.triggers),
      input_requirements: parseDetailList(cliOptions.inputs),
      steps: parseDetailList(cliOptions.steps),
      quality_checks: parseDetailList(cliOptions.qualityChecks),
      boundaries: parseDetailList(cliOptions.boundaries),
      overwrite: cliOptions.overwrite === true,
      validate_after_update: cliOptions.noValidate !== true,
    });
    if (cliOptions.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    output.write([
      `${result.update?.created ? "created" : "updated"} private skill ${result.skill?.id || skillName}`,
      `path: ${result.skill?.path || result.update?.path}`,
      `procedure: ${result.skill?.stepCount || 0} step(s), ${result.skill?.qualityCheckCount || 0} quality check(s)`,
      `phase: ${result.workflow?.phase}`,
      `revision: ${result.workflow?.revision}`,
      `next: ${result.nextAction}`,
      "",
    ].join("\n"));
    return;
  }

  if (action === "status" || action === "workflow") {
    const agentId = args[1] || cliOptions.agentId;
    if (!agentId) {
      output.write("usage: hireme agent status <agent-id>\n");
      return;
    }
    const statusTool = byName.get("hireme_get_agent_authoring_status");
    if (!statusTool) throw new Error("Agent Authoring Layer is not available.");
    const result = await statusTool.handler({ agent_id: agentId });
    if (cliOptions.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    printAuthoringWorkflow(result.workflow);
    return;
  }

  if (action === "files") {
    const agentId = args[1] || cliOptions.agentId;
    if (!agentId) {
      output.write("usage: hireme agent files <agent-id>\n");
      return;
    }
    const filesTool = byName.get("hireme_list_local_specialist_agent_files");
    if (!filesTool) throw new Error("Local Agent creator tools are not available.");
    const result = await filesTool.handler({ agent_id: agentId });
    if (cliOptions.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    output.write(`${result.agentId} files:\n`);
    for (const file of result.files || []) {
      output.write(`  ${file.path}  ${file.visibility}  ${file.bytes} bytes\n`);
    }
    return;
  }

  if (["read", "show", "view", "cat"].includes(action)) {
    const agentId = args[1] || cliOptions.agentId;
    const path = args[2] || cliOptions.path;
    if (!agentId || !path) {
      output.write("usage: hireme agent read <agent-id> <private-path>\n");
      return;
    }
    const readTool = byName.get("hireme_read_agent_draft_file");
    if (!readTool) throw new Error("Private Harness reading is not available.");
    const result = await readTool.handler({ agent_id: agentId, path });
    if (cliOptions.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    output.write([
      `# ${result.agentId}:${result.path}`,
      `# sha256 ${result.sha256}`,
      "",
      result.content,
    ].join("\n"));
    if (!String(result.content || "").endsWith("\n")) output.write("\n");
    return;
  }

  if (["manage", "management", "author", "authoring"].includes(action)) {
    const agentId = args[1] || cliOptions.agentId;
    const instruction = args.slice(2).join(" ").trim() || String(cliOptions.instruction || "").trim();
    if (!agentId || !instruction) {
      output.write("usage: hireme agent manage <agent-id> \"authoring instruction\"\n");
      return;
    }
    const result = await runAgentManagementCommand({ agentId, instruction });
    if (cliOptions.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    output.write(`${result.outputText}\n`);
    return;
  }

  if (action === "edit" || action === "update") {
    const agentId = args[1] || cliOptions.agentId;
    const path = args[2] || cliOptions.path;
    if (!agentId || !path) {
      output.write("usage: hireme agent edit <agent-id> <path> --content <text> --overwrite\n");
      return;
    }
    let content = cliOptions.content;
    if (cliOptions.fromFile) {
      const sourcePath = resolve(workspaceDir, String(cliOptions.fromFile));
      if (!relativePathInside(workspaceDir, sourcePath)) {
        throw new Error(`Agent edit source file is outside the workspace: ${cliOptions.fromFile}`);
      }
      content = await readFile(sourcePath, "utf8");
    }
    if (content === undefined) content = args.slice(3).join(" ");
    if (content === "") {
      output.write("agent edit requires --content, --from-file, or positional content\n");
      return;
    }
    const updateTool = byName.get("hireme_update_agent_draft_file");
    if (!updateTool) throw new Error("Agent Authoring Layer is not available.");
    const result = await updateTool.handler({
      agent_id: agentId,
      path,
      content,
      overwrite: cliOptions.overwrite === true,
      expected_sha256: cliOptions.expectedSha256,
      validate_after_update: cliOptions.noValidate !== true,
    });
    if (cliOptions.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    output.write([
      `updated ${result.workflow.agentId}:${result.update.path}`,
      `sha256: ${result.update.sha256}`,
      `phase: ${result.workflow.phase}`,
      `revision: ${result.workflow.revision}`,
      `next: ${result.nextAction}`,
      "",
    ].join("\n"));
    return;
  }

  if (action === "validate" || action === "check") {
    const agentId = args[1] || cliOptions.agentId;
    if (!agentId) {
      output.write("usage: hireme agent validate <agent-id>\n");
      return;
    }
    const validateTool = byName.get("hireme_validate_agent_draft");
    if (!validateTool) throw new Error("Agent Authoring Layer is not available.");
    const result = await validateTool.handler({ agent_id: agentId });
    if (cliOptions.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    output.write(`validation: ${result.validation.valid ? "passed" : "failed"}\n`);
    printAuthoringWorkflow(result.workflow);
    return;
  }

  if (action === "test") {
    const agentId = args[1] || cliOptions.agentId;
    const task = args.slice(2).join(" ").trim() || cliOptions.task;
    if (!agentId || !task) {
      output.write("usage: hireme agent test <agent-id> <task>\n");
      return;
    }
    const testTool = byName.get("hireme_test_agent_draft");
    if (!testTool) throw new Error("Agent Authoring Layer is not available.");
    const result = await testTool.handler({
      agent_id: agentId,
      task,
      response_mode: cliOptions.responseMode,
      output_format: cliOptions.outputFormat,
    });
    if (cliOptions.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (result.result?.outputText) output.write(`\n${result.result.outputText}\n\n`);
    output.write(`test: ${result.status}${result.reason ? ` (${result.reason})` : ""}\n`);
    printAuthoringWorkflow(result.workflow);
    return;
  }

  if (action === "eval" || action === "evaluate" || action === "verify") {
    const agentId = args[1] || cliOptions.agentId;
    const task = cliOptions.task || cliOptions.evalTask || args.slice(2).join(" ").trim() || undefined;
    if (!agentId) {
      output.write("usage: hireme agent eval <agent-id> [--task <representative task>]\n");
      return;
    }
    const evaluateTool = byName.get("hireme_evaluate_agent_draft");
    if (!evaluateTool) throw new Error("Agent evaluation tools are not available.");
    const result = await evaluateTool.handler({
      agent_id: agentId,
      task,
      max_cases: cliOptions.maxCases,
    });
    if (cliOptions.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    printAgentEvaluation(result.evaluation || result.workflow?.evaluation);
    output.write(`evaluation: ${result.status}${result.reason ? ` (${result.reason})` : ""}\n`);
    printAuthoringWorkflow(result.workflow);
    return;
  }

  if (action === "package") {
    const agentId = args[1] || cliOptions.agentId;
    if (!agentId) {
      output.write("usage: hireme agent package <agent-id> [--output PATH] [--overwrite]\n");
      return;
    }
    const packageTool = byName.get("hireme_package_agent_draft");
    if (!packageTool) throw new Error("Agent Authoring Layer is not available.");
    const result = await packageTool.handler({
      agent_id: agentId,
      output_path: cliOptions.output || cliOptions.outputPath,
      package_mode: cliOptions.public ? "public" : cliOptions.packageMode,
      creator_id: cliOptions.creatorId,
      current_user_id: cliOptions.userId || cliOptions.currentUserId,
      require_test: cliOptions.skipTest !== true,
      require_evaluation: cliOptions.skipEval !== true,
      overwrite: cliOptions.overwrite === true,
    });
    if (cliOptions.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (result.status === "blocked") {
      output.write(`package blocked: ${result.reason}\n`);
      printAuthoringWorkflow(result.workflow);
      return;
    }
    output.write([
      `packaged ${result.workflow.agentId}`,
      `path: ${result.package.path}`,
      `digest: ${result.package.digest}`,
      `phase: ${result.workflow.phase}`,
      `revision: ${result.workflow.revision}`,
      result.workflow.readiness?.publishReady === true
        ? "release readiness: passed"
        : "release readiness: incomplete (development package only; run the current eval before publishing)",
      "",
    ].join("\n"));
    return;
  }

  if (action === "list" || action === "ls") {
    const sourceListTool = byName.get("hireme_list_agent_sources");
    if (sourceListTool) {
      const result = await sourceListTool.handler({
        current_user_id: cliOptions.userId,
      });
      if (cliOptions.json) {
        output.write(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }
      const localSources = (result.sources || []).filter((source) => source.source === "local");
      const hiredSources = (result.sources || []).filter((source) =>
        source.source === "db" && source.canCall);
      const availableSources = (result.sources || []).filter((source) =>
        source.source === "db" && !source.canCall);
      output.write("Local editable Agents:\n");
      for (const source of localSources) {
        output.write(`  !${source.agentId}  ${source.name}  editable=${source.authoring?.editable === true}\n`);
      }
      if (!localSources.length) output.write("  none\n");
      output.write("Hired DB Agents:\n");
      for (const source of hiredSources) {
        output.write(`  !${source.agentId}  ${source.name}  callMode=${source.callMode}\n`);
      }
      if (!hiredSources.length) output.write("  none\n");
      output.write("Available DB Agents:\n");
      for (const source of availableSources) {
        output.write(`  !${source.agentId}  ${source.name}  next=${source.nextAction}\n`);
      }
      if (!availableSources.length) output.write("  none\n");
      return;
    }

    const listTool = byName.get("hireme_list_local_specialist_agents");
    const marketplaceListTool = byName.get("hireme_marketplace_list_agents");
    const protectedListTool = byName.get("hireme_list_protected_runtime_agents");
    const result = await listTool.handler({});
    const marketplaceResult = marketplaceListTool
      ? await marketplaceListTool.handler({
          current_user_id: cliOptions.userId,
        }).catch(() => ({ agents: [] }))
      : { agents: [] };
    const protectedResult = protectedListTool && !marketplaceListTool
      ? await protectedListTool.handler({}).catch(() => ({ agents: [] }))
      : { agents: [] };
    if (cliOptions.json) {
      output.write(`${JSON.stringify({
        local: result,
        marketplace: marketplaceResult,
        protectedRuntime: protectedResult,
      }, null, 2)}\n`);
      return;
    }
    output.write("Local specialist Agents:\n");
    for (const agent of result.agents || []) {
      output.write(`  !${agent.id}  ${agent.name}\n`);
    }
    if (!result.agents?.length) output.write("  none\n");
    const marketplaceAgents = marketplaceResult.agents || [];
    const hiredAgents = marketplaceAgents.filter((agent) => agent.entitlement);
    const availableAgents = marketplaceAgents.filter((agent) => !agent.entitlement);
    output.write("Hired DB Agents:\n");
    for (const agent of hiredAgents) {
      output.write(`  !${agent.id}  ${agent.name}\n`);
    }
    if (!hiredAgents.length) output.write("  none\n");
    output.write("Available DB Agents:\n");
    for (const agent of availableAgents) {
      output.write(`  !${agent.id}  ${agent.name}\n`);
    }
    if (!availableAgents.length) output.write("  none\n");
    if (protectedResult.agents?.length) {
      output.write("Protected runtime Agents:\n");
      for (const agent of protectedResult.agents || []) {
        output.write(`  !${agent.id}  ${agent.name}\n`);
      }
    }
    return;
  }

  if (action === "resolve" || action === "source" || action === "where") {
    const agentId = args[1] || cliOptions.agentId;
    if (!agentId) {
      output.write("usage: hireme agent resolve <agent-id>\n");
      return;
    }
    const resolveTool = byName.get("hireme_resolve_agent_source");
    if (!resolveTool) throw new Error("Agent Source Layer is not available.");
    const result = await resolveTool.handler({
      agent_id: agentId,
      current_user_id: cliOptions.userId,
    });
    if (cliOptions.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    output.write([
      `${result.agentId}`,
      `source: ${result.sourceKind || result.source}`,
      `found: ${result.found}`,
      `canCall: ${result.canCall}`,
      `callMode: ${result.callMode || "none"}`,
      `entitlementRequired: ${result.entitlementRequired}`,
      `editable: ${result.authoring?.editable === true}`,
      `privateHarnessEditable: ${result.authoring?.privateHarnessEditable === true}`,
      result.nextAction ? `next: ${result.nextAction}` : null,
      "",
    ].filter(Boolean).join("\n"));
    return;
  }

  if (action === "export" || action === "pack") {
    const agentId = args[1] || cliOptions.agentId;
    if (!agentId) {
      output.write("usage: hireme agent export <agent-id> [--output PATH] [--overwrite]\n");
      return;
    }
    const exportTool = byName.get("hireme_export_local_specialist_agent");
    const result = await exportTool.handler({
      agent_id: agentId,
      output_path: cliOptions.output || cliOptions.outputPath,
      package_mode: cliOptions.public ? "public" : cliOptions.packageMode,
      creator_id: cliOptions.creatorId,
      current_user_id: cliOptions.userId || cliOptions.currentUserId,
      overwrite: cliOptions.overwrite === true,
    });
    if (cliOptions.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    output.write([
      `exported ${result.agent.id}`,
      `path: ${result.path}`,
      `archive: ${result.archiveFormat || "unknown"} (${result.archiveBytes || 0} bytes)`,
      `digest: ${result.digest}`,
      `files: ${result.fileCount}`,
      result.ownership?.creatorId ? `creator: ${result.ownership.creatorId}` : null,
      result.protection?.localMaterialization
        ? `local materialization: ${result.protection.localMaterialization}`
        : null,
      result.includesPrivate
        ? "contains private harness files; keep this package protected"
        : "public-safe package only",
      "",
    ].join("\n"));
    return;
  }

  if (action === "import" || action === "unpack") {
    const packagePath = args[1] || cliOptions.packagePath || cliOptions.input;
    if (!packagePath) {
      output.write("usage: hireme agent import <package-path> [--overwrite]\n");
      return;
    }
    const importTool = byName.get("hireme_import_local_specialist_agent");
    const result = await importTool.handler({
      package_path: packagePath,
      current_user_id: cliOptions.userId || cliOptions.currentUserId,
      overwrite: cliOptions.overwrite === true,
    });
    mentionCatalogCache = null;
    if (cliOptions.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    output.write([
      `imported ${result.agent.id}`,
      `folder: ${result.folderPath}`,
      `digest: ${result.digest}`,
      `files: ${result.fileCount}`,
      "",
    ].join("\n"));
    return;
  }

  if (action === "call" || action === "run") {
    const agentId = args[1] || cliOptions.agentId;
    const task = args.slice(2).join(" ").trim() || cliOptions.task;
    if (!agentId || !task) {
      output.write("usage: hireme agent call <agent-id> <task>\n");
      return;
    }
    const result = await callAgentFromCli({ byName, agentId, task, cliOptions });
    if (cliOptions.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    output.write(`\n${result.outputText || JSON.stringify(result, null, 2)}\n`);
    if (result.runtime) {
      output.write([
        "runtime:",
        result.runtime.executionMode,
        `localHarnessMaterialized=${result.runtime.localHarnessMaterialized}`,
        `localPlaintextCache=${result.runtime.localPlaintextCache}`,
      ].join(" "));
      output.write("\n");
    }
    output.write("\n");
    return;
  }

  output.write(`unknown agent command: ${action}\n`);
  output.write("usage: hireme agent templates|init|create|status|memory|skill|files|read|edit|manage|validate|test|eval|package|list|resolve|export|import|call\n");
}

async function runAgentManagementCommand({ agentId, instruction }) {
  const targetAgentId = String(agentId || "").trim().replace(/^!+/, "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(targetAgentId)) {
    throw new Error("Invalid Agent id for management mode.");
  }
  const managementTools = createRuntimeTools({
    mode: "agent_authoring",
    targetAgentId,
    explicitAgentControl: false,
  });
  const managementAgent = createStandaloneAgent({
    profile,
    model: activeProvider,
    memory,
    tools: managementTools,
    limits: {
      maxIterations: readInteger(options.maxIterations, 8),
      maxToolCalls: readInteger(options.maxToolCalls, 10),
    },
  });
  const goal = [
    "[Verified HireMe CLI Agent management mode]",
    `Target Agent: ${targetAgentId}`,
    "This mode came from the explicit `hireme agent manage` control command, not from user text in work mode.",
    "Inspect existing private files when needed, update only this Agent, validate useful changes, and never echo private source in the final response.",
    "",
    "Creator instruction:",
    instruction,
  ].join("\n");
  return managementAgent.run({
    goal,
    context: {
      workspaceDir,
      stateDir,
      sessionId,
      runtimeMode: "agent_authoring",
      authoringTargetAgentId: targetAgentId,
      managementPolicyText: instruction,
      cli: {
        command: "hireme agent manage",
        hireMeTools: true,
      },
    },
  });
}

function printAuthoringWorkflow(workflow) {
  output.write([
    `${workflow.agentId}`,
    `phase: ${workflow.phase}`,
    `revision: ${workflow.revision}`,
    `template: ${workflow.template}`,
    `validation: ${workflow.validation?.valid === true && workflow.validation?.current ? "passed" : "required"}`,
    `test: ${workflow.test?.status === "completed" && workflow.test?.current ? "passed" : "required"}`,
    `eval: ${workflow.evaluation?.status === "completed" && workflow.evaluation?.current ? "passed" : "required"}`,
    `package: ${workflow.package?.current ? workflow.package.path : "required"}`,
    `memoryReady: ${workflow.readiness?.memoryReady === true}`,
    `memoryCustomized: ${workflow.readiness?.memoryCustomized === true}`,
    `functionalEval: ${workflow.readiness?.functionalEval === true}`,
    `leakageEval: ${workflow.readiness?.leakageEval === true}`,
    `previewFree: ${workflow.readiness?.previewFree === true}`,
    `starterFree: ${workflow.readiness?.starterFree === true}`,
    `publishReady: ${workflow.readiness?.publishReady === true}`,
    `next: ${workflow.nextAction}`,
    "",
  ].join("\n"));
}

function printAgentEvaluation(evaluation) {
  if (!evaluation) {
    output.write("No current evaluation report. Run `hireme agent eval <agent-id>`.\n");
    return;
  }
  output.write([
    "Evaluation:",
    `  ${evaluation.passedCount || 0}/${evaluation.caseCount || 0} cases passed`,
    `  functional: ${evaluation.functionalPassed === true ? "passed" : "failed"}`,
    `  privacy: ${evaluation.privacyPassed === true ? "passed" : "failed"}`,
    `  model-backed: ${evaluation.previewFree === true ? "yes" : "no"}`,
    `  non-starter: ${evaluation.starterFree === true ? "yes" : "no"}`,
    ...(evaluation.cases || [])
      .filter((testCase) => testCase.passed !== true)
      .map((testCase) => `  ${testCase.id}: ${testCase.failedChecks?.join(", ") || "failed"}`),
  ].join("\n") + "\n");
}

async function callAgentFromCli({ byName, agentId, task, cliOptions }) {
  const sourceCallTool = byName.get("hireme_call_agent_source");
  if (sourceCallTool) {
    return sourceCallTool.handler({
      agent_id: agentId,
      task,
      conversation_id: cliOptions.session,
      response_mode: cliOptions.responseMode,
      output_format: cliOptions.outputFormat,
      current_user_id: cliOptions.userId,
    });
  }

  const localListTool = byName.get("hireme_list_local_specialist_agents");
  const localCallTool = byName.get("hireme_call_local_specialist_agent");
  if (localListTool && localCallTool) {
    const localResult = await localListTool.handler({}).catch(() => ({ agents: [] }));
    if ((localResult.agents || []).some((agent) => agent.id === agentId)) {
      return localCallTool.handler({
        agent_id: agentId,
        task,
        response_mode: cliOptions.responseMode,
        output_format: cliOptions.outputFormat,
      });
    }
  }

  const entitlementTool = byName.get("hireme_marketplace_get_entitlement");
  const protectedListTool = byName.get("hireme_list_protected_runtime_agents");
  const protectedCallTool = byName.get("hireme_call_protected_agent_runtime");
  if (entitlementTool && protectedCallTool) {
    const entitlement = await entitlementTool.handler({
      agent_id: agentId,
      current_user_id: cliOptions.userId,
    }).catch((err) => {
      if (err?.code === "marketplace_agent_not_found") return null;
      throw err;
    });
    if (entitlement) {
      if (!entitlement.allowed) {
        return entitlementRequiredResult({ agentId, entitlement });
      }
      return protectedCallTool.handler({
        agent_id: agentId,
        task,
        conversation_id: cliOptions.session,
        response_mode: cliOptions.responseMode,
        output_format: cliOptions.outputFormat,
      });
    }
  }

  if (protectedListTool && protectedCallTool) {
    const protectedResult = await protectedListTool.handler({}).catch(() => ({ agents: [] }));
    if ((protectedResult.agents || []).some((agent) => agent.id === agentId)) {
      return protectedCallTool.handler({
        agent_id: agentId,
        task,
        conversation_id: cliOptions.session,
        response_mode: cliOptions.responseMode,
        output_format: cliOptions.outputFormat,
      });
    }
  }

  throw new Error(`No callable Agent found: ${agentId}`);
}

function entitlementRequiredResult({ agentId, entitlement }) {
  return {
    schema: "hireme.specialist_agent.output.v1",
    agentId,
    status: "refused",
    responseMode: "direct_answer",
    outputText: [
      `DB Agent "${agentId}" is not hired for this local HireMe user yet.`,
      `Run \`hireme marketplace hire ${agentId}\` before calling it, or inspect the public card with \`hireme marketplace inspect ${agentId}\`.`,
    ].join("\n"),
    structuredResult: {
      summary: "DB Agent entitlement required.",
      recommendations: [entitlement?.nextAction || `hireme marketplace hire ${agentId}`],
    },
    artifacts: [],
    evidence: [],
    assumptions: [],
    risks: [],
    memoryDeltas: [],
    runtime: {
      executionMode: entitlement?.agent?.runtime?.executionMode || "remote_trusted_executor",
      entitlementRequired: true,
      entitlementReason: entitlement?.reason || "not_hired",
      localHarnessMaterialized: false,
      localPlaintextCache: false,
      safeOutputOnly: true,
    },
  };
}

async function handleModelCommand(args, cliOptions = {}) {
  const action = args[0] || "show";
  if (action === "list" || action === "ls") {
    output.write(`${JSON.stringify(defaultModelOptions(), null, 2)}\n`);
    return;
  }
  if (action === "set") {
    const provider = args[1] || "codex";
    const model = args[2] || "";
    if (!["codex", "openai", "ollama", "fixture"].includes(provider)) {
      throw new Error(`Unsupported provider: ${provider}`);
    }
    const next = {
      ...(await readHireMeConfig({ configPath: cliOptions.config })),
      provider,
      model: model || null,
      updatedAt: new Date().toISOString(),
    };
    await writeHireMeConfig(next, { configPath: cliOptions.config });
    output.write(`default model set: ${provider}${model ? `:${model}` : ""}\n`);
    return;
  }
  if (action === "clear" || action === "reset") {
    const next = {
      ...(await readHireMeConfig({ configPath: cliOptions.config })),
      provider: null,
      model: null,
      updatedAt: new Date().toISOString(),
    };
    await writeHireMeConfig(next, { configPath: cliOptions.config });
    output.write("default model cleared\n");
    return;
  }
  const config = await readHireMeConfig({ configPath: cliOptions.config });
  output.write(`${JSON.stringify({
    provider: config.provider || "codex",
    model: config.model || null,
    configPath: cliOptions.config || hiremeConfigPath(),
    examples: [
      "hireme model set codex gpt-5.5",
      "hireme model set codex gpt-5.5-pro",
      "hireme model set openai gpt-5.4-nano",
      "hireme model set ollama gpt-oss:120b",
      "hireme model clear",
    ],
  }, null, 2)}\n`);
}

async function handleImageBridgeCommand(args, cliOptions = {}, { interactive = false } = {}) {
  const action = args[0] || "show";
  if (action === "show" || action === "status") {
    const config = await readHireMeConfig({ configPath: cliOptions.config });
    output.write(`${JSON.stringify(publicImageBridgeStatus(config, cliOptions), null, 2)}\n`);
    return;
  }

  if (action === "set") {
    const command = args[1] || cliOptions.imageBridgeCommand;
    if (!command) {
      output.write("usage: hireme image-bridge set <command> [bridge args...]\n");
      output.write("example: hireme image-bridge set /path/to/image-provider-command\n");
      return;
    }
    const bridgeArgs =
      parseBridgeArgList(cliOptions.imageBridgeArgs) ||
      args.slice(2).filter(Boolean);
    const timeoutMs = readInteger(
      cliOptions.imageBridgeTimeoutMs,
      120_000,
    );
    await saveImageBridgeConfig({
      command,
      args: bridgeArgs,
      timeoutMs,
      cliOptions,
    });
    if (interactive) await reloadRuntimeImageBridge(cliOptions);
    output.write(`image bridge saved: ${command}${bridgeArgs.length ? ` ${bridgeArgs.join(" ")}` : ""}\n`);
    return;
  }

  if (action === "set-fixture") {
    const command = process.execPath;
    const bridgeArgs = [resolve(repoRoot, "scripts/fixtures/codex-image-gen-fixture.mjs")];
    await saveImageBridgeConfig({
      command,
      args: bridgeArgs,
      timeoutMs: 120_000,
      cliOptions,
    });
    if (interactive) await reloadRuntimeImageBridge(cliOptions);
    output.write("image bridge saved to local fixture mode; this validates the contract but does not generate real images.\n");
    return;
  }

  if (action === "set-openai-codex" || action === "set-openai" || action === "set-native") {
    const command = process.execPath;
    const bridgeArgs = [resolve(repoRoot, "scripts/openai-codex-image-gen-native.mjs")];
    await saveImageBridgeConfig({
      command,
      args: bridgeArgs,
      timeoutMs: readInteger(cliOptions.imageBridgeTimeoutMs, 210_000),
      cliOptions,
    });
    if (interactive) await reloadRuntimeImageBridge(cliOptions);
    output.write("image bridge saved to native OpenAI Codex OAuth mode (openai/gpt-image-2, no OpenClaw process).\n");
    return;
  }

  if (action === "set-openclaw" || action === "set-openai-codex-openclaw") {
    const command = process.execPath;
    const bridgeArgs = [resolve(repoRoot, "scripts/openai-codex-image-gen-bridge.mjs")];
    await saveImageBridgeConfig({
      command,
      args: bridgeArgs,
      timeoutMs: readInteger(cliOptions.imageBridgeTimeoutMs, 210_000),
      cliOptions,
    });
    if (interactive) await reloadRuntimeImageBridge(cliOptions);
    output.write("image bridge saved to OpenAI Codex OAuth compatibility mode through the OpenClaw transport adapter.\n");
    return;
  }

  if (action === "auth-status" || action === "openai-codex-status") {
    output.write(`${JSON.stringify(await getOpenAICodexAuthStatus(), null, 2)}\n`);
    return;
  }

  if (action === "import-openai-codex" || action === "import-openclaw") {
    const result = await importOpenClawOpenAICodexProfiles();
    output.write(`${JSON.stringify({
      authPath: result.authPath,
      importedCount: result.importedCount,
      selectedProfileId: result.selectedProfileId,
      profileIds: result.profileIds,
    }, null, 2)}\n`);
    return;
  }

  if (action === "login-openai-codex" || action === "login-openai") {
    const result = await loginOpenAICodex({
      authPath: openAICodexAuthPath(),
      onAuth: async ({ url, callbackListening }) => {
        output.write(`OpenAI Codex OAuth login URL:\n${url}\n`);
        if (!callbackListening) {
          output.write("Local callback port is not available; paste the final callback URL or code below.\n");
        }
      },
      manualCodeProvider: input.isTTY
        ? async ({ url }) => {
            const rl = createInterface({ input, output });
            try {
              output.write("If the browser does not finish automatically, paste the callback URL or code.\n");
              output.write(`${url}\n`);
              return await rl.question("callback URL/code: ");
            } finally {
              rl.close();
            }
          }
        : null,
    });
    output.write(`${JSON.stringify({
      authPath: result.authPath,
      profileId: result.profileId,
      email: result.email,
      accountId: result.accountId,
      expires: result.expires,
    }, null, 2)}\n`);
    return;
  }

  if (action === "clear" || action === "reset") {
    const config = await readHireMeConfig({ configPath: cliOptions.config });
    delete config.imageGeneration;
    config.updatedAt = new Date().toISOString();
    await writeHireMeConfig(config, { configPath: cliOptions.config });
    if (interactive) await reloadRuntimeImageBridge(cliOptions);
    output.write("image bridge cleared\n");
    return;
  }

  if (action === "test" || action === "doctor") {
    await testImageBridge(cliOptions);
    return;
  }

  output.write(`unknown image-bridge command: ${action}\n`);
  output.write("usage: hireme image-bridge show|set|set-openai-codex|set-openclaw|login-openai-codex|import-openai-codex|auth-status|set-fixture|test|clear\n");
}

async function saveImageBridgeConfig({ command, args, timeoutMs, cliOptions }) {
  const config = await readHireMeConfig({ configPath: cliOptions.config });
  config.imageGeneration = {
    kind: "codex_host_bridge",
    command,
    args,
    timeoutMs,
    updatedAt: new Date().toISOString(),
  };
  config.updatedAt = new Date().toISOString();
  await writeHireMeConfig(config, { configPath: cliOptions.config });
}

async function reloadRuntimeImageBridge(cliOptions) {
  const nextConfig = await readHireMeConfig({ configPath: cliOptions.config });
  activeImageBridge = resolveImageBridgeConfig({
    config: nextConfig,
    cliOptions,
  });
  tools = createRuntimeTools();
  activeAgent = createRuntimeAgent();
  mentionCatalogCache = null;
}

async function testImageBridge(cliOptions = {}) {
  const config = await readHireMeConfig({ configPath: cliOptions.config });
  const bridge = resolveImageBridgeConfig({ config, cliOptions });
  if (!bridge.configured) {
    output.write("image bridge is not configured. Run `hireme image-bridge set <command>` first.\n");
    return;
  }

  const commandWorkspaceDir = resolve(cliOptions.workspace || process.cwd());
  const commandStateDir = resolve(
    cliOptions.stateDir || commandWorkspaceDir,
    cliOptions.stateDir ? "" : ".hireme/tmp/image-bridge-test",
  );
  const outputPath = relativePathInside(commandWorkspaceDir, resolve(commandStateDir, "image-bridge-test.png")) ||
    ".hireme/tmp/image-bridge-test/test.png";
  const bridgeTools = createDefaultTools({
    workspaceDir: commandWorkspaceDir,
    stateDir: commandStateDir,
    enableHireMeTools: true,
    enableLocalSpecialistTools: false,
    imageArtifactOptions: bridge.imageArtifactOptions,
  });
  const materializeImage = bridgeTools.find(
    (tool) => tool.name === "hireme_materialize_specialist_image_artifact",
  );
  const result = await materializeImage.handler({
    specialist_result: {
      schema: "hireme.specialist_agent.output.v1",
      agentId: "hireme-image-bridge-test",
      status: "completed",
      responseMode: "artifact_spec",
      outputText: "Generate a simple test PNG.",
      structuredResult: {
        imageSpec: {
          brief:
            "Create a tiny simple test image. This is only a HireMe codex_image_gen bridge connectivity check.",
          forbidden: ["text", "watermark"],
        },
      },
      artifacts: [
        {
          kind: "image_spec",
          filename: "hireme-image-bridge-test.json",
          mimeType: "application/json",
        },
      ],
    },
    provider: "codex_image_gen",
    output_path: outputPath,
    overwrite: true,
  });

  output.write(`${JSON.stringify({
    configured: true,
    source: bridge.source,
    command: bridge.command,
    status: result.status,
    provider: result.provider,
    path: result.path,
    mimeType: result.mimeType || null,
    bytes: result.bytes,
    error: result.error || null,
    commandResult: result.commandResult || null,
  }, null, 2)}\n`);
}

function relativePathInside(root, target) {
  const rel = relative(resolve(root), resolve(target));
  if (!rel || rel.startsWith("..") || /^[A-Za-z]:/.test(rel)) return null;
  return rel;
}

function parseBridgeArgList(value) {
  if (value == null || value === "") return null;
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
  } catch {
    return String(value).split(/\s+/).filter(Boolean);
  }
}

function defaultModelOptions() {
  return {
    codex: [
      {
        model: null,
        label: "Codex default",
        note: "Use the model configured in Codex CLI.",
      },
      {
        model: "gpt-5.5",
        label: "GPT-5.5",
      },
      {
        model: "gpt-5.5-pro",
        label: "GPT-5.5 Pro",
      },
      {
        model: "gpt-5.4",
        label: "GPT-5.4",
      },
      {
        model: "gpt-5.4-codex",
        label: "GPT-5.4 Codex",
      },
      {
        model: "gpt-5.4-nano",
        label: "GPT-5.4 Nano",
      },
    ],
    openai: ["gpt-5.5", "gpt-5.5-pro", "gpt-5.4", "gpt-5.4-pro", "gpt-5.4-mini", "gpt-5.4-nano"],
    ollama: ["gpt-oss:120b", "gpt-oss:20b"],
    fixture: ["fixture"],
  };
}

function runCodexPassthrough(args) {
  return new Promise((resolveCode, rejectCode) => {
    const child = spawn("codex", args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OPENAI_API_KEY:
          process.env.HIREME_CODEX_ALLOW_OPENAI_API_KEY === "1"
            ? process.env.OPENAI_API_KEY
            : "",
      },
      stdio: "inherit",
    });
    child.on("error", rejectCode);
    child.on("exit", (code) => resolveCode(code || 0));
  });
}

function chooseDefaultProvider() {
  if (process.env.HIREME_AGENT_PROVIDER) return process.env.HIREME_AGENT_PROVIDER;
  return "codex";
}

function normalizeSavedProvider(provider) {
  const text = String(provider || "codex").trim().toLowerCase();
  if (["openai-oauth", "codex-oauth", "oauth", "chatgpt"].includes(text)) {
    return "codex";
  }
  return text;
}

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (!arg.startsWith("--")) {
      parsed._.push(arg);
      continue;
    }
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const key = toCamelCase(rawKey);
    if (
      [
        "json",
        "chat",
        "allowShell",
        "noHiremeTools",
        "overwrite",
        "public",
        "try",
        "skipTest",
        "skipEval",
        "noValidate",
        "replace",
      ].includes(key)
    ) {
      parsed[key] = true;
      continue;
    }
    const next = inlineValue ?? argv[i + 1];
    if (inlineValue == null) i += 1;
    parsed[key] = next;
  }
  return parsed;
}

function normalizeRuntimeMode(value) {
  const mode = String(value || "work").trim().toLowerCase();
  if (!["work", "agent_authoring"].includes(mode)) {
    throw new Error(`Unsupported runtime mode: ${value}`);
  }
  return mode;
}

function toCamelCase(value) {
  return String(value || "").replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function parseCommaList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDetailList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value || "")
    .split(/\n|\s*\|\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function humanizeAgentId(value) {
  return String(value || "Agent")
    .replace(/^!+/, "")
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ") || "Agent";
}

function readInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function safeName(value) {
  return String(value || "session")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "session";
}

function dirnameSafe(path) {
  return dirname(path);
}

function loadEnvFiles(paths) {
  for (const path of paths) {
    let text = "";
    try {
      text = readFileSync(path, "utf8");
    } catch (err) {
      if (err?.code !== "ENOENT") throw err;
      continue;
    }
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
      if (!match || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = stripEnvQuotes(match[2]);
    }
  }
}

function stripEnvQuotes(value) {
  const text = String(value || "").trim();
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1);
  }
  return text;
}
