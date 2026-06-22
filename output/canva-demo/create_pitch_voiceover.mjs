import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const outDir = resolve("output/canva-demo");
const audioDir = join(outDir, "audio");
const segmentDir = join(audioDir, "pitch-segments");
mkdirSync(segmentDir, { recursive: true });
mkdirSync(audioDir, { recursive: true });

const ffmpeg = resolve("output/canva-demo/node_modules/ffmpeg-static/ffmpeg");
const voice = "Shelley (영어(미국))";

const scriptPath = join(outDir, "voiceover-hireme-intro-pitching.txt");
const finalWav = join(audioDir, "voiceover-hireme-intro-pitching.wav");
const finalM4a = join(audioDir, "voiceover-hireme-intro-pitching.m4a");

const segments = [
  {
    rate: 152,
    gap: 0.5,
    text: "What happens when an AI Agent becomes too valuable to give away?",
  },
  {
    rate: 146,
    gap: 0.36,
    text: "That is the problem HireMe is built to solve.",
  },
  {
    rate: 160,
    gap: 0.34,
    text: "Because the better an Agent gets, the harder it is to share.",
  },
  {
    rate: 154,
    gap: 0.35,
    text: "A useful Agent is not just a model call.",
  },
  {
    rate: 146,
    gap: 0.52,
    text: "Its value lives in the private Harness behind it: prompts, skills, rubrics, tools, memory rules, and review habits.",
  },
  {
    rate: 158,
    gap: 0.38,
    text: "And today, creators have a bad tradeoff.",
  },
  {
    rate: 164,
    gap: 0.26,
    text: "Share the full Harness, and clients can copy the know-how.",
  },
  {
    rate: 158,
    gap: 0.58,
    text: "Keep it private, and clients cannot use the Agent where they actually work.",
  },
  {
    rate: 142,
    gap: 0.64,
    text: "HireMe breaks that tradeoff.",
  },
  {
    rate: 152,
    gap: 0.36,
    text: "The client hires the Agent's work.",
  },
  {
    rate: 148,
    gap: 0.38,
    text: "The creator keeps the private Harness.",
  },
  {
    rate: 154,
    gap: 0.5,
    text: "And the Agent runs through HireMe's M C P gateway, so the client gets the result without receiving the raw source of the Agent.",
  },
  {
    rate: 148,
    gap: 0.4,
    text: "Walrus stores the encrypted Agent artifact as durable proof.",
  },
  {
    rate: 150,
    gap: 0.0,
    text: "Mem Wal gives hired Agents portable memory across sessions and multi-Agent workflows.",
  },
];

writeFileSync(
  scriptPath,
  segments.map((segment) => segment.text).join("\n\n"),
  "utf8",
);

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
  ], { stdio: "inherit" });

  execFileSync(ffmpeg, [
    "-hide_banner",
    "-y",
    "-i",
    aiffPath,
    "-ac",
    "1",
    "-ar",
    "44100",
    "-af",
    "volume=1.04",
    wavPath,
  ], { stdio: "inherit" });

  concatLines.push(`file '${wavPath.replace(/'/g, "'\\''")}'`);

  if (segment.gap > 0) {
    const silencePath = join(segmentDir, `${id}-pause.wav`);
    execFileSync(ffmpeg, [
      "-hide_banner",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=44100:cl=mono",
      "-t",
      String(segment.gap),
      "-acodec",
      "pcm_s16le",
      silencePath,
    ], { stdio: "inherit" });
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
  finalWav,
], { stdio: "inherit" });

execFileSync(ffmpeg, [
  "-hide_banner",
  "-y",
  "-i",
  finalWav,
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  finalM4a,
], { stdio: "inherit" });

console.log(finalM4a);
