import { createFileRoute } from "@tanstack/react-router";

// Cron endpoint: periodically resyncs approved marketplace product stock from
// each requester's source product stock, and logs discrepancies. Auth: caller
// must present Supabase publishable key in `apikey` header (matches the other
// scheduled jobs in the project). No user session is required.
export const Route = createFileRoute("/api/public/hooks/resync-marketplace-stock")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ??
          process.env.SUPABASE_ANON_KEY ??
          "";
        const provided =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (!expected || provided !== expected) {
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
