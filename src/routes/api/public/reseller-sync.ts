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

function clientIp(request: Request): string | null {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  const fwd = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim();
  return fwd || null;
}

type LogRow = {
  source_ip: string | null;
  secret_valid: boolean;
  http_status: number;
  external_id: string | null;
  source: string | null;
  error: string | null;
  payload: unknown;
};

async function writeLog(row: LogRow) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("reseller_sync_webhook_logs").insert(row);
  } catch (e) {
    console.warn("[reseller-sync] failed to write webhook log:", (e as Error).message);
  }
}

export const Route = createFileRoute("/api/public/reseller-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = clientIp(request);
        const secret = process.env.RESELLER_WEBHOOK_SECRET ?? "";
        const provided = request.headers.get("x-webhook-secret") ?? "";
        const secretValid = !!secret && timingSafeEq(provided, secret);
        if (!secretValid) {
          await writeLog({
            source_ip: ip, secret_valid: false, http_status: 401,
            external_id: null, source: null,
            error: "Invalid webhook secret", payload: null,
          });
          return Response.json({ ok: false, error: "Invalid webhook secret" }, { status: 401 });
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          await writeLog({
            source_ip: ip, secret_valid: true, http_status: 400,
            external_id: null, source: null,
            error: "Invalid JSON body", payload: null,
          });
          return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
        }

        const parsed = payloadSchema.safeParse(raw);
        if (!parsed.success) {
          const issues = parsed.error.issues.map((i) => ({ path: i.path, message: i.message }));
          await writeLog({
            source_ip: ip, secret_valid: true, http_status: 400,
            external_id: (raw as any)?.id ?? null,
            source: (raw as any)?.supplier_name ?? (raw as any)?.source ?? null,
            error: "Payload validation failed: " + JSON.stringify(issues),
            payload: raw,
          });
          return Response.json(
            { ok: false, error: "Payload validation failed", issues },
            { status: 400 },
          );
        }
        const p = parsed.data;
        const rawObj = (raw && typeof raw === "object") ? (raw as Record<string, unknown>) : {};

        const mediaUrls = (p.media ?? []).map((m) => m.url).filter(Boolean);
        const candidates: string[] = [];
        for (const u of [p.image ?? null, ...mediaUrls]) {
          if (u && !candidates.includes(u)) candidates.push(u);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { rehostAllImages, resolveCategory } = await import(
          "@/lib/reseller-sync-core.server"
        );

        const supplierSource = p.supplier_name ?? p.source;
        const rehost = await rehostAllImages(supabaseAdmin as never, p.id, candidates);
        if (rehost.status === "failed") {
          console.warn(`[reseller-sync] image rehost failed for ${p.id}: ${rehost.error}`);
        }
        const primaryImage = rehost.imageUrls[0] ?? null;
        const galleryImages = rehost.imageUrls.slice(1);

        const categoryRes = await resolveCategory(
          supabaseAdmin as never,
          rawObj,
          supplierSource,
          p.category ?? null,
        );

        const { data, error } = await (supabaseAdmin as any)
          .from("reseller_products")
          .upsert(
            {
              external_id: p.id,
              name: p.name,
              description: p.description ?? null,
              image: primaryImage,
              image_url: primaryImage,
              gallery_urls: galleryImages,
              price: p.price,
              reseller_price: p.reseller_price,
              stock: p.stock,
              category: categoryRes.category,
              category_missing_reason: categoryRes.missingReason,
              image_sync_status: rehost.status,
              image_sync_error: rehost.error,
              image_sync_attempted_at: rehost.attempted_at,
              source: supplierSource,
              payload: p as never,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "external_id" },
          )
          .select("id")
          .single();

        if (error) {
          await writeLog({
            source_ip: ip, secret_valid: true, http_status: 500,
            external_id: p.id, source: supplierSource,
            error: `Upsert failed: ${error.message}`, payload: raw,
          });
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        await writeLog({
          source_ip: ip, secret_valid: true, http_status: 200,
          external_id: p.id, source: supplierSource,
          error: rehost.status === "failed" ? `image_rehost_failed: ${rehost.error}` : null,
          payload: raw,
        });

        return Response.json({
          ok: true,
          id: data.id,
          image_sync_status: rehost.status,
          image_sync_error: rehost.error,
          category: categoryRes.category,
          category_missing_reason: categoryRes.missingReason,
        });
      },
    },
  },
});
