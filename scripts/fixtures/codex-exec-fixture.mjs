#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const args = process.argv.slice(2);
if (args[0] !== "exec") throw new Error("Expected codex exec.");
if (!args.includes("--skip-git-repo-check")) {
  throw new Error("Codex provider must allow non-Git workspaces.");
}
const outputFlagIndex = args.indexOf("--output-last-message");
const outputPath = args[outputFlagIndex + 1];
if (outputFlagIndex < 0 || !outputPath) {
  throw new Error("Missing --output-last-message path.");
}

await readStdin();
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, "codex-provider-fixture-ok\n", "utf8");

function readStdin() {
  return new Promise((resolveRead, rejectRead) => {
    process.stdin.resume();
    process.stdin.on("end", resolveRead);
    process.stdin.on("error", rejectRead);
  });
}
