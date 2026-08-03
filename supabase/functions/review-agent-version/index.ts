import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (request) => {
  try {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "Authentication is required." }, 401);
    const url = requiredEnv("SUPABASE_URL");
    const anonKey = requiredEnv("SUPABASE_ANON_KEY");
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const identity = await userClient.auth.getUser();
    const user = identity.data.user;
    if (identity.error || !user) return json({ error: "Authentication is required." }, 401);

    const reviewer = await userClient.from("platform_reviewers")
      .select("role, active").eq("user_id", user.id).maybeSingle();
    if (reviewer.error || !reviewer.data?.active) return json({ error: "Reviewer access is required." }, 403);

    const input = await request.json();
    const versionId = requireUuid(input?.versionId, "versionId");
    const decision = String(input?.decision || "").trim().toLowerCase();
    if (decision !== "approved" && decision !== "rejected") {
      return json({ error: "decision must be approved or rejected." }, 400);
    }
    const note = String(input?.note || "").trim().slice(0, 2000);
    const admin = createClient(url, requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const reviewed = await admin.rpc("review_agent_version", {
      target_version_id: versionId,
      decision,
      note,
    });
    if (reviewed.error) throw reviewed.error;
    return json({ status: decision, versionId, result: reviewed.data });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Agent review failed." }, 400);
  }
});

function requiredEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing ${key}.`);
  return value;
}
function requireUuid(value: unknown, name: string) {
  const id = String(value || "").trim().toLowerCase();
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)) {
    throw new Error(`${name} is invalid.`);
  }
  return id;
}
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}
