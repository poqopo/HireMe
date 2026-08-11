import { execFile } from "node:child_process";
import { readFile, realpath, writeFile, mkdir, stat } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { createAgentAuthoringTools } from "./agentAuthoringLayer.mjs";
import { createAgentSourceLayerTools } from "./agentSourceLayer.mjs";
import { createImageArtifactTools } from "./imageArtifactTools.mjs";
import { createLocalSpecialistAgentTools } from "./localSpecialistAgent.mjs";
import { createLocalSpecialistCreatorTools } from "./localSpecialistCreatorTools.mjs";
import { createMarketplaceTools } from "./marketplaceTools.mjs";
import { createProtectedRuntimeTools, mockProtectedAgents } from "./protectedRuntimeTools.mjs";
import { createSpecialistMemoryTools } from "./specialistMemory.mjs";
import { createUsageLedgerTools } from "./usageLedger.mjs";
import { createBillingTools } from "./billingTools.mjs";

const execFileAsync = promisify(execFile);

export function createDefaultTools({
  workspaceDir = process.cwd(),
  stateDir = ".hireme/standalone-agent/default",
  allowShell = false,
  enableHireMeTools = process.env.HIREME_AGENT_DISABLE_HIREME_TOOLS !== "1",
  enableLocalSpecialistTools =
    process.env.HIREME_AGENT_DISABLE_LOCAL_SPECIALISTS !== "1",
  enableLocalSpecialistCreatorTools =
    process.env.HIREME_AGENT_DISABLE_LOCAL_SPECIALIST_CREATOR !== "1",
  enableProtectedRuntimeTools =
    process.env.HIREME_AGENT_DISABLE_PROTECTED_RUNTIME !== "1",
  enableMarketplaceTools =
    process.env.HIREME_AGENT_DISABLE_MARKETPLACE !== "1",
  enableAgentSourceLayerTools =
    process.env.HIREME_AGENT_DISABLE_AGENT_SOURCE_LAYER !== "1",
  enableAgentAuthoringTools =
    process.env.HIREME_AGENT_DISABLE_AGENT_AUTHORING !== "1",
  enableUsageLedgerTools =
    process.env.HIREME_AGENT_DISABLE_USAGE_LEDGER !== "1",
  enableImageArtifactTools =
    process.env.HIREME_AGENT_DISABLE_IMAGE_ARTIFACTS !== "1",
  enableBillingTools =
    process.env.HIREME_AGENT_DISABLE_BILLING_TOOLS !== "1",
  localSpecialistOptions = {},
  protectedRuntimeOptions = {},
  marketplaceOptions = {},
  dbAgentSourceOptions = {},
  agentAuthoringOptions = {},
  agentSourceLayerOptions = {},
  usageLedgerOptions = {},
  billingOptions = {},
  imageArtifactOptions = {},
  specialistMemoryOptions = {},
  modelProvider = null,
  authoringTargetAgentId = null,
  runtimeMode = null,
} = {}) {
  const workspaceRoot = resolve(workspaceDir);
  const stateRoot = resolve(stateDir);
  const localRuntimeOptions = {
    ...localSpecialistOptions,
    modelProvider: localSpecialistOptions.modelProvider || modelProvider || null,
  };
  const sourceOptions = {
    ...marketplaceOptions,
    ...dbAgentSourceOptions,
  };
  const configuredSpecialistRoot = resolve(
    workspaceRoot,
    localSpecialistOptions.specialistRoot ||
      process.env.HIREME_LOCAL_SPECIALIST_ROOT ||
      "examples/local-specialist-agents",
  );
  const lexicalProtectedWorkspaceRoots = runtimeMode === "work"
    ? [stateRoot, configuredSpecialistRoot]
    : [];
  let protectedWorkspaceRootsPromise = null;
  const protectedWorkspaceRoots = async () => {
    if (runtimeMode !== "work") return [];
    protectedWorkspaceRootsPromise ||= (async () => {
      const containingAgentRoot = await findContainingHireMeAgentRoot(workspaceRoot);
      const roots = [
        ...lexicalProtectedWorkspaceRoots,
        ...(containingAgentRoot ? [containingAgentRoot] : []),
      ];
      const canonicalRoots = await Promise.all(
        roots.map((root) => realpath(root).catch(() => resolve(root))),
      );
      return [...new Set([...roots, ...canonicalRoots].map((root) => resolve(root)))];
    })();
    return protectedWorkspaceRootsPromise;
  };
  const protectedWorkspaceGlobs = lexicalProtectedWorkspaceRoots
    .map((root) => relative(workspaceRoot, root).replace(/\\/g, "/"))
    .filter((path) => path && !path.startsWith("..") && !/^[A-Za-z]:/.test(path));
  const isWorkspacePathProtected = async (path) => {
    if (runtimeMode !== "work") return false;
    const lexicalPath = resolve(path);
    const canonicalPath = await realpath(lexicalPath).catch(() => lexicalPath);
    const roots = await protectedWorkspaceRoots();
    return roots.some((root) => (
      pathInsideOrEqual(root, lexicalPath) || pathInsideOrEqual(root, canonicalPath)
    ));
  };
  const assertWorkspacePathAllowed = async (path) => {
    if (await isWorkspacePathProtected(path)) {
      throw Object.assign(
        new Error("Private Harness and Agent state files require an explicit management command."),
        { code: "management_session_required" },
      );
    }
  };

  const tools = [
    {
      name: "list_files",
      description: "List workspace files with ripgrep when available.",
      inputSchema: {
        type: "object",
        properties: {
          glob: { type: "string" },
          limit: { type: "integer" },
        },
      },
      handler: async ({ glob, limit = 120 } = {}, { signal } = {}) => {
        if (await isWorkspacePathProtected(workspaceRoot)) return { files: [] };
        const args = ["--files"];
        if (glob) args.push("-g", String(glob));
        for (const protectedGlob of protectedWorkspaceGlobs) {
          args.push("-g", `!${protectedGlob}/**`);
        }
        const result = await runCommand("rg", args, { cwd: workspaceRoot, signal }).catch((err) => {
          if (isAbortError(err)) throw err;
          return runCommand("find", [".", "-type", "f"], { cwd: workspaceRoot, signal });
        },
        );
        const candidates = result.stdout
          .split("\n")
          .map((line) => line.replace(/^\.\//, "").trim())
          .filter(Boolean)
          .filter((path) => !protectedWorkspaceGlobs.some((root) => (
            path === root || path.startsWith(`${root}/`)
          )));
        const files = [];
        for (const path of candidates) {
          if (await isWorkspacePathProtected(resolve(workspaceRoot, path))) continue;
          files.push(path);
          if (files.length >= Math.max(1, Number(limit) || 120)) break;
        }
        return { files };
      },
    },
    {
      name: "search_files",
      description: "Search workspace text files with ripgrep.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          glob: { type: "string" },
          limit: { type: "integer" },
        },
        required: ["query"],
      },
      handler: async ({ query, glob, limit = 80 } = {}, { signal } = {}) => {
        if (await isWorkspacePathProtected(workspaceRoot)) return { matches: [] };
        const args = ["--with-filename", "-n", String(query || "")];
        if (glob) args.push("-g", String(glob));
        for (const protectedGlob of protectedWorkspaceGlobs) {
          args.push("-g", `!${protectedGlob}/**`);
        }
        const result = await runCommand("rg", args, { cwd: workspaceRoot, reject: false, signal });
        const candidates = result.stdout
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        const matches = [];
        for (const match of candidates) {
          const path = workspacePathFromSearchMatch(match);
          if (!path) continue;
          if (await isWorkspacePathProtected(resolve(workspaceRoot, path))) continue;
          matches.push(match);
          if (matches.length >= Math.max(1, Number(limit) || 80)) break;
        }
        return { matches };
      },
    },
    {
      name: "read_file",
      description: "Read a UTF-8 file from the workspace.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          maxChars: { type: "integer" },
        },
        required: ["path"],
      },
      handler: async ({ path, maxChars = 12000 } = {}) => {
        await assertWorkspacePathAllowed(resolve(workspaceRoot, String(path || "")));
        const filePath = await resolveInside(workspaceRoot, path);
        await assertWorkspacePathAllowed(filePath);
        const text = await readFile(filePath, "utf8");
        return {
          path: relative(workspaceRoot, filePath),
          text: text.slice(0, Math.max(1, Number(maxChars) || 12000)),
          truncated: text.length > maxChars,
        };
      },
    },
    {
      name: "write_file",
      description:
        "Create a UTF-8 file in the workspace, or overwrite an existing file only when overwrite is true.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
          overwrite: { type: "boolean" },
        },
        required: ["path", "content"],
      },
      handler: async ({ path, content, overwrite = false } = {}) => {
        await assertWorkspacePathAllowed(resolve(workspaceRoot, String(path || "")));
        const filePath = await resolveWritablePath(workspaceRoot, path);
        await assertWorkspacePathAllowed(filePath);
        await mkdir(dirname(filePath), { recursive: true });
        const canonicalParent = await realpath(dirname(filePath));
        await assertWorkspacePathAllowed(join(canonicalParent, basename(filePath)));
        const canonicalExistingPath = await realpath(filePath).catch((err) => {
          if (err?.code === "ENOENT") return null;
          throw err;
        });
        if (canonicalExistingPath) {
          const canonicalWorkspace = await realpath(workspaceRoot).catch(() => workspaceRoot);
          if (!pathInsideOrEqual(canonicalWorkspace, canonicalExistingPath)) {
            throw Object.assign(new Error(`Path escapes workspace: ${path}`), {
              code: "path_outside_workspace",
            });
          }
          await assertWorkspacePathAllowed(canonicalExistingPath);
        }
        const existed = await stat(filePath).then(() => true).catch((err) => {
          if (err?.code === "ENOENT") return false;
          throw err;
        });
        if (existed && overwrite !== true) {
          throw Object.assign(
            new Error(`File already exists. Pass overwrite=true to replace it: ${path}`),
            { code: "file_exists" },
          );
        }
        const text = String(content || "");
        await writeFile(filePath, text, "utf8");
        return {
          path: relative(workspaceRoot, filePath),
          bytes: Buffer.byteLength(text, "utf8"),
          created: !existed,
          overwritten: existed,
        };
      },
    },
    {
      name: "write_note",
      description: "Write an agent-owned note under the agent state directory.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          text: { type: "string" },
        },
        required: ["name", "text"],
      },
      handler: async ({ name, text } = {}) => {
        const safeName = safeFileName(name || "note.md");
        const filePath = join(stateRoot, "notes", safeName.endsWith(".md") ? safeName : `${safeName}.md`);
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, String(text || ""), "utf8");
        return { path: filePath, bytes: Buffer.byteLength(String(text || ""), "utf8") };
      },
    },
  ];

  if (allowShell) {
    tools.push({
      name: "run_command",
      description: "Run an explicit command in the workspace. Disabled unless --allow-shell is set.",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string" },
          args: { type: "array", items: { type: "string" } },
        },
        required: ["command"],
      },
      handler: async ({ command, args = [] } = {}, { signal } = {}) => {
        const result = await runCommand(String(command || ""), args.map(String), {
          cwd: workspaceRoot,
          reject: false,
          timeout: 30_000,
          signal,
        });
        return {
          exitCode: result.exitCode,
          stdout: result.stdout.slice(0, 12000),
          stderr: result.stderr.slice(0, 6000),
        };
      },
    });
  }

  if (enableHireMeTools && enableLocalSpecialistTools) {
    tools.push(
      ...createLocalSpecialistAgentTools({
        workspaceDir: workspaceRoot,
        stateDir: stateRoot,
        currentUserId: sourceOptions.currentUserId,
        ...localRuntimeOptions,
      }),
    );
  }

  if (
    enableHireMeTools &&
    enableLocalSpecialistTools &&
    enableLocalSpecialistCreatorTools
  ) {
    tools.push(
      ...createLocalSpecialistCreatorTools({
        workspaceDir: workspaceRoot,
        ...localSpecialistOptions,
      }).map((tool) => authoringPolicyTool(tool, authoringTargetAgentId)),
    );
  }

  if (enableHireMeTools && (enableLocalSpecialistTools || enableProtectedRuntimeTools)) {
    tools.push(
      ...createSpecialistMemoryTools({
        workspaceDir: workspaceRoot,
        stateDir: stateRoot,
        specialistRoot: localSpecialistOptions.specialistRoot,
        currentUserId: sourceOptions.currentUserId,
        defaultConversationId: localSpecialistOptions.defaultConversationId,
        protectedAgents: protectedRuntimeOptions.protectedAgents || mockProtectedAgents,
        ...specialistMemoryOptions,
      }),
    );
  }

  if (
    enableHireMeTools &&
    enableLocalSpecialistTools &&
    enableAgentAuthoringTools
  ) {
    tools.push(
      ...createAgentAuthoringTools({
        workspaceDir: workspaceRoot,
        stateDir: stateRoot,
        ...localRuntimeOptions,
        ...agentAuthoringOptions,
      }).map((tool) => authoringPolicyTool(tool, authoringTargetAgentId)),
    );
  }

  if (enableHireMeTools && enableImageArtifactTools) {
    tools.push(
      ...createImageArtifactTools({
        workspaceDir: workspaceRoot,
        ...imageArtifactOptions,
      }),
    );
  }

  if (enableHireMeTools && enableProtectedRuntimeTools) {
    tools.push(
      ...createProtectedRuntimeTools({
        stateDir: stateRoot,
        currentUserId: sourceOptions.currentUserId,
        defaultConversationId: localSpecialistOptions.defaultConversationId,
        ...protectedRuntimeOptions,
      }),
    );
  }

  if (enableHireMeTools && enableMarketplaceTools) {
    tools.push(
      ...createMarketplaceTools({
        stateDir: stateRoot,
        ...sourceOptions,
      }),
    );
  }

  if (enableHireMeTools && enableAgentSourceLayerTools) {
    tools.push(
      ...createAgentSourceLayerTools({
        workspaceDir: workspaceRoot,
        stateDir: stateRoot,
        localSpecialistOptions: localRuntimeOptions,
        protectedRuntimeOptions,
        marketplaceOptions: sourceOptions,
        dbAgentSourceOptions: sourceOptions,
        ...agentSourceLayerOptions,
      }),
    );
  }

  if (enableHireMeTools && enableUsageLedgerTools) {
    tools.push(
      ...createUsageLedgerTools({
        stateDir: stateRoot,
        currentUserId: sourceOptions.currentUserId,
        ...usageLedgerOptions,
      }),
    );
  }

  if (enableHireMeTools && enableBillingTools) {
    tools.push(
      ...createBillingTools({
        currentUserId: sourceOptions.currentUserId,
        agents: sourceOptions.dbAgents || sourceOptions.marketplaceAgents,
        ...billingOptions,
      }),
    );
  }

  return tools;
}

const targetScopedAuthoringTools = new Set([
  "hireme_create_local_specialist_agent",
  "hireme_list_local_specialist_agent_files",
  "hireme_update_local_specialist_agent_file",
  "hireme_export_local_specialist_agent",
  "hireme_create_agent_draft",
  "hireme_initialize_agent_draft",
  "hireme_get_agent_authoring_status",
  "hireme_read_agent_draft_file",
  "hireme_update_agent_draft_file",
  "hireme_create_agent_skill",
  "hireme_validate_agent_draft",
  "hireme_get_agent_bootstrap_memory_status",
  "hireme_add_agent_bootstrap_memory",
  "hireme_test_agent_draft",
  "hireme_evaluate_agent_draft",
  "hireme_package_agent_draft",
  "hireme_start_agent_authoring_session",
  "hireme_fork_builtin_agent_skill",
  "hireme_get_agent_authoring_session",
  "hireme_record_agent_authoring_feedback",
  "hireme_compile_agent_graph",
  "hireme_propose_agent_skill_update",
  "hireme_compare_agent_candidate",
  "hireme_decide_agent_candidate",
  "hireme_rollback_agent_candidate",
]);

function authoringPolicyTool(tool, targetAgentId) {
  const target = normalizePolicyAgentId(targetAgentId);
  const scoped = targetScopedAuthoringTools.has(tool.name);
  if (!target || !scoped) {
    return {
      ...tool,
      requiredMode: "agent_authoring",
      ...(scoped ? { targetArgument: "agent_id" } : {}),
    };
  }
  return {
    ...tool,
    requiredMode: "agent_authoring",
    targetArgument: "agent_id",
    handler: async (args = {}, context = {}) => {
      const requested = normalizePolicyAgentId(args.agent_id || args.agentId);
      if (requested !== target) {
        throw Object.assign(
          new Error(`Management mode is scoped to Agent "${target}".`),
          { code: "authoring_target_mismatch" },
        );
      }
      return tool.handler(args, context);
    },
  };
}

function normalizePolicyAgentId(value) {
  return String(value || "").trim().toLowerCase();
}

function workspacePathFromSearchMatch(value) {
  const match = /^(.+?):\d+:/.exec(String(value || ""));
  return match?.[1]?.replace(/^\.\//, "") || null;
}

async function findContainingHireMeAgentRoot(workspaceRoot) {
  let current = await realpath(workspaceRoot).catch(() => resolve(workspaceRoot));
  while (true) {
    const hasAgentConfig = await isFile(join(current, "agent.json"));
    if (hasAgentConfig) {
      const hasPrivateAgentMarker = (
        await isFile(join(current, "AGENTS.md")) ||
        await isFile(join(current, "SOUL.md")) ||
        await isFile(join(current, "public.json")) ||
        await isDirectory(join(current, "harness"))
      );
      if (hasPrivateAgentMarker) return current;
    }
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

async function isFile(path) {
  return stat(path).then((info) => info.isFile()).catch((err) => {
    if (err?.code === "ENOENT") return false;
    throw err;
  });
}

async function isDirectory(path) {
  return stat(path).then((info) => info.isDirectory()).catch((err) => {
    if (err?.code === "ENOENT") return false;
    throw err;
  });
}

function pathInsideOrEqual(root, target) {
  const relativePath = relative(resolve(root), resolve(target));
  return relativePath === "" || (
    !relativePath.startsWith("..") &&
    !/^[A-Za-z]:/.test(relativePath)
  );
}

async function resolveInside(root, candidate) {
  const target = resolve(root, String(candidate || ""));
  const [realRoot, realTarget] = await Promise.all([
    realpath(root).catch(() => root),
    realpath(target),
  ]);
  if (realTarget !== realRoot && !realTarget.startsWith(`${realRoot}/`)) {
    throw Object.assign(new Error(`Path escapes workspace: ${candidate}`), {
      code: "path_outside_workspace",
    });
  }
  return realTarget;
}

async function resolveWritablePath(root, candidate) {
  const rawPath = String(candidate || "").trim();
  if (!rawPath) {
    throw Object.assign(new Error("path is required"), { code: "missing_path" });
  }
  const target = resolve(root, rawPath);
  const lexicalRelative = relative(root, target);
  if (
    lexicalRelative === "" ||
    lexicalRelative.startsWith("..") ||
    /^[A-Za-z]:/.test(lexicalRelative)
  ) {
    throw Object.assign(new Error(`Path escapes workspace: ${candidate}`), {
      code: "path_outside_workspace",
    });
  }

  const realRoot = await realpath(root).catch(() => root);
  const existingTarget = await realpath(target).catch((error) => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  if (existingTarget) {
    if (!pathInsideOrEqual(realRoot, existingTarget)) {
      throw Object.assign(new Error(`Path escapes workspace: ${candidate}`), {
        code: "path_outside_workspace",
      });
    }
    return existingTarget;
  }

  const realParent = await resolveProspectiveParent(dirname(target));
  if (realParent !== realRoot && !realParent.startsWith(`${realRoot}/`)) {
    throw Object.assign(new Error(`Path escapes workspace: ${candidate}`), {
      code: "path_outside_workspace",
    });
  }
  return join(realParent, basename(target));
}

async function resolveProspectiveParent(targetParent) {
  const missingSegments = [];
  let candidate = targetParent;
  while (true) {
    try {
      const existingParent = await realpath(candidate);
      return join(existingParent, ...missingSegments);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      const parent = dirname(candidate);
      if (parent === candidate) throw error;
      missingSegments.unshift(basename(candidate));
      candidate = parent;
    }
  }
}

async function runCommand(command, args, {
  cwd,
  reject = true,
  timeout = 15_000,
  signal,
} = {}) {
  try {
    throwIfAborted(signal);
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd,
      timeout,
      maxBuffer: 1024 * 1024 * 4,
      signal,
    });
    return { exitCode: 0, stdout, stderr };
  } catch (err) {
    const result = {
      exitCode: Number.isInteger(err?.code) ? err.code : 1,
      stdout: err?.stdout || "",
      stderr: err?.stderr || err?.message || "",
    };
    if (reject) throw Object.assign(err, result);
    return result;
  }
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

function isAbortError(err) {
  return Boolean(
    err &&
      (
        err.cancelled === true ||
        err.code === "run_cancelled" ||
        err.name === "AbortError" ||
        err.code === "ABORT_ERR"
      ),
  );
}

function safeFileName(value) {
  return String(value || "note")
    .replace(/[^\w가-힣.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "note";
}
