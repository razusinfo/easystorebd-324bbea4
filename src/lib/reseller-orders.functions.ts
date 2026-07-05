import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;

const Input = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUSES).optional(),
  tracking_id: z.string().trim().max(120).nullable().optional(),
  tracking_url: z.string().trim().url().nullable().optional().or(z.literal("").transform(() => null)),
});

export const updateResellerOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    // Verify caller is super_admin
    const { data: isAdmin, error: rerr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (rerr) throw new Error(rerr.message);
    if (!isAdmin) throw new Error("Forbidden");

    const patch: {
      status?: (typeof STATUSES)[number];
      tracking_id?: string | null;
      tracking_url?: string | null;
    } = {};
    if (data.status !== undefined) patch.status = data.status;
    if (data.tracking_id !== undefined) patch.tracking_id = data.tracking_id || null;
    if (data.tracking_url !== undefined) patch.tracking_url = data.tracking_url || null;
    if (Object.keys(patch).length === 0) return { ok: true as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error: uerr } = await supabaseAdmin
      .from("reseller_orders")
      .update(patch)
      .eq("id", data.id)
      .select(
        "id, product_name, quantity, reseller_price, customer_name, customer_phone, customer_email, reseller_id, status, tracking_id, tracking_url",
      )
      .single();
      .select(
        "id, product_name, quantity, reseller_price, customer_name, customer_phone, customer_email, reseller_id, status, tracking_id, tracking_url",
      )
      .single();
    if (uerr) throw new Error(uerr.message);

    // Fire-and-forget notification (don't block on SMS)
    try {
      const { sendOrderStatusUpdate, sendOrderWebhook } = await import("./order-notifications.server");
      const statusForNotice = data.status ?? order.status;
      await Promise.all([
        sendOrderStatusUpdate(order, statusForNotice, {
          tracking_id: order.tracking_id,
          tracking_url: order.tracking_url,
        }),
        sendOrderWebhook(order, "order.status_changed", {
          new_status: statusForNotice,
          tracking_id: order.tracking_id,
          tracking_url: order.tracking_url,
        }),
      ]);
    } catch (e) {
      console.warn("[order-status] notification failed:", (e as Error).message);
    }

    return { ok: true as const };
  });
