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
export type TemplateId = "minimal" | "boutique" | "techgrid" | "sporty" | "luxe" | "autoparts" | "bdlove" | "eazystore-basic";
export type ProductStatus = "pending" | "approved" | "rejected";

export type FooterLink = { label: string; href?: string; enabled: boolean };
export type FooterSocialKey = "twitter" | "youtube" | "instagram" | "facebook";
export type FooterSocial = { key: FooterSocialKey; url?: string; enabled: boolean };
export type FooterSettings = {
  showNav?: boolean;
  navLinks?: FooterLink[];
  showSocials?: boolean;
  socials?: FooterSocial[];
  showCopyright?: boolean;
};

export type TemplateSettings = {
  accentColor?: string;
  logoPath?: string | null;
  defaultCategoryId?: string | null;
  defaultCategoryName?: string | null;
  featuredProductIds?: string[];
  themeMode?: "light" | "dark";
  buyNowEnabled?: boolean;
  footer?: FooterSettings;
};

export const DEFAULT_FOOTER: Required<FooterSettings> = {
  showNav: true,
  navLinks: [
    { label: "Company", enabled: true },
    { label: "About Us", enabled: true },
    { label: "Team", enabled: true },
    { label: "Products", enabled: true },
    { label: "Blogs", enabled: true },
    { label: "Pricing", enabled: true },
  ],
  showSocials: true,
  socials: [
    { key: "twitter", enabled: true },
    { key: "youtube", enabled: true },
    { key: "instagram", enabled: true },
    { key: "facebook", enabled: true },
  ],
  showCopyright: true,
};



export type TemplateSettingsMap = Partial<Record<TemplateId, TemplateSettings>>;

export type ShopSettings = {
  policy?: {
    return?: string;
    refund?: string;
    terms?: string;
    privacy?: string;
    shipping?: string;
  };
  delivery?: {
    inside_dhaka?: number | null;
    outside_dhaka?: number | null;
    sub_dhaka?: number | null;
    free_above?: number | null;
    note?: string;
  };
  payment?: {
    cod?: boolean;
    bkash?: string;
    nagad?: string;
    rocket?: string;
    bank_name?: string;
    bank_account?: string;
    bank_branch?: string;
    instructions?: string;
  };
  seo?: {
    meta_title?: string;
    meta_description?: string;
    google_tag_manager?: string;
    facebook_pixel?: string;
    tiktok_pixel?: string;
    google_analytics?: string;
  };
  chat?: {
    messenger_url?: string;
    whatsapp_number?: string;
    tawk_to_id?: string;
    enabled?: boolean;
  };
  general?: {
    business_type?: string;
    country?: string;
    default_language?: "en" | "bn";
    favicon_url?: string | null;
    theme_color?: string;
    theme_builder_active?: boolean;
    maintain_stock?: boolean;
    show_sold_count?: boolean;
    allow_image_downloads?: boolean;
    show_email_field?: boolean;
    enable_promo?: boolean;
    show_popularity_filter?: boolean;
    auto_select_variant?: boolean;
    per_hour_order_limit?: number | null;
    vat_percent?: number | null;
  };

};

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
  shop_settings: ShopSettings;
  custom_domain: string | null;
  plan_tier: string;
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
  shop_settings?: ShopSettings;
  custom_domain?: string | null;
  plan_tier?: string;
};


export type ProductRow = {
  id: string;
  store_id: string;
  name: string;
  price: number;
  stock: number;
  status: ProductStatus;
  image_url: string | null;
  gallery_urls?: string[] | null;
  created_at: string;
  // Extended fields
  short_description?: string | null;
  description?: string | null;
  category_id?: string | null;
  brand?: string | null;
  condition?: "new" | "used" | "refurbished";
  weight_kg?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  regular_price?: number | null;
  buying_price?: number | null;
  sku?: string | null;
  unit_name?: string | null;
  product_serial?: string | null;
  warranty?: string | null;
  initial_sold_count?: number;
  use_default_delivery?: boolean;
  video_url?: string | null;
};

export type ProductVariantRow = {
  id: string;
  product_id: string;
  name: string;
  value: string;
  position: number;
};

export type ProductDetailRow = {
  id: string;
  product_id: string;
  key: string;
  value: string;
  position: number;
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
  { id: "eazystore-basic", name: "EazyStore Basic", tagline: "EazyStore's own basic storefront — sidebar categories, product grid, mobile-friendly", gradient: "from-violet-600 to-indigo-600", accent: "#5B21B6", category: "General" },
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
        .select("*")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
  });
}

export function useProductVariants(productId: string | undefined) {
  return useQuery({
    queryKey: ["product-variants", productId],
    enabled: !!productId,
    queryFn: async (): Promise<ProductVariantRow[]> => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", productId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProductVariantRow[];
    },
  });
}

export function useProductDetails(productId: string | undefined) {
  return useQuery({
    queryKey: ["product-details", productId],
    enabled: !!productId,
    queryFn: async (): Promise<ProductDetailRow[]> => {
      const { data, error } = await supabase
        .from("product_details")
        .select("*")
        .eq("product_id", productId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProductDetailRow[];
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

export type UpsertProductInput = {
  id?: string;
  name: string;
  price: number;
  stock: number;
  imageUrl?: string | null;
  galleryUrls?: string[];
  shortDescription?: string | null;
  description?: string | null;
  categoryId?: string | null;
  brand?: string | null;
  condition?: "new" | "used" | "refurbished";
  weightKg?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  regularPrice?: number | null;
  buyingPrice?: number | null;
  sku?: string | null;
  unitName?: string | null;
  productSerial?: string | null;
  warranty?: string | null;
  initialSoldCount?: number;
  useDefaultDelivery?: boolean;
  videoUrl?: string | null;
  status?: ProductStatus;
  variants?: { name: string; value: string }[];
  details?: { key: string; value: string }[];
};

export function useUpsertProduct(storeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertProductInput) => {
      if (!storeId) throw new Error("No store");

      const payload: Record<string, unknown> = {
        name: input.name,
        price: input.price,
        stock: input.stock,
      };
      if (input.imageUrl !== undefined) payload.image_url = input.imageUrl;
      if (input.galleryUrls !== undefined) payload.gallery_urls = input.galleryUrls;
      if (input.shortDescription !== undefined) payload.short_description = input.shortDescription;
      if (input.description !== undefined) payload.description = input.description;
      if (input.categoryId !== undefined) payload.category_id = input.categoryId || null;
      if (input.brand !== undefined) payload.brand = input.brand;
      if (input.condition !== undefined) payload.condition = input.condition;
      if (input.weightKg !== undefined) payload.weight_kg = input.weightKg;
      if (input.lengthCm !== undefined) payload.length_cm = input.lengthCm;
      if (input.widthCm !== undefined) payload.width_cm = input.widthCm;
      if (input.heightCm !== undefined) payload.height_cm = input.heightCm;
      if (input.regularPrice !== undefined) payload.regular_price = input.regularPrice;
      if (input.buyingPrice !== undefined) payload.buying_price = input.buyingPrice;
      if (input.sku !== undefined) payload.sku = input.sku;
      if (input.unitName !== undefined) payload.unit_name = input.unitName;
      if (input.productSerial !== undefined) payload.product_serial = input.productSerial;
      if (input.warranty !== undefined) payload.warranty = input.warranty;
      if (input.initialSoldCount !== undefined) payload.initial_sold_count = input.initialSoldCount;
      if (input.useDefaultDelivery !== undefined) payload.use_default_delivery = input.useDefaultDelivery;
      if (input.videoUrl !== undefined) payload.video_url = input.videoUrl;
      if (input.status !== undefined) payload.status = input.status;

      let productId: string;
      if (input.id) {
        const { error } = await supabase.from("products").update(payload as never).eq("id", input.id);
        if (error) throw error;
        productId = input.id;
      } else {
        payload.store_id = storeId;
        if (payload.status === undefined) payload.status = "approved";

        const { data, error } = await supabase
          .from("products")
          .insert(payload as never)
          .select("id")
          .single();
        if (error) throw error;
        productId = (data as { id: string }).id;
      }

      if (input.variants) {
        await supabase.from("product_variants").delete().eq("product_id", productId);
        const rows = input.variants
          .filter((v) => v.name.trim() || v.value.trim())
          .map((v, i) => ({ product_id: productId, name: v.name.trim(), value: v.value.trim(), position: i }));
        if (rows.length) {
          const { error } = await supabase.from("product_variants").insert(rows);
          if (error) throw error;
        }
      }

      if (input.details) {
        await supabase.from("product_details").delete().eq("product_id", productId);
        const rows = input.details
          .filter((d) => d.key.trim() || d.value.trim())
          .map((d, i) => ({ product_id: productId, key: d.key.trim(), value: d.value.trim(), position: i }));
        if (rows.length) {
          const { error } = await supabase.from("product_details").insert(rows);
          if (error) throw error;
        }
      }

      return { id: productId };
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["products", "by-store", storeId] });
      if (vars.id) {
        qc.invalidateQueries({ queryKey: ["product-variants", vars.id] });
        qc.invalidateQueries({ queryKey: ["product-details", vars.id] });
      }
    },
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

// Owner-side status change (creates audit log via DB trigger). Optional notes stored via manual log insert.
export function useUpdateProductStatus(storeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: ProductStatus; notes?: string }) => {
      const { error } = await supabase
        .from("products")
        .update({ status: input.status })
        .eq("id", input.id);
      if (error) throw error;
      if (input.notes && input.notes.trim()) {
        // Attach note as a follow-up audit row.
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("product_audit_logs").insert({
          product_id: input.id,
          actor_id: user?.id ?? null,
          action: "note",
          new_status: input.status,
          notes: input.notes.trim(),
        });
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["products", "by-store", storeId] });
      qc.invalidateQueries({ queryKey: ["product-audit", v.id] });
    },
  });
}

export function useProductAuditLogs(productId: string | null | undefined) {
  return useQuery({
    queryKey: ["product-audit", productId],
    enabled: !!productId,
    queryFn: async (): Promise<ProductAuditLog[]> => {
      const { data, error } = await supabase
        .from("product_audit_logs")
        .select("*")
        .eq("product_id", productId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ProductAuditLog[];
    },
  });
}

// ---------- Product image storage ----------

export async function uploadProductImage(file: File): Promise<{ path: string; publicUrl: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${user.id}/product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("product-images")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (upErr) throw upErr;
  console.log("[uploadProductImage] uploaded to path:", path);

  // Validate the object actually exists in the bucket.
  const dir = path.slice(0, path.lastIndexOf("/"));
  const fname = path.slice(path.lastIndexOf("/") + 1);
  const { data: listed, error: listErr } = await supabase.storage
    .from("product-images")
    .list(dir, { search: fname, limit: 1 });
  if (listErr) throw listErr;
  if (!listed?.some((o) => o.name === fname)) {
    throw new Error("Upload verification failed: object not found in bucket");
  }
  console.log("[uploadProductImage] verified object exists:", fname);

  // Bucket is private; sign a long-lived URL (~10y) so <img> can load it.
  const { data: signed, error: signErr } = await supabase.storage
    .from("product-images")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Failed to sign image URL");

  // Best-effort HEAD to confirm the signed URL is fetchable.
  try {
    const head = await fetch(signed.signedUrl, { method: "HEAD" });
    console.log("[uploadProductImage] signed URL HEAD status:", head.status);
    if (!head.ok) console.warn("[uploadProductImage] signed URL not reachable:", head.status);
  } catch (e) {
    console.warn("[uploadProductImage] HEAD check failed:", e);
  }

  return { path, publicUrl: signed.signedUrl };
}


export async function deleteProductImage(publicUrl: string): Promise<void> {
  const marker = "/product-images/";
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  let path = publicUrl.slice(idx + marker.length);
  const q = path.indexOf("?");
  if (q !== -1) path = path.slice(0, q);
  if (!path) return;
  await supabase.storage.from("product-images").remove([path]);
}

// Extracts the storage object path from either a public URL, signed URL, or bare path.
export function extractProductImagePath(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = "/product-images/";
  const idx = url.indexOf(marker);
  if (idx === -1) {
    // Might already be a bare path (e.g. "user-id/file.jpg")
    return url.includes("://") ? null : url;
  }
  let path = url.slice(idx + marker.length);
  const q = path.indexOf("?");
  if (q !== -1) path = path.slice(0, q);
  return path || null;
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
    queryFn: async (): Promise<{ store: StoreRow; products: ProductRow[]; logoUrl: string | null; categories: { id: string; name: string }[] } | null> => {
      const { data: store, error } = await supabase
        .from("stores")
        .select("*")
        .eq("slug", slug!)
        .eq("published", true)
        .maybeSingle();
      if (error) throw error;
      if (!store) return null;

      const [{ data: products, error: pErr }, { data: cats, error: cErr }] = await Promise.all([
        supabase
          .from("products")
          .select("id, store_id, name, price, stock, status, image_url, created_at")
          .eq("store_id", store.id)
          .eq("status", "approved")
          .order("created_at", { ascending: false }),
        supabase
          .from("product_categories")
          .select("id, name, slug, parent_id, sort_order")
          .eq("store_id", store.id)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
      ]);
      if (pErr) throw pErr;
      if (cErr) throw cErr;
      const categories = (cats ?? []).map((c: any) => ({ id: c.id as string, name: c.name as string }));


      // Product images live in a private bucket. Re-sign stored URLs so <img> can load on every visit.
      console.log(`[storefront] resigning ${products?.length ?? 0} product image(s) for store "${store.slug}"`);
      const signedProducts = await Promise.all(
        (products ?? []).map(async (p: any) => {
          const path = extractProductImagePath(p.image_url);
          if (!path) {
            if (p.image_url) console.warn("[storefront] could not extract path from image_url:", p.image_url);
            return p;
          }
          const { data: sig, error: sErr } = await supabase.storage
            .from("product-images")
            .createSignedUrl(path, 60 * 60 * 24 * 7);
          if (sErr || !sig?.signedUrl) {
            console.warn(`[storefront] failed to sign image for product ${p.id} (path=${path}):`, sErr);
            return { ...p, image_url: null };
          }
          return { ...p, image_url: sig.signedUrl };
        })
      );


      let logoUrl: string | null = null;
      if (store.logo_url) {
        const { data: signed } = await supabase.storage
          .from("store-logos")
          .createSignedUrl(store.logo_url, 60 * 60 * 24 * 7);
        logoUrl = signed?.signedUrl ?? null;
      }

      return { store: store as StoreRow, products: signedProducts as ProductRow[], logoUrl };

    },
  });
}

