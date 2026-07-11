import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";

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

function hashCode(phone: string, code: string): string {
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

async function sendBulkSmsBd(phone: string, message: string): Promise<void> {
  const apiKey = process.env.BULKSMSBD_API_KEY;
  const senderId = process.env.BULKSMSBD_SENDER_ID;
  if (!apiKey || !senderId) {
    throw new Error("SMS provider is not configured. Please contact support.");
  }
  // BulkSMSBD expects local format without the leading +
  const number = phone.replace(/^\+/, "");
  const url = new URL("https://bulksmsbd.net/api/smsapi");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("type", "text");
  url.searchParams.set("number", number);
  url.searchParams.set("senderid", senderId);
  url.searchParams.set("message", message);

  const res = await fetch(url.toString(), { method: "GET" });
  const text = await res.text();
  let json: { response_code?: number; success_message?: string; error_message?: string } | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON response */
  }
  // BulkSMSBD success code is 202
  if (!res.ok || (json && json.response_code !== undefined && json.response_code !== 202)) {
    const msg = json?.error_message || text || `BulkSMSBD HTTP ${res.status}`;
    console.error("BulkSMSBD send failed:", msg);
    throw new Error(`Failed to send SMS: ${msg}`);
  }
}

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
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = list?.users?.find((u) => u.phone === data.phone.replace(/^\+/, "") || u.phone === data.phone);
      if (existing) {
        throw new Error("This phone number is already registered. Please sign in instead.");
      }
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Invalidate any previous unused codes for this phone
    await supabaseAdmin
      .from("phone_otps")
      .update({ consumed: true })
      .eq("phone", data.phone)
      .eq("consumed", false);

    const { error: insertErr } = await supabaseAdmin.from("phone_otps").insert({
      phone: data.phone,
      code_hash: hashCode(data.phone, code),
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

    const expected = hashCode(data.phone, data.code);
    if (!constantTimeEqual(otp.code_hash, expected)) {
      await supabaseAdmin
        .from("phone_otps")
        .update({ attempts: otp.attempts + 1 })
        .eq("id", otp.id);
      throw new Error("Incorrect code. Please try again.");
    }

    // Mark consumed
    await supabaseAdmin.from("phone_otps").update({ consumed: true }).eq("id", otp.id);

    // Find or create the user by phone (Supabase stores phone without leading +)
    const phoneNoPlus = data.phone.replace(/^\+/, "");
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    let user = list?.users?.find((u) => u.phone === phoneNoPlus);

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
    const oneTimePassword = `${randomBytes(24).toString("base64url")}!Aa9`;
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: oneTimePassword,
    });
    if (updErr) throw new Error(updErr.message);

    return { phone: data.phone, password: oneTimePassword };
  });
