#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const command = process.argv[2] || "";
const subcommand = process.argv[3] || "";
const codexHome = process.env.CODEX_HOME;
if (!codexHome) throw new Error("CODEX_HOME is required.");
const authPath = join(codexHome, "auth.json");

if (command === "login" && subcommand === "status") {
  const auth = await readFile(authPath, "utf8").catch(() => "");
  if (!auth) {
    process.stderr.write("Not logged in\n");
    process.exit(1);
  }
  process.stdout.write("Logged in using ChatGPT\n");
  process.exit(0);
}

if (command === "login") {
  const delayMs = Number(process.env.HIREME_FIXTURE_LOGIN_DELAY_MS || 0);
  if (delayMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const access = jwt({
    exp: expires,
    email: "fixture@example.com",
    "https://api.openai.com/auth": { account_id: "account-fixture" },
  });
  const id = jwt({ exp: expires, email: "fixture@example.com", sub: "user-fixture" });
  await mkdir(codexHome, { recursive: true });
  await writeFile(authPath, `${JSON.stringify({
    auth_mode: "chatgpt",
    OPENAI_API_KEY: null,
    tokens: {
      access_token: access,
      refresh_token: "fixture-refresh-token",
      id_token: id,
      account_id: "account-fixture",
    },
    last_refresh: new Date().toISOString(),
  }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  process.stdout.write("Login successful\n");
  process.exit(0);
}

if (command === "logout") {
  await rm(authPath, { force: true });
  process.stdout.write("Logged out\n");
  process.exit(0);
}

process.stderr.write(`Unsupported fixture command: ${command} ${subcommand}\n`);
process.exit(2);

function jwt(payload) {
  return [
    encode({ alg: "none", typ: "JWT" }),
    encode(payload),
    "fixture",
  ].join(".");
}

function encode(value) {
  return Buffer.from(JSON.stringify(value))
    .toString("base64url");
}
