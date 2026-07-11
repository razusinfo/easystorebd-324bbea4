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
      admin_audit_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          notes: string | null
          role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          notes?: string | null
          role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          target_user_id?: string
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          related_id: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          related_id?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          related_id?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      courier_partner_settings: {
        Row: {
          api_key: string | null
          api_secret: string | null
          base_url: string | null
          created_at: string
          id: string
          is_active: boolean
          partner: string
          pickup_address: string | null
          pickup_zone: string | null
          status_mapping: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key?: string | null
          api_secret?: string | null
          base_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          partner: string
          pickup_address?: string | null
          pickup_zone?: string | null
          status_mapping?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string | null
          api_secret?: string | null
          base_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          partner?: string
          pickup_address?: string | null
          pickup_zone?: string | null
          status_mapping?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_domains: {
        Row: {
          created_at: string
          dns_target: string
          domain: string
          id: string
          last_checked_at: string | null
          last_error: string | null
          owner_id: string
          ssl_issued_at: string | null
          status: string
          store_id: string
          updated_at: string
          verification_token: string
        }
        Insert: {
          created_at?: string
          dns_target?: string
          domain: string
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          owner_id: string
          ssl_issued_at?: string | null
          status?: string
          store_id: string
          updated_at?: string
          verification_token: string
        }
        Update: {
          created_at?: string
          dns_target?: string
          domain?: string
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          owner_id?: string
          ssl_issued_at?: string | null
          status?: string
          store_id?: string
          updated_at?: string
          verification_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_domains_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address_line: string
          city: string | null
          country: string
          created_at: string
          full_name: string
          id: string
          is_default_billing: boolean
          is_default_shipping: boolean
          phone: string
          postal_code: string | null
          region: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line: string
          city?: string | null
          country?: string
          created_at?: string
          full_name: string
          id?: string
          is_default_billing?: boolean
          is_default_shipping?: boolean
          phone: string
          postal_code?: string | null
          region?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line?: string
          city?: string | null
          country?: string
          created_at?: string
          full_name?: string
          id?: string
          is_default_billing?: boolean
          is_default_shipping?: boolean
          phone?: string
          postal_code?: string | null
          region?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          created_at: string
          delivery_eta: string
          email_enabled: boolean
          from_email: string
          from_name: string
          id: boolean
          notify_customer: boolean
          notify_reseller: boolean
          reply_to: string | null
          sms_enabled: boolean
          statuses_email: string[]
          statuses_sms: string[]
          updated_at: string
          whatsapp_webhook_url: string | null
        }
        Insert: {
          created_at?: string
          delivery_eta?: string
          email_enabled?: boolean
          from_email?: string
          from_name?: string
          id?: boolean
          notify_customer?: boolean
          notify_reseller?: boolean
          reply_to?: string | null
          sms_enabled?: boolean
          statuses_email?: string[]
          statuses_sms?: string[]
          updated_at?: string
          whatsapp_webhook_url?: string | null
        }
        Update: {
          created_at?: string
          delivery_eta?: string
          email_enabled?: boolean
          from_email?: string
          from_name?: string
          id?: boolean
          notify_customer?: boolean
          notify_reseller?: boolean
          reply_to?: string | null
          sms_enabled?: boolean
          statuses_email?: string[]
          statuses_sms?: string[]
          updated_at?: string
          whatsapp_webhook_url?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          name: string
          order_id: string
          price: number
          product_id: string | null
          quantity: number
          subtotal: number
          variant_label: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_id: string
          price?: number
          product_id?: string | null
          quantity?: number
          subtotal?: number
          variant_label?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_id?: string
          price?: number
          product_id?: string | null
          quantity?: number
          subtotal?: number
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_requests: {
        Row: {
          created_at: string
          customer_user_id: string | null
          id: string
          order_id: string
          reason: string
          resolution_notes: string | null
          status: Database["public"]["Enums"]["order_request_status"]
          store_id: string
          type: Database["public"]["Enums"]["order_request_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_user_id?: string | null
          id?: string
          order_id: string
          reason: string
          resolution_notes?: string | null
          status?: Database["public"]["Enums"]["order_request_status"]
          store_id: string
          type: Database["public"]["Enums"]["order_request_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_user_id?: string | null
          id?: string
          order_id?: string
          reason?: string
          resolution_notes?: string | null
          status?: Database["public"]["Enums"]["order_request_status"]
          store_id?: string
          type?: Database["public"]["Enums"]["order_request_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_tracking_events: {
        Row: {
          courier_provider: string | null
          courier_status: string | null
          created_at: string
          event_type: string
          id: string
          new_status: string | null
          note: string | null
          old_status: string | null
          order_id: string
          source: string
          tracking_id: string | null
          tracking_url: string | null
        }
        Insert: {
          courier_provider?: string | null
          courier_status?: string | null
          created_at?: string
          event_type: string
          id?: string
          new_status?: string | null
          note?: string | null
          old_status?: string | null
          order_id: string
          source?: string
          tracking_id?: string | null
          tracking_url?: string | null
        }
        Update: {
          courier_provider?: string | null
          courier_status?: string | null
          created_at?: string
          event_type?: string
          id?: string
          new_status?: string | null
          note?: string | null
          old_status?: string | null
          order_id?: string
          source?: string
          tracking_id?: string | null
          tracking_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_tracking_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          courier_provider: string | null
          courier_status: string | null
          created_at: string
          customer_address: string | null
          customer_name: string
          customer_phone: string
          customer_user_id: string | null
          delivered_at: string | null
          delivery_charge: number
          discount: number
          id: string
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          shipped_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          total: number
          tracking_id: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          courier_provider?: string | null
          courier_status?: string | null
          created_at?: string
          customer_address?: string | null
          customer_name: string
          customer_phone: string
          customer_user_id?: string | null
          delivered_at?: string | null
          delivery_charge?: number
          discount?: number
          id?: string
          notes?: string | null
          order_number: string
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal?: number
          total?: number
          tracking_id?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          courier_provider?: string | null
          courier_status?: string | null
          created_at?: string
          customer_address?: string | null
          customer_name?: string
          customer_phone?: string
          customer_user_id?: string | null
          delivered_at?: string | null
          delivery_charge?: number
          discount?: number
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          subtotal?: number
          total?: number
          tracking_id?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          account_name: string
          account_number: string
          admin_note: string | null
          amount: number
          bank_name: string | null
          branch_name: string | null
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payout_method"]
          processed_at: string | null
          processed_by: string | null
          reference: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          admin_note?: string | null
          amount: number
          bank_name?: string | null
          branch_name?: string | null
          created_at?: string
          id?: string
          method: Database["public"]["Enums"]["payout_method"]
          processed_at?: string | null
          processed_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          admin_note?: string | null
          amount?: number
          bank_name?: string | null
          branch_name?: string | null
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payout_method"]
          processed_at?: string | null
          processed_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      phone_otps: {
        Row: {
          attempts: number
          code_hash: string
          consumed: boolean
          created_at: string
          expires_at: string
          id: string
          phone: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed?: boolean
          created_at?: string
          expires_at: string
          id?: string
          phone: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed?: boolean
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
        }
        Relationships: []
      }
      platform_domain_setup: {
        Row: {
          cloudflare_added: boolean
          current_step: number
          dns_records_added: boolean
          id: number
          lovable_wildcard_connected: boolean
          nameservers_updated: boolean
          notes: string | null
          ssl_mode_set: boolean
          updated_at: string
        }
        Insert: {
          cloudflare_added?: boolean
          current_step?: number
          dns_records_added?: boolean
          id?: number
          lovable_wildcard_connected?: boolean
          nameservers_updated?: boolean
          notes?: string | null
          ssl_mode_set?: boolean
          updated_at?: string
        }
        Update: {
          cloudflare_added?: boolean
          current_step?: number
          dns_records_added?: boolean
          id?: number
          lovable_wildcard_connected?: boolean
          nameservers_updated?: boolean
          notes?: string | null
          ssl_mode_set?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      product_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["product_status"] | null
          notes: string | null
          old_status: Database["public"]["Enums"]["product_status"] | null
          product_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["product_status"] | null
          notes?: string | null
          old_status?: Database["public"]["Enums"]["product_status"] | null
          product_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["product_status"] | null
          notes?: string | null
          old_status?: Database["public"]["Enums"]["product_status"] | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_audit_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          banner_url: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          parent_id: string | null
          slug: string | null
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          parent_id?: string | null
          slug?: string | null
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          parent_id?: string | null
          slug?: string | null
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_category_assignments: {
        Row: {
          category_id: string
          created_at: string
          product_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          product_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_category_assignments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_assignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_details: {
        Row: {
          created_at: string
          id: string
          key: string
          position: number
          product_id: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          position?: number
          product_id: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          position?: number
          product_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_details_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_requests: {
        Row: {
          admin_notes: string | null
          category: string | null
          created_at: string
          description: string | null
          id: string
          images: string[]
          name: string
          price: number
          published_reseller_product_id: string | null
          requested_by: string
          reseller_price: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[]
          name: string
          price?: number
          published_reseller_product_id?: string | null
          requested_by: string
          reseller_price?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[]
          name?: string
          price?: number
          published_reseller_product_id?: string | null
          requested_by?: string
          reseller_price?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_requests_published_reseller_product_id_fkey"
            columns: ["published_reseller_product_id"]
            isOneToOne: false
            referencedRelation: "reseller_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          product_id: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          product_id: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          product_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          add_to_reseller: boolean
          brand: string | null
          buying_price: number | null
          category_id: string | null
          condition: string
          created_at: string
          default_delivery_charge: number | null
          description: string | null
          gallery_urls: string[]
          height_cm: number | null
          id: string
          image_url: string | null
          initial_sold_count: number
          is_out_of_stock: boolean | null
          is_resellable: boolean | null
          length_cm: number | null
          name: string
          price: number
          product_serial: string | null
          regular_price: number | null
          reseller_price: number | null
          short_description: string | null
          sku: string | null
          source_reseller_product_id: string | null
          specific_delivery_charges: Json
          status: Database["public"]["Enums"]["product_status"]
          stock: number
          store_id: string
          unit_name: string | null
          updated_at: string
          use_default_delivery: boolean
          video_url: string | null
          warranty: string | null
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          add_to_reseller?: boolean
          brand?: string | null
          buying_price?: number | null
          category_id?: string | null
          condition?: string
          created_at?: string
          default_delivery_charge?: number | null
          description?: string | null
          gallery_urls?: string[]
          height_cm?: number | null
          id?: string
          image_url?: string | null
          initial_sold_count?: number
          is_out_of_stock?: boolean | null
          is_resellable?: boolean | null
          length_cm?: number | null
          name: string
          price: number
          product_serial?: string | null
          regular_price?: number | null
          reseller_price?: number | null
          short_description?: string | null
          sku?: string | null
          source_reseller_product_id?: string | null
          specific_delivery_charges?: Json
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          store_id: string
          unit_name?: string | null
          updated_at?: string
          use_default_delivery?: boolean
          video_url?: string | null
          warranty?: string | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          add_to_reseller?: boolean
          brand?: string | null
          buying_price?: number | null
          category_id?: string | null
          condition?: string
          created_at?: string
          default_delivery_charge?: number | null
          description?: string | null
          gallery_urls?: string[]
          height_cm?: number | null
          id?: string
          image_url?: string | null
          initial_sold_count?: number
          is_out_of_stock?: boolean | null
          is_resellable?: boolean | null
          length_cm?: number | null
          name?: string
          price?: number
          product_serial?: string | null
          regular_price?: number | null
          reseller_price?: number | null
          short_description?: string | null
          sku?: string | null
          source_reseller_product_id?: string | null
          specific_delivery_charges?: Json
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          store_id?: string
          unit_name?: string | null
          updated_at?: string
          use_default_delivery?: boolean
          video_url?: string | null
          warranty?: string | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_source_reseller_product_id_fkey"
            columns: ["source_reseller_product_id"]
            isOneToOne: false
            referencedRelation: "reseller_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
          store: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name?: string
          store?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          store?: string
          updated_at?: string
        }
        Relationships: []
      }
      reseller_category_mappings: {
        Row: {
          created_at: string
          fallback_value: string | null
          id: string
          notes: string | null
          payload_path: string | null
          priority: number
          source: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          fallback_value?: string | null
          id?: string
          notes?: string | null
          payload_path?: string | null
          priority?: number
          source?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          fallback_value?: string | null
          id?: string
          notes?: string | null
          payload_path?: string | null
          priority?: number
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reseller_marketplace_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string
          error: string | null
          id: string
          metadata: Json
          product_id: string | null
          success: boolean
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json
          product_id?: string | null
          success?: boolean
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json
          product_id?: string | null
          success?: boolean
        }
        Relationships: []
      }
      reseller_order_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          new_status: string | null
          old_status: string | null
          order_id: string
          tracking_id: string | null
          tracking_url: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          new_status?: string | null
          old_status?: string | null
          order_id: string
          tracking_id?: string | null
          tracking_url?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          new_status?: string | null
          old_status?: string | null
          order_id?: string
          tracking_id?: string | null
          tracking_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reseller_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "reseller_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_orders: {
        Row: {
          courier_provider: string | null
          courier_status: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          customer_price: number | null
          delivered_at: string | null
          id: string
          notes: string | null
          original_price: number
          product_name: string
          profit_margin: number
          quantity: number
          reseller_id: string
          reseller_price: number
          reseller_product_id: string
          settled_at: string | null
          shipping_address: string
          shipping_requested: boolean
          source: string | null
          source_order_id: string | null
          source_order_item_id: string | null
          source_store_id: string | null
          status: Database["public"]["Enums"]["reseller_order_status"]
          tracking_id: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          courier_provider?: string | null
          courier_status?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_price?: number | null
          delivered_at?: string | null
          id?: string
          notes?: string | null
          original_price?: number
          product_name: string
          profit_margin?: number
          quantity: number
          reseller_id: string
          reseller_price?: number
          reseller_product_id: string
          settled_at?: string | null
          shipping_address: string
          shipping_requested?: boolean
          source?: string | null
          source_order_id?: string | null
          source_order_item_id?: string | null
          source_store_id?: string | null
          status?: Database["public"]["Enums"]["reseller_order_status"]
          tracking_id?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          courier_provider?: string | null
          courier_status?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_price?: number | null
          delivered_at?: string | null
          id?: string
          notes?: string | null
          original_price?: number
          product_name?: string
          profit_margin?: number
          quantity?: number
          reseller_id?: string
          reseller_price?: number
          reseller_product_id?: string
          settled_at?: string | null
          shipping_address?: string
          shipping_requested?: boolean
          source?: string | null
          source_order_id?: string | null
          source_order_item_id?: string | null
          source_store_id?: string | null
          status?: Database["public"]["Enums"]["reseller_order_status"]
          tracking_id?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_orders_reseller_product_id_fkey"
            columns: ["reseller_product_id"]
            isOneToOne: false
            referencedRelation: "reseller_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_orders_source_order_id_fkey"
            columns: ["source_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_orders_source_order_item_id_fkey"
            columns: ["source_order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_orders_source_store_id_fkey"
            columns: ["source_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_products: {
        Row: {
          category: string | null
          category_missing_reason: string | null
          created_at: string
          description: string | null
          external_id: string
          gallery_urls: string[]
          id: string
          image: string | null
          image_overridden: boolean
          image_sync_attempted_at: string | null
          image_sync_error: string | null
          image_sync_status: string
          image_url: string | null
          is_out_of_stock: boolean | null
          name: string
          original_product_id: string | null
          payload: Json | null
          price: number
          price_overridden: boolean
          reseller_price: number | null
          source: string | null
          stock: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          category_missing_reason?: string | null
          created_at?: string
          description?: string | null
          external_id: string
          gallery_urls?: string[]
          id?: string
          image?: string | null
          image_overridden?: boolean
          image_sync_attempted_at?: string | null
          image_sync_error?: string | null
          image_sync_status?: string
          image_url?: string | null
          is_out_of_stock?: boolean | null
          name: string
          original_product_id?: string | null
          payload?: Json | null
          price?: number
          price_overridden?: boolean
          reseller_price?: number | null
          source?: string | null
          stock?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          category_missing_reason?: string | null
          created_at?: string
          description?: string | null
          external_id?: string
          gallery_urls?: string[]
          id?: string
          image?: string | null
          image_overridden?: boolean
          image_sync_attempted_at?: string | null
          image_sync_error?: string | null
          image_sync_status?: string
          image_url?: string | null
          is_out_of_stock?: boolean | null
          name?: string
          original_product_id?: string | null
          payload?: Json | null
          price?: number
          price_overridden?: boolean
          reseller_price?: number | null
          source?: string | null
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_products_original_product_id_fkey"
            columns: ["original_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_sync_webhook_logs: {
        Row: {
          error: string | null
          external_id: string | null
          http_status: number
          id: string
          payload: Json | null
          received_at: string
          secret_valid: boolean
          source: string | null
          source_ip: string | null
        }
        Insert: {
          error?: string | null
          external_id?: string | null
          http_status: number
          id?: string
          payload?: Json | null
          received_at?: string
          secret_valid?: boolean
          source?: string | null
          source_ip?: string | null
        }
        Update: {
          error?: string | null
          external_id?: string | null
          http_status?: number
          id?: string
          payload?: Json | null
          received_at?: string
          secret_valid?: boolean
          source?: string | null
          source_ip?: string | null
        }
        Relationships: []
      }
      reseller_wallets: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          asset_version: number
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          facebook_url: string | null
          favicon_url: string | null
          id: string
          instagram_url: string | null
          logo_url: string | null
          logo_url_dark: string | null
          low_stock_threshold: number
          primary_color: string
          sidebar_categories: Json
          updated_at: string
          updated_by: string | null
          whatsapp_url: string | null
        }
        Insert: {
          asset_version?: number
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          facebook_url?: string | null
          favicon_url?: string | null
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          logo_url_dark?: string | null
          low_stock_threshold?: number
          primary_color?: string
          sidebar_categories?: Json
          updated_at?: string
          updated_by?: string | null
          whatsapp_url?: string | null
        }
        Update: {
          asset_version?: number
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          facebook_url?: string | null
          favicon_url?: string | null
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          logo_url_dark?: string | null
          low_stock_threshold?: number
          primary_color?: string
          sidebar_categories?: Json
          updated_at?: string
          updated_by?: string | null
          whatsapp_url?: string | null
        }
        Relationships: []
      }
      sms_settings: {
        Row: {
          app_name: string
          created_at: string
          id: boolean
          otp_template: string
          signature: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          app_name?: string
          created_at?: string
          id?: boolean
          otp_template?: string
          signature?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          app_name?: string
          created_at?: string
          id?: boolean
          otp_template?: string
          signature?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      stores: {
        Row: {
          address: string | null
          category: Database["public"]["Enums"]["store_category"]
          contact_email: string | null
          created_at: string
          custom_domain: string | null
          facebook_url: string | null
          id: string
          instagram_url: string | null
          logo_url: string | null
          name: string
          owner_user_id: string
          phone: string | null
          plan_tier: string
          published: boolean
          published_at: string | null
          shop_settings: Json
          slug: string | null
          tagline: string | null
          template: Database["public"]["Enums"]["store_template"]
          template_settings: Json
          updated_at: string
          website_url: string | null
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          category: Database["public"]["Enums"]["store_category"]
          contact_email?: string | null
          created_at?: string
          custom_domain?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          name: string
          owner_user_id: string
          phone?: string | null
          plan_tier?: string
          published?: boolean
          published_at?: string | null
          shop_settings?: Json
          slug?: string | null
          tagline?: string | null
          template: Database["public"]["Enums"]["store_template"]
          template_settings?: Json
          updated_at?: string
          website_url?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          category?: Database["public"]["Enums"]["store_category"]
          contact_email?: string | null
          created_at?: string
          custom_domain?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          name?: string
          owner_user_id?: string
          phone?: string | null
          plan_tier?: string
          published?: boolean
          published_at?: string | null
          shop_settings?: Json
          slug?: string | null
          tagline?: string | null
          template?: Database["public"]["Enums"]["store_template"]
          template_settings?: Json
          updated_at?: string
          website_url?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          read_at: string | null
          receiver_id: string | null
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          receiver_id?: string | null
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          receiver_id?: string | null
          sender_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          related_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_reseller_settings: {
        Row: {
          created_at: string
          custom_description: string | null
          custom_image: string | null
          custom_price: number | null
          id: string
          reseller_product_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_description?: string | null
          custom_image?: string | null
          custom_price?: number | null
          id?: string
          reseller_product_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_description?: string | null
          custom_image?: string | null
          custom_price?: number | null
          id?: string
          reseller_product_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_reseller_settings_reseller_product_id_fkey"
            columns: ["reseller_product_id"]
            isOneToOne: false
            referencedRelation: "reseller_products"
            referencedColumns: ["id"]
          },
        ]
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
      wallet_ledger: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          entry_type: string
          id: string
          metadata: Json | null
          related_order_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description?: string | null
          entry_type: string
          id?: string
          metadata?: Json | null
          related_order_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          entry_type?: string
          id?: string
          metadata?: Json | null
          related_order_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_assign_role:
        | {
            Args: {
              _notes?: string
              _role: Database["public"]["Enums"]["app_role"]
              _target_user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _actor_id?: string
              _notes?: string
              _role: Database["public"]["Enums"]["app_role"]
              _target_user_id: string
            }
            Returns: undefined
          }
      admin_list_audit_logs: {
        Args: { _limit?: number }
        Returns: {
          action: string
          actor_email: string
          actor_id: string
          created_at: string
          id: string
          notes: string
          role: string
          target_email: string
          target_user_id: string
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          last_sign_in_at: string
          roles: string[]
          user_id: string
        }[]
      }
      admin_revoke_reseller_product: {
        Args: { _reason?: string; _reseller_product_id: string }
        Returns: undefined
      }
      admin_revoke_role:
        | {
            Args: {
              _notes?: string
              _role: Database["public"]["Enums"]["app_role"]
              _target_user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _actor_id?: string
              _notes?: string
              _role: Database["public"]["Enums"]["app_role"]
              _target_user_id: string
            }
            Returns: undefined
          }
      apply_courier_order_status: {
        Args: {
          _external_status: string
          _order_id: string
          _provider: string
          _tracking_id?: string
          _tracking_url?: string
        }
        Returns: {
          courier_provider: string | null
          courier_status: string | null
          created_at: string
          customer_address: string | null
          customer_name: string
          customer_phone: string
          customer_user_id: string | null
          delivered_at: string | null
          delivery_charge: number
          discount: number
          id: string
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          shipped_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          total: number
          tracking_id: string | null
          tracking_url: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_order_stock_decrement: {
        Args: { _order_id: string }
        Returns: undefined
      }
      get_owner_products_full: {
        Args: { _store_id: string }
        Returns: {
          add_to_reseller: boolean
          brand: string | null
          buying_price: number | null
          category_id: string | null
          condition: string
          created_at: string
          default_delivery_charge: number | null
          description: string | null
          gallery_urls: string[]
          height_cm: number | null
          id: string
          image_url: string | null
          initial_sold_count: number
          is_out_of_stock: boolean | null
          is_resellable: boolean | null
          length_cm: number | null
          name: string
          price: number
          product_serial: string | null
          regular_price: number | null
          reseller_price: number | null
          short_description: string | null
          sku: string | null
          source_reseller_product_id: string | null
          specific_delivery_charges: Json
          status: Database["public"]["Enums"]["product_status"]
          stock: number
          store_id: string
          unit_name: string | null
          updated_at: string
          use_default_delivery: boolean
          video_url: string | null
          warranty: string | null
          weight_kg: number | null
          width_cm: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_reseller_order_delivered: {
        Args: {
          _external_status?: string
          _order_id: string
          _provider?: string
        }
        Returns: {
          courier_provider: string | null
          courier_status: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          customer_price: number | null
          delivered_at: string | null
          id: string
          notes: string | null
          original_price: number
          product_name: string
          profit_margin: number
          quantity: number
          reseller_id: string
          reseller_price: number
          reseller_product_id: string
          settled_at: string | null
          shipping_address: string
          shipping_requested: boolean
          source: string | null
          source_order_id: string | null
          source_order_item_id: string | null
          source_store_id: string | null
          status: Database["public"]["Enums"]["reseller_order_status"]
          tracking_id: string | null
          tracking_url: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reseller_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reconcile_reseller_stock: {
        Args: { _rp_id: string }
        Returns: {
          copies_count: number
          min_copy_stock: number
          mismatch: boolean
          reseller_product_id: string
          source_stock: number
          total_consumed: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "store_owner"
        | "manager"
        | "cashier"
        | "salesman"
        | "accountant"
        | "technician"
        | "warehouse_manager"
      order_request_status: "pending" | "approved" | "rejected" | "completed"
      order_request_type: "cancellation" | "return"
      order_status:
        | "pending"
        | "confirmed"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
      payment_status: "unpaid" | "paid" | "refunded"
      payout_method: "bkash" | "nagad" | "bank"
      payout_status: "pending" | "approved" | "paid" | "rejected"
      product_status: "pending" | "approved" | "rejected"
      reseller_order_status:
        | "pending"
        | "confirmed"
        | "shipped"
        | "delivered"
        | "cancelled"
      store_category:
        | "Clothes"
        | "Electronics"
        | "Sports"
        | "Clothing & Apparel"
        | "Shoes & Footwear"
        | "Accessories & Jewelry"
        | "Beauty & Cosmetics"
        | "Electronics & Gadgets"
        | "Home & Furniture"
        | "Books & Media"
        | "Toys & Games"
        | "Sports & Outdoors"
        | "Health & Wellness"
        | "Food & Beverage"
        | "Pet Supplies"
        | "Grocery"
        | "Telecommunication"
        | "Pharmaceuticals"
        | "Utilities"
        | "Others"
      store_template:
        | "minimal"
        | "boutique"
        | "techgrid"
        | "sporty"
        | "luxe"
        | "autoparts"
        | "bdlove"
        | "eazystore-basic"
        | "flipmart"
        | "freshmart"
        | "megamart"
        | "trendmart"
        | "shopii"
        | "quickmart"
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
      app_role: [
        "super_admin",
        "store_owner",
        "manager",
        "cashier",
        "salesman",
        "accountant",
        "technician",
        "warehouse_manager",
      ],
      order_request_status: ["pending", "approved", "rejected", "completed"],
      order_request_type: ["cancellation", "return"],
      order_status: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      payment_status: ["unpaid", "paid", "refunded"],
      payout_method: ["bkash", "nagad", "bank"],
      payout_status: ["pending", "approved", "paid", "rejected"],
      product_status: ["pending", "approved", "rejected"],
      reseller_order_status: [
        "pending",
        "confirmed",
        "shipped",
        "delivered",
        "cancelled",
      ],
      store_category: [
        "Clothes",
        "Electronics",
        "Sports",
        "Clothing & Apparel",
        "Shoes & Footwear",
        "Accessories & Jewelry",
        "Beauty & Cosmetics",
        "Electronics & Gadgets",
        "Home & Furniture",
        "Books & Media",
        "Toys & Games",
        "Sports & Outdoors",
        "Health & Wellness",
        "Food & Beverage",
        "Pet Supplies",
        "Grocery",
        "Telecommunication",
        "Pharmaceuticals",
        "Utilities",
        "Others",
      ],
      store_template: [
        "minimal",
        "boutique",
        "techgrid",
        "sporty",
        "luxe",
        "autoparts",
        "bdlove",
        "eazystore-basic",
        "flipmart",
        "freshmart",
        "megamart",
        "trendmart",
        "shopii",
        "quickmart",
      ],
    },
  },
} as const
