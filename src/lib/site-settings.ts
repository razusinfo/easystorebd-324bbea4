import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SidebarCategory = {
  id: string;
  label: string;
  icon: string;   // lucide icon name (whitelisted set)
  href: string;
  order: number;
};

export type SiteSettings = {
  id: string;
  logo_url: string | null;
  logo_url_dark: string | null;
  favicon_url: string | null;
  primary_color: string;
  sidebar_categories: SidebarCategory[];
  whatsapp_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  asset_version: number;
  updated_at: string;
};

const SETTINGS_ID = "global";
const QK = ["site-settings"] as const;

const SELECT_COLS =
  "id,logo_url,logo_url_dark,favicon_url,primary_color,sidebar_categories,whatsapp_url,facebook_url,instagram_url,asset_version,updated_at";
const ADMIN_SELECT_COLS =
  "id,logo_url,logo_url_dark,favicon_url,primary_color,sidebar_categories,whatsapp_url,contact_email,contact_phone,facebook_url,instagram_url,asset_version,updated_at";

function normalize(row: any): SiteSettings {
  return {
    id: row.id ?? SETTINGS_ID,
    logo_url: row.logo_url ?? null,
    logo_url_dark: row.logo_url_dark ?? null,
    favicon_url: row.favicon_url ?? null,
    primary_color: row.primary_color ?? "#5B21B6",
    sidebar_categories: Array.isArray(row.sidebar_categories)
      ? (row.sidebar_categories as SidebarCategory[])
      : [],
    whatsapp_url: row.whatsapp_url ?? null,
    contact_email: row.contact_email ?? null,
    contact_phone: row.contact_phone ?? null,
    facebook_url: row.facebook_url ?? null,
    instagram_url: row.instagram_url ?? null,
    asset_version: typeof row.asset_version === "number" ? row.asset_version : 1,
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

export function useSiteSettings() {
  return useQuery({
    queryKey: QK,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<SiteSettings> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select(ADMIN_SELECT_COLS)
        .eq("id", SETTINGS_ID)
        .maybeSingle();
      if (error) throw error;
      return normalize(data ?? { id: SETTINGS_ID });
    },
  });
}

/**
 * Admin variant — includes sensitive contact fields (contact_email, contact_phone).
 * Only authenticated (super admin) callers should use this; anonymous visitors
 * are blocked at the column-privilege level from selecting the contact fields.
 */
export function useSiteSettingsAdmin() {
  return useQuery({
    queryKey: [...QK, "admin"] as const,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<SiteSettings> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select(ADMIN_SELECT_COLS)
        .eq("id", SETTINGS_ID)
        .maybeSingle();
      if (error) throw error;
      return normalize(data ?? { id: SETTINGS_ID });
    },
  });
}

export function useUpdateSiteSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<SiteSettings, "id" | "updated_at">>) => {
      const payload: any = { ...patch, id: SETTINGS_ID };
      const { data, error } = await supabase
        .from("site_settings")
        .upsert(payload, { onConflict: "id" })
        .select(SELECT_COLS)
        .maybeSingle();
      if (error) throw error;
      return normalize(data);
    },
    onSuccess: (next) => {
      qc.setQueryData(QK, next);
      qc.invalidateQueries({ queryKey: QK });
    },
  });
}

/** Upload a logo/favicon to the private `site-assets` bucket and return storage path. */
export async function uploadSiteAsset(
  file: File,
  kind: "logo" | "favicon",
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${kind}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("site-assets")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return path;
}

/** Resolve a stored site-asset path to a signed URL usable in <img> / <link>. */
export function useSignedSiteAsset(path: string | null | undefined) {
  return useQuery({
    queryKey: ["site-asset-signed", path],
    enabled: !!path,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("site-assets")
        .createSignedUrl(path!, 60 * 60 * 24 * 7);
      if (error) throw error;
      return data?.signedUrl ?? null;
    },
  });
}

export async function deleteSiteAsset(path: string) {
  await supabase.storage.from("site-assets").remove([path]);
}

// -------------- Icon whitelist for sidebar categories --------------

export const SIDEBAR_ICONS = [
  "Home", "Package", "ShoppingCart", "Users", "Settings", "Truck",
  "Tag", "MessageSquare", "Heart", "Star", "Layers", "Grid",
  "Store", "Gift", "Phone", "Mail", "Zap", "Sparkles",
] as const;
export type SidebarIcon = (typeof SIDEBAR_ICONS)[number];

// -------------- Validation --------------

export const HEX_COLOR_RE = /^#([0-9a-fA-F]{6})$/;

export function isValidUrl(v: string | null | undefined): boolean {
  if (!v) return true;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
