import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AuditInput = z.object({
  store_id: z.string().uuid(),
  action: z.enum(["upload", "change", "remove", "toggle"]),
  old_path: z.string().nullable().optional(),
  new_path: z.string().nullable().optional(),
  affected_scopes: z.array(z.enum(["slug", "subdomain", "custom_domain"])).default([]),
  host_snapshot: z.string().max(255).nullable().optional(),
});

/**
 * Record a reseller splash-logo change (upload / replacement / removal / toggle).
 * The row is scoped to a store the caller owns — or super_admin.
 */
export const recordSplashAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AuditInput.parse(data))
  .handler(async ({ data, context }) => {
    // Verify the caller can modify this store.
    const { data: store, error: storeErr } = await context.supabase
      .from("stores")
      .select("id, owner_user_id")
      .eq("id", data.store_id)
      .maybeSingle();
    if (storeErr) throw new Error(storeErr.message);
    if (!store) throw new Error("Store not found");

    let allowed = store.owner_user_id === context.userId;
    if (!allowed) {
      const { data: isAdmin } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "super_admin",
      });
      allowed = Boolean(isAdmin);
    }
    if (!allowed) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("splash_logo_audit_logs")
      .insert({
        store_id: data.store_id,
        actor_id: context.userId,
        action: data.action,
        old_path: data.old_path ?? null,
        new_path: data.new_path ?? null,
        affected_scopes: data.affected_scopes,
        host_snapshot: data.host_snapshot ?? null,
      });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** List recent splash-logo audit rows for a store the caller can access. */
export const listSplashAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      store_id: z.string().uuid(),
      limit: z.number().int().min(1).max(100).default(25),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("splash_logo_audit_logs")
      .select("id, action, old_path, new_path, affected_scopes, host_snapshot, created_at")
      .eq("store_id", data.store_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });
