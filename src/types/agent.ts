export type AgentCategory =
  | "Research"
  | "Code"
  | "Data"
  | "Security"
  | "Growth"
  | "Ops";

export type AgentStatus = "Available" | "Busy" | "Private Beta";

export type Agent = {
  id: string;
  name: string;
  handle: string;
  creator: string;
  category: AgentCategory;
  status: AgentStatus;
  headline: string;
  publicSummary: string;
  publicContract: string;
  memwalPolicy: string;
  skills: string[];
  protectedAssets: string[];
  sealedHarness: {
    network: "walrus-testnet" | "walrus-mainnet";
    sealPolicyId: string;
    walrusBlobId: string;
    suiObjectId: string;
    ciphertextDigest: string;
    visibility: string;
  };
  pricePerCallUsd: number;
  freeCalls: number;
  rating: number;
  calls: number;
  latencyMs: number;
  mcpPackage: string;
  accent: string;
};
