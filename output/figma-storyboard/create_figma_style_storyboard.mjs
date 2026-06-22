import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const outDir = resolve("output/figma-storyboard");
const textDir = join(outDir, "text");
const slideDir = join(outDir, "slides");
mkdirSync(textDir, { recursive: true });
mkdirSync(slideDir, { recursive: true });

const ffmpeg = resolve("output/canva-demo/node_modules/ffmpeg-static/ffmpeg");
const font = "/System/Library/Fonts/Supplemental/Arial.ttf";
const figmaSource = join(outDir, "figma-source-slide.png");

const scenes = [
  {
    id: "01",
    duration: 20,
    time: "0:00-0:20",
    kicker: "Figma storyboard source",
    title: "HireMe",
    line: "Use the Figma deck as the visual spine for the demo.",
    cards: [
      ["Clients", "Efficient, better outcomes"],
      ["HireMe", "Enable protected hiring"],
      ["Creators", "Monetize protected AI agents"],
    ],
    proof: ["Use this exact Figma framing", "Keep the dark product-demo style", "Do not dwell on setup"],
    source: true,
    accent: "0x13A8D8",
  },
  {
    id: "02",
    duration: 25,
    time: "0:20-0:45",
    kicker: "Clients",
    title: "Efficient, Better Outcomes",
    line: "Clients need expert AI Agent results without rewriting prompts, switching tools, or paying for repeated attempts.",
    cards: [
      ["Pain", "Too much prompt work"],
      ["Need", "Reliable specialist outcomes"],
      ["Result", "Hire the Agent's work"],
    ],
    proof: ["Show product home", "Short narration only", "No login walkthrough"],
    accent: "0xEF4444",
  },
  {
    id: "03",
    duration: 25,
    time: "0:45-1:10",
    kicker: "Product boundary",
    title: "HireMe Enables Protected Hiring",
    line: "The client gets useful Agent output while the creator keeps the private Harness protected.",
    cards: [
      ["Client", "Task and result"],
      ["HireMe", "Trusted execution boundary"],
      ["Creator", "Private Harness stays private"],
    ],
    proof: ["Use boundary graphic", "Avoid raw Harness exposure", "Say platform, not marketplace"],
    accent: "0x13A8D8",
  },
  {
    id: "04",
    duration: 35,
    time: "1:10-1:45",
    kicker: "Web demo",
    title: "Client Hires dokpami-maker",
    line: "The web flow shows a client choosing a specialized Agent and receiving a generated character PNG.",
    cards: [
      ["Select", "dokpami-maker"],
      ["Prompt", "Dokpami wizard eagle"],
      ["Output", "Generated PNG result"],
    ],
    proof: ["Replace with web clip", "Zoom on Agent profile", "Zoom on PNG result"],
    accent: "0xF59E0B",
  },
  {
    id: "05",
    duration: 40,
    time: "1:45-2:25",
    kicker: "MCP demo",
    title: "The Same Agent Works Inside Codex",
    line: "MCP turns the hired capability into a tool the client can call where they already work.",
    cards: [
      ["Call", "hireme_call_agent"],
      ["Async", "job_id returned"],
      ["Result", "hireme_get_agent_result"],
    ],
    proof: ["Terminal text must be readable", "Show job_id", "Show returned image"],
    accent: "0x22C55E",
  },
  {
    id: "06",
    duration: 35,
    time: "2:25-3:00",
    kicker: "Creators",
    title: "Monetize Protected AI Agents",
    line: "Creators can publish useful capabilities without giving away private prompts, skills, tools, or review habits.",
    cards: [
      ["Earn", "Paid usage"],
      ["Protect", "Private workflows"],
      ["Improve", "Real usage feedback"],
    ],
    proof: ["Prepared publish flow", "Protected metadata", "No full upload wizard"],
    accent: "0xF59E0B",
  },
  {
    id: "07",
    duration: 35,
    time: "3:00-3:35",
    kicker: "Walrus",
    title: "Protected Agent Packages",
    line: "Walrus stores protected Agent artifacts safely and verifiably while the public surface only shows safe metadata.",
    cards: [
      ["Artifact", "Encrypted package"],
      ["Proof", "Blob or object reference"],
      ["Boundary", "No public Harness source"],
    ],
    proof: ["Show blob ID", "Show artifact reference", "Skip wallet details"],
    accent: "0x10B981",
  },
  {
    id: "08",
    duration: 40,
    time: "3:35-4:15",
    kicker: "MemWal",
    title: "Session Memory Across Agents",
    line: "MCP conversations remember context across sessions and agents, so the next call can continue from prior work.",
    cards: [
      ["Store", "memWalStored: true"],
      ["Recall", "previousTurnsLoaded"],
      ["Context", "Dokpami character concept"],
    ],
    proof: ["Show namespace", "Show blobId", "Wait before recall call"],
    accent: "0x22C55E",
  },
  {
    id: "09",
    duration: 30,
    time: "4:15-4:45",
    kicker: "Resume",
    title: "A New Scene Uses Remembered Context",
    line: "The client asks for a dark magical library version without rebuilding the entire character brief.",
    cards: [
      ["Earlier", "Wizard eagle identity"],
      ["Follow-up", "Dark magical library"],
      ["Output", "New scene version"],
    ],
    proof: ["Show recall prompt", "Show new image", "Do not claim PNG byte editing"],
    accent: "0x8B5CF6",
  },
  {
    id: "10",
    duration: 15,
    time: "4:45-5:00",
    kicker: "Closing",
    title: "One Connected Hiring Flow",
    line: "Clients hire Agent work. Creators keep the Harness. Walrus and MemWal make the boundary durable and memorable.",
    cards: [
      ["Web", "Try or hire"],
      ["MCP", "Use inside workflows"],
      ["Walrus + MemWal", "Protected artifacts and memory"],
    ],
    proof: ["End on architecture", "Tie back to Figma deck", "Keep the final claim concise"],
    accent: "0x13A8D8",
  },
];

function wrap(text, max) {
  const out = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      out.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out.join("\n");
}

function textFile(scene, key, value) {
  const path = join(textDir, `${scene.id}-${key}.txt`);
  writeFileSync(path, value, "utf8");
  return path;
}

function esc(path) {
  return path.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
}

function addText({ file, x, y, size, color = "0xFFFFFF", spacing = 8 }) {
  return `drawtext=fontfile='${font}':textfile='${esc(file)}':x=${x}:y=${y}:fontsize=${size}:fontcolor=${color}:line_spacing=${spacing}`;
}

for (const scene of scenes) {
  const out = join(slideDir, `${scene.id}.png`);

  if (scene.source) {
    execFileSync(ffmpeg, [
      "-hide_banner",
      "-y",
      "-i",
      figmaSource,
      "-vf",
      "crop=1200:675:0:58,scale=1920:1080",
      "-frames:v",
      "1",
      out,
    ], { stdio: "inherit" });
    continue;
  }

  const files = {
    time: textFile(scene, "time", scene.time),
    kicker: textFile(scene, "kicker", scene.kicker),
    title: textFile(scene, "title", wrap(scene.title, 29)),
    line: textFile(scene, "line", wrap(scene.line, 65)),
    proof: textFile(scene, "proof", scene.proof.map((x) => `- ${x}`).join("\n")),
  };
  scene.cards.forEach(([head, body], index) => {
    files[`cardHead${index}`] = textFile(scene, `card-head-${index}`, head.toUpperCase());
    files[`cardBody${index}`] = textFile(scene, `card-body-${index}`, wrap(body, 24));
  });

  const cardXs = [92, 693, 1294];
  const filters = [
    "drawbox=x=0:y=0:w=1920:h=1080:color=0x06111F@1:t=fill",
    "drawbox=x=0:y=0:w=1920:h=1080:color=0x071526@1:t=fill",
    "drawbox=x=96:y=142:w=1728:h=3:color=0x146D8B@1:t=fill",
    "drawbox=x=1240:y=0:w=520:h=520:color=0x0B2A3B@0.72:t=fill",
    "drawbox=x=-90:y=728:w=420:h=420:color=0x0D3A31@0.68:t=fill",
    addText({ file: files.time, x: 96, y: 180, size: 34, color: scene.accent }),
    addText({ file: files.kicker, x: 96, y: 246, size: 44, color: "0xE7EDF6" }),
    addText({ file: files.title, x: 96, y: 318, size: 76, color: "0xFFFFFF", spacing: 14 }),
    addText({ file: files.line, x: 96, y: 520, size: 39, color: "0xE9EEF5", spacing: 12 }),
    `drawbox=x=210:y=808:w=1500:h=124:color=0x0B1B2F@1:t=fill`,
    `drawbox=x=210:y=808:w=1500:h=124:color=${scene.accent}@0.10:t=fill`,
    addText({ file: files.proof, x: 255, y: 834, size: 28, color: "0xDDE5EE", spacing: 10 }),
    "drawtext=fontfile='/System/Library/Fonts/Supplemental/Arial.ttf':text='HireMe':x=96:y=974:fontsize=26:fontcolor=0xA5B1C2",
    "drawtext=fontfile='/System/Library/Fonts/Supplemental/Arial.ttf':text='Figma storyboard style':x=1486:y=974:fontsize=26:fontcolor=0xA5B1C2",
  ];

  cardXs.forEach((x, i) => {
    filters.push(`drawbox=x=${x}:y=650:w=534:h=148:color=0x12223A@1:t=fill`);
    filters.push(`drawbox=x=${x}:y=650:w=534:h=148:color=${scene.accent}@0.08:t=fill`);
    filters.push(`drawbox=x=${x}:y=650:w=534:h=148:color=${scene.accent}@0.9:t=3`);
    filters.push(addText({ file: files[`cardHead${i}`], x: x + 34, y: 680, size: 22, color: scene.accent }));
    filters.push(addText({ file: files[`cardBody${i}`], x: x + 34, y: 724, size: 31, color: "0xFFFFFF", spacing: 8 }));
  });

  execFileSync(ffmpeg, [
    "-hide_banner",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=0x071526:s=1920x1080:d=1",
    "-vf",
    filters.join(","),
    "-frames:v",
    "1",
    out,
  ], { stdio: "inherit" });
}

const concatPath = join(outDir, "concat.txt");
let concat = "";
for (const scene of scenes) {
  concat += `file '${join(slideDir, `${scene.id}.png`).replace(/'/g, "'\\''")}'\n`;
  concat += `duration ${scene.duration}\n`;
}
concat += `file '${join(slideDir, `${scenes.at(-1).id}.png`).replace(/'/g, "'\\''")}'\n`;
writeFileSync(concatPath, concat, "utf8");

const raw = join(outDir, "HireMe-Figma-Storyboard.raw.mp4");
const final = join(outDir, "HireMe-Figma-Storyboard-5min.mp4");

execFileSync(ffmpeg, [
  "-hide_banner",
  "-y",
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  concatPath,
  "-vf",
  "format=yuv420p",
  "-r",
  "30",
  "-c:v",
  "libx264",
  "-preset",
  "veryfast",
  "-crf",
  "22",
  "-movflags",
  "+faststart",
  raw,
], { stdio: "inherit" });

execFileSync(ffmpeg, [
  "-hide_banner",
  "-y",
  "-i",
  raw,
  "-t",
  "300",
  "-c",
  "copy",
  final,
], { stdio: "inherit" });

writeFileSync(
  join(outDir, "README.md"),
  [
    "# HireMe Figma Storyboard",
    "",
    "Source: Figma Slides link provided by the user.",
    "",
    "- `figma-source-slide.png`: captured Figma source slide.",
    "- `HireMe-Figma-Storyboard-5min.mp4`: 5-minute Canva replacement storyboard.",
    "- `slides/*.png`: individual scene boards.",
    "",
  ].join("\n"),
  "utf8",
);
