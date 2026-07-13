import { supabase } from "@/integrations/supabase/client";

const SITE = "https://easystorebd.com";

export async function loadStoreHeadInfo(slug: string) {
  const { data } = await supabase
    .from("stores")
    .select("name, tagline")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  return {
    storeName: data?.name ?? null,
    tagline: data?.tagline ?? null,
  };
}

export function storefrontFaviconLinks(slug: string) {
  const icon = `${SITE}/api/public/og-logo/${slug}`;
  return [
    { rel: "icon", href: icon, type: "image/png" },
    { rel: "apple-touch-icon", href: icon },
    { rel: "shortcut icon", href: icon },
  ];
}

export function storefrontSectionMeta(opts: {
  slug: string;
  storeName: string | null;
  section?: string;
  description?: string;
}) {
  const name = opts.storeName ?? opts.slug;
  const title = opts.section ? `${opts.section} — ${name}` : name;
  const desc = opts.description || `${opts.section ? `${opts.section} at ` : ""}${name}.`;
  const image = `${SITE}/api/public/og-logo/${opts.slug}`;
  return [
    { title },
    { name: "description", content: desc },
    { property: "og:title", content: title },
    { property: "og:description", content: desc },
    { property: "og:site_name", content: name },
    { property: "og:image", content: image },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: desc },
    { name: "twitter:image", content: image },
  ];
}
