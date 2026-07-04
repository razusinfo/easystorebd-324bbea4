import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

const OrderSchema = z.object({
  reseller_id: z.string().uuid(),
  product_id: z.string().uuid(), // reseller_products.id (or external_id)
  quantity: z.number().int().positive().max(999),
  customer: z.object({
    name: z.string().min(1).max(120),
    phone: z.string().max(40).optional(),
    email: z.string().email().max(160).optional(),
  }),
  shipping_address: z.string().min(3).max(1000),
  customer_price: z.number().nonnegative().optional(),
  source: z.string().max(80).optional(),
  notes: z.string().max(1000).optional(),
});

export const Route = createFileRoute("/api/public/orders/place")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }
        const parsed = OrderSchema.safeParse(body);
        if (!parsed.success) {
          return json({ error: "Invalid input", issues: parsed.error.flatten() }, 400);
        }
        const o = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Resolve reseller product (id OR external_id) + per-reseller custom price.
        const { data: prod, error: prodErr } = await supabaseAdmin
          .from("reseller_products")
          .select(
            "id, name, price, reseller_price, user_reseller_settings!left(custom_price, user_id)",
          )
          .or(`id.eq.${o.product_id},external_id.eq.${o.product_id}`)
          .eq("user_reseller_settings.user_id", o.reseller_id)
          .maybeSingle();

        if (prodErr) return json({ error: prodErr.message }, 500);
        if (!prod) return json({ error: "Product not found" }, 404);

        const custom = (prod.user_reseller_settings as
          | Array<{ custom_price: number | null }>
          | null)?.[0] ?? null;
        const resellerPrice = Number(custom?.custom_price ?? prod.reseller_price ?? 0);
        const originalPrice = Number(prod.price ?? 0);

        const { data: order, error: insErr } = await supabaseAdmin
          .from("reseller_orders")
          .insert({
            reseller_id: o.reseller_id,
            reseller_product_id: prod.id,
            product_name: prod.name,
            customer_name: o.customer.name,
            customer_phone: o.customer.phone ?? null,
            customer_email: o.customer.email ?? null,
            shipping_address: o.shipping_address,
            quantity: o.quantity,
            original_price: originalPrice,
            reseller_price: resellerPrice,
            customer_price: o.customer_price ?? null,
            source: o.source ?? "api",
            notes: o.notes ?? null,
          })
          .select("id, status, created_at, reseller_price, quantity, profit_margin")
          .single();

        if (insErr) return json({ error: insErr.message }, 500);

        // Fire-and-forget SMS confirmation to the customer.
        try {
          const { sendOrderConfirmation } = await import(
            "@/lib/order-notifications.server"
          );
          await sendOrderConfirmation({
            id: order.id,
            product_name: prod.name,
            quantity: o.quantity,
            reseller_price: resellerPrice,
            customer_name: o.customer.name,
            customer_phone: o.customer.phone ?? null,
            customer_email: o.customer.email ?? null,
            reseller_id: o.reseller_id,
          });
        } catch (e) {
          console.warn("[orders.place] SMS failed:", (e as Error).message);
        }

        return json({
          ok: true,
          order_id: order.id,
          status: order.status,
          total_charged: Number(order.reseller_price) * order.quantity,
          created_at: order.created_at,
        }, 201);
      },
    },
  },
});
