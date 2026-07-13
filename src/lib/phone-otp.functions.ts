import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  constantTimeEqualHash,
  createOtpCode,
  createTemporaryPassword,
  findUserByPhone,
  hashPhoneOtpCode,
  sendBulkSmsBd,
} from "@/lib/phone-otp.server";

const phoneRegex = /^\+[1-9][0-9]{6,18}$/;

const sendInput = z.object({
  phone: z.string().regex(phoneRegex, "Invalid phone (use international format like +8801XXXXXXXXX)"),
  fullName: z.string().trim().max(120).optional(),
  isSignup: z.boolean(),
});

const verifyInput = z.object({
  phone: z.string().regex(phoneRegex),
  code: z.string().regex(/^[0-9]{6}$/),
  fullName: z.string().trim().max(120).optional(),
  isSignup: z.boolean(),
});

export const sendPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => sendInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Rate limit: max 3 OTPs per phone per 5 minutes
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("phone_otps")
      .select("id", { count: "exact", head: true })
      .eq("phone", data.phone)
      .gte("created_at", since);
    if ((count ?? 0) >= 3) {
      throw new Error("Too many requests. Please wait a few minutes before requesting a new code.");
    }

    // If signup, refuse if a confirmed user already exists with this phone
    if (data.isSignup) {
      const existing = await findUserByPhone(supabaseAdmin, data.phone);
      if (existing) {
        throw new Error("This phone number is already registered. Please sign in instead.");
      }
    }

    const code = createOtpCode();
    const expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Invalidate any previous unused codes for this phone
    await supabaseAdmin
      .from("phone_otps")
      .update({ consumed: true })
      .eq("phone", data.phone)
      .eq("consumed", false);

    const { error: insertErr } = await supabaseAdmin.from("phone_otps").insert({
      phone: data.phone,
      code_hash: hashPhoneOtpCode(data.phone, code),
      expires_at,
    });
    if (insertErr) throw new Error(insertErr.message);

    // Load admin-configurable SMS template (falls back to default)
    const { data: settings } = await supabaseAdmin
      .from("sms_settings")
      .select("otp_template, signature, app_name")
      .eq("id", true)
      .maybeSingle();

    const template =
      settings?.otp_template ??
      "Your {app} verification code is {code}. It expires in {minutes} minutes. Do not share this code.{signature}";
    const appName = settings?.app_name ?? "EasyStore";
    const signature = settings?.signature ?? "";
    const signatureBlock = signature ? `\n${signature}` : "";
    const message = template
      .replaceAll("{code}", code)
      .replaceAll("{minutes}", "5")
      .replaceAll("{app}", appName)
      .replaceAll("{signature}", signatureBlock);

    await sendBulkSmsBd(data.phone, message);

    return { ok: true as const };
  });

export const verifyPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => verifyInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error: selErr } = await supabaseAdmin
      .from("phone_otps")
      .select("id, code_hash, expires_at, attempts, consumed")
      .eq("phone", data.phone)
      .eq("consumed", false)
      .order("created_at", { ascending: false })
      .limit(1);
    if (selErr) throw new Error(selErr.message);
    const otp = rows?.[0];
    if (!otp) throw new Error("No active verification code. Please request a new one.");
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("phone_otps").update({ consumed: true }).eq("id", otp.id);
      throw new Error("This code has expired. Please request a new one.");
    }
    if (otp.attempts >= 5) {
      await supabaseAdmin.from("phone_otps").update({ consumed: true }).eq("id", otp.id);
      throw new Error("Too many wrong attempts. Please request a new code.");
    }

    const expected = hashPhoneOtpCode(data.phone, data.code);
    if (!constantTimeEqualHash(otp.code_hash, expected)) {
      await supabaseAdmin
        .from("phone_otps")
        .update({ attempts: otp.attempts + 1 })
        .eq("id", otp.id);
      throw new Error("Incorrect code. Please try again.");
    }

    // Mark consumed
    await supabaseAdmin.from("phone_otps").update({ consumed: true }).eq("id", otp.id);

    let user = await findUserByPhone(supabaseAdmin, data.phone);

    if (!user) {
      if (!data.isSignup) {
        throw new Error("No account found for this phone number. Please sign up first.");
      }
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        phone: data.phone,
        phone_confirm: true,
        user_metadata: data.fullName ? { full_name: data.fullName, name: data.fullName } : undefined,
      });
      if (createErr || !created.user) throw new Error(createErr?.message ?? "Could not create account");
      user = created.user;
    }

    // Mint a one-time strong password and return it to the client, which immediately
    // signs in with phone + password. This is the standard pattern for custom SMS OTP
    // providers when Supabase's built-in OTP cannot be used.
    const oneTimePassword = createTemporaryPassword();
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: oneTimePassword,
    });
    if (updErr) throw new Error(updErr.message);

    return { phone: data.phone, password: oneTimePassword };
  });
