import { readWalrusAgentArtifact } from "../apps/gateway/src/walrusAgentArtifact.mjs";

const options = parseArgs(process.argv.slice(2));
const result = await readWalrusAgentArtifact({
  blob_id: options.blobId || options["blob-id"],
  agent_id: options.agentId || options["agent-id"],
  task: options.task,
});

console.log(JSON.stringify(result, null, 2));

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}
