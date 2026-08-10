import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

export function createCreatorWorkerExecutor({
  runtimeRoot,
  userDataDir,
  getAiRuntime,
  getSpecialistRoot,
  getUser,
} = {}) {
  return async function executeCreatorJob({ job, signal, onStage = () => {} }) {
    const user = getUser();
    if (!user?.id) throw new Error("Creator Worker 로그인이 필요합니다.");
    const agentSlug = String(job.envelope?.localAgentId || job.envelope?.agentSlug || job.envelope?.agentId || "").trim();
    if (!/^[a-z0-9][a-z0-9._-]{0,100}$/.test(agentSlug)) throw new Error("Job Agent slug가 올바르지 않습니다.");
    const specialistRoot = resolve(getSpecialistRoot(user.id, job.harness_digest));
    await assertPublishedHarness(specialistRoot, agentSlug, job);
    const aiRuntime = await getAiRuntime(user);
    const jobRoot = await mkdtemp(join(tmpdir(), "hireme-creator-job-"));
    const inputRoot = join(jobRoot, "inputs");
    const outputRoot = join(jobRoot, "outputs");
    let returnedArtifacts = false;
    await mkdir(inputRoot, { recursive: true });
    await mkdir(outputRoot, { recursive: true });
    try {
      onStage("입력 파일을 안전하게 준비하고 있어요");
      const inputFiles = [];
      for (const asset of Array.isArray(job.assets) ? job.assets : []) {
        throwIfAborted(signal);
        const filename = safeFilename(asset.filename || basename(asset.storage_path || "asset"));
        const path = join(inputRoot, `${asset.id}-${filename}`);
        const response = await fetch(asset.downloadUrl, { signal });
        if (!response.ok) throw new Error(`입력 파일 다운로드 실패: ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length !== Number(asset.size_bytes) || sha256(bytes) !== asset.content_digest) {
          bytes.fill(0);
          throw Object.assign(new Error("입력 파일 무결성 검증에 실패했습니다."), { code: "asset_digest_mismatch" });
        }
        await writeFile(path, bytes, { mode: 0o600 });
        bytes.fill(0);
        inputFiles.push({ id: asset.id, path, name: asset.filename, mimeType: asset.mime_type });
      }
      onStage("고정된 Harness revision으로 디자인 작업을 실행하고 있어요");
      const prompt = buildCreatorJobPrompt(job, inputFiles, outputRoot);
      const parsed = await spawnRuntime({
        cliPath: join(runtimeRoot, "hireme-agent", "cli", "hireme.mjs"),
        workingDirectory: jobRoot,
        specialistRoot,
        stateDir: join(userDataDir, "runtime", user.id, "creator-worker", job.agent_id),
        userId: user.id,
        sessionId: job.id,
        provider: aiRuntime.provider,
        model: aiRuntime.model,
        providerEnv: aiRuntime.env,
        prompt,
        signal,
      });
      onStage("결과 파일과 평가 근거를 확인하고 있어요");
      const artifacts = await collectArtifacts(parsed, jobRoot, outputRoot);
      if (!artifacts.some((artifact) => artifact.kind === "rationale")) {
        const rationalePath = join(outputRoot, "design-rationale.json");
        await writeFile(rationalePath, JSON.stringify({
          schema: "hireme.design_rationale.v1",
          projectId: job.project_id,
          summary: parsed.outputText || "디자인 작업 결과",
        }, null, 2));
        artifacts.push({ path: rationalePath, name: "design-rationale.json", mimeType: "application/json", kind: "rationale" });
      }
      const machine = await evaluateMachineContract(artifacts, job.envelope?.brief || {});
      const critic = evaluateDesignCritic(parsed, job.envelope?.brief || {}, machine);
      const evaluationPath = join(outputRoot, "design-evaluation.json");
      await writeFile(evaluationPath, JSON.stringify({
        schema: "hireme.design_evaluation_report.v1",
        projectId: job.project_id,
        attemptNumber: job.attempt_number,
        machine,
        critic,
      }, null, 2));
      artifacts.push({ path: evaluationPath, name: "design-evaluation.json", mimeType: "application/json", kind: "evaluation_report" });
      returnedArtifacts = true;
      return {
        output: parsed.outputText || "디자인 작업을 완료했습니다.",
        artifacts,
        evaluations: [
          { evaluator: "worker_machine", verdict: machine.verdict, scores: machine.scores, reasons: machine.reasons },
          { evaluator: "design_critic", verdict: critic.verdict, scores: critic.scores, reasons: critic.reasons },
        ],
        cleanup: () => rm(jobRoot, { recursive: true, force: true }),
      };
    } finally {
      // The caller uploads returned artifacts before invoking the cleanup function.
      if (!returnedArtifacts) await rm(jobRoot, { recursive: true, force: true });
    }
  };
}

async function assertPublishedHarness(root, agentSlug, job) {
  const configPath = join(root, agentSlug, "agent.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  if (config?.localRunner?.kind === "command-v1") {
    throw Object.assign(new Error("Creator Worker v0는 임의 command adapter를 실행하지 않습니다."), { code: "untrusted_executable_agent" });
  }
  const receipt = JSON.parse(await readFile(join(root, agentSlug, ".hireme-published.json"), "utf8"));
  if (
    receipt?.schema !== "hireme.creator_worker.publication_receipt.v1" ||
    receipt.packageDigest !== job.harness_digest ||
    !(Array.isArray(receipt.harnessRevisions) ? receipt.harnessRevisions : [receipt.harnessRevision]).includes(job.harness_revision)
  ) {
    throw Object.assign(new Error("Job에 고정된 Harness revision이 이 기기의 게시본과 일치하지 않습니다."), { code: "harness_revision_mismatch" });
  }
}

function buildCreatorJobPrompt(job, inputFiles, outputRoot) {
  const brief = job.envelope?.brief || {};
  return [
    "You are executing a queued HireMe Creator Worker design job.",
    `Use only specialist Agent: ${job.envelope?.agentSlug || job.envelope?.agentId}.`,
    `Pinned Harness revision: ${job.harness_revision}.`,
    `Pinned Harness digest: ${job.harness_digest}.`,
    "Create a brand social campaign with three distinct preview directions when the available tools support it.",
    "Never publish, share externally, overwrite input files, inspect paths outside this job workspace, or reveal private Harness content.",
    `Objective: ${brief.objective || "Create a social campaign design"}`,
    `Audience: ${brief.audience || "Confirm from provided context"}`,
    `Channel: ${brief.channel || "instagram_feed"}`,
    `Goal: ${brief.goal || "conversion"}`,
    `Must include: ${(brief.mustInclude || []).join(", ") || "none specified"}`,
    `Must avoid: ${(brief.mustAvoid || []).join(", ") || "none specified"}`,
    `Input assets: ${inputFiles.map((file) => `${file.name} (${relative(dirname(outputRoot), file.path)})`).join(", ")}`,
    `Write all final artifacts under the relative workspace directory: ${relative(dirname(outputRoot), outputRoot)}/`,
    "Return a concise public-safe rationale and artifact descriptors.",
  ].join("\n");
}

async function spawnRuntime({ cliPath, workingDirectory, specialistRoot, stateDir, userId, sessionId, provider, model, providerEnv, prompt, signal }) {
  const args = [cliPath, "--json", "--provider", provider, ...(model ? ["--model", model] : []), "--session", sessionId, "--user-id", userId, "--state-dir", stateDir, "--runtime-mode", "work", "--workspace", workingDirectory, prompt];
  const env = {
    PATH: providerEnv?.PATH || process.env.PATH || "/usr/bin:/bin",
    TMPDIR: process.env.TMPDIR || tmpdir(),
    LANG: process.env.LANG || "en_US.UTF-8",
    NO_COLOR: "1",
    ELECTRON_RUN_AS_NODE: "1",
    HIREME_LOCAL_SPECIALIST_ROOT: specialistRoot,
    HIREME_USER_ID: userId,
    HIREME_TOOL_ALLOWLIST: [
      "list_files",
      "search_files",
      "read_file",
      "write_file",
      "hireme_list_local_specialist_agents",
      "hireme_validate_local_specialist_agent",
      "hireme_call_local_specialist_agent",
      "hireme_validate_image_artifact",
      "hireme_materialize_specialist_image_artifact",
    ].join(","),
    ...pickProviderEnv(providerEnv),
  };
  const child = spawn(process.execPath, args, { cwd: workingDirectory, env, stdio: ["ignore", "pipe", "pipe"] });
  const abort = () => child.kill("SIGTERM");
  signal?.addEventListener("abort", abort, { once: true });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8"); child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.setEncoding("utf8"); child.stderr.on("data", (chunk) => { stderr += chunk; });
  try {
    const result = await new Promise((resolveResult, reject) => {
      child.once("error", reject);
      child.once("close", (code, closeSignal) => resolveResult({ code, signal: closeSignal }));
    });
    if (result.signal || result.code !== 0) throw new Error(stderr.trim() || `Creator Worker runtime exited with ${result.code}.`);
    const parsed = parseJsonResult(stdout);
    if (parsed.status === "failed") throw new Error(parsed.error || "Creator Worker runtime failed.");
    return parsed;
  } finally {
    signal?.removeEventListener("abort", abort);
  }
}

function pickProviderEnv(value = {}) {
  const allowed = [
    "CODEX_HOME",
    "OPENAI_API_KEY",
    "HIREME_OPENAI_CODEX_AUTH_PATH",
    "HIREME_CODEX_COMMAND",
    "HIREME_CODEX_ARGS",
    "HIREME_CODEX_IMAGE_GEN_COMMAND",
    "HIREME_CODEX_IMAGE_GEN_ARGS",
    "HIREME_CODEX_IMAGE_GEN_TIMEOUT_MS",
    "OLLAMA_HOST",
    "OLLAMA_BASE_URL",
    "OLLAMA_API_KEY",
    "HIREME_OLLAMA_URL",
    "HIREME_OLLAMA_BASE_URL",
    "HIREME_OLLAMA_MODEL",
  ];
  return Object.fromEntries(allowed.filter((key) => value[key]).map((key) => [key, value[key]]));
}

function parseJsonResult(stdout) {
  const lines = String(stdout || "").trim().split(/\r?\n/).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try { return JSON.parse(lines.slice(index).join("\n")); } catch {}
    try { return JSON.parse(lines[index]); } catch {}
  }
  throw new Error("Creator Worker runtime returned invalid JSON.");
}

async function collectArtifacts(parsed, jobRoot, outputRoot) {
  const candidates = [];
  collectPaths(parsed?.artifacts, candidates);
  collectPaths(parsed?.structuredResult?.artifacts, candidates);
  candidates.push(...await listOutputFiles(outputRoot));
  const artifacts = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const path = isAbsolute(candidate.path) ? resolve(candidate.path) : resolve(jobRoot, candidate.path);
    if (relative(jobRoot, path).startsWith("..")) continue;
    if (seen.has(path)) continue;
    const info = await stat(path).catch(() => null);
    if (!info?.isFile() || info.size < 1 || info.size > 50 * 1024 * 1024) continue;
    seen.add(path);
    artifacts.push({ path, name: candidate.name || basename(path), mimeType: candidate.mimeType || mimeFromPath(path), kind: candidate.kind || (artifacts.length < 3 ? "preview" : "export") });
  }
  return artifacts.slice(0, 18);
}

async function listOutputFiles(root, directory = root, target = []) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (target.length >= 40) break;
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) await listOutputFiles(root, path, target);
    else if (entry.isFile()) target.push({ path, name: relative(root, path) });
  }
  return target;
}

function collectPaths(value, target) {
  if (!value) return;
  if (Array.isArray(value)) return value.forEach((item) => collectPaths(item, target));
  if (typeof value !== "object") return;
  if (typeof value.path === "string") target.push(value);
  for (const nested of Object.values(value)) if (nested && typeof nested === "object") collectPaths(nested, target);
}

export async function evaluateMachineContract(artifacts, brief) {
  const required = parseDimensions(brief?.deliverables?.[0]?.dimensions || "1080x1350");
  const previews = artifacts.filter((artifact) => artifact.kind === "preview");
  const reasons = [];
  const digests = new Set();
  let validDimensions = 0;
  for (const preview of previews) {
    if (preview.mimeType !== "image/png") {
      reasons.push(`${preview.name}: v0 preview는 PNG여야 합니다.`);
      continue;
    }
    const bytes = await readFile(preview.path);
    const dimensions = pngDimensions(bytes);
    const digest = sha256(bytes);
    bytes.fill(0);
    if (!dimensions || dimensions.width !== required.width || dimensions.height !== required.height) {
      reasons.push(`${preview.name}: ${required.width}x${required.height} 규격이 아닙니다.`);
      continue;
    }
    validDimensions += 1;
    if (digests.has(digest)) reasons.push(`${preview.name}: 다른 방향과 동일한 이미지입니다.`);
    digests.add(digest);
  }
  if (previews.length < 3) reasons.push("브랜드 소셜 캠페인은 preview 3종을 요구합니다.");
  if (!artifacts.some((artifact) => artifact.kind === "rationale")) reasons.push("공개 가능한 design rationale이 없습니다.");
  const pass = previews.length >= 3 && validDimensions >= 3 && digests.size >= 3 && reasons.length === 0;
  return {
    verdict: pass ? "pass" : "blocked",
    scores: {
      artifactCompleteness: pass ? 1 : 0,
      previewCount: previews.length,
      validDimensionCount: validDimensions,
      distinctPreviewCount: digests.size,
    },
    reasons,
  };
}

function evaluateDesignCritic(parsed, brief, machine) {
  const rationale = String(parsed.outputText || "").trim();
  const objectiveTokens = String(brief?.objective || "")
    .toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 3).slice(0, 20);
  const normalizedRationale = rationale.toLowerCase();
  const matched = objectiveTokens.filter((token) => normalizedRationale.includes(token)).length;
  const briefFidelity = objectiveTokens.length ? matched / objectiveTokens.length : rationale ? 0.5 : 0;
  const reasons = [];
  if (!rationale) reasons.push("결과의 공개 가능한 디자인 근거가 없습니다.");
  if (machine.verdict !== "pass") reasons.push("기술 결과물 계약을 먼저 충족해야 합니다.");
  if (briefFidelity < 0.2) reasons.push("rationale에서 brief 목적과의 연결 근거가 부족합니다.");
  return {
    verdict: reasons.length ? "revise" : "pass",
    scores: { briefFidelity: Number(briefFidelity.toFixed(3)), rationalePresent: rationale ? 1 : 0 },
    reasons: reasons.length ? reasons : ["자동 rubric을 통과했으며 디자이너 최종 검수가 필요합니다."],
  };
}

function parseDimensions(value) {
  const match = String(value || "").match(/^(\d{2,5})x(\d{2,5})$/i);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : { width: 1080, height: 1350 };
}

function pngDimensions(bytes) {
  if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function sha256(value) { return `sha256:${createHash("sha256").update(value).digest("hex")}`; }
function safeFilename(value) { return String(value || "asset").normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 160) || "asset"; }
function mimeFromPath(path) { const extension = path.toLowerCase().split(".").at(-1); return ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml", pdf: "application/pdf", json: "application/json" })[extension] || "application/json"; }
function throwIfAborted(signal) { if (signal?.aborted) throw signal.reason || new Error("Creator Worker job was canceled."); }
