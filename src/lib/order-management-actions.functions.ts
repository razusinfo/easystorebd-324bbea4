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
      .select("id, reseller_id, status, tracking_id, tracking_url, product_name, quantity")
      .eq("id", data.id)
      .maybeSingle();
    if (cerr) throw new Error(cerr.message);
    if (!current) throw new Error("Order not found");

    // Supplier scoping — must own the row.
    if (role === "supplier" && current.reseller_id !== userId) {
      throw new Error("Forbidden: order does not belong to this supplier");
    }

    // Field-level allow list per role.
    const patch: Partial<{ status: Status; tracking_id: string | null; tracking_url: string | null }> = {};
    if (data.status !== undefined) {
      if (role === "supplier" && !SUPPLIER_ALLOWED.includes(data.status)) {
        throw new Error(`Forbidden: suppliers may only set status to ${SUPPLIER_ALLOWED.join(", ")}`);
      }
      patch.status = data.status;
    }
    if (data.tracking_id !== undefined) patch.tracking_id = data.tracking_id || null;
    if (data.tracking_url !== undefined) patch.tracking_url = data.tracking_url || null;
    if (Object.keys(patch).length === 0) return { ok: true as const };

    const { data: updated, error: uerr } = await supabaseAdmin
      .from("reseller_orders")
      .update(patch)
      .eq("id", data.id)
      .select("id, status, tracking_id, tracking_url, reseller_id, product_name, quantity, reseller_price, customer_name, customer_phone, customer_email")
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
          },
          after: {
            status: updated.status,
            tracking_id: updated.tracking_id,
            tracking_url: updated.tracking_url,
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
