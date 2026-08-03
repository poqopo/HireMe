import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const inputDir =
  "/var/folders/k4/9902ytbd0837lk02rxvsyz6w0000gn/T/codex-presentations/manual-hireme-pseudocon/hireme-deck/tmp/final-preview-safe-jpg";
const outputPath =
  "/Users/hanlab/Desktop/HireMe/outputs/HireMe_PseudoCon_2026_safe_image.pptx";

async function readBytes(filePath) {
  const bytes = await fs.readFile(filePath);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function main() {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const presentation = Presentation.create({
    slideSize: { width: 960, height: 540 },
  });

  for (let i = 1; i <= 18; i += 1) {
    const slide = presentation.slides.add();
    slide.background.fill = "#FFFFFF";
    const stem = String(i).padStart(2, "0");
    const imagePath = path.join(inputDir, `slide-${stem}.jpg`);
    slide.images.add({
      blob: await readBytes(imagePath),
      contentType: "image/jpeg",
      alt: `HireMe PseudoCon slide ${i}`,
      fit: "cover",
      position: { left: 0, top: 0, width: 960, height: 540 },
    });
  }

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
