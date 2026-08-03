#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const input = await readStdin();
const request = JSON.parse(input);
if (request.schema !== "hireme.codex_image_gen.request.v1") {
  throw new Error("Unexpected codex image_gen request schema.");
}
if (!request.prompt || !request.outputPath) {
  throw new Error("prompt and outputPath are required.");
}

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);
await mkdir(dirname(request.outputPath), { recursive: true });
await writeFile(request.outputPath, png);
process.stdout.write(
  `${JSON.stringify({
    status: "completed",
    provider: "codex_image_gen_fixture",
    path: request.outputPath,
    mimeType: "image/png",
  })}\n`,
);

function readStdin() {
  return new Promise((resolveRead, rejectRead) => {
    let text = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      text += chunk;
    });
    process.stdin.on("end", () => resolveRead(text));
    process.stdin.on("error", rejectRead);
  });
}
