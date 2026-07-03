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
      orders: {
        Row: {
          created_at: string
          customer_address: string | null
          customer_name: string
          customer_phone: string
          customer_user_id: string | null
          delivery_charge: number
          discount: number
          id: string
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_address?: string | null
          customer_name: string
          customer_phone: string
          customer_user_id?: string | null
          delivery_charge?: number
          discount?: number
          id?: string
          notes?: string | null
          order_number: string
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_address?: string | null
          customer_name?: string
          customer_phone?: string
          customer_user_id?: string | null
          delivery_charge?: number
          discount?: number
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          subtotal?: number
          total?: number
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
          created_at: string
          id: string
          name: string
          parent_id: string | null
          slug: string | null
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          slug?: string | null
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
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
          brand: string | null
          buying_price: number | null
          category_id: string | null
          condition: string
          created_at: string
          description: string | null
          gallery_urls: string[]
          height_cm: number | null
          id: string
          image_url: string | null
          initial_sold_count: number
          length_cm: number | null
          name: string
          price: number
          product_serial: string | null
          regular_price: number | null
          short_description: string | null
          sku: string | null
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
          brand?: string | null
          buying_price?: number | null
          category_id?: string | null
          condition?: string
          created_at?: string
          description?: string | null
          gallery_urls?: string[]
          height_cm?: number | null
          id?: string
          image_url?: string | null
          initial_sold_count?: number
          length_cm?: number | null
          name: string
          price: number
          product_serial?: string | null
          regular_price?: number | null
          short_description?: string | null
          sku?: string | null
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
          brand?: string | null
          buying_price?: number | null
          category_id?: string | null
          condition?: string
          created_at?: string
          description?: string | null
          gallery_urls?: string[]
          height_cm?: number | null
          id?: string
          image_url?: string | null
          initial_sold_count?: number
          length_cm?: number | null
          name?: string
          price?: number
          product_serial?: string | null
          regular_price?: number | null
          short_description?: string | null
          sku?: string | null
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
      site_settings: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          facebook_url: string | null
          favicon_url: string | null
          id: string
          instagram_url: string | null
          logo_url: string | null
          primary_color: string
          sidebar_categories: Json
          updated_at: string
          updated_by: string | null
          whatsapp_url: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          facebook_url?: string | null
          favicon_url?: string | null
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          primary_color?: string
          sidebar_categories?: Json
          updated_at?: string
          updated_by?: string | null
          whatsapp_url?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          facebook_url?: string | null
          favicon_url?: string | null
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      order_status:
        | "pending"
        | "confirmed"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
      payment_status: "unpaid" | "paid" | "refunded"
      product_status: "pending" | "approved" | "rejected"
      store_category: "Clothes" | "Electronics" | "Sports"
      store_template:
        | "minimal"
        | "boutique"
        | "techgrid"
        | "sporty"
        | "luxe"
        | "autoparts"
        | "bdlove"
        | "eazystore-basic"
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
      order_status: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      payment_status: ["unpaid", "paid", "refunded"],
      product_status: ["pending", "approved", "rejected"],
      store_category: ["Clothes", "Electronics", "Sports"],
      store_template: [
        "minimal",
        "boutique",
        "techgrid",
        "sporty",
        "luxe",
        "autoparts",
        "bdlove",
        "eazystore-basic",
      ],
    },
  },
} as const
