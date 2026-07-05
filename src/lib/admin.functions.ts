import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const APP_ROLES = [
  "super_admin",
  "store_owner",
  "manager",
  "cashier",
  "salesman",
  "accountant",
  "technician",
  "warehouse_manager",
] as const;

async function assertSuperAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Access denied: super_admin only");
}

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("admin_list_users");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminListAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ limit: z.number().int().min(1).max(500).optional() }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("admin_list_audit_logs", { _limit: data.limit ?? 200 });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const roleInput = z.object({
  targetUserId: z.string().uuid(),
  role: z.enum(APP_ROLES),
  notes: z.string().trim().max(500).optional(),
});

export const adminAssignRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => roleInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("admin_assign_role", {
      _target_user_id: data.targetUserId,
      _role: data.role,
      _notes: data.notes,
      _actor_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminRevokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => roleInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("admin_revoke_role", {
      _target_user_id: data.targetUserId,
      _role: data.role,
      _notes: data.notes,
      _actor_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * List reseller-marketplace audit log entries (super_admin only).
 * Filters:
 *   - action:   optional exact match (e.g. "admin_revoke")
 *   - actorId:  optional actor uuid
 *   - since:    optional ISO timestamp lower bound (created_at >= since)
 *   - search:   optional substring match against product name in metadata
 */
export const adminListResellerAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      limit: z.number().int().min(1).max(500).optional(),
      action: z.string().trim().min(1).max(64).optional(),
      actorId: z.string().uuid().optional(),
      since: z.string().datetime().optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("reseller_marketplace_audit_logs")
      .select("id, actor_id, actor_role, action, product_id, success, error, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.action) q = q.eq("action", data.action);
    if (data.actorId) q = q.eq("actor_id", data.actorId);
    if (data.since) q = q.gte("created_at", data.since);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const actorIds = Array.from(
      new Set((rows ?? []).map((r) => r.actor_id).filter((v): v is string => !!v)),
    );
    const emails = new Map<string, string>();
    if (actorIds.length) {
      const { data: users } = await supabaseAdmin
        .from("profiles")
        .select("id, name")
        .in("id", actorIds);
      for (const u of users ?? []) emails.set(u.id, u.name ?? "");
      // Also fetch auth emails via admin API for accuracy.
      for (const id of actorIds) {
        try {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
          if (u?.user?.email) emails.set(id, u.user.email);
        } catch { /* ignore */ }
      }
    }
    return (rows ?? []).map((r) => ({
      ...r,
      actor_email: r.actor_id ? emails.get(r.actor_id) ?? null : null,
    }));
  });

