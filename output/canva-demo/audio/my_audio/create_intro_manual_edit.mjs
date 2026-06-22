import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const cwd = resolve(".");
const ffmpeg = join(cwd, "output/canva-demo/node_modules/ffmpeg-static/ffmpeg");
const source = join(cwd, "output/canva-demo/audio/my_audio/intro.m4a");
const workDir = join(cwd, "output/canva-demo/audio/my_audio/manual-edit-work");
const outputWav = join(cwd, "output/canva-demo/audio/my_audio/intro_manual_edit.wav");
const outputM4a = join(cwd, "output/canva-demo/audio/my_audio/intro_manual_edit.m4a");

const totalDuration = 112.041333;
const keepPause = 0.22;
const pauses = [
  [5.043, 5.80098],
  [19.8961, 20.4772],
  [23.4214, 23.983],
  [24.674, 25.2135],
  [31.1731, 31.8984],
  [35.747, 36.4382],
  [36.8782, 37.389],
  [38.2372, 38.7947],
  [42.7574, 44.1299],
  [53.1354, 53.6463],
  [70.7514, 71.4191],
  [110.337, 111.113],
  [111.282, 111.866],
];

rmSync(workDir, { recursive: true, force: true });
mkdirSync(workDir, { recursive: true });

const concatLines = [];
let cursor = 0;
let part = 0;

function addAudioSegment(start, end) {
  if (end - start < 0.04) return;
  part += 1;
  const out = join(workDir, `${String(part).padStart(3, "0")}-audio.wav`);
  execFileSync(ffmpeg, [
    "-hide_banner",
    "-y",
    "-i",
    source,
    "-ss",
    start.toFixed(3),
    "-to",
    end.toFixed(3),
    "-ac",
    "1",
    "-ar",
    "48000",
    "-c:a",
    "pcm_s16le",
    out,
  ], { stdio: "ignore" });
  concatLines.push(`file '${out.replace(/'/g, "'\\''")}'`);
}

function addPause(duration) {
  if (duration <= 0) return;
  part += 1;
  const out = join(workDir, `${String(part).padStart(3, "0")}-pause.wav`);
  execFileSync(ffmpeg, [
    "-hide_banner",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=48000:cl=mono",
    "-t",
    duration.toFixed(3),
    "-acodec",
    "pcm_s16le",
    out,
  ], { stdio: "ignore" });
  concatLines.push(`file '${out.replace(/'/g, "'\\''")}'`);
}

for (const [start, end] of pauses) {
  addAudioSegment(cursor, start);
  addPause(keepPause);
  cursor = end;
}

addAudioSegment(cursor, totalDuration);

const concatPath = join(workDir, "concat.txt");
const joinedWav = join(workDir, "joined.wav");
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
  "-c:a",
  "pcm_s16le",
  joinedWav,
], { stdio: "ignore" });

execFileSync(ffmpeg, [
  "-hide_banner",
  "-y",
  "-i",
  joinedWav,
  "-af",
  "highpass=f=80,lowpass=f=12500,afftdn=nf=-25,acompressor=threshold=-22dB:ratio=2.5:attack=8:release=140:makeup=4,equalizer=f=250:t=q:w=1:g=-2,equalizer=f=3600:t=q:w=1:g=2,equalizer=f=7200:t=q:w=1:g=1.2,loudnorm=I=-16:TP=-1.5:LRA=10,afade=t=in:st=0:d=0.08,areverse,afade=t=in:st=0:d=0.12,areverse",
  "-ar",
  "48000",
  "-c:a",
  "pcm_s16le",
  outputWav,
], { stdio: "ignore" });

execFileSync(ffmpeg, [
  "-hide_banner",
  "-y",
  "-i",
  outputWav,
  "-ar",
  "48000",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  outputM4a,
], { stdio: "ignore" });

console.log(outputM4a);
