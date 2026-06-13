import { agents as fallbackAgents } from "@/lib/agents";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type {
  Agent,
  AgentCategory,
  AgentStatus,
  AgentTeamBillingUnit,
} from "@/types/agent";
import type { Database } from "@/types/database";

type MarketplaceCardRow =
  Database["public"]["Views"]["agent_marketplace_cards"]["Row"];

export type AgentDataSource = "supabase" | "mock";

export type AgentLoadResult = {
  agents: Agent[];
  source: AgentDataSource;
  message?: string;
};

const categoryLabels: Record<
  Database["public"]["Enums"]["agent_category"],
  AgentCategory
> = {
  research: "Research",
  code: "Code",
  data: "Data",
  security: "Security",
  growth: "Growth",
  ops: "Ops",
  other: "Ops",
};

const statusLabels: Record<
  Database["public"]["Enums"]["agent_status"],
  AgentStatus
> = {
  draft: "Busy",
  listed: "Available",
  private_beta: "Private Beta",
  paused: "Busy",
  archived: "Busy",
};

export async function loadMarketplaceAgents(): Promise<AgentLoadResult> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      agents: fallbackAgents,
      source: "mock",
      message: "Supabase env is not configured; showing local demo data.",
    };
  }

  const { data, error } = await supabase
    .from("agent_marketplace_cards")
    .select("*")
    .order("rating", { ascending: false })
    .order("historical_calls", { ascending: false });

  if (error) {
    return {
      agents: fallbackAgents,
      source: "mock",
      message: `Supabase read failed: ${error.message}`,
    };
  }

  if (!data.length) {
    return {
      agents: fallbackAgents,
      source: "mock",
      message: "Supabase marketplace is empty; showing local demo data.",
    };
  }

  return {
    agents: data.map(mapMarketplaceCardToAgent),
    source: "supabase",
  };
}

function mapMarketplaceCardToAgent(row: MarketplaceCardRow): Agent {
  const slug = row.slug || row.id;
  const skills = row.public_skills.length ? row.public_skills : ["MCP"];
  const latencyMs = row.median_latency_ms ?? 0;
  const avgInputTokens = estimateInputTokens(row, skills);
  const avgOutputTokens = estimateOutputTokens(row, skills, latencyMs);

  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    creator: row.creator_name || "Unknown creator",
    team: {
      id: row.team_slug || slug,
      name: row.team_name || `${row.name} Team`,
      handle: row.team_handle || `@teams/${slug}`,
      owner: row.team_owner_name || row.creator_name || "Unknown owner",
      headline: row.team_headline || row.headline,
      publicSummary: row.team_public_summary || row.public_summary,
      agentCount: row.team_agent_count ?? 1,
      accent: row.team_accent || row.accent || "from-[#533afd] to-[#6ee7f9]",
      billing: {
        unit: mapTeamBillingUnit(row.team_billing_unit),
        basePriceUsd:
          row.team_base_price_usd ?? row.price_per_mcp_call_usd ?? 0,
        includedCalls: row.team_included_calls ?? row.free_calls ?? 0,
        overagePricePerCallUsd:
          row.team_overage_price_per_call_usd ??
          row.price_per_mcp_call_usd ??
          0,
        note:
          row.team_billing_note ||
          "Single-agent fallback. Team pricing is resolved when a team record is attached.",
      },
    },
    teamRole: row.team_role || "Specialist",
    listedIndividually: row.listed_individually ?? true,
    category: categoryLabels[row.category],
    status: statusLabels[row.status],
    headline: row.headline,
    publicSummary: row.public_summary,
    publicContract: row.public_mcp_contract,
    memwalPolicy:
      "Protected Skills, Harness logic, private prompts, and memory artifacts stay behind the MCP gateway.",
    skills,
    protectedAssets: [
      "AGENTS.md",
      "skills/**",
      "private prompts",
      "harness internals",
    ],
    sealedHarness: {
      network: "walrus-testnet",
      sealPolicyId: `platform:agent:${slug}`,
      walrusBlobId: `gateway-managed:${slug}`,
      suiObjectId: row.current_version_id || "pending",
      ciphertextDigest: "registered-with-protected-artifacts",
      visibility:
        "Marketplace cards expose capability, price, and safe metadata. Protected artifact details are resolved by the gateway at call time.",
    },
    pricePerCallUsd: row.price_per_mcp_call_usd ?? 0,
    freeCalls: row.free_calls ?? 0,
    rating: row.rating,
    calls: Number(row.historical_calls),
    latencyMs,
    avgInputTokens,
    avgOutputTokens,
    resultPreview: {
      title: `${skills[0]} result`,
      summary: `Returns safe ${row.public_mcp_contract} output with protected harness guidance and ledger-ready metadata.`,
      sample: `${row.headline} Typical response includes action items, constraints, and verification notes.`,
    },
    mcpPackage: `mcp://hireme/${slug}`,
    accent: row.accent || "from-[#533afd] to-[#6ee7f9]",
  };
}

function mapTeamBillingUnit(value: string | null): AgentTeamBillingUnit {
  if (
    value === "team_bundle" ||
    value === "monthly_access" ||
    value === "per_agent"
  ) {
    return value;
  }
  return "per_agent";
}

function estimateInputTokens(row: MarketplaceCardRow, skills: string[]) {
  const textSize =
    row.public_summary.length +
    row.public_mcp_contract.length +
    skills.join(" ").length;
  return clamp(Math.round(textSize * 3.2), 420, 2600);
}

function estimateOutputTokens(
  row: MarketplaceCardRow,
  skills: string[],
  latencyMs: number,
) {
  const textSize = row.headline.length + skills.join(" ").length;
  const latencyWeight = latencyMs ? latencyMs * 0.28 : 260;
  return clamp(Math.round(textSize * 4.5 + latencyWeight), 320, 1800);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
