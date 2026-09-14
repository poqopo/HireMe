#!/usr/bin/env node

import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import {
  applyComposerKey,
  composerRenderModel,
  createComposerState,
  extractResultArtifacts,
  formatContextPrompt,
  formatResumeNotice,
  friendlyToolLabel,
  measureTerminalText,
  renderArtifactBlocks,
  renderTerminalMarkdown,
  sanitizeTerminalText,
  terminalColorEnabled,
} from "../apps/agent/src/cliUi.mjs";

const stateDir = resolve(".hireme/tmp/cli-ux-smoke");
await rm(stateDir, { recursive: true, force: true });

try {
  let composer = createComposerState({ history: ["first command", "second command"] });
  composer = typeText(composer, "first line");
  composer = applyComposerKey(composer, {
    key: { name: "enter", shift: true },
  }).state;
  composer = typeText(composer, "second line");
  if (composer.value !== "first line\nsecond line") {
    throw new Error("Shift+Enter did not insert a multiline composer line break.");
  }

  composer = applyComposerKey(composer, { key: { name: "left" } }).state;
  composer = applyComposerKey(composer, { str: "!", key: { name: "!" } }).state;
  if (composer.value !== "first line\nsecond lin!e") {
    throw new Error("Composer cursor editing did not insert text at the cursor.");
  }

  let historyComposer = createComposerState({ history: ["first command", "second command"] });
  historyComposer = applyComposerKey(historyComposer, { key: { name: "up" } }).state;
  if (historyComposer.value !== "second command") {
    throw new Error("Composer Up key did not load the latest input history item.");
  }
  historyComposer = applyComposerKey(historyComposer, { key: { name: "up" } }).state;
  if (historyComposer.value !== "first command") {
    throw new Error("Composer history did not move to the previous item.");
  }
  historyComposer = applyComposerKey(historyComposer, { key: { name: "down" } }).state;
  if (historyComposer.value !== "second command") {
    throw new Error("Composer Down key did not move forward through input history.");
  }

  const suggestions = [
    {
      kind: "agent",
      label: "!dokpami-create-agent  Dokpami",
      insert: "!dokpami-create-agent ",
    },
    {
      kind: "agent",
      label: "!document-reviewer  Document Reviewer",
      insert: "!document-reviewer ",
    },
  ];
  let suggestionComposer = createComposerState();
  suggestionComposer = typeText(suggestionComposer, "!d");
  suggestionComposer = applyComposerKey(suggestionComposer, {
    key: { name: "down" },
    suggestions,
  }).state;
  suggestionComposer = applyComposerKey(suggestionComposer, {
    key: { name: "tab" },
    suggestions,
  }).state;
  if (suggestionComposer.value !== "!document-reviewer ") {
    throw new Error("Autocomplete direction selection and Tab application did not work.");
  }
  let commandComposer = createComposerState();
  commandComposer = typeText(commandComposer, "/logs");
  const exactCommand = applyComposerKey(commandComposer, {
    key: { name: "enter" },
    suggestions: [{
      kind: "command",
      label: "/logs  Show latest run log",
      insert: "/logs ",
    }],
  });
  if (exactCommand.action !== "submit" || exactCommand.state.value !== "/logs") {
    throw new Error("An exact command palette match should submit with one Enter.");
  }

  const contextPrompt = formatContextPrompt({
    agent: { id: "dokpami-create-agent" },
    file: { path: "base.png" },
    columns: 48,
  });
  if (!contextPrompt.includes("!dokpami-create-agent") || !contextPrompt.includes("@base.png")) {
    throw new Error("Context-aware prompt did not expose active Agent and file selections.");
  }
  const render = composerRenderModel({
    prompt: contextPrompt,
    state: suggestionComposer,
    suggestions,
    columns: 48,
  });
  if (
    !render.text.includes("+ Agents") ||
    !render.text.includes("> !dokpami-create-agent") ||
    render.rows < 5
  ) {
    throw new Error("Composer render model did not include context and suggestion rows.");
  }
  const koreanPosition = measureTerminalText("독팜희", 80);
  if (koreanPosition.column !== 6) {
    throw new Error("Terminal width calculation did not account for Korean wide characters.");
  }

  if (
    friendlyToolLabel("hireme_materialize_specialist_image_artifact") !==
      "Creating image artifact" ||
    formatResumeNotice([{ role: "user" }, { role: "assistant" }]) !==
      "resumed 1 prior message"
  ) {
    throw new Error("Progress labels or resumed-session notice are not user-facing.");
  }

  const markdown = renderTerminalMarkdown([
    "# Result",
    "",
    "- first item",
    "- second item with `code`",
    "",
    "```diff",
    "+ added",
    "- removed",
    "```",
    "",
    "| Name | Status |",
    "| --- | --- |",
    "| Agent | Ready |",
  ].join("\n"), { width: 60, color: false });
  if (
    !markdown.includes("Result") ||
    !markdown.includes("- first item") ||
    !markdown.includes("code · diff") ||
    !markdown.includes("| Name") ||
    markdown.includes("```")
  ) {
    throw new Error("Terminal Markdown renderer did not format structured output.");
  }
  const narrowTable = renderTerminalMarkdown([
    "| One | Two | Three | Four |",
    "| --- | --- | --- | --- |",
    "| A | B | C | D |",
  ].join("\n"), { width: 24, color: false });
  if (!narrowTable.includes("One: A") || !narrowTable.includes("Four: D")) {
    throw new Error("Narrow Markdown tables did not fall back to a responsive vertical layout.");
  }
  if (
    sanitizeTerminalText("safe\x1b[31munsafe\x1b[0m") !== "safeunsafe" ||
    terminalColorEnabled({ isTTY: true, env: { TERM: "xterm", NO_COLOR: "1" } }) !== false
  ) {
    throw new Error("Terminal renderer did not sanitize control sequences or honor NO_COLOR.");
  }

  const artifactResults = extractResultArtifacts({
    observations: [
      {
        tool: "write_file",
        ok: true,
        observation: { path: "artifacts/result.md", bytes: 120 },
      },
      {
        tool: "hireme_materialize_specialist_image_artifact",
        ok: true,
        observation: {
          path: "artifacts/result.png",
          bytes: 2048,
          mimeType: "image/png",
          status: "completed",
        },
      },
    ],
  });
  if (
    artifactResults.length !== 2 ||
    artifactResults[0].kind !== "file" ||
    artifactResults[1].kind !== "image"
  ) {
    throw new Error("Terminal artifact block extraction did not find created files and images.");
  }
  const artifactPanel = renderArtifactBlocks(artifactResults, { color: false });
  if (
    !artifactPanel.includes("FILE CREATED") ||
    !artifactPanel.includes("IMAGE CREATED") ||
    !artifactPanel.includes("artifacts/result.png") ||
    !artifactPanel.includes("image/png · 2.0 KB")
  ) {
    throw new Error("Terminal artifact panel did not render file and image metadata.");
  }

  const retryFlow = await runInteractive([
    "bin/hireme.mjs",
    "--provider",
    "fixture",
    "--state-dir",
    stateDir,
    "--session",
    "retry-flow",
    "--max-iterations",
    "1",
  ], "force the first run to exceed its iteration budget\n/retry\n/logs\n/context\n/help\n/exit\n");
  if (
    !retryFlow.stdout.includes("Agent iteration budget exceeded") ||
    !retryFlow.stdout.includes("Use /retry to run the same request again.") ||
    !retryFlow.stdout.includes("Standalone agent fixture completed.") ||
    !retryFlow.stdout.includes("Run activity") ||
    !retryFlow.stdout.includes("Active context") ||
    !retryFlow.stdout.includes("/logs") ||
    !retryFlow.stdout.includes("bye")
  ) {
    throw new Error("Interactive error recovery did not keep the session alive and complete /retry.");
  }

  const queuedTty = await runQueuedTtyFlow();
  const firstAnswer = queuedTty.indexOf("Goal: first queued request");
  const secondAnswer = queuedTty.indexOf("Goal: second queued request");
  const secondQueuedEcho = queuedTty.indexOf("> second queued request");
  const secondQueueContext = secondQueuedEcho >= 0
    ? queuedTty.slice(Math.max(0, secondQueuedEcho - 500), secondQueuedEcho)
    : "";
  if (
    !queuedTty.includes("Enter queues") ||
    !queuedTty.includes("Esc cancel") ||
    !queuedTty.includes("1 queued") ||
    !secondQueueContext.includes("queue") ||
    secondQueuedEcho < 0 ||
    secondQueuedEcho >= firstAnswer ||
    firstAnswer < 0 ||
    secondAnswer < 0 ||
    secondAnswer <= firstAnswer
  ) {
    throw new Error("TTY input submitted during an active run was not processed in FIFO order.");
  }

  const controlTty = await runExecutionControlTtyFlow();
  if (
    !controlTty.includes("Queued requests:") ||
    !controlTty.includes("second control request") ||
    !controlTty.includes("dropped queued request #1") ||
    !controlTty.includes("cancelling current run") ||
    !controlTty.includes("Run cancelled.")
  ) {
    throw new Error("TTY execution controls did not list/drop/cancel an active run.");
  }

  console.log("HireMe CLI UX smoke passed");
  console.log("Verified: multiline/editor -> overlays -> Markdown/artifacts -> collapsed logs -> failure recovery -> active-run FIFO queue -> execution controls");
} finally {
  await rm(stateDir, { recursive: true, force: true }).catch(() => {});
}

function typeText(state, text) {
  let current = state;
  for (const char of text) {
    current = applyComposerKey(current, {
      str: char,
      key: { name: char },
    }).state;
  }
  return current;
}

async function runInteractive(args, stdinText) {
  const child = spawn(process.execPath, args, {
    env: {
      ...process.env,
      HIREME_AGENT_PROVIDER: "fixture",
      OPENAI_API_KEY: "",
      OLLAMA_API_KEY: "",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdin.write(stdinText);
  child.stdin.end();
  const [exitCode] = await once(child, "exit");
  if (exitCode !== 0) {
    throw new Error(`node ${args.join(" ")} failed with ${exitCode}\n${stderr}`);
  }
  return { stdout, stderr };
}

async function runQueuedTtyFlow() {
  const transcriptPath = resolve(stateDir, "queued-tty-session.log");
  const expectProgram = [
    "set timeout 12",
    `log_file -noappend ${tclBrace(transcriptPath)}`,
    [
      "spawn",
      tclBrace(process.execPath),
      "bin/hireme.mjs",
      "--provider fixture",
      `--state-dir ${tclBrace(stateDir)}`,
      "--session queued-tty-flow",
    ].join(" "),
    'expect "HireMe Agent"',
    'send -- "first queued request\\r"',
    "after 120",
    'send -- "second queued request\\r"',
    'expect "Goal: second queued request"',
    'send -- "/exit\\r"',
    "expect eof",
    "set result [wait]",
    "exit [lindex $result 3]",
  ].join("\n");
  const child = spawn("expect", ["-c", expectProgram], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TERM: "xterm-256color",
      NO_COLOR: "1",
      HIREME_AGENT_PROVIDER: "fixture",
      HIREME_FIXTURE_DELAY_MS: "250",
      OPENAI_API_KEY: "",
      OLLAMA_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stdout.resume();
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const [exitCode] = await once(child, "exit");
  if (exitCode !== 0) {
    throw new Error(`queued TTY flow failed with ${exitCode}\n${stderr}`);
  }
  return readFile(transcriptPath, "utf8");
}

async function runExecutionControlTtyFlow() {
  const transcriptPath = resolve(stateDir, "execution-control-tty-session.log");
  const expectProgram = [
    "set timeout 15",
    `log_file -noappend ${tclBrace(transcriptPath)}`,
    [
      "spawn",
      tclBrace(process.execPath),
      "bin/hireme.mjs",
      "--provider fixture",
      `--state-dir ${tclBrace(stateDir)}`,
      "--session execution-control-tty-flow",
    ].join(" "),
    'expect "HireMe Agent"',
    'send -- "first control request\\r"',
    "after 120",
    'send -- "second control request\\r"',
    "after 120",
    'send -- "/queue\\r"',
    'expect "Queued requests:"',
    'send -- "/drop 1\\r"',
    'expect "dropped queued request #1"',
    'send -- "\\033"',
    'expect "Run cancelled."',
    'send -- "/exit\\r"',
    "expect eof",
    "set result [wait]",
    "exit [lindex $result 3]",
  ].join("\n");
  const child = spawn("expect", ["-c", expectProgram], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TERM: "xterm-256color",
      NO_COLOR: "1",
      HIREME_AGENT_PROVIDER: "fixture",
      HIREME_FIXTURE_DELAY_MS: "2000",
      OPENAI_API_KEY: "",
      OLLAMA_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stdout.resume();
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const [exitCode] = await once(child, "exit");
  if (exitCode !== 0) {
    throw new Error(`execution control TTY flow failed with ${exitCode}\n${stderr}`);
  }
  return readFile(transcriptPath, "utf8");
}

function tclBrace(value) {
  return `{${String(value || "").replace(/}/g, "\\}")}}`;
}
