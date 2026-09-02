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
      custom_subscription_passes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          duration_days: number
          expires_at: string
          id: string
          note: string | null
          tier: Database["public"]["Enums"]["account_tier"]
          updated_at: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          duration_days?: number
          expires_at?: string
          id?: string
          note?: string | null
          tier?: Database["public"]["Enums"]["account_tier"]
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          duration_days?: number
          expires_at?: string
          id?: string
          note?: string | null
          tier?: Database["public"]["Enums"]["account_tier"]
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
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
      kyc_submissions: {
        Row: {
          admin_note: string | null
          back_path: string | null
          created_at: string
          doc_type: string
          front_path: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          back_path?: string | null
          created_at?: string
          doc_type?: string
          front_path: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          back_path?: string | null
          created_at?: string
          doc_type?: string
          front_path?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      listings: {
        Row: {
          category: Database["public"]["Enums"]["listing_category"]
          cover_key: string
          created_at: string
          delivery_days: number
          id: string
          is_published: boolean
          language: string
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
          delivery_days?: number
          id?: string
          is_published?: boolean
          language?: string
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
          delivery_days?: number
          id?: string
          is_published?: boolean
          language?: string
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
      order_deliverables: {
        Row: {
          approval_state: string
          checksum: string | null
          created_at: string
          file_name: string
          id: string
          is_final: boolean
          mime_type: string
          order_id: string
          size_bytes: number
          storage_path: string
          updated_at: string
          uploader_id: string
        }
        Insert: {
          approval_state?: string
          checksum?: string | null
          created_at?: string
          file_name: string
          id?: string
          is_final?: boolean
          mime_type?: string
          order_id: string
          size_bytes?: number
          storage_path: string
          updated_at?: string
          uploader_id: string
        }
        Update: {
          approval_state?: string
          checksum?: string | null
          created_at?: string
          file_name?: string
          id?: string
          is_final?: boolean
          mime_type?: string
          order_id?: string
          size_bytes?: number
          storage_path?: string
          updated_at?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_deliverables_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          body: string
          created_at: string
          edited_at: string | null
          id: string
          lang: string
          order_id: string
          sender_id: string
          translations: Json
          updated_at: string
          version: number
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          lang?: string
          order_id: string
          sender_id: string
          translations?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          lang?: string
          order_id?: string
          sender_id?: string
          translations?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_milestones: {
        Row: {
          amount_usdt: number
          created_at: string
          id: string
          order_id: string
          pct: number
          position: number
          released_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          amount_usdt?: number
          created_at?: string
          id?: string
          order_id: string
          pct?: number
          position?: number
          released_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          amount_usdt?: number
          created_at?: string
          id?: string
          order_id?: string
          pct?: number
          position?: number
          released_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_milestones_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
          listing_id: string | null
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
          listing_id?: string | null
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
          listing_id?: string | null
          order_number?: number
          platform_fee_usdt?: number
          seller_id?: string
          sow_terms?: string
          status?: Database["public"]["Enums"]["order_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_governance_settings: {
        Row: {
          ai_confidence_threshold: number
          auto_release_hours: number
          autonomous_ai: boolean
          created_at: string
          id: boolean
          refill_daily_limit: number
          sla_hours_free: number
          sla_hours_pro: number
          updated_at: string
          updated_by: string | null
          warranty_escrow_pct: number
        }
        Insert: {
          ai_confidence_threshold?: number
          auto_release_hours?: number
          autonomous_ai?: boolean
          created_at?: string
          id?: boolean
          refill_daily_limit?: number
          sla_hours_free?: number
          sla_hours_pro?: number
          updated_at?: string
          updated_by?: string | null
          warranty_escrow_pct?: number
        }
        Update: {
          ai_confidence_threshold?: number
          auto_release_hours?: number
          autonomous_ai?: boolean
          created_at?: string
          id?: boolean
          refill_daily_limit?: number
          sla_hours_free?: number
          sla_hours_pro?: number
          updated_at?: string
          updated_by?: string | null
          warranty_escrow_pct?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_tier: Database["public"]["Enums"]["account_tier"]
          active_view: string
          avatar_url: string | null
          bio: string | null
          completed_orders: number
          country: string | null
          created_at: string
          display_name: string
          frozen_at: string | null
          frozen_reason: string | null
          id: string
          is_frozen: boolean
          is_verified: boolean
          kyc_status: string
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
          account_tier?: Database["public"]["Enums"]["account_tier"]
          active_view?: string
          avatar_url?: string | null
          bio?: string | null
          completed_orders?: number
          country?: string | null
          created_at?: string
          display_name?: string
          frozen_at?: string | null
          frozen_reason?: string | null
          id: string
          is_frozen?: boolean
          is_verified?: boolean
          kyc_status?: string
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
          account_tier?: Database["public"]["Enums"]["account_tier"]
          active_view?: string
          avatar_url?: string | null
          bio?: string | null
          completed_orders?: number
          country?: string | null
          created_at?: string
          display_name?: string
          frozen_at?: string | null
          frozen_reason?: string | null
          id?: string
          is_frozen?: boolean
          is_verified?: boolean
          kyc_status?: string
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
      rate_limit_events: {
        Row: {
          action: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
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
      security_incidents: {
        Row: {
          created_at: string
          detail: string
          froze_account: boolean
          id: string
          kind: Database["public"]["Enums"]["incident_kind"]
          meta: Json
          resolved: boolean
          severity: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string
          froze_account?: boolean
          id?: string
          kind: Database["public"]["Enums"]["incident_kind"]
          meta?: Json
          resolved?: boolean
          severity?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string
          froze_account?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["incident_kind"]
          meta?: Json
          resolved?: boolean
          severity?: string
          user_id?: string | null
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
      withdrawal_requests: {
        Row: {
          address: string
          admin_note: string | null
          amount_usdt: number
          created_at: string
          fee_usdt: number
          id: string
          net_usdt: number
          network: Database["public"]["Enums"]["usdt_network"]
          process_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_flags: Json
          risk_score: number
          sla_hours: number
          status: Database["public"]["Enums"]["withdrawal_status"]
          tier: Database["public"]["Enums"]["account_tier"]
          transaction_id: string | null
          tx_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          admin_note?: string | null
          amount_usdt: number
          created_at?: string
          fee_usdt?: number
          id?: string
          net_usdt?: number
          network?: Database["public"]["Enums"]["usdt_network"]
          process_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_flags?: Json
          risk_score?: number
          sla_hours?: number
          status?: Database["public"]["Enums"]["withdrawal_status"]
          tier?: Database["public"]["Enums"]["account_tier"]
          transaction_id?: string | null
          tx_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          admin_note?: string | null
          amount_usdt?: number
          created_at?: string
          fee_usdt?: number
          id?: string
          net_usdt?: number
          network?: Database["public"]["Enums"]["usdt_network"]
          process_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_flags?: Json
          risk_score?: number
          sla_hours?: number
          status?: Database["public"]["Enums"]["withdrawal_status"]
          tier?: Database["public"]["Enums"]["account_tier"]
          transaction_id?: string | null
          tx_hash?: string | null
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
      admin_resolve_dispute: {
        Args: { _action: string; _case_id: string; _ruling?: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "dispute_cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_review_kyc: {
        Args: { _approve: boolean; _note?: string; _submission_id: string }
        Returns: {
          admin_note: string | null
          back_path: string | null
          created_at: string
          doc_type: string
          front_path: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "kyc_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      auto_release_escrow: { Args: never; Returns: number }
      check_rate_limit: {
        Args: { _action: string; _max: number; _window: string }
        Returns: number
      }
      confirm_deposit: {
        Args: { _tx_hash?: string; _tx_id: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "wallet_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_deposit: {
        Args: {
          _address?: string
          _amount: number
          _network: Database["public"]["Enums"]["usdt_network"]
        }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "wallet_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_order_party: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      log_security_event: {
        Args: {
          _detail: string
          _kind: Database["public"]["Enums"]["incident_kind"]
          _meta?: Json
        }
        Returns: string
      }
      process_withdrawal_queue: { Args: never; Returns: number }
      redeem_subscription_pass: {
        Args: { _code: string }
        Returns: {
          code: string
          created_at: string
          created_by: string | null
          duration_days: number
          expires_at: string
          id: string
          note: string | null
          tier: Database["public"]["Enums"]["account_tier"]
          updated_at: string
          used_at: string | null
          used_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "custom_subscription_passes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_withdrawal: {
        Args: {
          _address: string
          _amount: number
          _network: Database["public"]["Enums"]["usdt_network"]
        }
        Returns: {
          address: string
          admin_note: string | null
          amount_usdt: number
          created_at: string
          fee_usdt: number
          id: string
          net_usdt: number
          network: Database["public"]["Enums"]["usdt_network"]
          process_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_flags: Json
          risk_score: number
          sla_hours: number
          status: Database["public"]["Enums"]["withdrawal_status"]
          tier: Database["public"]["Enums"]["account_tier"]
          transaction_id: string | null
          tx_hash: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "withdrawal_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_withdrawal: {
        Args: {
          _action: string
          _id: string
          _note?: string
          _tx_hash?: string
        }
        Returns: {
          address: string
          admin_note: string | null
          amount_usdt: number
          created_at: string
          fee_usdt: number
          id: string
          net_usdt: number
          network: Database["public"]["Enums"]["usdt_network"]
          process_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_flags: Json
          risk_score: number
          sla_hours: number
          status: Database["public"]["Enums"]["withdrawal_status"]
          tier: Database["public"]["Enums"]["account_tier"]
          transaction_id: string | null
          tx_hash: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "withdrawal_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_account_frozen: {
        Args: { _frozen: boolean; _reason?: string; _user_id: string }
        Returns: undefined
      }
      submit_kyc: {
        Args: { _back_path?: string; _doc_type: string; _front_path: string }
        Returns: {
          admin_note: string | null
          back_path: string | null
          created_at: string
          doc_type: string
          front_path: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "kyc_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      account_tier: "free" | "pro" | "corporate"
      app_role: "buyer" | "seller" | "admin" | "hybrid" | "corporate"
      case_kind: "dispute" | "review_appeal"
      case_status: "open" | "ai_reviewed" | "resolved" | "rejected"
      incident_kind:
        | "withdrawal_spike"
        | "large_withdrawal"
        | "admin_access_attempt"
        | "rate_limit"
        | "frozen_account_attempt"
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
      withdrawal_status:
        | "queued"
        | "auto_approved"
        | "manual_review"
        | "processing"
        | "paid"
        | "rejected"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_tier: ["free", "pro", "corporate"],
      app_role: ["buyer", "seller", "admin", "hybrid", "corporate"],
      case_kind: ["dispute", "review_appeal"],
      case_status: ["open", "ai_reviewed", "resolved", "rejected"],
      incident_kind: [
        "withdrawal_spike",
        "large_withdrawal",
        "admin_access_attempt",
        "rate_limit",
        "frozen_account_attempt",
      ],
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
      withdrawal_status: [
        "queued",
        "auto_approved",
        "manual_review",
        "processing",
        "paid",
        "rejected",
      ],
    },
  },
} as const
