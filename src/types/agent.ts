export type AgentCategory =
  | "Research"
  | "Code"
  | "Data"
  | "Security"
  | "Growth"
  | "Ops";

export type AgentStatus = "Available" | "Busy" | "Private Beta";

export type AgentTeamBillingUnit =
  | "team_bundle"
  | "monthly_access"
  | "per_agent";

export type AgentTeam = {
  id: string;
  name: string;
  handle: string;
  owner: string;
  headline: string;
  publicSummary: string;
  agentCount: number;
  accent: string;
  billing: {
    unit: AgentTeamBillingUnit;
    basePriceUsd: number;
    includedCalls: number;
    overagePricePerCallUsd: number;
    note: string;
  };
};

export type Agent = {
  id: string;
  name: string;
  handle: string;
  creator: string;
  team: AgentTeam;
  teamRole: string;
  listedIndividually: boolean;
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
  avgInputTokens: number;
  avgOutputTokens: number;
  resultPreview: {
    title: string;
    summary: string;
    sample: string;
  };
  mcpPackage: string;
  accent: string;
};
