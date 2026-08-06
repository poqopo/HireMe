#!/usr/bin/env node

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createDesktopDataService } from "../apps/desktop/data.mjs";

const env = await readEnv(resolve(".env"));
const supabaseUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(supabaseUrl && anonKey && serviceRoleKey, "Desktop data smoke credentials are required.");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const email = `hireme-data-smoke-${randomUUID()}@example.com`;
const created = await admin.auth.admin.createUser({
  email,
  email_confirm: true,
  user_metadata: { full_name: "HireMe Data Smoke" },
});
if (created.error) throw created.error;
const user = { id: created.data.user.id, displayName: "HireMe Data Smoke" };

try {
  const generated = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (generated.error) throw generated.error;
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signedIn = await client.auth.verifyOtp({
    type: "magiclink",
    token_hash: generated.data.properties.hashed_token,
  });
  if (signedIn.error) throw signedIn.error;

  const slug = `data-smoke-${randomUUID().slice(0, 12)}`;
  const insertedAgent = await client
    .from("agents")
    .insert({
      creator_id: user.id,
      slug,
      name: "Desktop Data Smoke Agent",
      category: "writing",
      status: "draft",
      visibility: "private",
      headline: "RLS persistence test Agent",
      public_summary: "Created temporarily for the desktop data smoke.",
      public_skills: ["Persistence"],
      result_types: ["text"],
      pricing: { mode: "free" },
    })
    .select("id")
    .single();
  if (insertedAgent.error) throw insertedAgent.error;
  const agentDatabaseId = insertedAgent.data.id;
  const dokpami = await client
    .from("agents")
    .select("id, creator_id")
    .eq("slug", "dokpami-create-agent")
    .single();
  if (dokpami.error) throw dokpami.error;

  const service = createDesktopDataService({
    getClient: () => client,
    getUser: () => user,
  });
  const initial = await service.loadWorkspace({ localAgentIds: [slug] });
  const loadedAgent = initial.agents.find((agent) => agent.id === slug);
  assert.equal(loadedAgent?.databaseId, agentDatabaseId);
  assert.equal(loadedAgent?.ownership, "mine");
  assert.equal(loadedAgent?.runtime, "local");
  const ownedManagementTarget = await service.assertAgentOwnership({
    agentId: slug,
    databaseId: agentDatabaseId,
  });
  assert.equal(ownedManagementTarget.owned, true);
  await assert.rejects(
    service.assertAgentOwnership({
      agentId: "dokpami-create-agent",
      databaseId: dokpami.data.id,
    }),
    (error) => error?.code === "agent_management_forbidden",
  );

  const conversationId = randomUUID();
  const createdConversation = await service.createConversation({
    id: conversationId,
    agentDatabaseId,
    title: "DB persistence smoke",
    provider: "codex",
  });
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
  const userMessageId = randomUUID();
  await service.saveMessage({
    id: userMessageId,
    conversationId,
    role: "user",
    text: "Persist this message.",
    at: new Date().toISOString(),
    status: "sent",
    attachments: [{
      name: "private-reference.png",
      path: "/Users/example/private-reference.png",
      previewUrl: "hireme-media://private-reference",
      mimeType: "image/png",
      size: 1234,
    }],
  });
  await service.saveMessage({
    id: randomUUID(),
    conversationId,
    role: "assistant",
    text: "The message was persisted.",
    at: new Date().toISOString(),
    elapsedMs: 321,
  });
  const activity = await client
    .from("conversations")
    .select("updated_at")
    .eq("id", conversationId)
    .single();
  if (activity.error) throw activity.error;
  assert.ok(Date.parse(activity.data.updated_at) > Date.parse(createdConversation.updated_at));
  await service.updateConversation({
    id: conversationId,
    title: "Updated DB persistence smoke",
    archived: true,
  });

  const loaded = await service.loadWorkspace({ localAgentIds: [slug] });
  const conversation = loaded.conversations.find((item) => item.id === conversationId);
  assert.equal(conversation?.title, "Updated DB persistence smoke");
  assert.equal(conversation?.archived, true);
  assert.equal(conversation?.messages.length, 2);
  assert.equal(conversation?.messages[0].attachments?.[0].name, "private-reference.png");
  assert.equal("path" in conversation.messages[0].attachments[0], false);
  assert.equal("previewUrl" in conversation.messages[0].attachments[0], false);
  const deleted = await service.deleteConversation({ id: conversationId });
  assert.equal(deleted.deleted, true);
  const deletedConversation = await client.from("conversations").select("id").eq("id", conversationId).maybeSingle();
  if (deletedConversation.error) throw deletedConversation.error;
  assert.equal(deletedConversation.data, null);
  const deletedMessages = await client.from("messages").select("id").eq("conversation_id", conversationId);
  if (deletedMessages.error) throw deletedMessages.error;
  assert.equal(deletedMessages.data.length, 0);

  await assert.rejects(
    service.createConversation({
      id: randomUUID(),
      agentDatabaseId: dokpami.data.id,
      title: "Unauthorized Agent conversation",
    }),
    /활성 권한/,
  );
  const spoofed = await client.from("conversations").insert({
    owner_id: dokpami.data.creator_id,
    title: "Spoofed owner",
  });
  assert.ok(spoofed.error, "RLS must reject an owner_id supplied for another user.");

  console.log("Desktop data smoke passed");
  console.log("Verified: DB Agent load -> ordered messages -> archive -> delete cascade -> local path stripping -> entitlement/RLS denial");
} finally {
  const removed = await admin.auth.admin.deleteUser(user.id);
  if (removed.error) throw removed.error;
}

async function readEnv(path) {
  const text = await readFile(path, "utf8");
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    values[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return values;
}
