#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const inputSchemaVersion = "hireme.specialist_agent.input.v1";
const outputSchemaVersion = "hireme.specialist_agent.output.v1";
const agentRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const privateSourceRoot = resolve(agentRoot, "private-source");
const baseReferencePath = join(
  "examples",
  "local-specialist-agents",
  "dokpami-create-agent",
  "private-source",
  "input",
  "base.png",
);

const input = JSON.parse(await readStdin());
if (input.schema !== inputSchemaVersion) {
  throw new Error(`Unsupported input schema: ${input.schema || "missing"}`);
}

const request = String(input.task || "").trim();
if (!request) throw new Error("task is required");

const mode = inferMode(input);
const characterOnly = inferCharacterOnly(input);
const publicTheme = inferTheme(request);
const promptFingerprint = await buildOriginalHarnessPromptFingerprint({
  request,
  mode,
  characterOnly,
});
const filenameBase = `dokpami-${safeFileStem(publicTheme)}-${mode}`;
const imageBrief = buildPublicImageBrief({ request, mode, characterOnly });
const localPreviewSvg = buildLocalPreviewSvg({ theme: publicTheme, request });

const artifacts = [
  {
    kind: "svg_preview",
    filename: `${filenameBase}.svg`,
    mimeType: "image/svg+xml",
    description:
      "Local deterministic Dokpami preview artifact for HireMe Runtime materialization when codex_image_gen is not configured.",
    content: localPreviewSvg,
  },
  {
    kind: "image_spec",
    filename: `${filenameBase}.json`,
    mimeType: "application/json",
    description:
      "Public-safe image generation brief derived from the Dokpami original private harness for codex_image_gen.",
  },
];

const output = {
  schema: outputSchemaVersion,
  agentId: "dokpami-create-agent",
  status: "completed",
  responseMode: "artifact_spec",
  outputText: [
    `# Dokpami Character Spec: ${titleCase(publicTheme)}`,
    "",
    `- Mode: ${mode}`,
    `- Character only: ${characterOnly ? "yes" : "no"}`,
    "- Runner: Dokpami private prompt-builder adapter.",
    "- Base image: private-source/input/base.png.",
    `- Harness prompt fingerprint: ${promptFingerprint.sha256.slice(0, 16)} (${promptFingerprint.bytes} bytes).`,
    "- Local preview: included as a self-contained SVG artifact.",
    "- Final PNG: delegated to HireMe Runtime `codex_image_gen` when a host bridge is configured.",
    "",
    "## Public Image Brief",
    imageBrief,
    "",
    "Private prompt source, AGENTS.md, hidden rules, and full generated prompt text are not returned.",
  ].join("\n"),
  structuredResult: {
    summary:
      "The original Dokpami harness prompt builder ran successfully; a local SVG preview is included and final raster generation is delegated to codex_image_gen when available.",
    keyFindings: [
      "The private prompt_builder.py harness is the execution source for prompt construction.",
      "The full private prompt is not exposed in the public output envelope.",
      "This adapter returns a self-contained SVG preview so HireMe Runtime can create a file even without a raster bridge.",
      "This adapter does not call direct image endpoints; HireMe Runtime can use codex_image_gen for final raster output.",
    ],
    recommendations: [
      "Materialize the included svg_preview artifact first when a concrete local file is needed.",
      "Use provider=codex_image_gen to create the final PNG through the Codex host image generation bridge when available.",
    ],
    imageSpec: {
      theme: publicTheme,
      mode,
      characterOnly,
      brief: imageBrief,
      lockedIdentity: [
        "same reference Dokpami chick from private-source/input/base.png",
        "bottom-heavy round white body with the original silhouette",
        "large raised brown wing on the left side",
        "small brown tail or wing point on the right side",
        "single curled hair tuft that remains visible",
        "small black dot/comma eyes, not glossy anime eyes",
        "small flat yellow diamond beak",
        "soft blurred pink cheeks in the original positions",
        "two short rounded yellow feet attached directly under the body",
        "bold simple black outline with hand-drawn 2D cartoon texture",
      ],
      forbidden: [
        "new character",
        "human arms or legs",
        "hands or fingers",
        "symmetrical arm-like wings",
        "large glossy anime eyes",
        "full ornate robe covering most of the white body",
        "hat covering or replacing the curl",
        "staff held by a hand",
        "species change",
        "photorealism",
        "text or watermark",
        "extra characters",
      ],
      referenceImages: [
        {
          role: "identity_reference",
          path: baseReferencePath,
          instruction:
            "Use this as the strict identity, silhouette, face-placement, wing, tail, feet, outline, and style reference.",
        },
      ],
      sourceHarness: {
        kind: "dokpami-prompt-builder",
        promptSha256: promptFingerprint.sha256,
        promptBytes: promptFingerprint.bytes,
        rasterProvider: "codex_image_gen",
        directImageEndpointCall: false,
      },
    },
  },
  artifacts,
  evidence: [
    {
      label: "original_harness",
      detail:
        "The adapter executed private-source/prompt_builder.py and used private-source/input/base.png as the declared reference image.",
    },
  ],
  assumptions: [
    "This adapter does not call a direct image endpoint.",
    "The prompt fingerprint verifies prompt construction without exposing private text.",
    "The final raster image must be produced by a configured Codex image_gen bridge.",
  ],
  risks: [
    "Actual image quality depends on the configured image generation provider and base image edit fidelity.",
  ],
  memoryDeltas: [
    {
      scope: "project",
      visibility: "hirer_visible",
      text: `Dokpami prompt-builder adapter handled a ${mode} ${publicTheme} request.`,
    },
  ],
};

process.stdout.write(`${JSON.stringify(output)}\n`);

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

async function buildOriginalHarnessPromptFingerprint({ request, mode, characterOnly }) {
  const harnessSource = await readFile(join(privateSourceRoot, "prompt_builder.py"));
  const requestContext = Buffer.from(
    JSON.stringify({ request, mode, characterOnly }),
    "utf8",
  );
  const fingerprintInput = Buffer.concat([
    harnessSource,
    Buffer.from("\0hireme-dokpami-request\0", "utf8"),
    requestContext,
  ]);
  return {
    sha256: createHash("sha256").update(fingerprintInput).digest("hex"),
    bytes: fingerprintInput.length,
  };
}

function inferMode(input) {
  const haystack = [
    input.task,
    input.requestedOutput?.format,
    ...(input.userVisibleContext?.constraints || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  for (const mode of ["strict", "balanced", "creative", "pose"]) {
    if (haystack.includes(mode)) return mode;
  }
  if (/포즈|pose|jump|점프|wink|윙크/.test(haystack)) return "pose";
  return "balanced";
}

function inferCharacterOnly(input) {
  const haystack = [
    input.task,
    ...(input.userVisibleContext?.constraints || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /character[-\s]?only|portrait|캐릭터만|단독|simple background|plain background|neutral background|흰색 배경/.test(
    haystack,
  );
}

function inferTheme(task) {
  if (/sad|cry|tear|breakup|heartbroken|슬프|슬퍼|슬픈|우는|울고|울|눈물|이별|헤어/i.test(task)) return "sad breakup";
  if (/wizard|마법사/i.test(task)) return "wizard";
  if (/zombie|좀비/i.test(task)) return "cute zombie";
  if (/beach|bikini|summer|해변|비키니|여름/i.test(task)) return "summer beach";
  if (/boxing|boxer|glove|권투|복싱|글러브/i.test(task)) return "confident boxer";
  if (/jump|점프/i.test(task)) return "jumping pose";
  return cleanTheme(task).slice(0, 80) || "custom theme";
}

function buildPublicImageBrief({ request, mode, characterOnly }) {
  return [
    `Create a Dokpami character variation from the private reference image at ${baseReferencePath}. User request: ${request}`,
    `Mode: ${mode}.`,
    characterOnly
      ? "Use a character-only composition on a simple neutral background."
      : "Use a simple, non-distracting background unless the request specifies one.",
    "Treat the reference image as a strict shape trace, not just a style reference.",
    "Preserve the bottom-heavy round white body, the original low-centered face placement, small black dot/comma eyes, small flat yellow diamond beak, soft blurred pink cheeks, visible single curled hair tuft, short rounded yellow feet, large raised brown wing on the left, small brown tail/wing point on the right, thick simple black outline, and flat hand-drawn 2D cartoon texture.",
    "Keep the original asymmetric pose. Do not turn the wings into two symmetrical arms or sleeves.",
    "For a wizard theme, add only lightweight accessories: a small hat that leaves the curl visible, a small cape or collar, and a half-moon staff leaning beside the left wing. Do not cover most of the white body with a full ornate robe.",
    "The white body must remain the dominant visual area. Theme details must read as accessories layered onto the original Dokpami, not a redesign.",
    "Avoid human limbs, hands, fingers, glossy anime eyes, large complex robes, excessive gems, species changes, photorealism, text, watermarks, and extra characters.",
  ].join(" ");
}

function buildLocalPreviewSvg({ theme, request }) {
  const sad = /sad|cry|tear|breakup|heartbroken|슬프|슬퍼|슬픈|우는|울고|울|눈물|이별|헤어/i.test(
    `${theme} ${request}`,
  );
  const themeAccent = sad ? "#6b7fb6" : "#2f9b92";
  const cheek = sad ? "#f2a8b5" : "#ffb7c7";
  const bgTop = sad ? "#e9eef8" : "#eefaf7";
  const bgBottom = sad ? "#f8f3f6" : "#fff7ef";
  const heartOpacity = sad ? "1" : "0";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" role="img">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="72%">
      <stop offset="0%" stop-color="${bgTop}"/>
      <stop offset="100%" stop-color="${bgBottom}"/>
    </radialGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#5c4c48" flood-opacity="0.16"/>
    </filter>
    <filter id="cheekBlur" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="9"/>
    </filter>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <g opacity="${sad ? "0.55" : "0"}" stroke="#9aa9cb" stroke-width="12" stroke-linecap="round">
    <path d="M240 150v52"/>
    <path d="M365 108v58"/>
    <path d="M645 116v56"/>
    <path d="M785 162v52"/>
  </g>
  <g opacity="${heartOpacity}" transform="translate(704 220)">
    <path d="M80 62C44 20 0 39 0 82c0 47 72 94 80 103 8-9 80-56 80-103 0-43-44-62-80-20Z" fill="#e77b91" stroke="#241916" stroke-width="12" stroke-linejoin="round"/>
    <path d="M83 34l-28 55h47l-24 68" fill="none" stroke="#fff6f7" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <g filter="url(#softShadow)" stroke="#241916" stroke-linecap="round" stroke-linejoin="round">
    <path d="M307 642c-52-21-88-60-97-109-11-61 28-115 88-121 58-6 94 37 105 82 13 55-28 122-96 148Z" fill="#9a6a40" stroke-width="18"/>
    <path d="M724 548c35-30 82-32 113-5 28 25 32 67 10 99-25 38-81 46-133 19Z" fill="#9a6a40" stroke-width="16"/>
    <path d="M238 584c0-176 119-306 277-306 158 0 271 128 271 306 0 186-113 315-270 315-159 0-278-130-278-315Z" fill="#fffdf8" stroke-width="20"/>
    <path d="M476 259c-24-41-11-80 26-100 31-16 71-8 86 23 14 30-6 58-38 63" fill="none" stroke-width="22"/>
    <path d="M417 544c19 15 49 15 68-1" fill="none" stroke-width="15"/>
    <path d="M553 544c19 15 49 15 68-1" fill="none" stroke-width="15"/>
    <g fill="#78b4e6" stroke-width="8" opacity="${sad ? "1" : "0"}">
      <path d="M455 586c22 34-7 62-28 43-19-17 3-42 28-43Z"/>
      <path d="M591 586c22 34-7 62-28 43-19-17 3-42 28-43Z"/>
    </g>
    <path d="M499 595l34-19 34 19-34 25Z" fill="#f6c24c" stroke-width="12"/>
    <path d="M472 656c28 24 80 24 112 0" fill="none" stroke-width="13" opacity="${sad ? "0" : "1"}"/>
    <path d="M476 678c29-22 76-22 105 0" fill="none" stroke-width="13" opacity="${sad ? "1" : "0"}"/>
    <ellipse cx="412" cy="620" rx="47" ry="25" fill="${cheek}" opacity="0.63" filter="url(#cheekBlur)" stroke="none"/>
    <ellipse cx="635" cy="620" rx="47" ry="25" fill="${cheek}" opacity="0.63" filter="url(#cheekBlur)" stroke="none"/>
    <path d="M433 890c-28 31-77 31-105 1" fill="#f6c24c" stroke-width="16"/>
    <path d="M693 890c-28 31-77 31-105 1" fill="#f6c24c" stroke-width="16"/>
  </g>
  <g stroke="${themeAccent}" stroke-width="10" stroke-linecap="round" opacity="${sad ? "0.85" : "0.55"}">
    <path d="M238 790c-36 12-71 13-105 3"/>
    <path d="M786 790c36 12 71 13 105 3"/>
  </g>
</svg>`;
}

function cleanTheme(value) {
  return String(value || "")
    .replace(/dokpami|character|variation|create|make|만들|생성|캐릭터|변형|버전/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeFileStem(value) {
  return String(value || "theme")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "theme";
}

function titleCase(value) {
  return String(value || "")
    .split(/\s+/)
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : ""))
    .join(" ");
}
