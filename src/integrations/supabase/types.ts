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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      dispute_cases: {
        Row: {
          admin_ruling: string | null
          against_user: string | null
          ai_analyzed_at: string | null
          ai_confidence: number | null
          ai_refund_pct: number | null
          ai_verdict: string | null
          blackmail_score: number | null
          created_at: string
          evidence: Json
          id: string
          kind: Database["public"]["Enums"]["case_kind"]
          order_id: string | null
          raised_by: string
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["case_status"]
          updated_at: string
        }
        Insert: {
          admin_ruling?: string | null
          against_user?: string | null
          ai_analyzed_at?: string | null
          ai_confidence?: number | null
          ai_refund_pct?: number | null
          ai_verdict?: string | null
          blackmail_score?: number | null
          created_at?: string
          evidence?: Json
          id?: string
          kind?: Database["public"]["Enums"]["case_kind"]
          order_id?: string | null
          raised_by: string
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          updated_at?: string
        }
        Update: {
          admin_ruling?: string | null
          against_user?: string | null
          ai_analyzed_at?: string | null
          ai_confidence?: number | null
          ai_refund_pct?: number | null
          ai_verdict?: string | null
          blackmail_score?: number | null
          created_at?: string
          evidence?: Json
          id?: string
          kind?: Database["public"]["Enums"]["case_kind"]
          order_id?: string | null
          raised_by?: string
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_cases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          category: Database["public"]["Enums"]["listing_category"]
          cover_key: string
          created_at: string
          id: string
          is_published: boolean
          orders_count: number
          owner_id: string | null
          price_usdt: number
          rating: number
          seller_ar: string
          seller_en: string
          tag_ar: string
          tag_en: string
          title_ar: string
          title_en: string
          updated_at: string
          verified: boolean
        }
        Insert: {
          category?: Database["public"]["Enums"]["listing_category"]
          cover_key?: string
          created_at?: string
          id?: string
          is_published?: boolean
          orders_count?: number
          owner_id?: string | null
          price_usdt?: number
          rating?: number
          seller_ar: string
          seller_en: string
          tag_ar?: string
          tag_en?: string
          title_ar: string
          title_en: string
          updated_at?: string
          verified?: boolean
        }
        Update: {
          category?: Database["public"]["Enums"]["listing_category"]
          cover_key?: string
          created_at?: string
          id?: string
          is_published?: boolean
          orders_count?: number
          owner_id?: string | null
          price_usdt?: number
          rating?: number
          seller_ar?: string
          seller_en?: string
          tag_ar?: string
          tag_en?: string
          title_ar?: string
          title_en?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "listings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nft_items: {
        Row: {
          collection: string
          created_at: string
          hue: number
          id: string
          is_published: boolean
          name: string
          price_usdt: number
          updated_at: string
        }
        Insert: {
          collection: string
          created_at?: string
          hue?: number
          id?: string
          is_published?: boolean
          name: string
          price_usdt?: number
          updated_at?: string
        }
        Update: {
          collection?: string
          created_at?: string
          hue?: number
          id?: string
          is_published?: boolean
          name?: string
          price_usdt?: number
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount_usdt: number
          auto_release_at: string | null
          auto_release_hours: number
          buyer_id: string
          category: string | null
          completed_at: string | null
          created_at: string
          deliverables: Json
          delivered_at: string | null
          delivery_days: number
          due_at: string | null
          escrow_locked: boolean
          id: string
          order_number: number
          platform_fee_usdt: number
          seller_id: string
          sow_terms: string
          status: Database["public"]["Enums"]["order_status"]
          title: string
          updated_at: string
        }
        Insert: {
          amount_usdt: number
          auto_release_at?: string | null
          auto_release_hours?: number
          buyer_id: string
          category?: string | null
          completed_at?: string | null
          created_at?: string
          deliverables?: Json
          delivered_at?: string | null
          delivery_days?: number
          due_at?: string | null
          escrow_locked?: boolean
          id?: string
          order_number?: number
          platform_fee_usdt?: number
          seller_id: string
          sow_terms?: string
          status?: Database["public"]["Enums"]["order_status"]
          title: string
          updated_at?: string
        }
        Update: {
          amount_usdt?: number
          auto_release_at?: string | null
          auto_release_hours?: number
          buyer_id?: string
          category?: string | null
          completed_at?: string | null
          created_at?: string
          deliverables?: Json
          delivered_at?: string | null
          delivery_days?: number
          due_at?: string | null
          escrow_locked?: boolean
          id?: string
          order_number?: number
          platform_fee_usdt?: number
          seller_id?: string
          sow_terms?: string
          status?: Database["public"]["Enums"]["order_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_view: string
          avatar_url: string | null
          bio: string | null
          completed_orders: number
          country: string | null
          created_at: string
          display_name: string
          id: string
          is_verified: boolean
          kyc_tier: Database["public"]["Enums"]["kyc_tier"]
          level: number
          rating: number
          referral_code: string
          referred_by: string | null
          terms_accepted_at: string | null
          updated_at: string
          xp_points: number
        }
        Insert: {
          active_view?: string
          avatar_url?: string | null
          bio?: string | null
          completed_orders?: number
          country?: string | null
          created_at?: string
          display_name?: string
          id: string
          is_verified?: boolean
          kyc_tier?: Database["public"]["Enums"]["kyc_tier"]
          level?: number
          rating?: number
          referral_code: string
          referred_by?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          xp_points?: number
        }
        Update: {
          active_view?: string
          avatar_url?: string | null
          bio?: string | null
          completed_orders?: number
          country?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_verified?: boolean
          kyc_tier?: Database["public"]["Enums"]["kyc_tier"]
          level?: number
          rating?: number
          referral_code?: string
          referred_by?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          xp_points?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_commissions: {
        Row: {
          commission_usdt: number
          created_at: string
          id: string
          order_id: string | null
          platform_fee_usdt: number
          referral_id: string
          referrer_id: string
        }
        Insert: {
          commission_usdt?: number
          created_at?: string
          id?: string
          order_id?: string | null
          platform_fee_usdt?: number
          referral_id: string
          referrer_id: string
        }
        Update: {
          commission_usdt?: number
          created_at?: string
          id?: string
          order_id?: string | null
          platform_fee_usdt?: number
          referral_id?: string
          referrer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commissions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          commission_rate: number
          created_at: string
          expires_at: string
          id: string
          is_active: boolean
          referred_id: string
          referrer_id: string
          starts_at: string
          total_earned_usdt: number
          updated_at: string
        }
        Insert: {
          commission_rate?: number
          created_at?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          referred_id: string
          referrer_id: string
          starts_at?: string
          total_earned_usdt?: number
          updated_at?: string
        }
        Update: {
          commission_rate?: number
          created_at?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          referred_id?: string
          referrer_id?: string
          starts_at?: string
          total_earned_usdt?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          address: string | null
          amount: number
          created_at: string
          fee: number
          id: string
          network: Database["public"]["Enums"]["usdt_network"] | null
          note: string | null
          order_id: string | null
          status: Database["public"]["Enums"]["tx_status"]
          tx_hash: string | null
          type: Database["public"]["Enums"]["tx_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          amount: number
          created_at?: string
          fee?: number
          id?: string
          network?: Database["public"]["Enums"]["usdt_network"] | null
          note?: string | null
          order_id?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          tx_hash?: string | null
          type: Database["public"]["Enums"]["tx_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          amount?: number
          created_at?: string
          fee?: number
          id?: string
          network?: Database["public"]["Enums"]["usdt_network"] | null
          note?: string | null
          order_id?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          tx_hash?: string | null
          type?: Database["public"]["Enums"]["tx_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          available_usdt: number
          created_at: string
          default_network: Database["public"]["Enums"]["usdt_network"]
          id: string
          lifetime_earned: number
          locked_usdt: number
          payout_address: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          available_usdt?: number
          created_at?: string
          default_network?: Database["public"]["Enums"]["usdt_network"]
          id?: string
          lifetime_earned?: number
          locked_usdt?: number
          payout_address?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          available_usdt?: number
          created_at?: string
          default_network?: Database["public"]["Enums"]["usdt_network"]
          id?: string
          lifetime_earned?: number
          locked_usdt?: number
          payout_address?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_release_escrow: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "buyer" | "seller" | "admin" | "hybrid" | "corporate"
      case_kind: "dispute" | "review_appeal"
      case_status: "open" | "ai_reviewed" | "resolved" | "rejected"
      kyc_tier: "tier0" | "tier1" | "tier2" | "tier3"
      listing_category: "freelance" | "course" | "product" | "gaming"
      order_status:
        | "pending"
        | "in_progress"
        | "delivered"
        | "completed"
        | "disputed"
        | "cancelled"
        | "refunded"
      tx_status: "pending" | "confirmed" | "failed" | "cancelled"
      tx_type:
        | "deposit"
        | "withdrawal"
        | "escrow_lock"
        | "escrow_release"
        | "escrow_refund"
        | "commission"
        | "referral_payout"
        | "adjustment"
      usdt_network: "trc20" | "bep20" | "polygon"
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
    Enums: {
      app_role: ["buyer", "seller", "admin", "hybrid", "corporate"],
      case_kind: ["dispute", "review_appeal"],
      case_status: ["open", "ai_reviewed", "resolved", "rejected"],
      kyc_tier: ["tier0", "tier1", "tier2", "tier3"],
      listing_category: ["freelance", "course", "product", "gaming"],
      order_status: [
        "pending",
        "in_progress",
        "delivered",
        "completed",
        "disputed",
        "cancelled",
        "refunded",
      ],
      tx_status: ["pending", "confirmed", "failed", "cancelled"],
      tx_type: [
        "deposit",
        "withdrawal",
        "escrow_lock",
        "escrow_release",
        "escrow_refund",
        "commission",
        "referral_payout",
        "adjustment",
      ],
      usdt_network: ["trc20", "bep20", "polygon"],
    },
  },
} as const
