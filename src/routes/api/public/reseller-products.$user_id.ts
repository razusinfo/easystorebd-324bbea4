import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/public/reseller-products/$user_id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ params }) => {
        const userId = params.user_id;
        if (!UUID_RE.test(userId)) {
          return json({ error: "Invalid user_id" }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // LEFT JOIN reseller_products ← user_reseller_settings (filtered to this user).
        const { data, error } = await supabaseAdmin
          .from("reseller_products")
          .select(
            "id, external_id, name, description, image_url, image, price, reseller_price, category, updated_at, user_reseller_settings!left(custom_price, custom_description, custom_image, user_id)",
          )
          .eq("user_reseller_settings.user_id", userId)
          .order("updated_at", { ascending: false });

        if (error) {
          return json({ error: error.message }, 500);
        }

        const products = (data ?? []).map((r: Record<string, unknown>) => {
          const settings = (r.user_reseller_settings as
            | Array<{
                custom_price: number | null;
                custom_description: string | null;
                custom_image: string | null;
              }>
            | null) ?? [];
          const s = settings[0] ?? null;
          const baseImage = (r.image_url as string | null) ?? (r.image as string | null);
          return {
            id: r.id as string,
            external_id: r.external_id as string,
            name: r.name as string,
            description: s?.custom_description ?? (r.description as string | null),
            image: s?.custom_image ?? baseImage,
            original_price: Number(r.price ?? 0),
            price: s?.custom_price ?? (r.reseller_price as number | null),
            category: r.category as string | null,
            is_customized: !!s,
            updated_at: r.updated_at as string,
          };
        });

        return json({ user_id: userId, count: products.length, products });
      },
    },
  },
});
