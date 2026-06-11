export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: {
      agent_marketplace_cards: {
        Row: {
          id: string;
          slug: string;
          name: string;
          handle: string;
          creator_id: string;
          creator_name: string | null;
          category: Database["public"]["Enums"]["agent_category"];
          status: Database["public"]["Enums"]["agent_status"];
          headline: string;
          public_summary: string;
          public_skills: string[];
          public_mcp_contract: string;
          current_version_id: string | null;
          accent: string | null;
          rating: number;
          historical_calls: number;
          median_latency_ms: number | null;
          price_per_mcp_call_usd: number | null;
          free_calls: number | null;
          max_budget_calls: number | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      agent_category:
        | "research"
        | "code"
        | "data"
        | "security"
        | "growth"
        | "ops"
        | "other";
      agent_status: "draft" | "listed" | "private_beta" | "paused" | "archived";
      agent_version_status: "draft" | "sealed" | "published" | "deprecated";
      protected_artifact_kind:
        | "agent_folder"
        | "memory_snapshot"
        | "eval_bundle"
        | "adapter_bundle";
      hire_status: "active" | "suspended" | "expired" | "canceled";
      mcp_call_status: "authorized" | "completed" | "failed" | "refunded";
      payout_status: "pending" | "processing" | "paid" | "failed";
    };
    CompositeTypes: Record<string, never>;
  };
};
