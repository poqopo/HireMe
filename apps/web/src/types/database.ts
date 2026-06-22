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
          creator_info_url: string | null;
          team_role: string | null;
          listed_individually: boolean | null;
          team_id: string | null;
          team_slug: string | null;
          team_name: string | null;
          team_handle: string | null;
          team_owner_id: string | null;
          team_owner_name: string | null;
          team_headline: string | null;
          team_public_summary: string | null;
          team_accent: string | null;
          team_agent_count: number | null;
          team_billing_unit: string | null;
          team_base_price_usd: number | null;
          team_included_calls: number | null;
          team_overage_price_per_call_usd: number | null;
          team_billing_note: string | null;
          category: Database["public"]["Enums"]["agent_category"];
          status: Database["public"]["Enums"]["agent_status"];
          headline: string;
          public_summary: string;
          how_to_use: string | null;
          public_skills: string[];
          public_mcp_contract: string;
          current_version_id: string | null;
          accent: string | null;
          rating: number;
          historical_calls: number;
          median_latency_ms: number | null;
          avg_input_tokens: number | null;
          avg_output_tokens: number | null;
          active_user_count: number | null;
          result_title: string | null;
          result_summary: string | null;
          result_sample: string | null;
          result_media_url: string | null;
          result_media_type: string | null;
          price_per_mcp_call_usd: number | null;
          price_per_1m_tokens_usd: number | null;
          price_per_1m_tokens_sui: number | null;
          free_calls: number | null;
          max_budget_calls: number | null;
          created_at: string | null;
          updated_at: string | null;
          artifact_network: string | null;
          walrus_blob_id: string | null;
          walrus_sui_object_id: string | null;
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
        | "image";
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
