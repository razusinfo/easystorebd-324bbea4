import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DuplicateMatch = {
  id: string;
  name: string;
  brand: string | null;
  sku: string | null;
  source_product_url: string | null;
  image_url: string | null;
  match_reason: "source_url" | "sku" | "brand_name" | "name";
};

/**
 * Find existing products that likely duplicate an import candidate.
 * Match priority: source_product_url → sku → brand+name → name.
 */
export const findDuplicateProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      sourceUrl: z.string().url().optional().nullable(),
      name: z.string().optional().nullable(),
      brand: z.string().optional().nullable(),
      sku: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data, context }): Promise<DuplicateMatch[]> => {
    const { supabase } = context;
    const results: DuplicateMatch[] = [];
    const seen = new Set<string>();
    const push = (rows: any[] | null, reason: DuplicateMatch["match_reason"]) => {
      for (const r of rows ?? []) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        results.push({
          id: r.id,
          name: r.name,
          brand: r.brand ?? null,
          sku: r.sku ?? null,
          source_product_url: r.source_product_url ?? null,
          image_url: r.image_url ?? null,
          match_reason: reason,
        });
      }
    };

    const cols = "id, name, brand, sku, source_product_url, image_url";

    if (data.sourceUrl) {
      const { data: rows } = await supabase
        .from("products")
        .select(cols)
        .eq("source_product_url", data.sourceUrl)
        .limit(5);
      push(rows, "source_url");
    }
    if (data.sku && data.sku.trim()) {
      const { data: rows } = await supabase
        .from("products")
        .select(cols)
        .eq("sku", data.sku.trim())
        .limit(5);
      push(rows, "sku");
    }
    if (data.name && data.name.trim()) {
      const n = data.name.trim();
      if (data.brand && data.brand.trim()) {
        const { data: rows } = await supabase
          .from("products")
          .select(cols)
          .ilike("brand", data.brand.trim())
          .ilike("name", n)
          .limit(5);
        push(rows, "brand_name");
      }
      const { data: rows } = await supabase
        .from("products")
        .select(cols)
        .ilike("name", n)
        .limit(5);
      push(rows, "name");
    }

    return results.slice(0, 10);
  });
