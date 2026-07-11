import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const updateInput = z.object({
  otp_template: z
    .string()
    .trim()
    .min(10, "Template must be at least 10 characters")
    .max(480, "Template is too long")
    .refine((s) => s.includes("{code}"), "Template must include the {code} placeholder"),
  signature: z.string().trim().max(80, "Signature must be 80 characters or less"),
  app_name: z.string().trim().min(1, "App name is required").max(40),
});

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super_admin role required");
}

export const getSmsSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("sms_settings")
      .select("otp_template, signature, app_name, updated_at")
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (
      data ?? {
        otp_template:
          "Your {app} verification code is {code}. It expires in {minutes} minutes. Do not share this code.{signature}",
        signature: "",
        app_name: "EasyStore",
        updated_at: null,
      }
    );
  });

export const updateSmsSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("sms_settings")
      .upsert({
        id: true,
        otp_template: data.otp_template,
        signature: data.signature,
        app_name: data.app_name,
        updated_by: context.userId,
      });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
