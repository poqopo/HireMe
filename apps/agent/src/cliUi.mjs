export function createComposerState({ history = [] } = {}) {
  const normalizedHistory = history
    .map((item) => String(item || ""))
    .filter(Boolean)
    .slice(-100);
  return {
    value: "",
    cursor: 0,
    history: normalizedHistory,
    historyIndex: normalizedHistory.length,
    historyDraft: "",
    suggestionIndex: 0,
    suggestionsDismissed: false,
  };
}

export function applyComposerKey(state, { str = "", key = {}, suggestions = [] } = {}) {
  const current = normalizeComposerState(state);
  const visibleSuggestions = current.suggestionsDismissed ? [] : suggestions;
  const name = String(key.name || "").toLowerCase();

  if (key.ctrl && name === "c") {
    return { state: setComposerValue(current, "/exit"), action: "submit" };
  }
  if (key.shift && (name === "return" || name === "enter")) {
    return { state: insertText(current, "\n"), action: "render" };
  }
  if (name === "return" || name === "enter") {
    if (visibleSuggestions.length) {
      const selected = visibleSuggestions[
        wrapIndex(current.suggestionIndex, visibleSuggestions.length)
      ];
      if (String(selected?.insert || "").trim() === current.value.trim()) {
        return { state: current, action: "submit" };
      }
      return {
        state: applySuggestion(current, visibleSuggestions),
        action: "render",
      };
    }
    return { state: current, action: "submit" };
  }
  if (name === "tab") {
    if (!visibleSuggestions.length) return { state: current, action: "render" };
    if (key.shift) {
      return {
        state: {
          ...current,
          suggestionIndex: wrapIndex(
            current.suggestionIndex - 1,
            visibleSuggestions.length,
          ),
        },
        action: "render",
      };
    }
    return {
      state: applySuggestion(current, visibleSuggestions),
      action: "render",
    };
  }
  if (name === "escape" || name === "esc") {
    return {
      state: {
        ...current,
        suggestionsDismissed: true,
      },
      action: "render",
    };
  }
  if (name === "up" || name === "down") {
    if (visibleSuggestions.length) {
      const delta = name === "up" ? -1 : 1;
      return {
        state: {
          ...current,
          suggestionIndex: wrapIndex(
            current.suggestionIndex + delta,
            visibleSuggestions.length,
          ),
        },
        action: "render",
      };
    }
    if (current.value.includes("\n")) {
      return {
        state: {
          ...current,
          cursor: moveCursorVertically(
            current.value,
            current.cursor,
            name === "up" ? -1 : 1,
          ),
        },
        action: "render",
      };
    }
    return {
      state: moveThroughHistory(current, name === "up" ? -1 : 1),
      action: "render",
    };
  }
  if (name === "left" || name === "right") {
    return {
      state: {
        ...current,
        cursor: name === "left"
          ? previousCodePointIndex(current.value, current.cursor)
          : nextCodePointIndex(current.value, current.cursor),
      },
      action: "render",
    };
  }
  if (name === "home" || (key.ctrl && name === "a")) {
    return {
      state: { ...current, cursor: lineStart(current.value, current.cursor) },
      action: "render",
    };
  }
  if (name === "end" || (key.ctrl && name === "e")) {
    return {
      state: { ...current, cursor: lineEnd(current.value, current.cursor) },
      action: "render",
    };
  }
  if (key.ctrl && name === "u") {
    const start = lineStart(current.value, current.cursor);
    return {
      state: editComposerValue(
        current,
        `${current.value.slice(0, start)}${current.value.slice(current.cursor)}`,
        start,
      ),
      action: "render",
    };
  }
  if (key.ctrl && name === "k") {
    const end = lineEnd(current.value, current.cursor);
    return {
      state: editComposerValue(
        current,
        `${current.value.slice(0, current.cursor)}${current.value.slice(end)}`,
        current.cursor,
      ),
      action: "render",
    };
  }
  if (name === "backspace") {
    if (current.cursor <= 0) return { state: current, action: "render" };
    const before = previousCodePointIndex(current.value, current.cursor);
    return {
      state: editComposerValue(
        current,
        `${current.value.slice(0, before)}${current.value.slice(current.cursor)}`,
        before,
      ),
      action: "render",
    };
  }
  if (name === "delete") {
    if (current.cursor >= current.value.length) {
      return { state: current, action: "render" };
    }
    const after = nextCodePointIndex(current.value, current.cursor);
    return {
      state: editComposerValue(
        current,
        `${current.value.slice(0, current.cursor)}${current.value.slice(after)}`,
        current.cursor,
      ),
      action: "render",
    };
  }
  if (isPrintableKey(str, key)) {
    return { state: insertText(current, str), action: "render" };
  }
  return { state: current, action: "render" };
}

export function commitComposerHistory(history, value, limit = 100) {
  const text = String(value || "").trim();
  if (!text) return [...history];
  const next = [...history];
  if (next.at(-1) !== text) next.push(text);
  return next.slice(-Math.max(1, Number(limit) || 100));
}

export function composerRenderModel({
  prompt,
  state,
  suggestions = [],
  columns = 80,
} = {}) {
  const current = normalizeComposerState(state);
  const width = Math.max(20, Number(columns) || 80);
  const visibleSuggestions = current.suggestionsDismissed ? [] : suggestions;
  const suggestionRows = formatSuggestionOverlay({
    suggestions: visibleSuggestions,
    selectedIndex: current.suggestionIndex,
    columns: width,
  });
  const base = `${String(prompt || "")}${current.value}`;
  const renderedText = suggestionRows.length
    ? `${base}\n${suggestionRows.join("\n")}`
    : base;
  const target = measureTerminalText(
    `${String(prompt || "")}${current.value.slice(0, current.cursor)}`,
    width,
  );
  const end = measureTerminalText(renderedText, width);
  return {
    text: renderedText,
    cursorRow: target.row,
    cursorColumn: target.column,
    endRow: end.row,
    rows: end.row + 1,
    suggestions: suggestionRows,
  };
}

export function measureTerminalText(value, columns = 80) {
  const width = Math.max(1, Number(columns) || 80);
  let row = 0;
  let column = 0;
  for (const char of stripTerminalFormatting(value)) {
    if (char === "\n") {
      row += 1;
      column = 0;
      continue;
    }
    const cells = codePointWidth(char.codePointAt(0));
    if (cells === 0) continue;
    if (column + cells > width) {
      row += 1;
      column = 0;
    }
    column += cells;
    if (column >= width) {
      row += 1;
      column = 0;
    }
  }
  return { row, column };
}

export function formatContextPrompt({
  agent,
  file,
  columns = 80,
  label = "you",
  status = null,
} = {}) {
  const context = [
    agent ? `!${agent.id}` : null,
    file ? `@${file.path}` : null,
  ].filter(Boolean);
  const divider = "-".repeat(Math.max(20, Math.min(Number(columns) || 80, 96)));
  const heading = [label, status, ...context].filter(Boolean).join("  ");
  return `${divider}\n${heading}\n> `;
}

export function formatSuggestionOverlay({
  suggestions = [],
  selectedIndex = 0,
  columns = 80,
} = {}) {
  if (!suggestions.length) return [];
  const width = Math.max(20, Math.min(Number(columns) || 80, 76));
  const kind = suggestions[0]?.kind || "result";
  const title = kind === "agent"
    ? "Agents"
    : kind === "file"
      ? "Files"
      : kind === "command"
        ? "Commands"
        : "Matches";
  const topLabel = ` ${title} `;
  const top = `+${topLabel}${"-".repeat(Math.max(0, width - topLabel.length - 2))}+`;
  const rows = suggestions.map((suggestion, index) => {
    const marker = index === selectedIndex ? "> " : "  ";
    const content = truncateDisplay(`${marker}${suggestion.label}`, width - 4);
    return `| ${padDisplay(content, width - 4)} |`;
  });
  return [top, ...rows, `+${"-".repeat(width - 2)}+`];
}

export function friendlyToolLabel(value) {
  const name = String(value || "");
  const known = {
    hireme_call_agent_source: "Calling selected Agent",
    hireme_call_local_specialist_agent: "Calling local specialist",
    hireme_call_protected_agent_runtime: "Calling protected Agent",
    hireme_materialize_specialist_image_artifact: "Creating image artifact",
    hireme_route_local_specialist_agent: "Selecting specialist",
    hireme_resolve_agent_source: "Resolving Agent source",
    hireme_create_agent_draft: "Creating Agent draft",
    hireme_update_agent_draft_file: "Updating Agent draft",
    hireme_validate_agent_draft: "Validating Agent draft",
    hireme_test_agent_draft: "Testing Agent draft",
    hireme_package_agent_draft: "Packaging Agent",
    read_file: "Reading file",
    write_file: "Writing file",
    list_files: "Listing files",
    search_files: "Searching workspace",
    run_command: "Running command",
  };
  if (known[name]) return known[name];
  return name
    .replace(/^hireme_/, "")
    .replace(/_/g, " ")
    .replace(/^./, (char) => char.toUpperCase()) || "Working";
}

export function formatResumeNotice(turns = []) {
  const count = Array.isArray(turns) ? turns.length : 0;
  if (!count) return "";
  const userTurns = turns.filter((turn) => turn.role === "user").length;
  return `resumed ${userTurns} prior message${userTurns === 1 ? "" : "s"}`;
}

export function terminalColorEnabled({ isTTY = false, env = process.env } = {}) {
  return Boolean(
    isTTY &&
    !Object.hasOwn(env || {}, "NO_COLOR") &&
    String(env?.TERM || "").toLowerCase() !== "dumb",
  );
}

export function styleTerminal(value, tone, { enabled = true } = {}) {
  const text = String(value || "");
  if (!enabled) return text;
  const codes = {
    bold: "1",
    dim: "2",
    cyan: "36",
    green: "32",
    yellow: "33",
    red: "31",
    blue: "34",
    underline: "4",
  };
  const code = codes[tone];
  return code ? `\x1b[${code}m${text}\x1b[0m` : text;
}

export function sanitizeTerminalText(value) {
  return String(value || "")
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

export function renderTerminalMarkdown(value, {
  width = 80,
  color = false,
} = {}) {
  const safeWidth = Math.max(24, Number(width) || 80);
  const lines = sanitizeTerminalText(value).replace(/\r\n?/g, "\n").split("\n");
  const rendered = [];
  let inCode = false;
  let codeLanguage = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = /^\s*```([^`]*)$/.exec(line);
    if (fence) {
      inCode = !inCode;
      codeLanguage = inCode ? fence[1].trim() : "";
      if (inCode) {
        const label = `code${codeLanguage ? ` · ${codeLanguage}` : ""}`;
        rendered.push(styleTerminal(label, "dim", { enabled: color }));
      }
      continue;
    }
    if (inCode) {
      const chunks = wrapPlainText(line || " ", Math.max(8, safeWidth - 4));
      for (const chunk of chunks) {
        const tone = chunk.startsWith("+")
          ? "green"
          : chunk.startsWith("-")
            ? "red"
            : chunk.startsWith("@@")
              ? "cyan"
              : null;
        const content = tone
          ? styleTerminal(chunk, tone, { enabled: color })
          : chunk;
        rendered.push(`  | ${content}`);
      }
      continue;
    }

    if (isMarkdownTableHeader(lines, index)) {
      const tableLines = [line];
      index += 2;
      while (index < lines.length && isMarkdownTableRow(lines[index])) {
        tableLines.push(lines[index]);
        index += 1;
      }
      index -= 1;
      rendered.push(...renderMarkdownTable(tableLines, {
        width: safeWidth,
        color,
      }));
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const text = stripMarkdownSyntax(heading[2]);
      const chunks = wrapPlainText(text, safeWidth);
      rendered.push(...chunks.map((chunk) =>
        styleTerminal(chunk, heading[1].length <= 2 ? "bold" : "cyan", {
          enabled: color,
        })));
      continue;
    }
    if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) {
      rendered.push(styleTerminal("-".repeat(Math.min(safeWidth, 72)), "dim", {
        enabled: color,
      }));
      continue;
    }
    const bullet = /^(\s*)[-*+]\s+(.+)$/.exec(line);
    if (bullet) {
      rendered.push(...renderMarkdownBlock(bullet[2], {
        prefix: "- ",
        continuation: "  ",
        width: safeWidth,
        color,
      }));
      continue;
    }
    const numbered = /^(\s*)(\d+[.)])\s+(.+)$/.exec(line);
    if (numbered) {
      rendered.push(...renderMarkdownBlock(numbered[3], {
        prefix: `${numbered[2]} `,
        continuation: " ".repeat(numbered[2].length + 1),
        width: safeWidth,
        color,
      }));
      continue;
    }
    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) {
      rendered.push(...renderMarkdownBlock(quote[1], {
        prefix: "| ",
        continuation: "| ",
        width: safeWidth,
        color,
        tone: "dim",
      }));
      continue;
    }
    if (!line.trim()) {
      if (rendered.at(-1) !== "") rendered.push("");
      continue;
    }
    rendered.push(...wrapMarkdownText(line.trim(), safeWidth).map((chunk) =>
      renderInlineMarkdown(chunk, { color })));
  }

  while (rendered.at(-1) === "") rendered.pop();
  return rendered.join("\n");
}

export function extractResultArtifacts(result = {}) {
  const artifacts = [];
  const add = (candidate = {}) => {
    const path = sanitizeArtifactPath(candidate.path || candidate.localPath);
    if (!path) return;
    artifacts.push({
      kind: candidate.kind || inferArtifactKind(candidate),
      path,
      mimeType: candidate.mimeType || candidate.mime_type || null,
      bytes: finiteNumber(candidate.bytes),
      width: finiteNumber(candidate.width),
      height: finiteNumber(candidate.height),
      status: candidate.status || "completed",
    });
  };

  for (const artifact of result.artifacts || []) add(artifact);
  for (const entry of result.observations || []) {
    const observation = parseObservation(entry?.observation);
    if (!observation || entry?.ok === false) continue;
    switch (entry.tool) {
      case "write_file":
        add({ ...observation, kind: "file" });
        break;
      case "hireme_materialize_specialist_image_artifact":
        add({ ...observation, kind: "image" });
        break;
      case "hireme_package_agent_draft":
      case "hireme_export_local_specialist_agent":
        add({ ...(observation.package || observation), kind: "package" });
        break;
      case "hireme_create_agent_draft":
        add({
          path: observation.creation?.folderPath,
          kind: "agent",
          status: observation.status,
        });
        break;
      case "hireme_call_agent_source":
      case "hireme_call_local_specialist_agent":
        for (const artifact of observation.artifacts || []) add(artifact);
        break;
      default:
        break;
    }
  }

  return artifacts.filter((artifact, index, all) =>
    all.findIndex((candidate) => candidate.path === artifact.path) === index);
}

export function formatByteSize(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export function renderArtifactBlocks(artifacts = [], {
  color = false,
  linkPath = (path) => path,
} = {}) {
  const blocks = artifacts.map((artifact) => {
    const title = artifact.kind === "image"
      ? "IMAGE CREATED"
      : artifact.kind === "package"
        ? "PACKAGE CREATED"
        : artifact.kind === "agent"
          ? "AGENT CREATED"
          : "FILE CREATED";
    const metadata = [
      artifact.mimeType,
      formatByteSize(artifact.bytes),
      artifact.width && artifact.height
        ? `${artifact.width} x ${artifact.height}`
        : null,
    ].filter(Boolean).join(" · ");
    return [
      "",
      styleTerminal(title, "green", { enabled: color }),
      `  ${linkPath(artifact.path)}`,
      metadata ? `  ${styleTerminal(metadata, "dim", { enabled: color })}` : null,
    ].filter(Boolean).join("\n");
  });
  return blocks.length ? `${blocks.join("\n")}\n` : "";
}

function renderMarkdownBlock(text, {
  prefix,
  continuation,
  width,
  color,
  tone = null,
}) {
  const chunks = wrapMarkdownText(text, Math.max(8, width - displayWidth(prefix)));
  return chunks.map((chunk, index) => {
    const line = `${index === 0 ? prefix : continuation}${renderInlineMarkdown(chunk, { color })}`;
    return tone ? styleTerminal(line, tone, { enabled: color }) : line;
  });
}

function renderInlineMarkdown(value, { color }) {
  let text = String(value || "");
  text = text.replace(/\[([^\]]+)]\(([^)]+)\)/g, (_, label) =>
    styleTerminal(label, "underline", { enabled: color }));
  text = text.replace(/`([^`]+)`/g, (_, code) =>
    styleTerminal(code, "yellow", { enabled: color }));
  text = text.replace(/\*\*([^*]+)\*\*/g, (_, strong) =>
    styleTerminal(strong, "bold", { enabled: color }));
  text = text.replace(/__([^_]+)__/g, (_, strong) =>
    styleTerminal(strong, "bold", { enabled: color }));
  text = text.replace(/(?:^|\s)\*([^*]+)\*(?=\s|$)/g, (match, emphasis) =>
    match.replace(`*${emphasis}*`, styleTerminal(emphasis, "cyan", { enabled: color })));
  return text;
}

function wrapMarkdownText(value, width) {
  const words = String(value || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let current = "";
  let currentWidth = 0;
  for (const word of words) {
    const wordWidth = displayWidth(stripMarkdownSyntax(word));
    const separator = current ? 1 : 0;
    if (current && currentWidth + separator + wordWidth > width) {
      lines.push(current);
      current = word;
      currentWidth = wordWidth;
      continue;
    }
    current = current ? `${current} ${word}` : word;
    currentWidth += separator + wordWidth;
  }
  if (current) lines.push(current);
  return lines.flatMap((line) => splitLongDisplayLine(line, width));
}

function wrapPlainText(value, width) {
  const text = String(value || "");
  if (!text) return [""];
  const lines = [];
  let current = "";
  let used = 0;
  for (const char of text) {
    const cells = codePointWidth(char.codePointAt(0));
    if (used + cells > width && current) {
      lines.push(current);
      current = "";
      used = 0;
    }
    current += char;
    used += cells;
  }
  if (current || !lines.length) lines.push(current);
  return lines;
}

function splitLongDisplayLine(value, width) {
  if (displayWidth(stripMarkdownSyntax(value)) <= width) return [value];
  return wrapPlainText(stripMarkdownSyntax(value), width);
}

function isMarkdownTableHeader(lines, index) {
  return (
    isMarkdownTableRow(lines[index]) &&
    /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1] || "")
  );
}

function isMarkdownTableRow(value) {
  const text = String(value || "").trim();
  return text.includes("|") && !/^\s*```/.test(text);
}

function renderMarkdownTable(lines, { width, color }) {
  const rows = lines.map(parseMarkdownTableRow);
  const columnCount = Math.max(...rows.map((row) => row.length), 1);
  if (columnCount * 7 + 1 > width) {
    return renderVerticalMarkdownTable(rows, { width, color });
  }
  const available = Math.max(columnCount * 4, width - (columnCount * 3 + 1));
  const columnWidth = Math.max(4, Math.floor(available / columnCount));
  const renderRow = (row) => {
    const cells = Array.from({ length: columnCount }, (_, index) => {
      const plain = stripMarkdownSyntax(row[index] || "");
      return padDisplay(truncateDisplay(plain, columnWidth), columnWidth);
    });
    return `| ${cells.join(" | ")} |`;
  };
  const output = [styleTerminal(renderRow(rows[0]), "bold", { enabled: color })];
  output.push(styleTerminal(
    `|-${Array.from({ length: columnCount }, () => "-".repeat(columnWidth)).join("-+-")}-|`,
    "dim",
    { enabled: color },
  ));
  output.push(...rows.slice(1).map(renderRow));
  return output;
}

function renderVerticalMarkdownTable(rows, { width, color }) {
  const headers = rows[0].map(stripMarkdownSyntax);
  const output = [];
  for (const [rowIndex, row] of rows.slice(1).entries()) {
    if (rowIndex > 0) output.push("");
    for (let index = 0; index < headers.length; index += 1) {
      const prefix = `${headers[index] || `Column ${index + 1}`}: `;
      const value = stripMarkdownSyntax(row[index] || "");
      const wrapped = wrapPlainText(value, Math.max(8, width - displayWidth(prefix)));
      wrapped.forEach((chunk, chunkIndex) => {
        const label = chunkIndex === 0
          ? styleTerminal(prefix, "bold", { enabled: color })
          : " ".repeat(displayWidth(prefix));
        output.push(`${label}${chunk}`);
      });
    }
  }
  return output;
}

function parseMarkdownTableRow(value) {
  return String(value || "")
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function stripMarkdownSyntax(value) {
  return String(value || "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1");
}

function parseObservation(value) {
  if (value && typeof value === "object") return value;
  try {
    return JSON.parse(String(value || ""));
  } catch {
    return null;
  }
}

function sanitizeArtifactPath(value) {
  const path = String(value || "").trim();
  if (!path || /[\x00-\x1F\x7F]/.test(path) || path.length > 500) return null;
  return path;
}

function inferArtifactKind(candidate) {
  const mime = String(candidate.mimeType || candidate.mime_type || "");
  if (mime.startsWith("image/")) return "image";
  return "file";
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizeComposerState(state = {}) {
  const value = String(state.value || "");
  const history = Array.isArray(state.history) ? state.history.map(String) : [];
  return {
    value,
    cursor: clamp(Number(state.cursor) || 0, 0, value.length),
    history,
    historyIndex: clamp(
      Number.isInteger(state.historyIndex) ? state.historyIndex : history.length,
      0,
      history.length,
    ),
    historyDraft: String(state.historyDraft || ""),
    suggestionIndex: Math.max(0, Number(state.suggestionIndex) || 0),
    suggestionsDismissed: state.suggestionsDismissed === true,
  };
}

function setComposerValue(state, value) {
  return editComposerValue(state, String(value || ""), String(value || "").length);
}

function editComposerValue(state, value, cursor) {
  return {
    ...state,
    value,
    cursor,
    historyIndex: state.history.length,
    historyDraft: "",
    suggestionIndex: 0,
    suggestionsDismissed: false,
  };
}

function insertText(state, text) {
  const value = `${state.value.slice(0, state.cursor)}${text}${state.value.slice(state.cursor)}`;
  return editComposerValue(state, value, state.cursor + text.length);
}

function applySuggestion(state, suggestions) {
  const index = wrapIndex(state.suggestionIndex, suggestions.length);
  const suggestion = suggestions[index];
  return setComposerValue(state, suggestion?.insert || state.value);
}

function moveThroughHistory(state, delta) {
  if (!state.history.length) return state;
  let draft = state.historyDraft;
  if (state.historyIndex === state.history.length && delta < 0) {
    draft = state.value;
  }
  const nextIndex = clamp(
    state.historyIndex + delta,
    0,
    state.history.length,
  );
  const value = nextIndex === state.history.length
    ? draft
    : state.history[nextIndex];
  return {
    ...state,
    value,
    cursor: value.length,
    historyIndex: nextIndex,
    historyDraft: draft,
    suggestionIndex: 0,
    suggestionsDismissed: false,
  };
}

function moveCursorVertically(value, cursor, delta) {
  const starts = [0];
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "\n") starts.push(index + 1);
  }
  const currentLine = starts.findLastIndex((start) => start <= cursor);
  const targetLine = clamp(currentLine + delta, 0, starts.length - 1);
  if (targetLine === currentLine) return cursor;
  const currentColumn = cursor - starts[currentLine];
  const targetStart = starts[targetLine];
  const targetEnd = value.indexOf("\n", targetStart);
  const boundedEnd = targetEnd < 0 ? value.length : targetEnd;
  return Math.min(targetStart + currentColumn, boundedEnd);
}

function lineStart(value, cursor) {
  const index = value.lastIndexOf("\n", Math.max(0, cursor - 1));
  return index < 0 ? 0 : index + 1;
}

function lineEnd(value, cursor) {
  const index = value.indexOf("\n", cursor);
  return index < 0 ? value.length : index;
}

function previousCodePointIndex(value, cursor) {
  if (cursor <= 0) return 0;
  const code = value.charCodeAt(cursor - 1);
  if (code >= 0xdc00 && code <= 0xdfff && cursor >= 2) return cursor - 2;
  return cursor - 1;
}

function nextCodePointIndex(value, cursor) {
  if (cursor >= value.length) return value.length;
  const code = value.charCodeAt(cursor);
  if (code >= 0xd800 && code <= 0xdbff && cursor + 1 < value.length) return cursor + 2;
  return cursor + 1;
}

function isPrintableKey(str, key = {}) {
  if (!str || key.ctrl || key.meta) return false;
  const name = String(key.name || "").toLowerCase();
  if (
    [
      "shift",
      "ctrl",
      "control",
      "meta",
      "alt",
      "option",
      "escape",
      "esc",
      "return",
      "enter",
      "backspace",
      "delete",
      "tab",
      "up",
      "down",
      "left",
      "right",
      "home",
      "end",
    ].includes(name)
  ) {
    return false;
  }
  return !/[\x00-\x1F\x7F-\x9F]/.test(str);
}

function truncateDisplay(value, width) {
  const text = String(value || "");
  if (measureTerminalText(text, width).row === 0) return text;
  const suffix = "...";
  let result = "";
  let used = 0;
  for (const char of text) {
    const cells = codePointWidth(char.codePointAt(0));
    if (used + cells + suffix.length > width) break;
    result += char;
    used += cells;
  }
  return `${result}${suffix}`;
}

function padDisplay(value, width) {
  const text = String(value || "");
  const used = displayWidth(text);
  return `${text}${" ".repeat(Math.max(0, width - used))}`;
}

function displayWidth(value) {
  let width = 0;
  for (const char of stripTerminalFormatting(value)) {
    width += codePointWidth(char.codePointAt(0));
  }
  return width;
}

function stripTerminalFormatting(value) {
  return String(value || "")
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
}

function codePointWidth(codePoint) {
  if (codePoint === 0) return 0;
  if (
    (codePoint >= 0x0300 && codePoint <= 0x036f) ||
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
    (codePoint >= 0xfe20 && codePoint <= 0xfe2f)
  ) {
    return 0;
  }
  if (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2329 && codePoint <= 0x232a) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1faff) ||
    (codePoint >= 0x20000 && codePoint <= 0x3fffd)
  ) {
    return 2;
  }
  return 1;
}

function wrapIndex(value, length) {
  if (!length) return 0;
  return ((value % length) + length) % length;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
