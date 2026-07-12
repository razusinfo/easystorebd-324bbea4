import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;
type Status = (typeof STATUSES)[number];

// Suppliers may progress fulfillment; only super admins may cancel or
// reopen back to pending.
const SUPPLIER_ALLOWED: Status[] = ["confirmed", "shipped", "delivered"];

const Input = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUSES).optional(),
  tracking_id: z.string().trim().max(120).nullable().optional(),
  tracking_url: z
    .string()
    .trim()
    .url()
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const updateManagedOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    const role: "super_admin" | "supplier" = isAdmin ? "super_admin" : "supplier";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load current row for authorization & audit before/after values.
    const { data: current, error: cerr } = await supabaseAdmin
      .from("reseller_orders")
      .select("id, reseller_id, status, tracking_id, tracking_url, notes, product_name, quantity")
      .eq("id", data.id)
      .maybeSingle();
    if (cerr) throw new Error(cerr.message);
    if (!current) throw new Error("Order not found");

    // Supplier scoping — must own the row.
    if (role === "supplier" && current.reseller_id !== userId) {
      throw new Error("Forbidden: order does not belong to this supplier");
    }

    // Field-level allow list per role.
    const patch: Partial<{ status: Status; tracking_id: string | null; tracking_url: string | null; notes: string | null }> = {};
    if (data.status !== undefined) {
      if (role === "supplier" && !SUPPLIER_ALLOWED.includes(data.status)) {
        throw new Error(`Forbidden: suppliers may only set status to ${SUPPLIER_ALLOWED.join(", ")}`);
      }
      patch.status = data.status;
    }
    if (data.tracking_id !== undefined) patch.tracking_id = data.tracking_id || null;
    if (data.tracking_url !== undefined) patch.tracking_url = data.tracking_url || null;
    if (data.notes !== undefined) patch.notes = data.notes || null;
    if (Object.keys(patch).length === 0) return { ok: true as const };

    const { data: updated, error: uerr } = await supabaseAdmin
      .from("reseller_orders")
      .update(patch)
      .eq("id", data.id)
      .select("id, status, tracking_id, tracking_url, notes, reseller_id, product_name, quantity, reseller_price, customer_name, customer_phone, customer_email")
      .single();
    if (uerr) throw new Error(uerr.message);

    // Audit — reuse admin_audit_logs; target_user_id = reseller (order owner).
    try {
      await supabaseAdmin.from("admin_audit_logs").insert({
        actor_id: userId,
        target_user_id: current.reseller_id,
        action: "reseller_order.update",
        role: role === "super_admin" ? "super_admin" : "store_owner",
        notes: JSON.stringify({
          order_id: data.id,
          before: {
            status: current.status,
            tracking_id: current.tracking_id,
            tracking_url: current.tracking_url,
            notes: current.notes,
          },
          after: {
            status: updated.status,
            tracking_id: updated.tracking_id,
            tracking_url: updated.tracking_url,
            notes: updated.notes,
          },
        }),
      });
    } catch (e) {
      console.warn("[order-audit] insert failed:", (e as Error).message);
    }

    // Fire-and-forget customer notification for status transitions.
    try {
      if (data.status) {
        const { sendOrderStatusUpdate } = await import("./order-notifications.server");
        await sendOrderStatusUpdate(updated, data.status, {
          tracking_id: updated.tracking_id,
          tracking_url: updated.tracking_url,
        });
      }
    } catch (e) {
      console.warn("[order-status] notification failed:", (e as Error).message);
    }

    return { ok: true as const, role };
  });

// -----------------------------------------------------------------------------
// Bulk status update — applies the same status/tracking to many orders at once.
// -----------------------------------------------------------------------------

const BulkInput = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  status: z.enum(STATUSES).optional(),
  tracking_id: z.string().trim().max(120).nullable().optional(),
  tracking_url: z
    .string()
    .trim()
    .url()
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const bulkUpdateManagedOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => BulkInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    const role: "super_admin" | "supplier" = isAdmin ? "super_admin" : "supplier";
    if (data.status && role === "supplier" && !SUPPLIER_ALLOWED.includes(data.status)) {
      throw new Error(`Forbidden: suppliers may only set status to ${SUPPLIER_ALLOWED.join(", ")}`);
    }

    const patch: Partial<{ status: Status; tracking_id: string | null; tracking_url: string | null; notes: string | null }> = {};
    if (data.status !== undefined) patch.status = data.status;
    if (data.tracking_id !== undefined) patch.tracking_id = data.tracking_id || null;
    if (data.tracking_url !== undefined) patch.tracking_url = data.tracking_url || null;
    if (data.notes !== undefined) patch.notes = data.notes || null;
    if (Object.keys(patch).length === 0) return { ok: true as const, updated: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error: lerr } = await supabaseAdmin
      .from("reseller_orders")
      .select("id, reseller_id, status")
      .in("id", data.ids);
    if (lerr) throw new Error(lerr.message);
    const owned = (rows ?? []).filter(
      (r) => role === "super_admin" || r.reseller_id === userId,
    );
    if (owned.length === 0) return { ok: true as const, updated: 0 };

    const ids = owned.map((r) => r.id);
    const { error: uerr } = await supabaseAdmin
      .from("reseller_orders")
      .update(patch)
      .in("id", ids);
    if (uerr) throw new Error(uerr.message);

    try {
      await supabaseAdmin.from("admin_audit_logs").insert(
        owned.map((r) => ({
          actor_id: userId,
          target_user_id: r.reseller_id,
          action: "reseller_order.bulk_update",
          role: role === "super_admin" ? "super_admin" : "store_owner",
          notes: JSON.stringify({ order_id: r.id, patch }),
        })),
      );
    } catch (e) {
      console.warn("[order-bulk] audit insert failed:", (e as Error).message);
    }

    return { ok: true as const, updated: ids.length, role };
  });

// -----------------------------------------------------------------------------
// Order timeline — pulls status/tracking/notes change history from audit log.
// -----------------------------------------------------------------------------

export const getOrderTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    const role: "super_admin" | "supplier" = isAdmin ? "super_admin" : "supplier";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (role === "supplier") {
      const { data: row } = await supabaseAdmin
        .from("reseller_orders")
        .select("reseller_id")
        .eq("id", data.id)
        .maybeSingle();
      if (!row || row.reseller_id !== userId) {
        throw new Error("Forbidden");
      }
    }

    const { data: logs, error } = await supabaseAdmin
      .from("admin_audit_logs")
      .select("id, actor_id, action, notes, created_at")
      .in("action", ["reseller_order.update", "reseller_order.bulk_update"])
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    type Entry = {
      id: string;
      at: string;
      actor_id: string | null;
      actor_name: string | null;
      action: string;
      before: Record<string, unknown> | null;
      after: Record<string, unknown> | null;
      patch: Record<string, unknown> | null;
    };
    const filtered: Entry[] = [];
    for (const l of logs ?? []) {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = l.notes ? JSON.parse(l.notes as string) : {};
      } catch { /* ignore */ }
      if (parsed.order_id !== data.id) continue;
      filtered.push({
        id: l.id as string,
        at: l.created_at as string,
        actor_id: (l.actor_id as string) ?? null,
        actor_name: null,
        action: l.action as string,
        before: (parsed.before as Record<string, unknown>) ?? null,
        after: (parsed.after as Record<string, unknown>) ?? null,
        patch: (parsed.patch as Record<string, unknown>) ?? null,
      });
    }

    const actorIds = Array.from(
      new Set(filtered.map((f) => f.actor_id).filter((v): v is string => !!v)),
    );
    if (actorIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, name")
        .in("id", actorIds);
      const nameMap = new Map<string, string>();
      for (const p of profs ?? []) nameMap.set(p.id, p.name ?? "");
      for (const f of filtered) {
        if (f.actor_id) f.actor_name = nameMap.get(f.actor_id) ?? null;
      }
    }

    return { entries: filtered };
  });
