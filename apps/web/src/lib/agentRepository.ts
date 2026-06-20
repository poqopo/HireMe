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
  image: "Image",
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
      agents: [],
      source: "mock",
      message: "Supabase env is not configured; no marketplace agents loaded.",
    };
  }

  const createdOrderResult = await supabase
    .from("agent_marketplace_cards")
    .select("*")
    .order("created_at", { ascending: false, nullsFirst: false });
  const fallbackOrderResult = createdOrderResult.error
    ? await supabase
        .from("agent_marketplace_cards")
        .select("*")
        .order("rating", { ascending: false })
        .order("historical_calls", { ascending: false })
    : createdOrderResult;

  const { data, error } = fallbackOrderResult;

  if (error) {
    return {
      agents: [],
      source: "mock",
      message: `Supabase read failed: ${error.message}`,
    };
  }

  if (!data.length) {
    return {
      agents: [],
      source: "supabase",
      message: "Supabase marketplace is empty.",
    };
  }

  return {
    agents: sortAgentsNewestFirst(data.map(mapMarketplaceCardToAgent)),
    source: "supabase",
  };
}

function mapMarketplaceCardToAgent(row: MarketplaceCardRow): Agent {
  const slug = row.slug || row.id;
  const skills = row.public_skills.length ? row.public_skills : ["MCP"];
  const latencyMs = row.median_latency_ms ?? 0;
  const tokenPriceSui =
    row.price_per_1m_tokens_sui ??
    row.price_per_1m_tokens_usd ??
    normalizeLegacyTokenPrice(row.price_per_mcp_call_usd);
  const avgInputTokens = row.avg_input_tokens ?? estimateInputTokens(row, skills);
  const avgOutputTokens =
    row.avg_output_tokens ?? estimateOutputTokens(row, skills, latencyMs);

  return {
    id: slug,
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
          row.team_base_price_usd ?? tokenPriceSui,
        includedCalls: row.team_included_calls ?? row.free_calls ?? 0,
        overagePricePerCallUsd:
          row.team_overage_price_per_call_usd ??
          tokenPriceSui,
        note:
          row.team_billing_note ||
          "Single-agent fallback. Team pricing is resolved when a team record is attached.",
      },
    },
    teamRole: row.team_role || "Specialist",
    listedIndividually: row.listed_individually ?? true,
    category: categoryLabels[row.category],
    categories: [categoryLabels[row.category]],
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
    pricePerCallUsd: tokenPriceSui,
    pricePer1MTokensSui: tokenPriceSui,
    freeCalls: row.free_calls ?? 0,
    rating: row.rating,
    calls: Number(row.historical_calls),
    latencyMs,
    avgInputTokens,
    avgOutputTokens,
    activeUsers: row.active_user_count ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? row.created_at ?? undefined,
    resultPreview: {
      title: row.result_title || `${skills[0]} result`,
      summary:
        row.result_summary ||
        `Returns safe ${row.public_mcp_contract} output with protected harness guidance and ledger-ready metadata.`,
      sample:
        row.result_sample ||
        `${row.headline} Response includes action items, constraints, and verification notes.`,
      mediaUrl: row.result_media_url || undefined,
      mediaType:
        row.result_media_type === "image" || row.result_media_type === "video"
          ? row.result_media_type
          : undefined,
    },
    mcpPackage: `mcp://hireme/${slug}`,
    accent: row.accent || "from-[#533afd] to-[#6ee7f9]",
  };
}

export function sortAgentsNewestFirst(agents: Agent[]) {
  return agents
    .map((agent, index) => ({ agent, index }))
    .sort((a, b) => {
      const newestDelta = agentTimestampMs(b.agent) - agentTimestampMs(a.agent);
      if (newestDelta !== 0) return newestDelta;
      return a.index - b.index;
    })
    .map(({ agent }) => agent);
}

function agentTimestampMs(agent: Agent) {
  const timestamp = Date.parse(agent.createdAt || agent.updatedAt || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeLegacyTokenPrice(value: number | null) {
  if (!value) return 0;
  return value < 1 ? value * 1000 : value;
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
