import { createFileRoute } from "@tanstack/react-router";

// Courier delivery webhook.
//
// External couriers (Pathao/Steadfast/etc.) POST status updates here. We
// authenticate via a shared secret in the `x-webhook-secret` header (reuses
// the existing RESELLER_WEBHOOK_SECRET to avoid a new secret rotation) and
// route "Delivered" events through a SECURITY DEFINER RPC that is idempotent:
// wallet settlement runs exactly once per order regardless of how many times
// the webhook fires.
//
// Expected body:
//   { order_id: string, status: string, provider?: string }
// `status` is matched case-insensitively against known "delivered" values.

const DELIVERED_STATUSES = new Set([
  "delivered",
  "delivery_completed",
  "delivery-completed",
  "completed",
  "success",
]);

export const Route = createFileRoute("/api/public/hooks/courier-status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RESELLER_WEBHOOK_SECRET;
        if (!secret) {
          return new Response("Webhook secret not configured", { status: 500 });
        }
        const provided = request.headers.get("x-webhook-secret") ?? "";
        if (provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: { order_id?: string; status?: string; provider?: string; tracking_id?: string };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const orderId = payload.order_id?.trim();
        const status = (payload.status ?? "").trim();
        if (!orderId || !status) {
          return new Response("order_id and status are required", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Non-delivered events: just record the courier status/provider,
        // don't touch settlement.
        if (!DELIVERED_STATUSES.has(status.toLowerCase())) {
          const { error } = await supabaseAdmin
            .from("reseller_orders")
            .update({
              courier_provider: payload.provider ?? null,
              courier_status: status,
              tracking_id: payload.tracking_id ?? undefined,
            })
            .eq("id", orderId);
          if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
          return Response.json({ ok: true, settled: false, status });
        }

        // Delivered: idempotent RPC — will not double-settle even if we
        // receive the same webhook multiple times.
        const { data, error } = await (
          supabaseAdmin.rpc as unknown as (
            fn: string,
            args: Record<string, unknown>,
          ) => Promise<{ data: { id: string; settled_at: string | null; delivered_at: string | null } | null; error: { message: string } | null }>
        )("mark_reseller_order_delivered", {
          _order_id: orderId,
          _provider: payload.provider ?? null,
          _external_status: status,
        });

        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }
        return Response.json({
          ok: true,
          settled: !!data?.settled_at,
          delivered_at: data?.delivered_at ?? null,
          order_id: data?.id ?? orderId,
        });
      },
    },
  },
});
