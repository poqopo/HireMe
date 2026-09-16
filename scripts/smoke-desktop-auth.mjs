#!/usr/bin/env node

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  createDesktopAuthService,
  createEncryptedAuthStorage,
  readDesktopPublicConfig,
} from "../apps/desktop/auth.mjs";

const tempRoot = resolve(".hireme/tmp/desktop-auth-smoke");
await rm(tempRoot, { recursive: true, force: true });

try {
  const safeStorage = {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(`encrypted:${Buffer.from(value).toString("base64")}`),
    decryptString: (value) => Buffer.from(
      value.toString("utf8").replace(/^encrypted:/, ""),
      "base64",
    ).toString("utf8"),
  };
  const storage = createEncryptedAuthStorage({ root: tempRoot, safeStorage });
  const secretMarker = "AUTH_TOKEN_MUST_NOT_APPEAR_IN_PLAINTEXT";
  await storage.setItem("supabase.auth.token", secretMarker);
  assert.equal(await storage.getItem("supabase.auth.token"), secretMarker);
  const storedFiles = await readdir(tempRoot);
  assert.equal(storedFiles.length, 1);
  const rawStored = await readFile(resolve(tempRoot, storedFiles[0]), "utf8");
  assert.ok(!rawStored.includes(secretMarker));
  await storage.removeItem("supabase.auth.token");
  assert.equal(await storage.getItem("supabase.auth.token"), null);

  const unconfigured = createDesktopAuthService({
    userDataDir: tempRoot,
    redirectUrl: "hireme://auth/callback",
  });
  assert.equal((await unconfigured.initialize()).status, "unconfigured");
  assert.equal(unconfigured.getUserId(), null);

  const publicConfig = await readDesktopPublicConfig(
    resolve("apps/desktop/public-config.json"),
    {},
  );
  assert.equal(publicConfig.configured, true);
  assert.equal(publicConfig.projectRef, "yknrtsvdgwwsnjmjidrd");

  const env = await readEnv(resolve(".env"));
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  assert.ok(supabaseUrl && anonKey && serviceRoleKey, "Supabase smoke credentials are required.");

  const settingsResponse = await fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: { apikey: anonKey },
  });
  assert.equal(settingsResponse.ok, true);
  const settings = await settingsResponse.json();
  assert.equal(settings.external?.google, true);
  assert.equal(settings.disable_signup, false);

  const oauthClient = createClient(supabaseUrl, anonKey, {
    auth: {
      flowType: "pkce",
      persistSession: false,
      storage: memoryStorage(),
    },
  });
  const oauth = await oauthClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: "hireme://auth/callback",
      skipBrowserRedirect: true,
    },
  });
  assert.equal(oauth.error, null);
  const oauthUrl = new URL(oauth.data.url);
  assert.equal(oauthUrl.searchParams.get("provider"), "google");
  assert.equal(oauthUrl.searchParams.get("redirect_to"), "hireme://auth/callback");
  assert.ok(oauthUrl.searchParams.get("code_challenge"));
  const authorizeResponse = await fetch(oauthUrl, { redirect: "manual" });
  assert.ok([301, 302, 303, 307, 308].includes(authorizeResponse.status));
  const googleLocation = new URL(authorizeResponse.headers.get("location"));
  assert.equal(googleLocation.hostname, "accounts.google.com");

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `hireme-auth-smoke-${randomUUID()}@example.com`;
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: "HireMe Auth Smoke" },
  });
  if (created.error) throw created.error;
  const userId = created.data.user.id;

  try {
    const profile = await admin
      .from("profiles")
      .select("id, display_name, default_provider, ai_setup_completed")
      .eq("id", userId)
      .single();
    if (profile.error) throw profile.error;
    assert.equal(profile.data.id, userId);
    assert.equal(profile.data.display_name, "HireMe Auth Smoke");
    assert.equal(profile.data.default_provider, "codex");
    assert.equal(profile.data.ai_setup_completed, false);

    const untrustedRun = await oauthClient.from("runs").insert({
      user_id: userId,
      provider: "codex",
    });
    assert.ok(untrustedRun.error, "Unauthenticated clients must not create billing runs.");
  } finally {
    const removed = await admin.auth.admin.deleteUser(userId);
    if (removed.error) throw removed.error;
  }

  const removedProfile = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (removedProfile.error) throw removedProfile.error;
  assert.equal(removedProfile.data, null);

  const migration = await readFile(
    resolve("supabase/migrations/202607110001_hireme_core.sql"),
    "utf8",
  );
  const tables = [...migration.matchAll(/create table public\.([a-z_]+)/g)].map((match) => match[1]);
  assert.deepEqual(tables, [
    "profiles",
    "agents",
    "agent_versions",
    "agent_access",
    "conversations",
    "messages",
    "runs",
  ]);
  assert.match(migration, /create policy profiles_update_self/);
  assert.match(migration, /create policy conversations_manage_self/);
  assert.match(migration, /create policy runs_read_participant/);
  const aiSetupMigration = await readFile(
    resolve("supabase/migrations/202607120001_ai_setup.sql"),
    "utf8",
  );
  assert.match(aiSetupMigration, /add column ai_setup_completed boolean not null default false/);
  assert.match(aiSetupMigration, /grant update \(ai_setup_completed\)/);

  console.log("Desktop auth smoke passed");
  console.log("Verified: encrypted session storage -> Google PKCE URL -> HireMe UUID/profile -> first AI setup flag -> RLS -> auth cleanup -> seven-table schema");
} finally {
  await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
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

function memoryStorage() {
  const values = new Map();
  return {
    getItem: async (key) => values.get(key) || null,
    setItem: async (key, value) => values.set(key, value),
    removeItem: async (key) => values.delete(key),
  };
}
