// Data hooks for the "EasyStore365.com Control" super-admin module.
// All access is enforced server-side by RLS (super_admin only).
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ----- Types --------------------------------------------------------------
export type MarketplaceOrderStatus = "pending" | "shipped" | "delivered" | "cancelled";

export type MarketplaceOrderRow = {
  id: string;
  order_code: string;
  customer_name: string;
  customer_phone: string | null;
  reseller_store_name: string | null;
  reseller_store_id: string | null;
  total_amount: number;
  status: MarketplaceOrderStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketplaceCampaignRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  banner_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type MarketplaceFlashSaleRow = {
  id: string;
  product_id: string;
  discount_percent: number;
  ends_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MarketplaceCategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  image_url: string | null;
  sort_order: number;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
};

// ----- Realtime helper ----------------------------------------------------
function useRealtimeInvalidate(table: string, keys: unknown[]) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`realtime-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        keys.forEach((k) => qc.invalidateQueries({ queryKey: k as any }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);
}

// ============ Orders ======================================================
export function useMarketplaceOrders(search?: string) {
  useRealtimeInvalidate("marketplace_orders", [["mp_orders"]]);
  return useQuery({
    queryKey: ["mp_orders", search ?? ""],
    queryFn: async (): Promise<MarketplaceOrderRow[]> => {
      let q = supabase.from("marketplace_orders" as any).select("*").order("created_at", { ascending: false }).limit(200);
      if (search && search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`order_code.ilike.${s},customer_name.ilike.${s},reseller_store_name.ilike.${s}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as MarketplaceOrderRow[]) ?? [];
    },
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: MarketplaceOrderStatus }) => {
      const { error } = await supabase.from("marketplace_orders" as any).update({ status: input.status }).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mp_orders"] }),
  });
}

// ============ Campaigns ===================================================
export function useMarketplaceCampaigns() {
  useRealtimeInvalidate("marketplace_campaigns", [["mp_campaigns"]]);
  return useQuery({
    queryKey: ["mp_campaigns"],
    queryFn: async (): Promise<MarketplaceCampaignRow[]> => {
      const { data, error } = await supabase.from("marketplace_campaigns" as any).select("*").order("sort_order").order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as MarketplaceCampaignRow[]) ?? [];
    },
  });
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export function useUpsertCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<MarketplaceCampaignRow> & { name: string }) => {
      const payload: Record<string, unknown> = {
        name: input.name,
        slug: input.slug || slugify(input.name),
        description: input.description ?? null,
        banner_url: input.banner_url ?? null,
        starts_at: input.starts_at ?? null,
        ends_at: input.ends_at ?? null,
        is_active: input.is_active ?? false,
        sort_order: input.sort_order ?? 0,
      };
      if (input.id) {
        const { error } = await supabase.from("marketplace_campaigns" as any).update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("marketplace_campaigns" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mp_campaigns"] }),
  });
}

export function useToggleCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("marketplace_campaigns" as any).update({ is_active: input.is_active }).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mp_campaigns"] }),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketplace_campaigns" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mp_campaigns"] }),
  });
}

export async function uploadCampaignBanner(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${user.id}/banner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage.from("marketplace-banners").upload(path, file, { upsert: false, contentType: file.type });
  if (upErr) throw upErr;
  const { data: signed, error: signErr } = await supabase.storage.from("marketplace-banners").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Failed to sign URL");
  return signed.signedUrl;
}

// ============ Flash Sales =================================================
export type FlashSaleWithProduct = MarketplaceFlashSaleRow & {
  product?: { id: string; name: string; image_url: string | null; price: number | null } | null;
};

export function useFlashSales() {
  useRealtimeInvalidate("marketplace_flash_sales", [["mp_flash"]]);
  return useQuery({
    queryKey: ["mp_flash"],
    queryFn: async (): Promise<FlashSaleWithProduct[]> => {
      const { data, error } = await supabase
        .from("marketplace_flash_sales" as any)
        .select("*, product:products(id,name,image_url,price)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as FlashSaleWithProduct[]) ?? [];
    },
  });
}

export function useProductSearch(query: string) {
  return useQuery({
    queryKey: ["mp_product_search", query],
    enabled: query.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,image_url,price")
        .ilike("name", `%${query.trim()}%`)
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddFlashSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { product_id: string; discount_percent: number; ends_at: string }) => {
      const { error } = await supabase.from("marketplace_flash_sales" as any).insert({
        product_id: input.product_id,
        discount_percent: input.discount_percent,
        ends_at: input.ends_at,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mp_flash"] }),
  });
}

export function useRemoveFlashSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketplace_flash_sales" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mp_flash"] }),
  });
}

// ============ Categories ==================================================
export function useMarketplaceCategories() {
  useRealtimeInvalidate("marketplace_categories", [["mp_cats"]]);
  return useQuery({
    queryKey: ["mp_cats"],
    queryFn: async (): Promise<MarketplaceCategoryRow[]> => {
      const { data, error } = await supabase.from("marketplace_categories" as any).select("*").order("sort_order").order("name");
      if (error) throw error;
      return (data as unknown as MarketplaceCategoryRow[]) ?? [];
    },
  });
}

export function useUpsertCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<MarketplaceCategoryRow> & { name: string }) => {
      const payload: Record<string, unknown> = {
        name: input.name,
        slug: input.slug || slugify(input.name),
        parent_id: input.parent_id ?? null,
        image_url: input.image_url ?? null,
        sort_order: input.sort_order ?? 0,
        is_hidden: input.is_hidden ?? false,
      };
      if (input.id) {
        const { error } = await supabase.from("marketplace_categories" as any).update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("marketplace_categories" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mp_cats"] }),
  });
}

export function useToggleCategoryHidden() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; is_hidden: boolean }) => {
      const { error } = await supabase.from("marketplace_categories" as any).update({ is_hidden: input.is_hidden }).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mp_cats"] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketplace_categories" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mp_cats"] }),
  });
}
