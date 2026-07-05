import { createFileRoute } from "@tanstack/react-router";

// Cron endpoint: periodically resyncs approved marketplace product stock from
// each requester's source product stock, and logs discrepancies. Auth: caller
// must present the server-only CRON_RESYNC_SECRET (never the Supabase
// publishable/anon key, which ships in the browser bundle).
export const Route = createFileRoute("/api/public/hooks/resync-marketplace-stock")({
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

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { resyncApprovedMarketplaceStock } = await import(
          "@/lib/marketplace-stock-reconciliation.server"
        );
        try {
          const result = await resyncApprovedMarketplaceStock(supabaseAdmin as never, {
            id: null,
            role: "system_cron",
          });
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("[resync-marketplace-stock] failed", e);
          return new Response(
            (e as Error).message ?? "Resync failed",
            { status: 500 },
          );
        }
      },
    },
  },
});
