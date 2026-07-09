import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Response("Forbidden: super_admin only", { status: 403 });
}

// ─────────────────────────── Category Mappings CRUD ───────────────────────────

export const listCategoryMappings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("reseller_category_mappings")
      .select("id, source, payload_path, fallback_value, priority, notes, created_at, updated_at")
      .order("priority", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string; source: string | null; payload_path: string | null;
      fallback_value: string | null; priority: number; notes: string | null;
      created_at: string; updated_at: string;
    }>;
  });

const mappingInput = z.object({
  id: z.string().uuid().optional().nullable(),
  source: z.string().trim().max(120).optional().nullable().transform((v) => (v && v.length > 0 ? v : null)),
  payload_path: z.string().trim().max(200).optional().nullable().transform((v) => (v && v.length > 0 ? v : null)),
  fallback_value: z.string().trim().max(200).optional().nullable().transform((v) => (v && v.length > 0 ? v : null)),
  priority: z.coerce.number().int().min(0).max(10000).default(100),
  notes: z.string().trim().max(1000).optional().nullable().transform((v) => (v && v.length > 0 ? v : null)),
}).refine((v) => v.payload_path !== null || v.fallback_value !== null, {
  message: "Provide a payload path, a fallback value, or both",
});

export const saveCategoryMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => mappingInput.parse(raw))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      source: data.source,
      payload_path: data.payload_path,
      fallback_value: data.fallback_value,
      priority: data.priority,
      notes: data.notes,
    };
    if (data.id) {
      const { error } = await (supabaseAdmin as any).from("reseller_category_mappings").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: inserted, error } = await (supabaseAdmin as any)
      .from("reseller_category_mappings")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (inserted as { id: string }).id };
  });

export const deleteCategoryMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("reseller_category_mappings" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────────────────────── Sync-status list + Retry ─────────────────────────

export const listResellerSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("reseller_products")
      .select(
        "id, external_id, name, source, category, image_url, image_sync_status, image_sync_error, image_sync_attempted_at, category_missing_reason, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string; external_id: string; name: string; source: string | null;
      category: string | null; image_url: string | null;
      image_sync_status: string | null; image_sync_error: string | null;
      image_sync_attempted_at: string | null; category_missing_reason: string | null;
      updated_at: string;
    }>;
  });

export const retryImageRehost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ reseller_product_id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rehostAllImages } = await import("./reseller-sync-core.server");

    const { data: row, error: readErr } = await supabaseAdmin
      .from("reseller_products")
      .select("id, external_id, image, image_url, gallery_urls, payload")
      .eq("id", data.reseller_product_id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!row) throw new Response("Not found", { status: 404 });

    // Collect all candidates: original payload.image, payload.media[], then stored fallbacks.
    const payload = ((row as any).payload ?? {}) as Record<string, unknown>;
    const media = Array.isArray((payload as any).media) ? ((payload as any).media as Array<{ url?: string }>) : [];
    const candidates: string[] = [];
    for (const u of [
      (payload as any).image as string | undefined,
      ...media.map((m) => m?.url).filter(Boolean) as string[],
      (row as any).image_url as string | null,
      (row as any).image as string | null,
    ]) {
      if (typeof u === "string" && u && !candidates.includes(u)) candidates.push(u);
    }

    const result = await rehostAllImages(supabaseAdmin as never, (row as any).external_id, candidates);
    const primary = result.imageUrls[0] ?? null;
    const gallery = result.imageUrls.slice(1);
    const update: Record<string, unknown> = {
      image_sync_status: result.status,
      image_sync_error: result.error,
      image_sync_attempted_at: result.attempted_at,
      updated_at: new Date().toISOString(),
    };
    if (result.imageUrls.length > 0) {
      update.image = primary;
      update.image_url = primary;
      update.gallery_urls = gallery;
    }
    const { error: updErr } = await supabaseAdmin
      .from("reseller_products")
      .update(update as never)
      .eq("id", data.reseller_product_id);
    if (updErr) throw new Error(updErr.message);
    return { ok: true, status: result.status, error: result.error, imageUrl: primary, gallery };
  });
  });
