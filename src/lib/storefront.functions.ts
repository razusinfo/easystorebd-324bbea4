// Server-side fetcher for published storefronts. Guarantees that only
// real, approved products from the store's own inventory are ever returned
// — template/demo items live only in preview-mode component code and can
// never reach a non-preview (published) storefront request through this path.

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type PublishedStorefront = {
  store: any;
  products: any[];
  categories: Array<{ id: string; name: string; slug: string | null; parent_id: string | null; sort_order: number | null }>;
} | null;

export const getPublishedStorefront = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string; preview?: boolean }) => {
    const slug = String(data?.slug ?? "").trim().toLowerCase();
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) throw new Error("Invalid slug");
    return { slug, preview: Boolean(data?.preview) };
  })
  .handler(async ({ data }) => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { data: store, error } = await supabase
      .from("stores")
      .select("*")
      .eq("slug", data.slug)
      .eq("published", true)
      .maybeSingle();
    if (error) throw error;
    if (!store) return null;

    // Only the store's own approved products. Preview mode is NOT honored here;
    // demo/template content is a client-only concern for the admin preview
    // route and must never be emitted for published storefront requests.
    const [{ data: products, error: pErr }, { data: cats, error: cErr }] = await Promise.all([
      supabase
        .from("products")
        .select("id, store_id, name, price, stock, status, image_url, category_id, created_at")
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

    return { store, products: products ?? [], categories: cats ?? [] };
  });

