#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(".");
const migrations = await readdir(resolve(root, "migrations"));
assert.ok(migrations.includes("202608060001_creator_worker_control_plane.sql"));

const controlPlane = await readFile(resolve(root, "migrations/202608060001_creator_worker_control_plane.sql"), "utf8");
for (const contract of ["creator_workers", "design_projects", "creator_jobs", "design_artifacts", "claim_creator_job"]) {
  assert.match(controlPlane, new RegExp(`\\b${contract}\\b`));
}

const worker = await readFile(resolve(root, "functions/creator-worker/index.ts"), "utf8");
for (const action of ["create-project", "finalize-project", "claim", "complete", "approve"]) {
  assert.ok(worker.includes(`case "${action}"`));
}

console.log(`Supabase control-plane smoke test passed (${migrations.length} migrations).`);
