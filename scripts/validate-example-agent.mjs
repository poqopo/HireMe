import { validateAgentFolder } from "../apps/gateway/src/localSealedArtifact.mjs";

const folderPath = process.argv[2] || "examples/code-reviewer-agent";
const validation = await validateAgentFolder(folderPath);

console.log(
  JSON.stringify(
    {
      status: "valid-agent-folder",
      folderPath: validation.folderPath,
      fileCount: validation.fileCount,
      requiredFiles: validation.requiredFiles,
      folderManifestDigest: validation.folderManifestDigest,
      files: validation.files.map(({ path, size, digest }) => ({
        path,
        size,
        digest,
      })),
    },
    null,
    2,
  ),
);
