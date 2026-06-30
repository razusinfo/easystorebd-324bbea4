// Supabase-backed data layer for EazyStore.
// All hooks rely on RLS — owners only see/modify their own data; super_admin sees all.
import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Category = "Clothes" | "Electronics" | "Sports";
export type TemplateId = "minimal" | "boutique" | "techgrid" | "sporty" | "luxe";
export type ProductStatus = "pending" | "approved" | "rejected";

export type StoreRow = {
  id: string;
  owner_user_id: string;
  name: string;
  category: Category;
  template: TemplateId;
  created_at: string;
};

export type ProductRow = {
  id: string;
  store_id: string;
  name: string;
  price: number;
  stock: number;
  status: ProductStatus;
  created_at: string;
};

export const TEMPLATES: { id: TemplateId; name: string; tagline: string; gradient: string }[] = [
  { id: "minimal", name: "Minimal Mono", tagline: "Clean, editorial, type-led", gradient: "from-slate-900 to-slate-600" },
  { id: "boutique", name: "Boutique Blush", tagline: "Soft pastels for fashion", gradient: "from-pink-400 to-rose-500" },
  { id: "techgrid", name: "Tech Grid", tagline: "Dark, sharp, specs-first", gradient: "from-indigo-600 to-cyan-500" },
  { id: "sporty", name: "Sporty Pulse", tagline: "Bold, kinetic, energetic", gradient: "from-orange-500 to-red-600" },
  { id: "luxe", name: "Luxe Noir", tagline: "Premium dark with gold accents", gradient: "from-neutral-900 to-amber-600" },
];

// ---------- Queries ----------

export function useMyStore(opts?: Partial<UseQueryOptions<StoreRow | null>>) {
  return useQuery({
    queryKey: ["my-store"],
    queryFn: async (): Promise<StoreRow | null> => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, owner_user_id, name, category, template, created_at")
        .maybeSingle();
      if (error) throw error;
      return (data as StoreRow | null) ?? null;
    },
    ...opts,
  });
}

export function useMyProducts(storeId: string | undefined) {
  return useQuery({
    queryKey: ["products", "by-store", storeId],
    enabled: !!storeId,
    queryFn: async (): Promise<ProductRow[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, store_id, name, price, stock, status, created_at")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
  });
}

export function useIsSuperAdmin() {
  return useQuery({
    queryKey: ["is-super-admin"],
    queryFn: async (): Promise<boolean> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

export function useAdminStores() {
  return useQuery({
    queryKey: ["admin", "stores"],
    queryFn: async (): Promise<StoreRow[]> => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, owner_user_id, name, category, template, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StoreRow[];
    },
  });
}

export function useAdminProducts() {
  return useQuery({
    queryKey: ["admin", "products"],
    queryFn: async (): Promise<ProductRow[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, store_id, name, price, stock, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
  });
}

// ---------- Mutations ----------

export function useCreateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; category: Category; template: TemplateId }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("stores")
        .insert({
          owner_user_id: user.id,
          name: input.name,
          category: input.category,
          template: input.template,
        })
        .select()
        .single();
      if (error) throw error;
      return data as StoreRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-store"] }),
  });
}

export function useUpdateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name: string; category: Category; template: TemplateId }) => {
      const { data, error } = await supabase
        .from("stores")
        .update({ name: input.name, category: input.category, template: input.template })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as StoreRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-store"] }),
  });
}

export function useUpsertProduct(storeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      name: string;
      price: number;
      stock: number;
    }) => {
      if (!storeId) throw new Error("No store");
      if (input.id) {
        const { error } = await supabase
          .from("products")
          .update({ name: input.name, price: input.price, stock: input.stock, status: "pending" })
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("products")
          .insert({ store_id: storeId, name: input.name, price: input.price, stock: input.stock });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products", "by-store", storeId] }),
  });
}

export function useDeleteProduct(storeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products", "by-store", storeId] }),
  });
}

export function useModerateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: ProductStatus }) => {
      const { error } = await supabase
        .from("products")
        .update({ status: input.status })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "products"] }),
  });
}
