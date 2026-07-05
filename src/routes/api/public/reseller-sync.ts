import { createFileRoute } from "@tanstack/react-router";

// Webhook endpoint for the external Product Sales site to upsert products into
// our `reseller_products` table. Authenticate with a shared secret sent in
// the `x-webhook-secret` header (or `Authorization: Bearer <secret>`).
export const Route = createFileRoute("/api/public/reseller-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RESELLER_WEBHOOK_SECRET;
        if (!secret) {
          return new Response("Webhook not configured", { status: 500 });
        }
        const provided =
          request.headers.get("x-webhook-secret") ??
          (request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
        if (provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const externalId = String(body.id ?? body.external_id ?? "").trim();
        const name = String(body.name ?? "").trim();
        if (!externalId || !name) {
          return new Response("Missing id or name", { status: 400 });
        }

        const priceNum = Number(body.price ?? 0);
        const resellerPriceRaw = body.reseller_price;
        const resellerPrice =
          resellerPriceRaw === null || resellerPriceRaw === undefined || resellerPriceRaw === ""
            ? null
            : Number(resellerPriceRaw);

        // Stock: honor the webhook value when provided; otherwise seed to a
        // safe default so the marketplace card doesn't render as "Out of
        // Stock" the moment the product is synced. External sources that
        // don't track stock can still update it later via the same webhook.
        const stockRaw = body.stock;
        const parsedStock = stockRaw === null || stockRaw === undefined || stockRaw === ""
          ? null
          : Number(stockRaw);
        const stockNum =
          parsedStock != null && Number.isFinite(parsedStock) && parsedStock >= 0
            ? Math.trunc(parsedStock)
            : 100;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("reseller_products")
          .upsert(
            {
              external_id: externalId,
              name,
              description: (body.description as string | null) ?? null,
              image: (body.image as string | null) ?? null,
              price: Number.isFinite(priceNum) ? priceNum : 0,
              reseller_price: resellerPrice != null && Number.isFinite(resellerPrice) ? resellerPrice : null,
              stock: stockNum,
              source: (body.source as string | null) ?? "product-sales",
              payload: body as never,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "external_id" },
          );

        if (error) {
          console.error("[reseller-sync] upsert failed", error);
          return new Response(`Upsert failed: ${error.message}`, { status: 500 });
        }
        return Response.json({ ok: true, external_id: externalId });
      },
    },
  },
});
