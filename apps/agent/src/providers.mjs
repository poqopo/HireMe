import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export function createModelProvider({
  provider = process.env.HIREME_AGENT_PROVIDER || "codex",
  model,
  baseUrl,
  apiKey,
  workspaceDir = process.cwd(),
  maxOutputTokens = Number(process.env.HIREME_AGENT_MAX_OUTPUT_TOKENS || 1800),
} = {}) {
  const normalizedProvider = String(provider || "fixture").toLowerCase();
  if (normalizedProvider === "codex") {
    return createCodexProvider({
      model: model || process.env.HIREME_AGENT_MODEL || process.env.CODEX_MODEL,
      workspaceDir,
    });
  }
  if (normalizedProvider === "fixture") {
    return createFixtureProvider();
  }
  if (normalizedProvider === "openai") {
    return createOpenAIProvider({
      model:
        model ||
        process.env.HIREME_AGENT_MODEL ||
        process.env.HIREME_OPENAI_MODEL ||
        process.env.OPENAI_MODEL ||
        "gpt-5.4-nano",
      baseUrl:
        baseUrl ||
        process.env.HIREME_OPENAI_BASE_URL ||
        process.env.OPENAI_BASE_URL ||
        "https://api.openai.com/v1",
      apiKey: apiKey || process.env.OPENAI_API_KEY,
      maxOutputTokens,
    });
  }
  if (normalizedProvider === "ollama") {
    return createOllamaProvider({
      model:
        model ||
        process.env.HIREME_AGENT_MODEL ||
        process.env.HIREME_OLLAMA_MODEL ||
        process.env.OLLAMA_MODEL ||
        "gpt-oss:120b",
      baseUrl:
        baseUrl ||
        process.env.HIREME_OLLAMA_BASE_URL ||
        process.env.OLLAMA_BASE_URL ||
        "https://ollama.com",
      apiKey: apiKey || process.env.OLLAMA_API_KEY,
      maxOutputTokens,
    });
  }
  throw new Error(`Unsupported agent provider: ${provider}`);
}

function createCodexProvider({ model, workspaceDir }) {
  async function complete({ instructions, input, signal }) {
    throwIfAborted(signal);
    const tempDir = await mkdtemp(join(tmpdir(), "hireme-codex-provider-"));
    const outputPath = join(tempDir, "last-message.txt");
    const prompt = [
      instructions,
      "",
      "You are being used as the model backend for a HireMe Agent runtime.",
      "Return only the requested final response. Do not wrap it in Markdown fences.",
      "",
      "Specialist input:",
      JSON.stringify(input, null, 2),
    ].join("\n");
    const args = [
      "exec",
      "--cd",
      resolve(workspaceDir || process.cwd()),
      "--skip-git-repo-check",
      "--sandbox",
      process.env.HIREME_CODEX_SANDBOX || "read-only",
      "--output-last-message",
      outputPath,
    ];
    if (model) {
      args.push("--model", model);
    }
    args.push("-");

    try {
      const codexCommand = process.env.HIREME_CODEX_COMMAND || "codex";
      const { stdout, stderr } = await runProcessWithInput(codexCommand, args, prompt, {
        cwd: resolve(workspaceDir || process.cwd()),
        timeout: Number(process.env.HIREME_CODEX_TIMEOUT_MS || 180000),
        signal,
        env: {
          ...process.env,
          OPENAI_API_KEY:
            process.env.HIREME_CODEX_ALLOW_OPENAI_API_KEY === "1"
              ? process.env.OPENAI_API_KEY
            : "",
        },
      });
      const lastMessage = await readFile(outputPath, "utf8").catch(() => stdout || stderr || "");
      if (!String(lastMessage || "").trim()) {
        throw new Error("Codex exec completed without a final message.");
      }
      return String(lastMessage).trim();
    } catch (err) {
      const message = String(err?.stderr || err?.stdout || err?.message || err || "").trim();
      if (/not logged in|login|auth|authentication/i.test(message)) {
        throw new Error(
          "Codex OAuth session is not available. Run `codex login` and choose ChatGPT sign-in, then run `hireme` again.",
        );
      }
      if (message && message !== String(err?.message || "").trim()) {
        throw new Error(`Codex exec failed: ${message.slice(0, 1200)}`, { cause: err });
      }
      throw err;
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  return {
    provider: "codex",
    model: model || "codex-default",
    complete,
    async decide({ instructions, input, signal }) {
      return parseDecision(await complete({
        instructions: [
          instructions,
          "",
          "Return exactly one JSON object for the next agent decision.",
        ].join("\n"),
        input,
        signal,
      }));
    },
  };
}

function runProcessWithInput(command, args, stdinText, {
  cwd,
  env,
  timeout = 180000,
  signal,
} = {}) {
  return new Promise((resolveProcess, rejectProcess) => {
    if (signal?.aborted) {
      rejectProcess(abortErrorFromSignal(signal));
      return;
    }
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener?.("abort", onAbort);
      child.kill("SIGTERM");
      const err = new Error(`${command} timed out after ${timeout}ms`);
      err.stdout = stdout;
      err.stderr = stderr;
      rejectProcess(err);
    }, timeout);
    const settle = (fn) => {
      if (settled) return false;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener?.("abort", onAbort);
      fn();
      return true;
    };
    const onAbort = () => {
      settle(() => {
        child.kill("SIGTERM");
        rejectProcess(abortErrorFromSignal(signal));
      });
    };
    signal?.addEventListener?.("abort", onAbort, { once: true });
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (err) => {
      settle(() => {
        err.stdout = stdout;
        err.stderr = stderr;
        rejectProcess(err);
      });
    });
    child.on("exit", (exitCode, signal) => {
      settle(() => {
        if (exitCode === 0) {
          resolveProcess({ stdout, stderr });
          return;
        }
        const err = new Error(`${command} exited with ${exitCode ?? signal}`);
        err.exitCode = exitCode;
        err.signal = signal;
        err.stdout = stdout;
        err.stderr = stderr;
        rejectProcess(err);
      });
    });
    child.stdin.end(stdinText);
  });
}

function createFixtureProvider() {
  let step = 0;
  const delayMs = Math.min(
    5000,
    Math.max(0, Number(process.env.HIREME_FIXTURE_DELAY_MS || 0)),
  );
  return {
    provider: "fixture",
    model: "fixture",
    async complete({ input, signal }) {
      throwIfAborted(signal);
      const agent = input?.agent || {};
      const specialistInput = input?.input || {};
      return JSON.stringify({
        schema: "hireme.specialist_agent.output.v1",
        agentId: agent.id || "fixture-specialist",
        status: "completed",
        responseMode: specialistInput.responseMode || "direct_answer",
        outputText: [
          `Fixture preview for ${agent.name || agent.id || "local specialist"}.`,
          `Task: ${specialistInput.task || "No task provided."}`,
          "Use a configured Codex, OpenAI, or Ollama provider to validate model-backed specialist behavior.",
        ].join("\n"),
        structuredResult: {
          summary: "Fixture preview completed without invoking a language model.",
          keyFindings: ["Fixture mode validates local Harness wiring only."],
          recommendations: ["Run `hireme agent eval <agent-id>` with a real model before packaging."],
        },
        artifacts: specialistInput.responseMode === "artifact_spec"
          ? [{
              kind: "markdown",
              filename: `${agent.id || "fixture-specialist"}-preview.md`,
              mimeType: "text/markdown",
              description: "Fixture-only artifact preview.",
            }]
          : [],
        evidence: [],
        assumptions: ["Fixture mode is deterministic and does not assess domain quality."],
        risks: ["Fixture output is not evidence of model-backed specialist quality."],
        memoryDeltas: [],
      });
    },
    async decide({ goal, toolObservations, signal }) {
      if (delayMs > 0) {
        await delay(delayMs, signal);
      }
      throwIfAborted(signal);
      step += 1;
      if (step === 1) {
        return {
          action: "tool",
          tool: {
            name: "write_note",
            input: {
              name: "fixture-agent-note",
              text: `Fixture note for: ${goal}`,
            },
          },
          memories: [
            {
              type: "preference",
              text: "The user wants a standalone Agent runtime with its own execution loop.",
              tags: ["architecture", "standalone-agent"],
            },
          ],
        };
      }
      const lastObservation = toolObservations.at(-1);
      return {
        action: "final",
        output: [
          "Standalone agent fixture completed.",
          `Goal: ${goal}`,
          lastObservation ? `Last tool: ${lastObservation.tool}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        skill: {
          title: "Standalone Agent First Run",
          body:
            "When the user asks for an OpenClaw/Hermes-style agent, build a long-running runtime with memory, skills, tools, and provider adapters before adding marketplace surfaces.",
        },
      };
    },
  };
}

function createOpenAIProvider({ model, baseUrl, apiKey, maxOutputTokens }) {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required when HIREME_AGENT_PROVIDER=openai.");
  }
  const root = String(baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  return {
    provider: "openai",
    model,
    async complete({ instructions, input, signal }) {
      throwIfAborted(signal);
      const response = await fetch(`${root}/responses`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          instructions,
          input: JSON.stringify(input, null, 2),
          max_output_tokens: maxOutputTokens,
        }),
        signal,
      });
      const text = await response.text();
      const data = parseJson(text) || {};
      if (!response.ok) {
        throw new Error(data?.error?.message || data?.message || `OpenAI returned ${response.status}`);
      }
      return readOpenAIOutputText(data);
    },
    async decide({ instructions, input, signal }) {
      const responseText = await this.complete({ instructions, input, signal });
      return parseDecision(responseText);
    },
  };
}

function createOllamaProvider({ model, baseUrl, apiKey, maxOutputTokens }) {
  if (!apiKey && !isLoopbackUrl(baseUrl)) {
    throw new Error("OLLAMA_API_KEY is required when HIREME_AGENT_PROVIDER=ollama.");
  }
  const root = String(baseUrl || "https://ollama.com").replace(/\/$/, "");
  return {
    provider: "ollama",
    model,
    async complete({ instructions, input, signal }) {
      throwIfAborted(signal);
      const endpoints = ollamaChatEndpointCandidates(root);
      let lastError = null;
      for (const endpoint of endpoints) {
        const body =
          endpoint.type === "openai-compatible"
            ? {
                model,
                stream: false,
                messages: [
                  { role: "system", content: instructions },
                  { role: "user", content: JSON.stringify(input, null, 2) },
                ],
                max_tokens: maxOutputTokens,
              }
            : {
                model,
                stream: false,
                messages: [
                  { role: "system", content: instructions },
                  { role: "user", content: JSON.stringify(input, null, 2) },
                ],
                options: { num_predict: maxOutputTokens },
              };
        const response = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
          signal,
        });
        const text = await response.text();
        const data = parseJson(text) || {};
        if (response.ok) {
          return readChatOutputText(data);
        }
        lastError = data?.error?.message || data?.message || `Ollama returned ${response.status}`;
        if (![404, 405].includes(response.status)) break;
      }
      throw new Error(lastError || "Ollama request failed.");
    },
    async decide({ instructions, input, signal }) {
      const responseText = await this.complete({ instructions, input, signal });
      return parseDecision(responseText);
    },
  };
}

function isLoopbackUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

function delay(ms, signal) {
  return new Promise((resolveDelay, rejectDelay) => {
    if (signal?.aborted) {
      rejectDelay(abortErrorFromSignal(signal));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener?.("abort", onAbort);
      resolveDelay();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      rejectDelay(abortErrorFromSignal(signal));
    };
    signal?.addEventListener?.("abort", onAbort, { once: true });
  });
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw abortErrorFromSignal(signal);
}

function abortErrorFromSignal(signal) {
  if (signal?.reason instanceof Error) return signal.reason;
  const err = new Error("Run cancelled.");
  err.name = "AbortError";
  err.code = "run_cancelled";
  err.cancelled = true;
  return err;
}

export function parseDecision(text) {
  const parsed = parseJsonObjectFromText(text);
  if (!parsed) {
    return {
      action: "final",
      output: String(text || "").trim(),
    };
  }
  if (parsed.action === "tool_call") parsed.action = "tool";
  if (parsed.toolName && !parsed.tool) {
    parsed.tool = { name: parsed.toolName, input: parsed.input || parsed.arguments || {} };
  }
  if (parsed.tool && typeof parsed.tool === "string") {
    parsed.tool = { name: parsed.tool, input: parsed.input || parsed.arguments || {} };
  }
  return parsed;
}

function readOpenAIOutputText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }
  const chunks = [];
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      const text = content?.text || content?.value;
      if (typeof text === "string" && text.trim()) chunks.push(text.trim());
    }
  }
  return chunks.join("\n\n").trim();
}

function readChatOutputText(response) {
  const message = response?.message?.content;
  if (typeof message === "string" && message.trim()) return message.trim();
  for (const choice of response?.choices || []) {
    const text = choice?.message?.content || choice?.text;
    if (typeof text === "string" && text.trim()) return text.trim();
  }
  return "";
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseJsonObjectFromText(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const direct = parseJson(text);
  if (direct && typeof direct === "object") return direct;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  const parsed = parseJson(text.slice(start, end + 1));
  return parsed && typeof parsed === "object" ? parsed : null;
}

function ollamaChatEndpointCandidates(baseUrl) {
  const base = String(baseUrl || "https://ollama.com").replace(/\/$/, "");
  if (/\/api$/i.test(base)) {
    const root = base.replace(/\/api$/i, "");
    return [
      { type: "native", url: `${base}/chat` },
      { type: "openai-compatible", url: `${root}/v1/chat/completions` },
    ];
  }
  if (/\/v1$/i.test(base)) {
    const root = base.replace(/\/v1$/i, "");
    return [
      { type: "openai-compatible", url: `${base}/chat/completions` },
      { type: "native", url: `${root}/api/chat` },
    ];
  }
  return [
    { type: "native", url: `${base}/api/chat` },
    { type: "openai-compatible", url: `${base}/v1/chat/completions` },
  ];
}
