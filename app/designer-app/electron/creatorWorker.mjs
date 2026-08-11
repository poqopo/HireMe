import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  sign,
} from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const workerSchema = "hireme.creator_worker.state.v1";
const heartbeatEveryMs = 30_000;
const pollEveryMs = 10_000;
const renewEveryMs = 30_000;

export function createCreatorWorkerService({
  getClient,
  getUser,
  appVersion,
  platform,
  deviceName,
  identityPath,
  protectSecret,
  unprotectSecret,
  executeJob,
  onStateChange = () => {},
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  let identity = null;
  let worker = null;
  let available = false;
  let heartbeatTimer = null;
  let pollTimer = null;
  let activeJob = null;
  let stopped = false;
  let busy = false;
  let error = null;
  let jobs = [];
  let approvalItems = [];

  const publicState = () => ({
    schema: workerSchema,
    worker: worker ? {
      id: worker.id,
      deviceName: worker.device_name || deviceName,
      availability: available ? "available" : "unavailable",
      health: worker.health || (worker.last_heartbeat_at ? "online" : "offline"),
      lastHeartbeatAt: worker.last_heartbeat_at || null,
      appVersion,
      platform,
    } : null,
    available,
    busy,
    activeJob: activeJob ? { ...publicJob(activeJob.job), stage: activeJob.stage || null } : null,
    jobs: jobs.map(publicJob),
    approvalItems: approvalItems.map(publicApproval),
    error,
  });

  const publish = () => {
    const state = publicState();
    onStateChange(state);
    return state;
  };

  async function initialize() {
    stopped = false;
    identity = await readOrCreateIdentity({ identityPath, protectSecret, unprotectSecret });
    worker = await registerWorker();
    await refresh();
    if (available) {
      scheduleHeartbeat(0);
      schedulePoll(0);
    }
    return publish();
  }

  async function registerWorker() {
    const response = await invoke("register", {
      deviceName,
      platform,
      appVersion,
      signingPublicKey: identity.signingPublicKey,
      encryptionPublicKey: identity.encryptionPublicKey,
    });
    if (!response?.worker?.id) throw new Error("Worker 등록 결과가 올바르지 않습니다.");
    return response.worker;
  }

  async function setAvailable(next) {
    if (!worker) await initialize();
    const response = await invoke("set-availability", { workerId: worker.id, available: next === true });
    worker = { ...worker, ...response.worker };
    available = response.worker?.availability === "available";
    error = null;
    clearSchedules();
    if (available) {
      scheduleHeartbeat(0);
      schedulePoll(0);
    }
    return publish();
  }

  async function heartbeat() {
    if (!available || stopped || !worker) return;
    try {
      const response = await invoke("heartbeat", { workerId: worker.id, appVersion });
      worker = { ...worker, ...response.worker, health: "online" };
      error = null;
      publish();
    } catch (heartbeatError) {
      error = publicError(heartbeatError);
      publish();
    } finally {
      scheduleHeartbeat(heartbeatEveryMs);
    }
  }

  async function poll() {
    if (!available || stopped || !worker || busy) return schedulePoll(pollEveryMs);
    try {
      const claimed = await invoke("claim", { workerId: worker.id });
      if (claimed?.job && claimed?.leaseToken) {
        void runClaimedJob(claimed.job, claimed.leaseToken);
        return;
      }
      error = null;
    } catch (pollError) {
      error = publicError(pollError);
      publish();
    }
    schedulePoll(pollEveryMs);
  }

  async function runClaimedJob(job, leaseToken) {
    busy = true;
    const abortController = new AbortController();
    activeJob = { job, leaseToken, abortController, renewTimer: null };
    publish();
    let executionResult = null;
    try {
      await invoke("start", { workerId: worker.id, jobId: job.id, leaseToken });
      scheduleRenew(activeJob);
      const result = await executeJob({
        job,
        signal: abortController.signal,
        onStage(stage) {
          activeJob = activeJob ? { ...activeJob, stage: String(stage || "") } : activeJob;
          publish();
        },
      });
      executionResult = result;
      const artifacts = await prepareAndUploadArtifacts({ job, leaseToken, artifacts: result.artifacts || [] });
      await invoke("complete", {
        workerId: worker.id,
        jobId: job.id,
        leaseToken,
        artifactIds: artifacts.map((item) => item.artifactId),
        evaluations: result.evaluations,
      });
      error = null;
    } catch (jobError) {
      const cancelled = abortController.signal.aborted;
      error = publicError(jobError);
      await invoke("fail", {
        workerId: worker.id,
        jobId: job.id,
        leaseToken,
        retryable: !cancelled && isRetryable(jobError),
        errorCode: cancelled ? "worker_cancelled" : errorCode(jobError),
        errorDetail: error,
      }).catch(() => {});
    } finally {
      await executionResult?.cleanup?.().catch(() => {});
      if (activeJob?.renewTimer) clearTimer(activeJob.renewTimer);
      activeJob = null;
      busy = false;
      await refresh().catch(() => {});
      publish();
      schedulePoll(available ? 250 : pollEveryMs);
    }
  }

  async function prepareAndUploadArtifacts({ job, leaseToken, artifacts }) {
    if (!Array.isArray(artifacts) || !artifacts.length) throw new Error("Worker 결과 artifact가 없습니다.");
    const manifests = [];
    const files = [];
    for (const [index, artifact] of artifacts.slice(0, 20).entries()) {
      const path = resolve(String(artifact.path || ""));
      const info = await stat(path);
      if (!info.isFile() || info.size < 1 || info.size > 50 * 1024 * 1024) throw new Error("Artifact 파일 크기가 올바르지 않습니다.");
      const bytes = await readFile(path);
      const manifest = {
        schema: "hireme.creator_worker.artifact_manifest.v1",
        jobId: job.id,
        projectId: job.project_id,
        workerId: worker.id,
        harnessDigest: job.harness_digest,
        attemptNumber: job.attempt_number,
        kind: normalizeArtifactKind(artifact.kind, index),
        version: Number(artifact.version || job.attempt_number || 1),
        filename: String(artifact.name || basename(path)).slice(0, 240),
        mimeType: normalizeMime(artifact.mimeType, path),
        sizeBytes: info.size,
        contentDigest: sha256(bytes),
        provenance: {
          workflowId: job.workflow_id,
          workflowRevision: job.workflow_revision,
          harnessRevision: job.harness_revision,
          toolCallIds: Array.isArray(artifact.toolCallIds) ? artifact.toolCallIds.slice(0, 50) : [],
        },
      };
      manifests.push({ ...manifest, signature: signManifest(manifest, identity.signingPrivateKey) });
      files.push({ path, bytes, mimeType: manifest.mimeType });
    }
    const prepared = await invoke("prepare-artifacts", {
      workerId: worker.id, jobId: job.id, leaseToken, artifacts: manifests,
    });
    if (!Array.isArray(prepared?.uploads) || prepared.uploads.length !== files.length) throw new Error("Artifact 업로드 권한을 받지 못했습니다.");
    const client = requireClient(getClient);
    for (const [index, upload] of prepared.uploads.entries()) {
      const result = await client.storage.from("design-deliveries").uploadToSignedUrl(
        upload.path,
        upload.token,
        files[index].bytes,
        { contentType: files[index].mimeType, upsert: false },
      );
      files[index].bytes.fill(0);
      if (result.error) throw new Error(`Artifact 업로드 실패: ${result.error.message}`);
    }
    return prepared.uploads;
  }

  async function bindAgent({ agentId, localAgentId, harnessRevision, harnessDigest }) {
    if (!worker) await initialize();
    return invoke("bind-agent", { workerId: worker.id, agentId, localAgentId, harnessRevision, harnessDigest });
  }

  async function publishAgent({ packagePath, agentSlug, version, packageDigest, publicProfile, publicDesignContract, manifest }) {
    if (!worker) await initialize();
    const packageBytes = await readFile(packagePath);
    let backupBytes = null;
    try {
      const backup = encryptCreatorBackup({ packageBytes, packageDigest, identity });
      backupBytes = backup.bytes;
      const response = await invoke("publish-agent", {
        workerId: worker.id,
        agentSlug,
        version,
        packageDigest,
        publicProfile,
        publicDesignContract,
        manifest,
        backupBase64: backupBytes.toString("base64"),
      });
      await refresh();
      return response;
    } finally {
      backupBytes?.fill(0);
      packageBytes.fill(0);
    }
  }

  async function refresh() {
    const state = await invoke("state", {});
    jobs = Array.isArray(state.jobs) ? state.jobs : [];
    approvalItems = Array.isArray(state.approvalItems) ? state.approvalItems : [];
    if (worker) {
      const remote = (state.workers || []).find((item) => item.id === worker.id);
      if (remote) {
        worker = { ...worker, ...remote };
        available = remote.availability === "available";
      }
    }
    return publish();
  }

  async function approveJob({ jobId, decision, note = "" }) {
    const result = await invoke("approve", { jobId, decision, note });
    await refresh();
    return result;
  }

  async function stop({ revoke = false } = {}) {
    stopped = true;
    clearSchedules();
    activeJob?.abortController?.abort();
    if (worker) {
      await invoke(revoke ? "revoke" : "set-availability", {
        workerId: worker.id,
        available: false,
      }).catch(() => {});
    }
    available = false;
    return publish();
  }

  async function invoke(action, body) {
    const client = requireClient(getClient);
    const response = await client.functions.invoke("creator-worker", { body: { action, ...body } });
    if (response.error) throw new Error(await edgeErrorMessage(response.error));
    if (response.data?.error) throw new Error(String(response.data.error));
    return response.data || {};
  }

  function scheduleHeartbeat(delay) {
    if (!available || stopped) return;
    if (heartbeatTimer) clearTimer(heartbeatTimer);
    heartbeatTimer = setTimer(() => { heartbeatTimer = null; void heartbeat(); }, delay);
    heartbeatTimer?.unref?.();
  }

  function schedulePoll(delay) {
    if (!available || stopped) return;
    if (pollTimer) clearTimer(pollTimer);
    pollTimer = setTimer(() => { pollTimer = null; void poll(); }, delay);
    pollTimer?.unref?.();
  }

  function scheduleRenew(record) {
    if (!record || activeJob !== record) return;
    record.renewTimer = setTimer(async () => {
      try {
        const response = await invoke("renew", { workerId: worker.id, jobId: record.job.id, leaseToken: record.leaseToken });
        if (!response.renewed) throw new Error("Worker lease가 만료되었습니다.");
        scheduleRenew(record);
      } catch (renewError) {
        record.abortController.abort(renewError);
      }
    }, renewEveryMs);
    record.renewTimer?.unref?.();
  }

  function clearSchedules() {
    if (heartbeatTimer) clearTimer(heartbeatTimer);
    if (pollTimer) clearTimer(pollTimer);
    heartbeatTimer = null;
    pollTimer = null;
  }

  return { initialize, getState: publicState, setAvailable, refresh, bindAgent, publishAgent, approveJob, stop };
}

export function encryptCreatorBackup({ packageBytes, packageDigest, identity } = {}) {
  const plaintext = Buffer.from(packageBytes || []);
  if (!plaintext.length || plaintext.length > 100 * 1024 * 1024) throw new Error("Creator Harness 백업 크기가 올바르지 않습니다.");
  if (!/^sha256:[a-f0-9]{64}$/.test(String(packageDigest || ""))) throw new Error("Creator Harness package digest가 올바르지 않습니다.");
  const privateBytes = Buffer.from(identity.encryptionPrivateKey, "base64");
  const salt = randomBytes(32);
  const iv = randomBytes(12);
  const keyFingerprint = sha256(Buffer.from(identity.encryptionPublicKey, "base64"));
  const key = Buffer.from(hkdfSync("sha256", privateBytes, salt, Buffer.from(`hireme-creator-backup\0${packageDigest}\0${keyFingerprint}`), 32));
  const metadata = {
    schema: "hireme.creator_harness_backup.v1",
    algorithm: "aes-256-gcm",
    kdf: "hkdf-sha256",
    keyFingerprint,
    packageDigest,
    createdAt: new Date().toISOString(),
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
  };
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(stableStringify(metadata), "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const envelope = { ...metadata, authTag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") };
  key.fill(0); privateBytes.fill(0); ciphertext.fill(0);
  return { bytes: Buffer.from(`${stableStringify(envelope)}\n`, "utf8"), metadata };
}

export function decryptCreatorBackup({ envelopeBytes, identity } = {}) {
  const envelope = JSON.parse(Buffer.from(envelopeBytes || []).toString("utf8"));
  if (envelope?.schema !== "hireme.creator_harness_backup.v1" || envelope.algorithm !== "aes-256-gcm") {
    throw new Error("지원하지 않는 Creator Harness 백업입니다.");
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(String(envelope.packageDigest || ""))) {
    throw new Error("Creator Harness 백업 digest가 올바르지 않습니다.");
  }
  const privateBytes = Buffer.from(identity.encryptionPrivateKey, "base64");
  const salt = Buffer.from(envelope.salt, "base64");
  const iv = Buffer.from(envelope.iv, "base64");
  const keyFingerprint = sha256(Buffer.from(identity.encryptionPublicKey, "base64"));
  if (keyFingerprint !== envelope.keyFingerprint) throw new Error("이 기기의 Creator key로 복구할 수 없는 백업입니다.");
  const metadata = {
    schema: envelope.schema,
    algorithm: envelope.algorithm,
    kdf: envelope.kdf,
    keyFingerprint: envelope.keyFingerprint,
    packageDigest: envelope.packageDigest,
    createdAt: envelope.createdAt,
    salt: envelope.salt,
    iv: envelope.iv,
  };
  const key = Buffer.from(hkdfSync("sha256", privateBytes, salt, Buffer.from(`hireme-creator-backup\0${envelope.packageDigest}\0${keyFingerprint}`), 32));
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from(stableStringify(metadata), "utf8"));
    decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ]);
    let embeddedDigest = "";
    try {
      embeddedDigest = JSON.parse(plaintext.toString("utf8"))?.integrity?.packageDigest || "";
    } catch {}
    if (embeddedDigest !== envelope.packageDigest) {
      plaintext.fill(0);
      throw new Error("복구한 Creator Harness의 무결성 검증에 실패했습니다.");
    }
    return { packageBytes: plaintext, packageDigest: envelope.packageDigest };
  } finally {
    key.fill(0);
    privateBytes.fill(0);
  }
}

export function createWorkerIdentity() {
  const signing = generateKeyPairSync("ed25519");
  const encryption = generateKeyPairSync("x25519");
  return {
    schema: "hireme.creator_worker.identity.v1",
    signingPublicKey: exportKey(signing.publicKey, "spki"),
    signingPrivateKey: exportKey(signing.privateKey, "pkcs8"),
    encryptionPublicKey: exportKey(encryption.publicKey, "spki"),
    encryptionPrivateKey: exportKey(encryption.privateKey, "pkcs8"),
    createdAt: new Date().toISOString(),
  };
}

async function readOrCreateIdentity({ identityPath, protectSecret, unprotectSecret }) {
  try {
    const encrypted = await readFile(identityPath);
    const decoded = await unprotectSecret(encrypted);
    const identity = JSON.parse(Buffer.from(decoded).toString("utf8"));
    validateIdentity(identity);
    return identity;
  } catch (readError) {
    if (readError?.code !== "ENOENT") throw readError;
    const identity = createWorkerIdentity();
    const plaintext = Buffer.from(JSON.stringify(identity), "utf8");
    const encrypted = await protectSecret(plaintext);
    await mkdir(dirname(identityPath), { recursive: true });
    await writeFile(identityPath, encrypted, { mode: 0o600 });
    plaintext.fill(0);
    return identity;
  }
}

function validateIdentity(identity) {
  if (identity?.schema !== "hireme.creator_worker.identity.v1") throw new Error("지원하지 않는 Worker identity입니다.");
  createPrivateKey({ key: Buffer.from(identity.signingPrivateKey, "base64"), format: "der", type: "pkcs8" });
  createPublicKey({ key: Buffer.from(identity.signingPublicKey, "base64"), format: "der", type: "spki" });
}

function exportKey(key, type) {
  return key.export({ format: "der", type }).toString("base64");
}

function signManifest(manifest, privateKeyBase64) {
  const key = createPrivateKey({ key: Buffer.from(privateKeyBase64, "base64"), format: "der", type: "pkcs8" });
  return sign(null, Buffer.from(stableStringify(manifest), "utf8"), key).toString("base64");
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function normalizeMime(value, path) {
  const provided = String(value || "").toLowerCase();
  if (provided) return provided;
  const extension = path.toLowerCase().split(".").at(-1);
  return ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml", pdf: "application/pdf", json: "application/json" })[extension] || "application/json";
}

function normalizeArtifactKind(value, index) {
  const kind = String(value || "").toLowerCase();
  if (["preview", "source", "export", "rationale", "evaluation_report"].includes(kind)) return kind;
  return index < 3 ? "preview" : "export";
}

function publicJob(job) {
  return {
    id: job.id,
    projectId: job.project_id,
    agentId: job.agent_id,
    workerId: job.worker_id,
    status: job.status,
    attemptNumber: job.attempt_number,
    queuedAt: job.queued_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    errorCode: job.error_code || null,
  };
}

function publicApproval(job) {
  return {
    jobId: job.id,
    projectId: job.project_id,
    agentId: job.agent_id,
    status: job.status,
    attemptNumber: job.attempt_number,
    brief: job.design_projects?.brief || {},
    createdAt: job.design_projects?.created_at || job.queued_at,
    artifacts: (job.design_artifacts || []).map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind,
      name: artifact.filename,
      mimeType: artifact.mime_type,
      size: Number(artifact.size_bytes || 0),
      downloadUrl: artifact.downloadUrl || null,
    })),
    evaluations: (job.design_evaluations || []).map((evaluation) => ({
      evaluator: evaluation.evaluator,
      verdict: evaluation.verdict,
      scores: evaluation.scores || {},
      reasons: evaluation.reasons || [],
    })),
  };
}

function requireClient(getClient) {
  const client = getClient?.();
  if (!client) throw new Error("HireMe 로그인 세션을 확인하지 못했습니다.");
  return client;
}

async function edgeErrorMessage(error) {
  try {
    const context = error?.context;
    if (context && typeof context.json === "function") {
      const payload = await (typeof context.clone === "function" ? context.clone() : context).json();
      if (payload?.error) return String(payload.error);
    }
  } catch {}
  try {
    const context = error?.context;
    if (context && typeof context.text === "function") {
      const text = await (typeof context.clone === "function" ? context.clone() : context).text();
      if (text.trim()) return text.trim().slice(0, 500);
    }
  } catch {}
  return error?.message || "Creator Worker 요청에 실패했습니다.";
}

function isRetryable(error) {
  return !/revision|digest|forbidden|policy|invalid|not allowed/i.test(String(error?.message || error));
}

function errorCode(error) {
  return String(error?.code || "worker_execution_failed").replace(/[^a-z0-9._-]+/gi, "_").slice(0, 120);
}

function publicError(error) {
  return String(error?.message || error || "알 수 없는 Worker 오류").slice(0, 500);
}
