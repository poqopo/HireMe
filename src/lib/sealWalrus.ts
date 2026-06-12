export type HarnessUploadDraft = {
  agentName: string;
  publicCapability: string;
  creatorAddress: string;
  policyRule: string;
  pricePerCallUsd: number;
  epochs: number;
  files?: File[];
};

export type SealedHarnessRecord = {
  id: string;
  agentName: string;
  network: "walrus-testnet";
  sealProvider: string;
  platformKmsKeyId: string;
  sealPolicyId: string;
  walrusBlobId: string;
  suiObjectId: string;
  encryptionId: string;
  sealCiphertextFormat: string;
  sealThreshold: number;
  sealKeyServerIds: string[];
  ciphertextDigest: string;
  fileName: string;
  fileSize: number;
  fileCount: number;
  entryPreview: string[];
  epochs: number;
  pricePerCallUsd: number;
  policyRule: string;
  createdAt: string;
};

function randomHex(bytes: number) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: ArrayBuffer | string) {
  const data =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function createLocalSealedHarnessRecord(
  draft: HarnessUploadDraft,
): Promise<SealedHarnessRecord> {
  const fallbackPayload = JSON.stringify({
    agentName: draft.agentName,
    publicCapability: draft.publicCapability,
    creatorAddress: draft.creatorAddress,
    policyRule: draft.policyRule,
    createdAt: new Date().toISOString(),
  });
  const files = draft.files ?? [];
  const fileDigests = await Promise.all(
    files.map(async (file) => ({
      path: file.webkitRelativePath || file.name,
      size: file.size,
      digest: await sha256Hex(await file.arrayBuffer()),
    })),
  );
  const payload = files.length > 0 ? JSON.stringify(fileDigests) : fallbackPayload;
  const digest = await sha256Hex(payload);
  const objectHex = randomHex(32);
  const shortDigest = digest.slice(0, 24);
  const firstPath = files[0]?.webkitRelativePath || files[0]?.name;
  const folderName = firstPath?.includes("/") ? firstPath.split("/")[0] : draft.agentName;

  return {
    id: `sealed_${Date.now().toString(36)}`,
    agentName: draft.agentName,
    network: "walrus-testnet",
    sealProvider: "platform-managed-envelope",
    platformKmsKeyId: "platform:local-dev-key",
    sealPolicyId: `platform:agent:${randomHex(12)}`,
    walrusBlobId: `walrus_${shortDigest}`,
    suiObjectId: `0x${objectHex}`,
    encryptionId: `hireme::harness::${shortDigest}`,
    sealCiphertextFormat: "hireme.platform-ciphertext-envelope.v1",
    sealThreshold: 0,
    sealKeyServerIds: [],
    ciphertextDigest: `sha256:${digest}`,
    fileName: folderName,
    fileSize:
      files.reduce((total, file) => total + file.size, 0) || fallbackPayload.length,
    fileCount: files.length || 1,
    entryPreview:
      fileDigests.length > 0
        ? fileDigests.slice(0, 5).map((item) => item.path)
        : ["local-harness-preview.json"],
    epochs: draft.epochs,
    pricePerCallUsd: draft.pricePerCallUsd,
    policyRule: draft.policyRule,
    createdAt: new Date().toISOString(),
  };
}
