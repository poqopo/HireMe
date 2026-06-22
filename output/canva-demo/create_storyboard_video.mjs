import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const outDir = resolve("output/canva-demo");
const textDir = join(outDir, "text");
const slideDir = join(outDir, "slides");
mkdirSync(textDir, { recursive: true });
mkdirSync(slideDir, { recursive: true });

const ffmpeg = resolve("output/canva-demo/node_modules/ffmpeg-static/ffmpeg");
const font = "/System/Library/Fonts/Supplemental/Arial.ttf";

const scenes = [
  {
    id: "01",
    duration: 12,
    time: "0:00-0:12",
    title: "HireMe Demo",
    eyebrow: "Protected AI Agent Hiring",
    caption: "The better an Agent gets, the harder it is to share.",
    visual: "OPEN WITH: HireMe platform screen or clean product UI.",
    proof: ["No login walkthrough", "No provider settings", "Keep the first frame clear"],
    accent: "0x41EAD4",
  },
  {
    id: "02",
    duration: 18,
    time: "0:12-0:30",
    title: "The Private Harness Problem",
    eyebrow: "Prompts, skills, rubrics, tools, memory rules",
    caption: "Clients need the Agent. Creators need to protect the Harness.",
    visual: "SHOW: creator-side profile with private details blurred or abstracted.",
    proof: ["Agent value lives behind the visible UI", "Do not show raw private prompts"],
    accent: "0xFFB703",
  },
  {
    id: "03",
    duration: 20,
    time: "0:30-0:50",
    title: "HireMe Solves The Boundary",
    eyebrow: "Hire work, not copyable workflows",
    caption: "The client hires the Agent's work. The creator keeps the Harness.",
    visual: "SHOW: web flow entering the protected execution boundary.",
    proof: ["Trusted gateway", "MCP-native", "Protected Agent result"],
    accent: "0x90BE6D",
  },
  {
    id: "04",
    duration: 40,
    time: "0:50-1:30",
    title: "Client Hires dokpami-maker",
    eyebrow: "Web flow",
    caption: "The client receives a generated PNG, not the private Harness.",
    visual: "REPLACE WITH: web clip selecting dokpami-maker and generated character PNG.",
    proof: ["Prompt: Dokpami wizard eagle", "Centered character asset", "Plain background"],
    accent: "0xF94144",
  },
  {
    id: "05",
    duration: 40,
    time: "1:30-2:10",
    title: "The Same Agent Through MCP",
    eyebrow: "Codex or Claude workflow",
    caption: "HireMe starts an async Agent job and returns a job id.",
    visual: "REPLACE WITH: MCP terminal clip showing hireme_call_agent and get result polling.",
    proof: ["hireme_call_agent", "job_id", "hireme_get_agent_result", "PNG returned"],
    accent: "0x4CC9F0",
  },
  {
    id: "06",
    duration: 35,
    time: "2:10-2:45",
    title: "Creator Publishes A Protected Agent",
    eyebrow: "Supply side",
    caption: "Creators publish capabilities, not copyable prompts.",
    visual: "REPLACE WITH: prepared creator publish flow and protected artifact metadata.",
    proof: ["Profile fields", "Protected package status", "No upload wizard detour"],
    accent: "0xE76F51",
  },
  {
    id: "07",
    duration: 35,
    time: "2:45-3:20",
    title: "Walrus Artifact Evidence",
    eyebrow: "Durable protected storage",
    caption: "Protected Agent packages are stored on Walrus.",
    visual: "REPLACE WITH: Walrus blob ID, Walruscan, or aggregator proof.",
    proof: ["Show blob/artifact reference", "Avoid wallet funding details", "Payload is not public source"],
    accent: "0x06D6A0",
  },
  {
    id: "08",
    duration: 40,
    time: "3:20-4:00",
    title: "MemWal Stores Conversation Memory",
    eyebrow: "Encrypted recall layer",
    caption: "MemWal turns hired Agent sessions into portable memory.",
    visual: "REPLACE WITH: MCP response metadata showing memWalStored and blob ID.",
    proof: ["memWalStored: true", "namespace", "blobId", "Dokpami context"],
    accent: "0xB5179E",
  },
  {
    id: "09",
    duration: 40,
    time: "4:00-4:40",
    title: "Resume And Recall",
    eyebrow: "Continuity across sessions",
    caption: "The Agent remembers the Dokpami concept and creates a new scene.",
    visual: "REPLACE WITH: recall prompt and dark magical library image result.",
    proof: ["previousTurnsLoaded > 0", "same wizard eagle identity", "new scene version"],
    accent: "0x8AC926",
  },
  {
    id: "10",
    duration: 20,
    time: "4:40-5:00",
    title: "Closing Architecture",
    eyebrow: "Web + MCP + Walrus + MemWal",
    caption: "Protected Agent hiring keeps creator know-how private and client context portable.",
    visual: "BUILD FINAL SLIDE: Creator Harness -> Walrus artifact -> HireMe gateway -> safe Agent result.",
    proof: ["Client task -> MCP call", "Conversation -> MemWal recall", "Encrypted memory blobs on Walrus"],
    accent: "0xFFD166",
  },
];

function wrapWords(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

function writeText(scene, key, value) {
  const path = join(textDir, `${scene.id}-${key}.txt`);
  writeFileSync(path, value, "utf8");
  return path;
}

function escapePath(path) {
  return path.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
}

for (const scene of scenes) {
  const titleFile = writeText(scene, "title", wrapWords(scene.title, 27));
  const eyebrowFile = writeText(scene, "eyebrow", wrapWords(scene.eyebrow, 60));
  const captionFile = writeText(scene, "caption", wrapWords(scene.caption, 43));
  const visualFile = writeText(scene, "visual", wrapWords(scene.visual, 62));
  const proofFile = writeText(scene, "proof", scene.proof.map((item) => `- ${item}`).join("\n"));
  const timeFile = writeText(scene, "time", scene.time);
  const replaceFile = writeText(scene, "replace", "Replace this storyboard frame\nwith the real screen recording\nor proof clip in Canva.");
  const out = join(slideDir, `${scene.id}-${scene.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`);

  const filter = [
    "drawbox=x=0:y=0:w=1920:h=1080:color=0x101114@1:t=fill",
    "drawbox=x=0:y=0:w=1920:h=1080:color=0x181B20@0.86:t=fill",
    `drawbox=x=88:y=78:w=16:h=858:color=${scene.accent}@1:t=fill`,
    `drawbox=x=125:y=704:w=1170:h=196:color=${scene.accent}@0.12:t=fill`,
    "drawbox=x=1320:y=155:w=470:h=575:color=0x2A2F38@1:t=fill",
    `drawbox=x=1348:y=185:w=414:h=225:color=${scene.accent}@0.18:t=fill`,
    "drawbox=x=1348:y=440:w=414:h=260:color=0x121418@1:t=fill",
    `drawtext=fontfile='${font}':textfile='${escapePath(timeFile)}':x=132:y=90:fontsize=34:fontcolor=${scene.accent}:line_spacing=8`,
    `drawtext=fontfile='${font}':textfile='${escapePath(eyebrowFile)}':x=132:y=156:fontsize=44:fontcolor=0xDDE2EA:line_spacing=10`,
    `drawtext=fontfile='${font}':textfile='${escapePath(titleFile)}':x=132:y=230:fontsize=78:fontcolor=0xFFFFFF:line_spacing=14`,
    `drawtext=fontfile='${font}':textfile='${escapePath(captionFile)}':x=132:y=500:fontsize=46:fontcolor=0xF6F7FB:line_spacing=14`,
    `drawtext=fontfile='${font}':textfile='${escapePath(visualFile)}':x=156:y=732:fontsize=34:fontcolor=0xFFFFFF:line_spacing=10`,
    `drawtext=fontfile='${font}':textfile='${escapePath(proofFile)}':x=1375:y=460:fontsize=30:fontcolor=0xEEF2F5:line_spacing=18`,
    `drawtext=fontfile='${font}':text='PROOF SHOT':x=1375:y=210:fontsize=36:fontcolor=${scene.accent}`,
    `drawtext=fontfile='${font}':textfile='${escapePath(replaceFile)}':x=1375:y=278:fontsize=25:fontcolor=0xB7BDC8:line_spacing=8`,
    "drawtext=fontfile='/System/Library/Fonts/Supplemental/Arial.ttf':text='HireMe Demo':x=132:y=968:fontsize=28:fontcolor=0x9AA3AD",
    "drawtext=fontfile='/System/Library/Fonts/Supplemental/Arial.ttf':text='Protected AI Agent Hiring':x=1470:y=968:fontsize=28:fontcolor=0x9AA3AD",
  ].join(",");

  execFileSync(ffmpeg, [
    "-hide_banner",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=0x101114:s=1920x1080:d=1",
    "-vf",
    filter,
    "-frames:v",
    "1",
    out,
  ], { stdio: "inherit" });
}

const concatPath = join(outDir, "concat.txt");
let concat = "";
for (const scene of scenes) {
  const file = join(slideDir, `${scene.id}-${scene.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`);
  concat += `file '${file.replace(/'/g, "'\\''")}'\n`;
  concat += `duration ${scene.duration}\n`;
}
const last = scenes.at(-1);
concat += `file '${join(slideDir, `${last.id}-${last.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`).replace(/'/g, "'\\''")}'\n`;
writeFileSync(concatPath, concat, "utf8");

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
  join(outDir, "HireMe-Demo-Canva-Storyboard.mp4"),
], { stdio: "inherit" });

writeFileSync(
  join(outDir, "README.md"),
  [
    "# HireMe Demo Canva Storyboard Assets",
    "",
    "- `HireMe-Demo-Canva-Storyboard.mp4`: 5-minute Canva base video.",
    "- `slides/*.png`: individual scene frames if you want to replace clips one-by-one.",
    "- Replace storyboard placeholders with actual web, MCP, Walrus, and MemWal screen recordings in Canva.",
    "",
  ].join("\n"),
  "utf8",
);
