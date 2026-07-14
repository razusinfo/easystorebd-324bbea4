import { createFileRoute } from "@tanstack/react-router";

// Cron endpoint: re-checks source_product_url for each imported product and
// flips is_out_of_stock when the dropshipper page is out of stock (and
// restores availability when it comes back in stock). Auth via
// server-only CRON_RESYNC_SECRET header.
export const Route = createFileRoute("/api/public/hooks/resync-source-stock")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.CRON_RESYNC_SECRET ?? "";
        const provided =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (!expected || provided.length === 0 || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );
          const { resyncSourceStockForAllProducts } = await import(
            "@/lib/product-stock-sync.server"
          );
          const result = await resyncSourceStockForAllProducts(
            supabaseAdmin as never,
          );
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("[resync-source-stock] failed", e);
          return new Response(
            (e as Error).message ?? "Resync failed",
            { status: 500 },
          );
        }
      },
    },
  },
});
