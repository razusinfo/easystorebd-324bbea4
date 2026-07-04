import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;

const Input = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUSES),
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error: uerr } = await supabaseAdmin
      .from("reseller_orders")
      .update({ status: data.status })
      .eq("id", data.id)
      .select(
        "id, product_name, quantity, reseller_price, customer_name, customer_phone, reseller_id, status",
      )
      .single();
    if (uerr) throw new Error(uerr.message);

    // Fire-and-forget notification (don't block on SMS)
    try {
      const { sendOrderStatusUpdate, sendOrderWebhook } = await import("./order-notifications.server");
      await Promise.all([
        sendOrderStatusUpdate(order, data.status),
        sendOrderWebhook(order, "order.status_changed", { new_status: data.status }),
      ]);
    } catch (e) {
      console.warn("[order-status] notification failed:", (e as Error).message);
    }

    return { ok: true as const };
  });
