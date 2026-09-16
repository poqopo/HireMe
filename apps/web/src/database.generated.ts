export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_access: {
        Row: {
          access_mode: string
          agent_id: string
          created_at: string
          remaining_runs: number | null
          renews_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_mode: string
          agent_id: string
          created_at?: string
          remaining_runs?: number | null
          renews_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_mode?: string
          agent_id?: string
          created_at?: string
          remaining_runs?: number | null
          renews_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_access_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_versions: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          manifest: Json
          package_ciphertext_digest: string | null
          package_digest: string
          package_encryption: Json
          package_size_bytes: number | null
          published_at: string | null
          release_notes: string
          runtime_ref: string
          version_number: number
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          manifest?: Json
          package_ciphertext_digest?: string | null
          package_digest: string
          package_encryption?: Json
          package_size_bytes?: number | null
          published_at?: string | null
          release_notes?: string
          runtime_ref: string
          version_number: number
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          manifest?: Json
          package_ciphertext_digest?: string | null
          package_digest?: string
          package_encryption?: Json
          package_size_bytes?: number | null
          published_at?: string | null
          release_notes?: string
          runtime_ref?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_versions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          category: string
          cover_image_url: string | null
          created_at: string
          creator_id: string
          current_version: number | null
          headline: string
          id: string
          name: string
          pricing: Json
          public_design_contract: Json
          public_skills: string[]
          public_summary: string
          result_types: string[]
          slug: string
          status: string
          updated_at: string
          visibility: string
        }
        Insert: {
          category?: string
          cover_image_url?: string | null
          created_at?: string
          creator_id: string
          current_version?: number | null
          headline?: string
          id?: string
          name: string
          pricing?: Json
          public_design_contract?: Json
          public_skills?: string[]
          public_summary?: string
          result_types?: string[]
          slug: string
          status?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          category?: string
          cover_image_url?: string | null
          created_at?: string
          creator_id?: string
          current_version?: number | null
          headline?: string
          id?: string
          name?: string
          pricing?: Json
          public_design_contract?: Json
          public_skills?: string[]
          public_summary?: string
          result_types?: string[]
          slug?: string
          status?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_current_version_fkey"
            columns: ["id", "current_version"]
            isOneToOne: false
            referencedRelation: "agent_versions"
            referencedColumns: ["agent_id", "version_number"]
          },
        ]
      }
      conversations: {
        Row: {
          agent_id: string | null
          created_at: string
          id: string
          model: string | null
          owner_id: string
          provider: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          id?: string
          model?: string | null
          owner_id: string
          provider?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          id?: string
          model?: string | null
          owner_id?: string
          provider?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          artifacts: Json
          attachments: Json
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          role: string
        }
        Insert: {
          artifacts?: Json
          attachments?: Json
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          role: string
        }
        Update: {
          artifacts?: Json
          attachments?: Json
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_setup_completed: boolean
          avatar_url: string | null
          created_at: string
          default_model: string | null
          default_provider: string
          display_name: string
          id: string
          locale: string
          updated_at: string
        }
        Insert: {
          ai_setup_completed?: boolean
          avatar_url?: string | null
          created_at?: string
          default_model?: string | null
          default_provider?: string
          display_name?: string
          id: string
          locale?: string
          updated_at?: string
        }
        Update: {
          ai_setup_completed?: boolean
          avatar_url?: string | null
          created_at?: string
          default_model?: string | null
          default_provider?: string
          display_name?: string
          id?: string
          locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      runs: {
        Row: {
          agent_id: string | null
          charged_minor: number
          completed_at: string | null
          conversation_id: string | null
          created_at: string
          creator_earnings_minor: number
          creator_id: string | null
          currency: string
          error_code: string | null
          id: string
          input_tokens: number
          model: string | null
          output_tokens: number
          provider: string
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          charged_minor?: number
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          creator_earnings_minor?: number
          creator_id?: string | null
          currency?: string
          error_code?: string | null
          id?: string
          input_tokens?: number
          model?: string | null
          output_tokens?: number
          provider: string
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          charged_minor?: number
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          creator_earnings_minor?: number
          creator_id?: string | null
          currency?: string
          error_code?: string | null
          id?: string
          input_tokens?: number
          model?: string | null
          output_tokens?: number
          provider?: string
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_agent_package_runtime_secret: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
