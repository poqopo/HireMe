export type AgentCategory =
  | "Research"
  | "Code"
  | "Data"
  | "Image";

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
  categories?: AgentCategory[];
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
  pricePer1MTokensSui?: number;
  freeCalls: number;
  rating: number;
  calls: number;
  latencyMs: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  activeUsers?: number;
  createdAt?: string;
  updatedAt?: string;
  resultPreview: {
    title: string;
    summary: string;
    sample: string;
    mediaUrl?: string;
    mediaType?: "image" | "video";
  };
  mcpPackage: string;
  accent: string;
};
