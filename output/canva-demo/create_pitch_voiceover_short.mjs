import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const outDir = resolve("output/canva-demo");
const audioDir = join(outDir, "audio");
const segmentDir = join(audioDir, "pitch-short-segments");
mkdirSync(segmentDir, { recursive: true });
mkdirSync(audioDir, { recursive: true });

const ffmpeg = resolve("output/canva-demo/node_modules/ffmpeg-static/ffmpeg");
const voice = "Shelley (영어(미국))";

const scriptPath = join(outDir, "voiceover-hireme-intro-pitching-short.txt");
const finalWav = join(audioDir, "voiceover-hireme-intro-pitching-short.wav");
const finalM4a = join(audioDir, "voiceover-hireme-intro-pitching-short.m4a");

const segments = [
  {
    rate: 154,
    gap: 0.48,
    text: "What happens when an AI Agent becomes too valuable to give away?",
  },
  {
    rate: 150,
    gap: 0.32,
    text: "That is the problem HireMe solves.",
  },
  {
    rate: 160,
    gap: 0.32,
    text: "A useful Agent is more than a model call.",
  },
  {
    rate: 158,
    gap: 0.46,
    text: "Its value lives in private prompts, skills, tools, memory rules, and review habits.",
  },
  {
    rate: 160,
    gap: 0.28,
    text: "Today, creators face a bad tradeoff.",
  },
  {
    rate: 166,
    gap: 0.22,
    text: "Share the Harness, and clients can copy the know-how.",
  },
  {
    rate: 160,
    gap: 0.55,
    text: "Keep it private, and clients cannot use the Agent where they work.",
  },
  {
    rate: 144,
    gap: 0.5,
    text: "HireMe breaks that tradeoff.",
  },
  {
    rate: 154,
    gap: 0.3,
    text: "The client hires the Agent's work.",
  },
  {
    rate: 150,
    gap: 0.34,
    text: "The creator keeps the private Harness.",
  },
  {
    rate: 158,
    gap: 0.46,
    text: "The Agent runs through HireMe's M C P gateway, so the client gets the result, not the raw source.",
  },
  {
    rate: 152,
    gap: 0.28,
    text: "Walrus stores the encrypted Agent artifact as durable proof.",
  },
  {
    rate: 154,
    gap: 0,
    text: "Mem Wal gives hired Agents portable memory across sessions and multi-Agent workflows.",
  },
];

writeFileSync(scriptPath, segments.map((segment) => segment.text).join("\n\n"), "utf8");

rmSync(segmentDir, { recursive: true, force: true });
mkdirSync(segmentDir, { recursive: true });

const concatLines = [];

for (const [index, segment] of segments.entries()) {
  const id = String(index + 1).padStart(2, "0");
  const textPath = join(segmentDir, `${id}.txt`);
  const aiffPath = join(segmentDir, `${id}.aiff`);
  const wavPath = join(segmentDir, `${id}.wav`);
  writeFileSync(textPath, segment.text, "utf8");

  execFileSync("say", [
    "-v",
    voice,
    "-r",
    String(segment.rate),
    "-f",
    textPath,
    "-o",
    aiffPath,
  ], { stdio: "ignore" });

  execFileSync(ffmpeg, [
    "-hide_banner",
    "-y",
    "-i",
    aiffPath,
    "-ac",
    "1",
    "-ar",
    "48000",
    "-af",
    "volume=1.04",
    wavPath,
  ], { stdio: "ignore" });

  concatLines.push(`file '${wavPath.replace(/'/g, "'\\''")}'`);

  if (segment.gap > 0) {
    const silencePath = join(segmentDir, `${id}-pause.wav`);
    execFileSync(ffmpeg, [
      "-hide_banner",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=48000:cl=mono",
      "-t",
      String(segment.gap),
      "-acodec",
      "pcm_s16le",
      silencePath,
    ], { stdio: "ignore" });
    concatLines.push(`file '${silencePath.replace(/'/g, "'\\''")}'`);
  }
}

const concatPath = join(segmentDir, "concat.txt");
writeFileSync(concatPath, `${concatLines.join("\n")}\n`, "utf8");

execFileSync(ffmpeg, [
  "-hide_banner",
  "-y",
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  concatPath,
  "-af",
  "loudnorm=I=-16:TP=-1.5:LRA=10",
  "-ar",
  "48000",
  finalWav,
], { stdio: "ignore" });

execFileSync(ffmpeg, [
  "-hide_banner",
  "-y",
  "-i",
  finalWav,
  "-ar",
  "48000",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  finalM4a,
], { stdio: "ignore" });

console.log(finalM4a);
