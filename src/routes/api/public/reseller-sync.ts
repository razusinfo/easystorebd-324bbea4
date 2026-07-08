import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Suppliers send category as either a plain string, an object like
// { name: "..." } / { title: "..." }, or under aliases (category_name).
const categoryField = z
  .union([
    z.string(),
    z.object({ name: z.string().optional(), title: z.string().optional(), label: z.string().optional() }).passthrough(),
  ])
  .nullable()
  .optional()
  .transform((v) => {
    if (!v) return null;
    if (typeof v === "string") return v.trim() || null;
    const s = (v.name ?? v.title ?? v.label ?? "").toString().trim();
    return s || null;
  });

const payloadSchema = z
  .object({
    id: z.string().min(1, "id required"),
    name: z.string().trim().min(1, "name required").max(500),
    description: z.string().max(20000).optional().nullable(),
    image: z.string().url("image must be a valid URL").nullable().optional(),
    price: z.coerce.number().nonnegative("price must be >= 0"),
    reseller_price: z.coerce.number().nonnegative("reseller_price must be >= 0"),
    // Suppliers that don't track stock send 0 or omit it — treat as "unlimited"
    // so items don't display as out of stock on the marketplace.
    stock: z.coerce.number().int().nonnegative().optional().transform((v) => (v && v > 0 ? v : 9999)),
    source: z.string().trim().min(1, "source required").max(100),
    supplier_name: z.string().trim().min(1).max(200).optional(),
    category: categoryField,
    category_name: categoryField,
    media: z.array(z.object({ url: z.string().url() }).passthrough()).max(20).optional(),
  })
  .passthrough()
  .transform((v) => ({ ...v, category: v.category ?? v.category_name ?? null }));

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
        const originalImageUrl = p.image ?? firstMediaUrl ?? null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Suppliers ship short-lived signed URLs. Rehost the primary image
        // into our own bucket so it keeps working after their token expires.
        let imageUrl: string | null = originalImageUrl;
        if (originalImageUrl) {
          try {
            const res = await fetch(originalImageUrl);
            if (res.ok) {
              const buf = new Uint8Array(await res.arrayBuffer());
              const ct = res.headers.get("content-type") || "image/jpeg";
              const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
              const path = `${p.id}/${Date.now()}.${ext}`;
              const { error: upErr } = await supabaseAdmin.storage
                .from("reseller-images")
                .upload(path, buf, { contentType: ct, upsert: true });
              if (!upErr) {
                const { data: signed } = await supabaseAdmin.storage
                  .from("reseller-images")
                  .createSignedUrl(path, 60 * 60 * 24 * 365 * 10); // 10 years
                if (signed?.signedUrl) imageUrl = signed.signedUrl;
              }
            }
          } catch {
            // fall back to the supplier's URL
          }
        }
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
