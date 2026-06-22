import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const outDir = resolve("output/figma-storyboard");
const textDir = join(outDir, "intro-boundary-text");
mkdirSync(textDir, { recursive: true });

const ffmpeg = resolve("output/canva-demo/node_modules/ffmpeg-static/ffmpeg");
const font = "/System/Library/Fonts/Supplemental/Arial.ttf";
const output = join(outDir, "hireme-intro-boundary-slide.png");

function wrap(text, max) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

function textFile(name, value) {
  const path = join(textDir, `${name}.txt`);
  writeFileSync(path, value, "utf8");
  return path;
}

function esc(path) {
  return path.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
}

function addText({ file, x, y, size, color = "0xFFFFFF", spacing = 8 }) {
  return `drawtext=fontfile='${font}':textfile='${esc(file)}':x=${x}:y=${y}:fontsize=${size}:fontcolor=${color}:line_spacing=${spacing}`;
}

const files = {
  title: textFile("title", "HireMe"),
  subtitle: textFile(
    "subtitle",
    wrap(
      "Clients hire the Agent's work. Creators keep the private Harness.",
      90,
    ),
  ),
  subnote: textFile(
    "subnote",
    wrap(
      "HireMe runs protected Agents through MCP, returning results without raw Agent source.",
      74,
    ),
  ),
  clientKicker: textFile("client-kicker", "CLIENTS"),
  clientTitle: textFile("client-title", "Hire the Agent's work"),
  clientBullets: textFile(
    "client-bullets",
    [
      "- Use expert Agents in your workflow",
      "- Get results, not raw source",
      "- Keep context across sessions",
      "- Avoid rebuilding prompts",
    ].join("\n"),
  ),
  clientPill: textFile("client-pill", "No Harness files to copy."),
  gatewayKicker: textFile("gateway-kicker", "HIREME GATEWAY"),
  gatewayTitle: textFile("gateway-title", "Protected MCP boundary"),
  gatewayBullets: textFile(
    "gateway-bullets",
    [
      "- Run the Agent behind the gateway",
      "- Check access and route the call",
      "- Return safe Agent output",
      "- Keep private Harness protected",
    ].join("\n"),
  ),
  gatewayPill: textFile("gateway-pill", "MCP-native protected execution."),
  creatorKicker: textFile("creator-kicker", "CREATORS"),
  creatorTitle: textFile("creator-title", "Keep the private Harness"),
  creatorBullets: textFile(
    "creator-bullets",
    [
      "- Protect prompts, skills, rubrics",
      "- Protect tools and review habits",
      "- Publish useful Agents safely",
      "- Earn without exposing IP",
    ].join("\n"),
  ),
  creatorPill: textFile("creator-pill", "Monetize Agent work, not source."),
  walrusTitle: textFile("walrus-title", "Walrus"),
  walrusText: textFile(
    "walrus-text",
    wrap("Encrypted Agent artifact stored as durable proof", 46),
  ),
  memwalTitle: textFile("memwal-title", "MemWal"),
  memwalText: textFile(
    "memwal-text",
    wrap("Portable memory across sessions and multi-Agent workflows", 52),
  ),
};

const cards = [
  {
    x: 92,
    accent: "0xEF4444",
    kicker: files.clientKicker,
    title: files.clientTitle,
    bullets: files.clientBullets,
    pill: files.clientPill,
  },
  {
    x: 693,
    accent: "0x13A8D8",
    kicker: files.gatewayKicker,
    title: files.gatewayTitle,
    bullets: files.gatewayBullets,
    pill: files.gatewayPill,
  },
  {
    x: 1294,
    accent: "0xF59E0B",
    kicker: files.creatorKicker,
    title: files.creatorTitle,
    bullets: files.creatorBullets,
    pill: files.creatorPill,
  },
];

const filters = [
  "drawbox=x=0:y=0:w=1920:h=1080:color=0x06111F@1:t=fill",
  "drawbox=x=0:y=0:w=1920:h=1080:color=0x071526@1:t=fill",
  "drawbox=x=96:y=160:w=1728:h=2:color=0x146D8B@1:t=fill",
  "drawbox=x=1230:y=0:w=520:h=330:color=0x0B2A3B@0.62:t=fill",
  "drawbox=x=-90:y=760:w=420:h=320:color=0x0D3A31@0.58:t=fill",
  addText({ file: files.title, x: 96, y: 190, size: 58, color: "0xFFFFFF" }),
  addText({ file: files.subtitle, x: 96, y: 272, size: 38, color: "0xF4F7FB", spacing: 8 }),
  addText({ file: files.subnote, x: 96, y: 342, size: 27, color: "0xBFC8D6", spacing: 6 }),
  "drawbox=x=630:y=604:w=660:h=3:color=0x00A1C8@1:t=fill",
  "drawbox=x=210:y=852:w=1500:h=126:color=0x0B1B2F@1:t=fill",
  "drawbox=x=210:y=852:w=1500:h=126:color=0x10B981@0.10:t=fill",
  "drawbox=x=210:y=852:w=1500:h=126:color=0x10B981@0.85:t=3",
  "drawbox=x=915:y=874:w=2:h=82:color=0x10B981@0.95:t=fill",
  addText({ file: files.walrusTitle, x: 246, y: 899, size: 34, color: "0xFFFFFF" }),
  addText({ file: files.walrusText, x: 382, y: 884, size: 25, color: "0xCAD2DF", spacing: 6 }),
  addText({ file: files.memwalTitle, x: 966, y: 899, size: 34, color: "0xFFFFFF" }),
  addText({ file: files.memwalText, x: 1132, y: 884, size: 25, color: "0xCAD2DF", spacing: 6 }),
];

for (const card of cards) {
  filters.push(`drawbox=x=${card.x}:y=432:w=534:h=328:color=0x12223A@1:t=fill`);
  filters.push(`drawbox=x=${card.x}:y=432:w=534:h=328:color=${card.accent}@0.06:t=fill`);
  filters.push(`drawbox=x=${card.x}:y=432:w=534:h=328:color=${card.accent}@0.75:t=2`);
  filters.push(addText({ file: card.kicker, x: card.x + 34, y: 466, size: 18, color: card.accent }));
  filters.push(addText({ file: card.title, x: card.x + 34, y: 516, size: 32, color: "0xFFFFFF", spacing: 8 }));
  filters.push(addText({ file: card.bullets, x: card.x + 52, y: 590, size: 23, color: "0xD6DDE8", spacing: 8 }));
  filters.push(`drawbox=x=${card.x + 42}:y=710:w=430:h=37:color=${card.accent}@0.20:t=fill`);
  filters.push(`drawbox=x=${card.x + 42}:y=710:w=430:h=37:color=${card.accent}@0.75:t=1`);
  filters.push(addText({ file: card.pill, x: card.x + 65, y: 719, size: 16, color: "0xFFFFFF" }));
}

execFileSync(ffmpeg, [
  "-hide_banner",
  "-y",
  "-f",
  "lavfi",
  "-i",
  "color=c=black:s=1920x1080:r=1",
  "-vf",
  filters.join(","),
  "-frames:v",
  "1",
  output,
], { stdio: "inherit" });

console.log(output);
