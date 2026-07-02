// Supabase-backed data layer for EazyStore.
// All hooks rely on RLS — owners only see/modify their own data; super_admin sees all.
import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  adminListUsers,
  adminListAuditLogs,
  adminAssignRole,
  adminRevokeRole,
} from "@/lib/admin.functions";


export type Category = "Clothes" | "Electronics" | "Sports";
export type TemplateId = "minimal" | "boutique" | "techgrid" | "sporty" | "luxe" | "autoparts" | "bdlove";
export type ProductStatus = "pending" | "approved" | "rejected";

export type TemplateSettings = {
  accentColor?: string;
  logoPath?: string | null;
  defaultCategoryId?: string | null;
  defaultCategoryName?: string | null;
  featuredProductIds?: string[];
  themeMode?: "light" | "dark";
  buyNowEnabled?: boolean;
};


export type TemplateSettingsMap = Partial<Record<TemplateId, TemplateSettings>>;

export type StoreRow = {
  id: string;
  owner_user_id: string;
  name: string;
  category: Category;
  template: TemplateId;
  created_at: string;
  logo_url: string | null;
  tagline: string | null;
  address: string | null;
  phone: string | null;
  contact_email: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  whatsapp_number: string | null;
  website_url: string | null;
  slug: string | null;
  published: boolean;
  published_at: string | null;
  template_settings: TemplateSettingsMap;
};

export function getTemplateSettings(
  store: Pick<StoreRow, "template_settings"> | null | undefined,
  id: TemplateId,
): TemplateSettings {
  return (store?.template_settings?.[id] as TemplateSettings) ?? {};
}




export type StoreSettings = {
  name: string;
  category: Category;
  template: TemplateId;
  logo_url?: string | null;
  tagline?: string | null;
  address?: string | null;
  phone?: string | null;
  contact_email?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  whatsapp_number?: string | null;
  website_url?: string | null;
};

export type ProductRow = {
  id: string;
  store_id: string;
  name: string;
  price: number;
  stock: number;
  status: ProductStatus;
  image_url: string | null;
  created_at: string;
};

export type ProductAuditLog = {
  id: string;
  product_id: string;
  actor_id: string | null;
  action: string;
  old_status: ProductStatus | null;
  new_status: ProductStatus | null;
  notes: string | null;
  created_at: string;
};


export const TEMPLATES: { id: TemplateId; name: string; tagline: string; gradient: string; accent: string; category: string; premium?: boolean }[] = [
  { id: "bdlove", name: "Basic Theme", tagline: "Gadget bazaar layout — sidebar categories, purple accents, green save badges, rounded search pill", gradient: "from-violet-600 to-indigo-600", accent: "#5B21B6", category: "General" },
  { id: "autoparts", name: "AutoParts Pro", tagline: "Multi-vendor auto parts marketplace with hero deals, category rail, and stock-progress cards", gradient: "from-red-600 to-rose-700", accent: "#DC2626", category: "Automotive", premium: true },

  { id: "minimal", name: "Minimal Mono", tagline: "Clean, editorial, type-led", gradient: "from-slate-900 to-slate-600", accent: "#0F172A", category: "Editorial" },
  { id: "boutique", name: "Boutique Blush", tagline: "Soft pastels for fashion", gradient: "from-pink-400 to-rose-500", accent: "#EC4899", category: "Fashion" },
  { id: "techgrid", name: "Tech Grid", tagline: "Dark, sharp, specs-first", gradient: "from-indigo-600 to-cyan-500", accent: "#4F46E5", category: "Electronics" },
  { id: "sporty", name: "Sporty Pulse", tagline: "Bold, kinetic, energetic", gradient: "from-orange-500 to-red-600", accent: "#F97316", category: "Sports" },
  { id: "luxe", name: "Luxe Noir", tagline: "Premium dark with gold accents", gradient: "from-neutral-900 to-amber-600", accent: "#D97706", category: "Luxury" },
];

// ---------- Queries ----------

export function useMyStore(opts?: Partial<UseQueryOptions<StoreRow | null>>) {
  return useQuery({
    queryKey: ["my-store"],
    queryFn: async (): Promise<StoreRow | null> => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
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
        .select("id, store_id, name, price, stock, status, image_url, created_at")
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
        .select("*")
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
        .select("id, store_id, name, price, stock, status, image_url, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
  });
}

export type AdminUserRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  roles: string[];
};

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: async (): Promise<AdminUserRow[]> => {
      const data = await adminListUsers();
      return (data ?? []) as AdminUserRow[];
    },
  });
}


export type AppRole =
  | "super_admin"
  | "store_owner"
  | "manager"
  | "cashier"
  | "salesman"
  | "accountant"
  | "technician"
  | "warehouse_manager";

export type AuditLogRow = {
  id: string;
  actor_id: string;
  actor_email: string | null;
  target_user_id: string;
  target_email: string | null;
  action: "assign_role" | "revoke_role";
  role: string;
  notes: string | null;
  created_at: string;
};

export function useAdminAuditLogs() {
  return useQuery({
    queryKey: ["admin", "audit-logs"],
    queryFn: async (): Promise<AuditLogRow[]> => {
      const data = await adminListAuditLogs({ data: { limit: 200 } });
      return (data ?? []) as AuditLogRow[];
    },
  });
}

export function useAssignRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { targetUserId: string; role: AppRole; notes?: string }) => {
      await adminAssignRole({ data: input });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
  });
}

export function useRevokeRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { targetUserId: string; role: AppRole; notes?: string }) => {
      await adminRevokeRole({ data: input });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
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
    mutationFn: async (input: { id: string } & Partial<StoreSettings>) => {
      const { id, ...patch } = input;
      const { data, error } = await supabase
        .from("stores")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as StoreRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-store"] }),
  });
}

// Merge-save settings for one template into the stores.template_settings jsonb.
export function useSaveTemplateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      storeId: string;
      templateId: TemplateId;
      settings: TemplateSettings;
      currentMap: TemplateSettingsMap;
      activate?: boolean;
    }) => {
      const merged: TemplateSettingsMap = {
        ...(input.currentMap ?? {}),
        [input.templateId]: {
          ...(input.currentMap?.[input.templateId] ?? {}),
          ...input.settings,
        },
      };
      const patch: { template_settings: TemplateSettingsMap; template?: TemplateId } = {
        template_settings: merged,
      };
      if (input.activate) patch.template = input.templateId;
      const { data, error } = await supabase
        .from("stores")
        .update(patch as never)
        .eq("id", input.storeId)
        .select()
        .single();

      if (error) throw error;
      return data as StoreRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-store"] }),
  });
}


// Resolve a logo storage path (e.g. "<uid>/logo.png") to a signed URL.
export function useLogoSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["logo-signed-url", path],
    enabled: !!path,
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<string | null> => {
      if (!path) return null;
      const { data, error } = await supabase.storage
        .from("store-logos")
        .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days
      if (error) throw error;
      return data?.signedUrl ?? null;
    },
  });
}

export async function uploadStoreLogo(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${user.id}/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("store-logos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return path;
}

export async function deleteStoreLogo(path: string): Promise<void> {
  if (!path) return;
  await supabase.storage.from("store-logos").remove([path]);
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

// ---------- Public storefront ----------

export function slugifyStoreName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 32);
}

import { STOREFRONT_APEX_DOMAINS, buildSubdomainStorefrontUrl } from "@/lib/storefront-host";

export function buildStorefrontUrl(slug: string): string {
  if (typeof window === "undefined") {
    return buildSubdomainStorefrontUrl(slug) ?? `https://eazystorebd.lovable.app/s/${slug}`;
  }
  const host = window.location.hostname.toLowerCase();
  for (const apex of STOREFRONT_APEX_DOMAINS) {
    if (host === apex || host.endsWith(`.${apex}`)) {
      return `${window.location.protocol}//${slug}.${apex}/`;
    }
  }
  return `${window.location.origin}/s/${slug}`;
}

// Generate a unique slug — appends -2, -3... on conflict. Run before publish.
async function ensureUniqueSlug(base: string, ownerStoreId: string): Promise<string> {
  let candidate = base || "store";
  let n = 1;
  // Safety cap
  while (n < 50) {
    const { data, error } = await supabase
      .from("stores")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.id === ownerStoreId) return candidate;
    n += 1;
    candidate = `${base}${n}`;
  }
  throw new Error("Could not generate a unique storefront address.");
}

export function usePublishStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name: string; desiredSlug?: string }) => {
      const base = slugifyStoreName(input.desiredSlug || input.name) || "store";
      const slug = await ensureUniqueSlug(base, input.id);
      const { data, error } = await supabase
        .from("stores")
        .update({ slug, published: true, published_at: new Date().toISOString() })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as StoreRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-store"] }),
  });
}

// Change/claim a custom slug. Validates format, ensures uniqueness, updates store.
export function useChangeSlug() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; slug: string }) => {
      const cleaned = slugifyStoreName(input.slug);
      if (cleaned.length < 3) throw new Error("URL must be at least 3 characters (letters and numbers only).");
      if (cleaned.length > 32) throw new Error("URL must be 32 characters or fewer.");

      // Uniqueness check — allow keeping the same slug on this store.
      const { data: existing, error: checkErr } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", cleaned)
        .maybeSingle();
      if (checkErr) throw checkErr;
      if (existing && existing.id !== input.id) {
        throw new Error("This URL is already taken. Please try another.");
      }

      const { data, error } = await supabase
        .from("stores")
        .update({ slug: cleaned })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as StoreRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-store"] }),
  });
}

// Public fetch by slug — relies on RLS allowing anon read of published stores.
export function usePublicStoreBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["public-store", slug],
    enabled: !!slug,
    queryFn: async (): Promise<{ store: StoreRow; products: ProductRow[]; logoUrl: string | null } | null> => {
      const { data: store, error } = await supabase
        .from("stores")
        .select("*")
        .eq("slug", slug!)
        .eq("published", true)
        .maybeSingle();
      if (error) throw error;
      if (!store) return null;

      const { data: products, error: pErr } = await supabase
        .from("products")
        .select("id, store_id, name, price, stock, status, image_url, created_at")
        .eq("store_id", store.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (pErr) throw pErr;

      let logoUrl: string | null = null;
      if (store.logo_url) {
        const { data: signed } = await supabase.storage
          .from("store-logos")
          .createSignedUrl(store.logo_url, 60 * 60 * 24 * 7);
        logoUrl = signed?.signedUrl ?? null;
      }

      return { store: store as StoreRow, products: (products ?? []) as ProductRow[], logoUrl };
    },
  });
}

