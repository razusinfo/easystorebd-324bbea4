import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  id: z.string().min(1, "id required"),
  name: z.string().trim().min(1, "name required").max(500),
  description: z.string().max(20000).optional().nullable(),
  image: z.string().url("image must be a valid URL").nullable().optional(),
  price: z.coerce.number().nonnegative("price must be >= 0"),
  reseller_price: z.coerce.number().nonnegative("reseller_price must be >= 0"),
  stock: z.coerce.number().int().nonnegative().default(0),
  source: z.string().trim().min(1, "source required").max(100),
  supplier_name: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().max(200).optional().nullable(),
  media: z.array(z.object({ url: z.string().url() }).passthrough()).max(20).optional(),
});

function timingSafeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export const Route = createFileRoute("/api/public/reseller-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RESELLER_WEBHOOK_SECRET ?? "";
        const provided = request.headers.get("x-webhook-secret") ?? "";
        if (!secret || !timingSafeEq(provided, secret)) {
          return Response.json({ ok: false, error: "Invalid webhook secret" }, { status: 401 });
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
        }

        const parsed = payloadSchema.safeParse(raw);
        if (!parsed.success) {
          return Response.json(
            {
              ok: false,
              error: "Payload validation failed",
              issues: parsed.error.issues.map((i) => ({
                path: i.path,
                message: i.message,
              })),
            },
            { status: 400 },
          );
        }
        const p = parsed.data;

        const firstMediaUrl = p.media?.[0]?.url ?? null;
        const imageUrl = p.image ?? firstMediaUrl ?? null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("reseller_products")
          .upsert(
            {
              external_id: p.id,
              name: p.name,
              description: p.description ?? null,
              image: imageUrl,
              image_url: imageUrl,
              price: p.price,
              reseller_price: p.reseller_price,
              stock: p.stock,
              category: p.category ?? null,
              source: p.supplier_name ?? p.source,
              payload: p as never,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "external_id" },
          )
          .select("id")
          .single();

        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }
        return Response.json({ ok: true, id: data.id });
      },
    },
  },
});
