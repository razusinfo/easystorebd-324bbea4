import { createFileRoute } from "@tanstack/react-router";

// Courier webhook for regular shop orders.
//
// External couriers (Pathao/Steadfast/RedX/Paperfly/etc.) POST status
// updates here. Auth via shared secret in `x-webhook-secret` (reuses
// RESELLER_WEBHOOK_SECRET). Delegates to the SECURITY DEFINER RPC
// `apply_courier_order_status`, which maps the external status → internal
// order status, updates tracking fields, and lets the AFTER UPDATE trigger
// on `orders` append a timeline event. Idempotent — repeated calls with the
// same payload do not create duplicate history.
//
// Body: { order_id, status, provider?, tracking_id?, tracking_url? }

export const Route = createFileRoute("/api/public/hooks/order-courier-status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RESELLER_WEBHOOK_SECRET;
        if (!secret) return new Response("Webhook secret not configured", { status: 500 });
        if ((request.headers.get("x-webhook-secret") ?? "") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: {
          order_id?: string; status?: string; provider?: string;
          tracking_id?: string; tracking_url?: string;
        };
        try { payload = (await request.json()) as typeof payload; }
        catch { return new Response("Invalid JSON", { status: 400 }); }

        const orderId = payload.order_id?.trim();
        const status = (payload.status ?? "").trim();
        if (!orderId || !status) {
          return new Response("order_id and status are required", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data, error } = await (
          supabaseAdmin.rpc as unknown as (
            fn: string, args: Record<string, unknown>,
          ) => Promise<{ data: { id: string; status: string; delivered_at: string | null } | null; error: { message: string } | null }>
        )("apply_courier_order_status", {
          _order_id: orderId,
          _provider: payload.provider ?? null,
          _external_status: status,
          _tracking_id: payload.tracking_id ?? null,
          _tracking_url: payload.tracking_url ?? null,
        });

        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        if (!data) return Response.json({ ok: false, error: "order not found" }, { status: 404 });

        return Response.json({
          ok: true, order_id: data.id, status: data.status, delivered_at: data.delivered_at,
        });
      },
    },
  },
});
