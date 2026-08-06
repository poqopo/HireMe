/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase row shapes are generated only after the migration is applied. */
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  boundedText,
  bytesFromBase64,
  corsHeaders,
  json,
  requireDigest,
  requireUuid,
  stableStringify,
} from "../_shared/http.ts";

const inputBucket = "design-project-inputs";
const deliveryBucket = "design-deliveries";
const allowedInputMime = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "application/pdf"]);
const allowedOutputMime = new Set([...allowedInputMime, "application/json"]);
const leaseSeconds = 300;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const context = await requestContext(request);
    const body = await request.json().catch(() => ({}));
    const action = boundedText(body?.action, "action", 80);
    switch (action) {
      case "register": return json(await registerWorker(context, body));
      case "heartbeat": return json(await heartbeatWorker(context, body));
      case "set-availability": return json(await setAvailability(context, body));
      case "revoke": return json(await revokeWorker(context, body));
      case "bind-agent": return json(await bindAgent(context, body));
      case "publish-agent": return json(await publishAgent(context, body));
      case "state": return json(await loadWorkerState(context));
      case "projects": return json(await loadParticipantProjects(context));
      case "claim": return json(await claimJob(context, body));
      case "renew": return json(await renewLease(context, body));
      case "start": return json(await startJob(context, body));
      case "prepare-artifacts": return json(await prepareArtifacts(context, body));
      case "complete": return json(await completeJob(context, body));
      case "fail": return json(await failJob(context, body));
      case "approve": return json(await approveJob(context, body));
      case "create-project": return json(await createProject(context, body));
      case "finalize-project": return json(await finalizeProject(context, body));
      case "cancel": return json(await cancelProject(context, body));
      default: return json({ error: "unknown_action" }, 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "request_failed";
    return json({ error: message }, /unauthenticated|forbidden|pilot_access_required/.test(message) ? 403 : 400);
  }
});

type Context = {
  user: { id: string };
  userClient: SupabaseClient;
  service: SupabaseClient;
};

async function requestContext(request: Request): Promise<Context> {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authorization = request.headers.get("Authorization") || "";
  if (!url || !anon || !serviceKey || !authorization.startsWith("Bearer ")) throw new Error("unauthenticated");
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error("unauthenticated");
  const service = createClient(url, serviceKey);
  const membership = await service.from("pilot_members").select("user_id").eq("user_id", data.user.id).eq("status", "active").maybeSingle();
  if (membership.error || !membership.data) throw new Error("pilot_access_required");
  return { user: { id: data.user.id }, userClient, service };
}

async function registerWorker({ user, service }: Context, body: any) {
  const signingKey = boundedText(body.signingPublicKey, "signingPublicKey", 16_384);
  const encryptionKey = boundedText(body.encryptionPublicKey, "encryptionPublicKey", 16_384);
  const fingerprint = await sha256(bytesFromBase64(signingKey));
  const payload = {
    creator_id: user.id,
    device_name: boundedText(body.deviceName, "deviceName", 120),
    signing_public_key: signingKey,
    encryption_public_key: encryptionKey,
    key_fingerprint: fingerprint,
    platform: boundedText(body.platform, "platform", 20),
    app_version: boundedText(body.appVersion, "appVersion", 40),
    status: "active",
  };
  const result = await service.from("creator_workers")
    .upsert(payload, { onConflict: "creator_id,key_fingerprint" })
    .select("id, device_name, availability, status, last_heartbeat_at")
    .single();
  throwResult(result, "worker registration");
  return { schema: "hireme.creator_worker.registration.v1", worker: result.data };
}

async function heartbeatWorker({ user, service }: Context, body: any) {
  const workerId = requireUuid(body.workerId, "workerId");
  const result = await service.from("creator_workers")
    .update({ last_heartbeat_at: new Date().toISOString(), app_version: boundedText(body.appVersion, "appVersion", 40) })
    .eq("id", workerId).eq("creator_id", user.id).eq("status", "active")
    .select("id, availability, status, last_heartbeat_at").maybeSingle();
  throwResult(result, "worker heartbeat");
  if (!result.data) throw new Error("worker_not_found");
  return { worker: result.data };
}

async function setAvailability({ user, service }: Context, body: any) {
  const workerId = requireUuid(body.workerId, "workerId");
  const availability = body.available === true ? "available" : "unavailable";
  const result = await service.from("creator_workers")
    .update({ availability, last_heartbeat_at: new Date().toISOString() })
    .eq("id", workerId).eq("creator_id", user.id).eq("status", "active")
    .select("id, availability, status, last_heartbeat_at").maybeSingle();
  throwResult(result, "worker availability");
  if (!result.data) throw new Error("worker_not_found");
  return { worker: result.data };
}

async function revokeWorker({ user, service }: Context, body: any) {
  const workerId = requireUuid(body.workerId, "workerId");
  const result = await service.from("creator_workers")
    .update({ status: "revoked", availability: "unavailable" })
    .eq("id", workerId).eq("creator_id", user.id).select("id").maybeSingle();
  throwResult(result, "worker revoke");
  if (!result.data) throw new Error("worker_not_found");
  await service.from("agent_worker_bindings").update({ status: "revoked" }).eq("worker_id", workerId);
  return { workerId, revoked: true };
}

async function bindAgent({ user, service }: Context, body: any) {
  const workerId = requireUuid(body.workerId, "workerId");
  const agentId = requireUuid(body.agentId, "agentId");
  const [workerResult, agentResult] = await Promise.all([
    service.from("creator_workers").select("id").eq("id", workerId).eq("creator_id", user.id).eq("status", "active").maybeSingle(),
    service.from("agents").select("id, creator_id").eq("id", agentId).eq("creator_id", user.id).maybeSingle(),
  ]);
  throwResult(workerResult, "worker lookup");
  throwResult(agentResult, "agent lookup");
  if (!workerResult.data || !agentResult.data) throw new Error("forbidden");
  const result = await service.from("agent_worker_bindings").upsert({
    agent_id: agentId,
    worker_id: workerId,
    creator_id: user.id,
    local_agent_id: boundedText(body.localAgentId, "localAgentId", 100),
    harness_revision: boundedText(body.harnessRevision, "harnessRevision", 80),
    harness_digest: requireDigest(body.harnessDigest, "harnessDigest"),
    execution_class: "creator_worker",
    status: "active",
  }).select().single();
  throwResult(result, "agent worker binding");
  return { binding: result.data };
}

async function publishAgent({ user, service }: Context, body: any) {
  const workerId = requireUuid(body.workerId, "workerId");
  const localAgentId = boundedText(body.agentSlug, "agentSlug", 100).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,100}$/.test(localAgentId)) throw new Error("agent_slug_invalid");
  const slug = localAgentId
    .replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) throw new Error("agent_slug_invalid");
  const version = boundedText(body.version, "version", 80);
  const packageDigest = requireDigest(body.packageDigest, "packageDigest");
  const backupBytes = bytesFromLargeBase64(body.backupBase64);
  if (backupBytes.length > 100 * 1024 * 1024) throw new Error("backup_too_large");
  const backupDigest = await sha256(backupBytes);
  const worker = await service.from("creator_workers").select("id, encryption_public_key").eq("id", workerId).eq("creator_id", user.id).eq("status", "active").maybeSingle();
  throwResult(worker, "publish worker");
  if (!worker.data) throw new Error("forbidden");
  let envelope: any;
  try { envelope = JSON.parse(new TextDecoder().decode(backupBytes)); } catch { throw new Error("backup_envelope_invalid"); }
  if (envelope?.schema !== "hireme.creator_harness_backup.v1" || envelope.packageDigest !== packageDigest) throw new Error("backup_envelope_invalid");

  const publicProfile = body.publicProfile && typeof body.publicProfile === "object" ? body.publicProfile : {};
  const existing = await service.from("agents").select("id, creator_id").eq("slug", slug).maybeSingle();
  throwResult(existing, "agent publish lookup");
  if (existing.data && existing.data.creator_id !== user.id) throw new Error("agent_slug_unavailable");
  const agentPayload = {
    creator_id: user.id,
    slug,
    name: boundedText(publicProfile.name || slug, "agent name", 120),
    category: normalizeCategory(publicProfile.category),
    status: "published",
    visibility: "public",
    headline: String(publicProfile.headline || "").slice(0, 240),
    public_summary: String(publicProfile.public_summary || publicProfile.summary || "").slice(0, 4000),
    public_skills: Array.isArray(publicProfile.skills) ? publicProfile.skills.slice(0, 20).map(String) : [],
    result_types: Array.isArray(publicProfile.result_types) ? publicProfile.result_types.slice(0, 20).map(String) : ["image"],
    public_design_contract: body.publicDesignContract && typeof body.publicDesignContract === "object" ? body.publicDesignContract : {},
  };
  let agentId = existing.data?.id;
  if (agentId) {
    const updated = await service.from("agents").update(agentPayload).eq("id", agentId).eq("creator_id", user.id).select("id").single();
    throwResult(updated, "agent publish update");
  } else {
    const inserted = await service.from("agents").insert(agentPayload).select("id").single();
    throwResult(inserted, "agent publish insert");
    agentId = inserted.data.id;
  }
  const versions = await service.from("agent_versions").select("version_number").eq("agent_id", agentId).order("version_number", { ascending: false }).limit(1);
  throwResult(versions, "version lookup");
  const versionNumber = Number(versions.data?.[0]?.version_number || 0) + 1;
  const path = `${user.id}/${agentId}/${version}/${backupDigest.slice(7)}.hireme-backup.json`;
  const upload = await service.storage.from("creator-harness-backups").upload(path, backupBytes, {
    contentType: "application/vnd.hireme.creator-backup+json", upsert: false,
  });
  if (upload.error) throw new Error(`backup_upload_failed: ${upload.error.message}`);
  const versionResult = await service.from("agent_versions").insert({
    agent_id: agentId,
    version_number: versionNumber,
    display_version: version,
    release_notes: String(body.releaseNotes || "").slice(0, 4000),
    manifest: body.manifest && typeof body.manifest === "object" ? body.manifest : {},
    package_digest: packageDigest,
    package_ciphertext_digest: backupDigest,
    package_size_bytes: backupBytes.length,
    package_encryption: { schema: envelope.schema, algorithm: envelope.algorithm, kdf: envelope.kdf, keyFingerprint: envelope.keyFingerprint },
    runtime_ref: `creator-worker://${workerId}/${packageDigest.slice(7)}`,
    published_at: new Date().toISOString(),
  }).select("id, version_number, display_version").single();
  if (versionResult.error) {
    await service.storage.from("creator-harness-backups").remove([path]);
    throwResult(versionResult, "version publish");
  }
  const current = await service.from("agents").update({ current_version: versionNumber }).eq("id", agentId);
  throwResult(current, "agent current version");
  const binding = await service.from("agent_worker_bindings").upsert({
    agent_id: agentId, worker_id: workerId, creator_id: user.id,
    local_agent_id: localAgentId,
    harness_revision: version, harness_digest: packageDigest,
    execution_class: "creator_worker", status: "active",
  }).select().single();
  throwResult(binding, "worker binding publish");
  return {
    schema: "hireme.creator_worker.agent_publish.v1",
    agentId,
    agentSlug: slug,
    versionId: versionResult.data.id,
    versionNumber,
    displayVersion: version,
    packageDigest,
    backup: { bucket: "creator-harness-backups", path, digest: backupDigest, sizeBytes: backupBytes.length },
    binding: binding.data,
  };
}

async function loadWorkerState({ user, service }: Context) {
  const [workers, jobs, approvals] = await Promise.all([
    service.from("creator_worker_status").select("*").eq("creator_id", user.id).order("updated_at", { ascending: false }),
    service.from("creator_jobs").select("id, project_id, agent_id, worker_id, status, attempt_number, queued_at, started_at, completed_at, error_code").eq("creator_id", user.id).order("created_at", { ascending: false }).limit(100),
    service.from("creator_jobs").select("id, project_id, agent_id, worker_id, status, attempt_number, queued_at, started_at, completed_at, error_code, design_projects(brief, created_at), design_artifacts(id, kind, version, filename, mime_type, size_bytes, storage_bucket, storage_path), design_evaluations(evaluator, attempt_number, verdict, scores, reasons)").eq("creator_id", user.id).eq("status", "awaiting_creator_approval").order("created_at", { ascending: true }).limit(50),
  ]);
  throwResult(workers, "worker state");
  throwResult(jobs, "worker jobs");
  throwResult(approvals, "worker approvals");
  const approvalItems = await Promise.all((approvals.data || []).map(async (job: any) => ({
    ...job,
    design_artifacts: await signArtifacts(service, (job.design_artifacts || []).filter((artifact: any) => artifact.version === job.attempt_number)),
    design_evaluations: (job.design_evaluations || []).filter((evaluation: any) => evaluation.attempt_number === job.attempt_number),
  })));
  return { schema: "hireme.creator_worker.state.v1", workers: workers.data || [], jobs: jobs.data || [], approvalItems };
}

async function loadParticipantProjects({ user, service }: Context) {
  const projects = await service.from("design_projects")
    .select("id, client_id, creator_id, agent_id, agent_version_id, status, brief, retention_until, delivered_at, created_at, updated_at")
    .or(`client_id.eq.${user.id},creator_id.eq.${user.id}`)
    .order("created_at", { ascending: false }).limit(100);
  throwResult(projects, "project state");
  const projectIds = (projects.data || []).map((project: any) => project.id);
  if (!projectIds.length) return { schema: "hireme.design_project_list.v1", projects: [] };
  const [jobs, artifacts, evaluations] = await Promise.all([
    service.from("creator_jobs").select("id, project_id, status, attempt_number, error_code, queued_at, started_at, completed_at").in("project_id", projectIds).order("created_at", { ascending: false }),
    service.from("design_artifacts").select("id, project_id, job_id, kind, filename, mime_type, size_bytes, storage_bucket, storage_path, approved_at, created_at").in("project_id", projectIds),
    service.from("design_evaluations").select("project_id, job_id, evaluator, attempt_number, verdict, scores, reasons, created_at").in("project_id", projectIds),
  ]);
  throwResult(jobs, "project jobs"); throwResult(artifacts, "project artifacts"); throwResult(evaluations, "project evaluations");
  const byProject = new Map<string, any[]>();
  for (const artifact of artifacts.data || []) {
    const project = (projects.data || []).find((item: any) => item.id === artifact.project_id);
    const canDownload = project?.creator_id === user.id || (project?.client_id === user.id && project?.status === "delivered" && artifact.approved_at);
    const hydrated = canDownload
      ? (await signArtifacts(service, [artifact]))[0]
      : { ...artifact, storage_bucket: undefined, storage_path: undefined };
    byProject.set(artifact.project_id, [...(byProject.get(artifact.project_id) || []), hydrated]);
  }
  return {
    schema: "hireme.design_project_list.v1",
    projects: (projects.data || []).map((project: any) => ({
      ...project,
      jobs: (jobs.data || []).filter((job: any) => job.project_id === project.id),
      artifacts: byProject.get(project.id) || [],
      evaluations: (evaluations.data || []).filter((evaluation: any) => evaluation.project_id === project.id),
    })),
  };
}

async function claimJob({ userClient, service }: Context, body: any) {
  const workerId = requireUuid(body.workerId, "workerId");
  const leaseToken = randomToken();
  const leaseDigest = await sha256(new TextEncoder().encode(leaseToken));
  const claimed = await userClient.rpc("claim_creator_job", {
    p_worker_id: workerId,
    p_lease_token_digest: leaseDigest,
    p_lease_seconds: leaseSeconds,
  });
  throwResult(claimed, "job claim");
  const job = Array.isArray(claimed.data) ? claimed.data[0] : null;
  if (!job) return { job: null };
  const assets = await service.from("design_project_assets").select("*").eq("project_id", job.project_id).eq("direction", "input").is("deleted_at", null);
  throwResult(assets, "project assets");
  const hydratedAssets = await Promise.all((assets.data || []).map(async (asset: any) => {
    const signed = await service.storage.from(asset.storage_bucket).createSignedUrl(asset.storage_path, 900);
    if (signed.error || !signed.data?.signedUrl) throw new Error("asset_url_failed");
    return { ...asset, downloadUrl: signed.data.signedUrl };
  }));
  return { job: { ...job, assets: hydratedAssets }, leaseToken };
}

async function renewLease({ userClient }: Context, body: any) {
  const leaseToken = boundedText(body.leaseToken, "leaseToken", 256);
  const result = await userClient.rpc("renew_creator_job_lease", {
    p_job_id: requireUuid(body.jobId, "jobId"),
    p_worker_id: requireUuid(body.workerId, "workerId"),
    p_lease_token_digest: await sha256(new TextEncoder().encode(leaseToken)),
    p_lease_seconds: leaseSeconds,
  });
  throwResult(result, "lease renewal");
  return { renewed: result.data === true };
}

async function startJob(context: Context, body: any) {
  const job = await requireLease(context, body, ["leased"]);
  await transition(context.service, job, "running", "worker_started", { attempt: job.attempt_number });
  return { jobId: job.id, status: "running" };
}

async function prepareArtifacts(context: Context, body: any) {
  const job = await requireLease(context, body, ["running", "evaluating"]);
  const worker = await context.service.from("creator_workers").select("signing_public_key").eq("id", job.worker_id).single();
  throwResult(worker, "worker key");
  const manifests = Array.isArray(body.artifacts) ? body.artifacts.slice(0, 20) : [];
  if (!manifests.length) throw new Error("artifacts_required");
  const uploads = [];
  for (const manifest of manifests) {
    const canonical = normalizeArtifactManifest(manifest, job);
    if (!await verifySignature(worker.data.signing_public_key, canonical, manifest.signature)) {
      throw new Error("artifact_signature_invalid");
    }
    const artifactId = crypto.randomUUID();
    const path = `${job.client_id}/${job.project_id}/${job.id}/${artifactId}/${safeFilename(canonical.filename)}`;
    const inserted = await context.service.from("design_artifacts").insert({
      id: artifactId,
      project_id: job.project_id,
      job_id: job.id,
      creator_id: job.creator_id,
      kind: canonical.kind,
      version: canonical.version,
      filename: canonical.filename,
      mime_type: canonical.mimeType,
      size_bytes: canonical.sizeBytes,
      content_digest: canonical.contentDigest,
      storage_bucket: deliveryBucket,
      storage_path: path,
      provenance: canonical.provenance,
      worker_signature: manifest.signature,
    }).select("id").single();
    throwResult(inserted, "artifact registration");
    const signed = await context.service.storage.from(deliveryBucket).createSignedUploadUrl(path);
    if (signed.error || !signed.data) throw new Error("artifact_upload_url_failed");
    uploads.push({ artifactId, path, token: signed.data.token, signedUrl: signed.data.signedUrl });
  }
  return { uploads };
}

async function completeJob(context: Context, body: any) {
  const job = await requireLease(context, body, ["running", "evaluating"]);
  const artifactIds = Array.isArray(body.artifactIds)
    ? [...new Set(body.artifactIds.map((value: unknown) => requireUuid(value, "artifactId")))].slice(0, 20)
    : [];
  if (!artifactIds.length) throw new Error("artifacts_required");
  const artifactRows = await context.service.from("design_artifacts")
    .select("id, storage_bucket, storage_path, size_bytes")
    .eq("job_id", job.id).in("id", artifactIds);
  throwResult(artifactRows, "artifact verification");
  if ((artifactRows.data || []).length !== artifactIds.length) throw new Error("artifact_registration_mismatch");
  for (const artifact of artifactRows.data || []) {
    const folder = artifact.storage_path.split("/").slice(0, -1).join("/");
    const filename = artifact.storage_path.split("/").at(-1);
    const listed = await context.service.storage.from(artifact.storage_bucket).list(folder, { search: filename, limit: 1 });
    const object = listed.data?.find((item: any) => item.name === filename);
    if (listed.error || !object || Number(object.metadata?.size || 0) !== Number(artifact.size_bytes)) {
      throw new Error("artifact_upload_incomplete");
    }
  }
  const evaluations = Array.isArray(body.evaluations) ? body.evaluations.slice(0, 4) : [];
  if (evaluations.length < 2) throw new Error("evaluations_required");
  const evaluatorNames = new Set(evaluations.map((evaluation: any) => evaluation?.evaluator));
  if (!evaluatorNames.has("worker_machine") || !evaluatorNames.has("design_critic")) throw new Error("evaluations_required");
  for (const evaluation of evaluations) {
    const evaluator = ["worker_machine", "design_critic"].includes(evaluation.evaluator) ? evaluation.evaluator : null;
    const verdict = ["pass", "revise", "blocked"].includes(evaluation.verdict) ? evaluation.verdict : null;
    if (!evaluator || !verdict) throw new Error("evaluation_invalid");
    const result = await context.service.from("design_evaluations").insert({
      project_id: job.project_id, job_id: job.id, evaluator, attempt_number: job.attempt_number, verdict,
      scores: evaluation.scores && typeof evaluation.scores === "object" ? evaluation.scores : {},
      reasons: Array.isArray(evaluation.reasons) ? evaluation.reasons.slice(0, 20).map(String) : [],
    });
    throwResult(result, "evaluation insert");
  }
  if (evaluations.some((item: any) => item.verdict === "blocked")) {
    await transition(context.service, job, "failed", "evaluation_blocked", {});
    await context.service.from("design_projects").update({ status: "blocked" }).eq("id", job.project_id);
    return { jobId: job.id, status: "failed" };
  }
  await transition(context.service, job, "awaiting_creator_approval", "evaluation_completed", {});
  await context.service.from("design_projects").update({ status: "awaiting_creator_approval" }).eq("id", job.project_id);
  return { jobId: job.id, status: "awaiting_creator_approval" };
}

async function failJob(context: Context, body: any) {
  const job = await requireLease(context, body, ["leased", "running", "evaluating", "cancel_requested"]);
  const canceled = job.status === "cancel_requested";
  const retryable = !canceled && body.retryable === true && job.attempt_number < job.max_attempts;
  const next = canceled ? "canceled" : retryable ? "queued" : "failed";
  const result = await context.service.from("creator_jobs").update({
    status: next,
    lease_token_digest: null,
    lease_expires_at: null,
    lease_heartbeat_at: null,
    error_code: boundedText(body.errorCode || "worker_failed", "errorCode", 120),
    error_detail: String(body.errorDetail || "").slice(0, 2000),
    completed_at: retryable ? null : new Date().toISOString(),
  }).eq("id", job.id);
  throwResult(result, "job failure");
  await addEvent(context.service, job, canceled ? "worker_canceled" : retryable ? "worker_retry_scheduled" : "worker_failed", job.status, next, {});
  if (!retryable) await context.service.from("design_projects").update({ status: canceled ? "canceled" : "failed" }).eq("id", job.project_id);
  return { jobId: job.id, status: next };
}

async function approveJob({ user, service }: Context, body: any) {
  const jobId = requireUuid(body.jobId, "jobId");
  const decision = ["approved", "revision_requested", "rejected"].includes(body.decision) ? body.decision : null;
  if (!decision) throw new Error("decision_invalid");
  const found = await service.from("creator_jobs").select("*").eq("id", jobId).eq("creator_id", user.id).eq("status", "awaiting_creator_approval").maybeSingle();
  throwResult(found, "approval job");
  const job = found.data;
  if (!job) throw new Error("forbidden");
  const approval = await service.from("design_approvals").insert({
    project_id: job.project_id, job_id: job.id, creator_id: user.id, decision, attempt_number: job.attempt_number,
    note: String(body.note || "").slice(0, 2000),
  });
  throwResult(approval, "approval insert");
  if (decision === "approved") {
    const now = new Date().toISOString();
    await service.from("design_artifacts").update({ approved_at: now }).eq("job_id", job.id).eq("version", job.attempt_number);
    await transition(service, job, "delivered", "creator_approved", {});
    await service.from("design_projects").update({ status: "delivered", delivered_at: now }).eq("id", job.project_id);
    return { jobId, status: "delivered" };
  }
  if (decision === "revision_requested") {
    if (job.attempt_number >= job.max_attempts) throw new Error("revision_limit_reached");
    await transition(service, job, "queued", "creator_revision_requested", { note: String(body.note || "").slice(0, 500) });
    await service.from("design_projects").update({ status: "queued" }).eq("id", job.project_id);
    return { jobId, status: "queued" };
  }
  await transition(service, job, "failed", "creator_rejected", {});
  await service.from("design_projects").update({ status: "failed" }).eq("id", job.project_id);
  return { jobId, status: "failed" };
}

async function createProject({ user, service }: Context, body: any) {
  const agentId = requireUuid(body.agentId, "agentId");
  const idempotencyKey = boundedText(body.idempotencyKey, "idempotencyKey", 120);
  const [agent, binding, access] = await Promise.all([
    service.from("agents").select("id, slug, creator_id, current_version, status").eq("id", agentId).eq("status", "published").maybeSingle(),
    service.from("agent_worker_bindings").select("*").eq("agent_id", agentId).eq("status", "active").maybeSingle(),
    service.from("agent_access").select("status").eq("agent_id", agentId).eq("user_id", user.id).eq("status", "active").maybeSingle(),
  ]);
  throwResult(agent, "agent lookup"); throwResult(binding, "worker binding"); throwResult(access, "agent access");
  if (!agent.data || !binding.data || (!access.data && agent.data.creator_id !== user.id)) throw new Error("forbidden");
  const version = await service.from("agent_versions").select("id, package_digest, display_version")
    .eq("agent_id", agentId).eq("version_number", agent.data.current_version).maybeSingle();
  throwResult(version, "agent version lookup");
  if (!version.data || version.data.package_digest !== binding.data.harness_digest) throw new Error("agent_revision_unavailable");
  const manifests = Array.isArray(body.assets) ? body.assets.slice(0, 12) : [];
  if (!manifests.length) throw new Error("at_least_one_asset_required");
  const brief = normalizeBrief(body.brief);
  const projectId = crypto.randomUUID();
  const project = await service.from("design_projects").insert({
    id: projectId, client_id: user.id, creator_id: agent.data.creator_id, agent_id: agentId, agent_version_id: version.data.id,
    status: "draft", brief,
  }).select().single();
  throwResult(project, "project insert");
  const job = await service.from("creator_jobs").insert({
    project_id: projectId, client_id: user.id, creator_id: agent.data.creator_id, agent_id: agentId, agent_version_id: version.data.id,
    worker_id: binding.data.worker_id, status: "awaiting_assets",
    harness_revision: binding.data.harness_revision, harness_digest: binding.data.harness_digest,
    envelope: { schema: "hireme.creator_job.envelope.v1", agentId: agent.data.slug, agentSlug: agent.data.slug, localAgentId: binding.data.local_agent_id, brief, capabilities: ["asset.inspect", "brand.validate", "image.generate", "image.edit", "layout.compose", "file.export"] },
    idempotency_key: idempotencyKey,
  }).select().single();
  if (job.error) {
    await service.from("design_projects").delete().eq("id", projectId);
    throwResult(job, "job insert");
  }
  const uploads = [];
  for (const raw of manifests) {
    const manifest = normalizeInputManifest(raw);
    const assetId = crypto.randomUUID();
    const path = `${user.id}/${projectId}/${assetId}/${safeFilename(manifest.filename)}`;
    const inserted = await service.from("design_project_assets").insert({
      id: assetId, project_id: projectId, owner_id: user.id, direction: "input", kind: manifest.kind,
      storage_bucket: inputBucket, storage_path: path, filename: manifest.filename,
      mime_type: manifest.mimeType, size_bytes: manifest.sizeBytes, content_digest: manifest.contentDigest,
    });
    throwResult(inserted, "asset registration");
    const signed = await service.storage.from(inputBucket).createSignedUploadUrl(path);
    if (signed.error || !signed.data) throw new Error("asset_upload_url_failed");
    uploads.push({ assetId, path, token: signed.data.token, signedUrl: signed.data.signedUrl });
  }
  return { project: project.data, job: job.data, uploads };
}

async function finalizeProject({ user, service }: Context, body: any) {
  const projectId = requireUuid(body.projectId, "projectId");
  const project = await service.from("design_projects").select("*").eq("id", projectId).eq("client_id", user.id).eq("status", "draft").maybeSingle();
  throwResult(project, "project finalize");
  if (!project.data) throw new Error("forbidden");
  const assets = await service.from("design_project_assets").select("storage_path, size_bytes").eq("project_id", projectId).eq("direction", "input");
  throwResult(assets, "asset finalize");
  if (!(assets.data || []).length) throw new Error("assets_missing");
  for (const asset of assets.data || []) {
    const folder = asset.storage_path.split("/").slice(0, -1).join("/");
    const filename = asset.storage_path.split("/").at(-1);
    const listed = await service.storage.from(inputBucket).list(folder, { search: filename, limit: 1 });
    if (listed.error || !listed.data?.some((item) => item.name === filename)) throw new Error("asset_upload_incomplete");
  }
  await service.from("design_projects").update({ status: "queued" }).eq("id", projectId);
  const job = await service.from("creator_jobs").update({ status: "queued" }).eq("project_id", projectId).eq("status", "awaiting_assets").select().single();
  throwResult(job, "job enqueue");
  await addEvent(service, job.data, "client_enqueued", "awaiting_assets", "queued", {}, user.id);
  return { projectId, jobId: job.data.id, status: "queued" };
}

async function cancelProject({ user, service }: Context, body: any) {
  const projectId = requireUuid(body.projectId, "projectId");
  const found = await service.from("creator_jobs").select("*").eq("project_id", projectId).eq("client_id", user.id).maybeSingle();
  throwResult(found, "cancel job");
  const job = found.data;
  if (!job) throw new Error("forbidden");
  if (["delivered", "failed", "canceled", "expired"].includes(job.status)) return { projectId, status: job.status };
  if (["awaiting_assets", "queued", "awaiting_creator_approval", "revision_requested"].includes(job.status)) {
    await transition(service, job, "canceled", "client_canceled", {}, user.id);
    await service.from("design_projects").update({ status: "canceled" }).eq("id", projectId);
    return { projectId, status: "canceled" };
  }
  await service.from("creator_jobs").update({ status: "cancel_requested", cancel_requested_at: new Date().toISOString() }).eq("id", job.id);
  await addEvent(service, job, "client_cancel_requested", job.status, "cancel_requested", {}, user.id);
  return { projectId, status: "cancel_requested" };
}

async function requireLease(context: Context, body: any, statuses: string[]) {
  const jobId = requireUuid(body.jobId, "jobId");
  const workerId = requireUuid(body.workerId, "workerId");
  const digest = await sha256(new TextEncoder().encode(boundedText(body.leaseToken, "leaseToken", 256)));
  const found = await context.service.from("creator_jobs").select("*").eq("id", jobId).eq("worker_id", workerId).eq("creator_id", context.user.id).in("status", statuses).maybeSingle();
  throwResult(found, "lease lookup");
  if (!found.data || found.data.lease_token_digest !== digest || Date.parse(found.data.lease_expires_at || "") <= Date.now()) throw new Error("lease_invalid");
  return found.data;
}

async function transition(service: SupabaseClient, job: any, to: string, event: string, payload: Record<string, unknown>, actorId?: string) {
  const update: Record<string, unknown> = { status: to };
  if (["delivered", "failed", "canceled", "expired", "approval_expired"].includes(to)) update.completed_at = new Date().toISOString();
  if (to === "running" && !job.started_at) update.started_at = new Date().toISOString();
  if (!["leased", "running", "evaluating"].includes(to)) {
    update.lease_token_digest = null; update.lease_expires_at = null; update.lease_heartbeat_at = null;
  }
  const result = await service.from("creator_jobs").update(update).eq("id", job.id).eq("status", job.status);
  throwResult(result, "job transition");
  await addEvent(service, job, event, job.status, to, payload, actorId);
}

async function addEvent(service: SupabaseClient, job: any, event: string, from: string, to: string, payload: Record<string, unknown>, actorId?: string) {
  const result = await service.from("creator_job_events").insert({ job_id: job.id, actor_id: actorId || job.creator_id || job.client_id, event_type: event, from_status: from, to_status: to, payload });
  throwResult(result, "job event");
}

function normalizeBrief(value: any) {
  if (!value || typeof value !== "object") throw new Error("brief_invalid");
  return {
    objective: boundedText(value.objective, "brief.objective", 1200),
    audience: boundedText(value.audience || "확인 필요", "brief.audience", 500),
    channel: boundedText(value.channel || "instagram_feed", "brief.channel", 120),
    goal: boundedText(value.goal || "구매 전환", "brief.goal", 240),
    deliverables: Array.isArray(value.deliverables) && value.deliverables.length ? value.deliverables.slice(0, 12) : [{ kind: "social_image", format: "png", dimensions: "1080x1350", count: 3 }],
    mustInclude: Array.isArray(value.mustInclude) ? value.mustInclude.slice(0, 30).map(String) : [],
    mustAvoid: Array.isArray(value.mustAvoid) ? value.mustAvoid.slice(0, 30).map(String) : [],
  };
}

function normalizeInputManifest(value: any) {
  const mimeType = boundedText(value?.mimeType, "mimeType", 160).toLowerCase();
  if (!allowedInputMime.has(mimeType)) throw new Error("asset_mime_not_allowed");
  const sizeBytes = Number(value?.sizeBytes);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 52_428_800) throw new Error("asset_size_invalid");
  return { kind: boundedText(value.kind || "reference", "asset.kind", 80), filename: boundedText(value.filename, "filename", 240), mimeType, sizeBytes, contentDigest: requireDigest(value.contentDigest, "contentDigest") };
}

function normalizeArtifactManifest(value: any, job: any) {
  const mimeType = boundedText(value?.mimeType, "mimeType", 160).toLowerCase();
  if (!allowedOutputMime.has(mimeType)) throw new Error("artifact_mime_not_allowed");
  const kind = ["preview", "source", "export", "rationale", "evaluation_report"].includes(value.kind) ? value.kind : null;
  const sizeBytes = Number(value.sizeBytes);
  if (!kind || !Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 52_428_800) throw new Error("artifact_manifest_invalid");
  return {
    schema: "hireme.creator_worker.artifact_manifest.v1", jobId: job.id, projectId: job.project_id,
    workerId: job.worker_id, harnessDigest: job.harness_digest, attemptNumber: job.attempt_number,
    kind, version: Math.max(1, Math.min(1000, Number(value.version || 1))),
    filename: boundedText(value.filename, "filename", 240), mimeType, sizeBytes,
    contentDigest: requireDigest(value.contentDigest, "contentDigest"),
    provenance: value.provenance && typeof value.provenance === "object" ? value.provenance : {},
  };
}

async function verifySignature(publicKeyBase64: string, payload: unknown, signatureBase64: unknown) {
  try {
    const key = await crypto.subtle.importKey("spki", bytesFromBase64(publicKeyBase64), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", key, bytesFromBase64(signatureBase64), new TextEncoder().encode(stableStringify(payload)));
  } catch {
    return false;
  }
}

async function sha256(bytes: Uint8Array) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return `sha256:${[...digest].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function safeFilename(value: string) {
  return value.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160) || "artifact";
}

function bytesFromLargeBase64(value: unknown) {
  const encoded = String(value || "").trim();
  if (!encoded || encoded.length > 140_000_000) throw new Error("backup_base64_invalid");
  try { return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0)); }
  catch { throw new Error("backup_base64_invalid"); }
}

async function signArtifacts(service: SupabaseClient, artifacts: any[]) {
  return Promise.all(artifacts.map(async (artifact: any) => {
    const signed = await service.storage.from(artifact.storage_bucket).createSignedUrl(artifact.storage_path, 900);
    return { ...artifact, downloadUrl: signed.data?.signedUrl || null };
  }));
}

function normalizeCategory(value: unknown) {
  const category = String(value || "design").trim().toLowerCase();
  const aliases: Record<string, string> = { "디자인": "design", "이미지": "image", "글쓰기": "writing", "비즈니스": "business", "리서치": "research", "생산성": "productivity" };
  const normalized = aliases[category] || category;
  return ["design", "image", "writing", "business", "research", "productivity", "other"].includes(normalized) ? normalized : "other";
}

function throwResult(result: { error?: { message?: string } | null }, label: string) {
  if (result.error) throw new Error(`${label}: ${result.error.message || "failed"}`);
}
