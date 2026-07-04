import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;

const SettingsSchema = z.object({
  email_enabled: z.boolean(),
  sms_enabled: z.boolean(),
  from_email: z.string().email().max(160),
  from_name: z.string().trim().min(1).max(80),
  reply_to: z.string().email().max(160).nullable().optional(),
  notify_customer: z.boolean(),
  notify_reseller: z.boolean(),
  statuses_email: z.array(z.enum(STATUSES)).default([]),
  statuses_sms: z.array(z.enum(STATUSES)).default([]),
  delivery_eta: z.string().trim().min(1).max(80),
  whatsapp_webhook_url: z
    .string()
    .trim()
    .max(500)
    .url()
    .or(z.literal(""))
    .nullable()
    .optional(),
});

async function assertSuperAdmin(ctx: { supabase: any; userId: string }): Promise<void> {
  const { data: isAdmin, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Forbidden");
}

export const updateNotificationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SettingsSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("notification_settings")
      .upsert({ id: true, ...data, reply_to: data.reply_to ?? null })
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getNotificationProviderStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    return {
      resend_configured: Boolean(process.env.RESEND_API_KEY),
      sms_configured: Boolean(
        process.env.BULKSMSBD_API_KEY && process.env.BULKSMSBD_SENDER_ID,
      ),
    };
  });

export const sendTestOrderEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ to: z.string().email() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { sendOrderConfirmation } = await import("./order-notifications.server");
    await sendOrderConfirmation({
      id: "00000000-0000-0000-0000-000000000000",
      product_name: "Test Product",
      quantity: 1,
      reseller_price: 500,
      customer_name: "Test Customer",
      customer_phone: null,
      customer_email: data.to,
      reseller_id: context.userId,
    });
    return { ok: true as const };
  });
