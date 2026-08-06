import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/http.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const expected = Deno.env.get("CREATOR_WORKER_CRON_SECRET") || "";
  if (!expected || request.headers.get("x-cron-secret") !== expected) return json({ error: "forbidden" }, 403);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) return json({ error: "server_not_configured" }, 500);
  const service = createClient(url, key);
  const now = new Date();
  const nowIso = now.toISOString();
  const queueCutoff = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();
  const approvalCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  const expiredLeases = await service.from("creator_jobs").select("id, project_id, attempt_number, max_attempts")
    .in("status", ["leased", "running", "evaluating", "cancel_requested"]).lt("lease_expires_at", nowIso);
  if (expiredLeases.error) return json({ error: expiredLeases.error.message }, 500);
  let requeued = 0;
  let failed = 0;
  for (const job of expiredLeases.data || []) {
    const current = await service.from("creator_jobs").select("status").eq("id", job.id).single();
    const next = current.data?.status === "cancel_requested"
      ? "canceled"
      : job.attempt_number < job.max_attempts ? "queued" : "failed";
    const update = await service.from("creator_jobs").update({
      status: next,
      lease_token_digest: null,
      lease_expires_at: null,
      lease_heartbeat_at: null,
      error_code: "lease_expired",
      completed_at: ["failed", "canceled"].includes(next) ? nowIso : null,
    }).eq("id", job.id).in("status", ["leased", "running", "evaluating", "cancel_requested"]);
    if (update.error) return json({ error: update.error.message }, 500);
    if (next === "queued") requeued += 1;
    else if (next === "canceled") {
      await service.from("design_projects").update({ status: "canceled" }).eq("id", job.project_id);
    }
    else {
      failed += 1;
      await service.from("design_projects").update({ status: "failed" }).eq("id", job.project_id);
    }
  }

  const staleQueued = await service.from("creator_jobs").select("id, project_id").in("status", ["awaiting_assets", "queued"]).lt("queued_at", queueCutoff);
  if (staleQueued.error) return json({ error: staleQueued.error.message }, 500);
  for (const job of staleQueued.data || []) {
    await service.from("creator_jobs").update({ status: "expired", completed_at: nowIso, error_code: "queue_expired" }).eq("id", job.id);
    await service.from("design_projects").update({ status: "expired" }).eq("id", job.project_id);
  }

  const staleApprovals = await service.from("creator_jobs").select("id, project_id").eq("status", "awaiting_creator_approval").lt("updated_at", approvalCutoff);
  if (staleApprovals.error) return json({ error: staleApprovals.error.message }, 500);
  for (const job of staleApprovals.data || []) {
    await service.from("creator_jobs").update({ status: "approval_expired", completed_at: nowIso, error_code: "approval_expired" }).eq("id", job.id);
    await service.from("design_projects").update({ status: "approval_expired" }).eq("id", job.project_id);
  }

  const expiredProjects = await service.from("design_projects").select("id").lt("retention_until", nowIso);
  if (expiredProjects.error) return json({ error: expiredProjects.error.message }, 500);
  let deletedInputs = 0;
  for (const project of expiredProjects.data || []) {
    const assets = await service.from("design_project_assets").select("id, storage_bucket, storage_path")
      .eq("project_id", project.id).eq("direction", "input").is("deleted_at", null);
    if (assets.error) return json({ error: assets.error.message }, 500);
    for (const asset of assets.data || []) {
      const removed = await service.storage.from(asset.storage_bucket).remove([asset.storage_path]);
      if (removed.error) continue;
      await service.from("design_project_assets").update({ deleted_at: nowIso }).eq("id", asset.id);
      deletedInputs += 1;
    }
  }

  return json({
    schema: "hireme.creator_worker.maintenance.v1",
    requeued,
    failed,
    expiredQueued: staleQueued.data?.length || 0,
    expiredApprovals: staleApprovals.data?.length || 0,
    deletedInputs,
  });
});
