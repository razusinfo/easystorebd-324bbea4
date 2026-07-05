// Server-only helpers for sending order notifications (SMS + Email).
// - SMS via BulkSMSBD (already configured for OTP).
// - Email via Resend (RESEND_API_KEY secret).
// Config is read from public.notification_settings, with reseller branding
// from public.stores / public.profiles.

import { escapeHtml } from "@/lib/html-escape";

type OrderCore = {
  id: string;
  product_name: string;
  quantity: number;
  reseller_price: number | string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email?: string | null;
  reseller_id: string;
  status?: string | null;
};

type Settings = {
  email_enabled: boolean;
  sms_enabled: boolean;
  from_email: string;
  from_name: string;
  reply_to: string | null;
  notify_customer: boolean;
  notify_reseller: boolean;
  statuses_email: string[];
  statuses_sms: string[];
  delivery_eta: string;
  whatsapp_webhook_url: string | null;
};

const DEFAULTS: Settings = {
  email_enabled: true,
  sms_enabled: true,
  from_email: "orders@resend.dev",
  from_name: "EazyStore",
  reply_to: null,
  notify_customer: true,
  notify_reseller: true,
  statuses_email: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
  statuses_sms: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
  delivery_eta: "3-5 business days",
  whatsapp_webhook_url: null,
};

// Fire a JSON payload to an external automation platform (Make.com, Zapier, n8n)
// which can then forward to WhatsApp Business API, Slack, etc.
export async function sendOrderWebhook(
  order: OrderCore,
  event: "order.placed" | "order.status_changed",
  extra: Record<string, unknown> = {},
): Promise<void> {
  const cfg = await loadSettings();
  const url = (cfg.whatsapp_webhook_url ?? "").trim();
  if (!url) return;
  try {
    const { brand, resellerPhone, resellerEmail } = await getResellerBrand(order.reseller_id);
    const total = Number(order.reseller_price ?? 0) * order.quantity;
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      order: {
        id: order.id,
        short_id: order.id.slice(0, 8).toUpperCase(),
        status: order.status ?? null,
        product_name: order.product_name,
        quantity: order.quantity,
        unit_price: Number(order.reseller_price ?? 0),
        total,
        currency: "BDT",
      },
      customer: {
        name: order.customer_name,
        phone: order.customer_phone,
        email: order.customer_email ?? null,
      },
      reseller: {
        id: order.reseller_id,
        shop_name: brand,
        phone: resellerPhone,
        email: resellerEmail,
      },
      ...extra,
    };
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("[webhook] error:", (e as Error).message);
  }
}

async function loadSettings(): Promise<Settings> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("notification_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (!data) return DEFAULTS;
    return { ...DEFAULTS, ...(data as Partial<Settings>) };
  } catch {
    return DEFAULTS;
  }
}

async function getResellerBrand(resellerId: string): Promise<{
  brand: string;
  resellerPhone: string | null;
  resellerEmail: string | null;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: store }, { data: profile }] = await Promise.all([
    supabaseAdmin
      .from("stores")
      .select("name, phone, whatsapp_number, contact_email")
      .eq("owner_user_id", resellerId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin.from("profiles").select("store, name").eq("id", resellerId).maybeSingle(),
  ]);
  const brand = store?.name || profile?.store || profile?.name || "Our Shop";
  const resellerPhone = store?.phone || store?.whatsapp_number || null;
  const resellerEmail = store?.contact_email || null;
  return { brand, resellerPhone, resellerEmail };
}

function money(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return `৳${v.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

// ---------- SMS ----------
async function sendSms(phone: string, message: string): Promise<void> {
  const apiKey = process.env.BULKSMSBD_API_KEY;
  const senderId = process.env.BULKSMSBD_SENDER_ID;
  if (!apiKey || !senderId) return;
  const number = phone.replace(/^\+/, "").replace(/\s+/g, "");
  if (!number) return;
  const url = new URL("https://bulksmsbd.net/api/smsapi");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("type", "text");
  url.searchParams.set("number", number);
  url.searchParams.set("senderid", senderId);
  url.searchParams.set("message", message);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) console.warn("[sms] failed:", res.status, await res.text());
  } catch (e) {
    console.warn("[sms] error:", (e as Error).message);
  }
}

// ---------- Email (Resend) ----------
async function sendEmail(opts: {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string | null;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY not set; skipping email");
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from: opts.from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });
    if (!res.ok) console.warn("[email] failed:", res.status, await res.text());
  } catch (e) {
    console.warn("[email] error:", (e as Error).message);
  }
}

function baseTemplate(brand: string, heading: string, bodyHtml: string): string {
  // brand + heading are HTML-escaped so a malicious shop name or subject
  // cannot inject markup. bodyHtml is treated as already-safe HTML built by
  // the caller (which itself escapes every user-controlled value).
  const safeBrand = escapeHtml(brand);
  const safeHeading = escapeHtml(heading);
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)">
        <tr><td style="padding:20px 24px;background:#0f172a;color:#fff;font-weight:700;font-size:16px">${safeBrand}</td></tr>
        <tr><td style="padding:24px">
          <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a">${safeHeading}</h1>
          ${bodyHtml}
          <p style="margin-top:24px;font-size:12px;color:#64748b">Thank you for shopping with ${safeBrand}.</p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function orderRowsHtml(order: OrderCore, total: string, brand: string): string {
  // Every value here is escaped because order.product_name and
  // order.customer_name originate from the unauthenticated
  // /api/public/orders/place endpoint and could otherwise inject phishing
  // links or fake UI into a real transactional email.
  const rows: [string, string][] = [
    ["Order", `#${escapeHtml(order.id.slice(0, 8).toUpperCase())}`],
    ["Product", `${escapeHtml(order.product_name)} × ${escapeHtml(String(order.quantity))}`],
    ["Total", escapeHtml(total)],
    ["Customer", escapeHtml(order.customer_name)],
    ["Shop", escapeHtml(brand)],
  ];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;color:#64748b;width:35%">${k}</td><td style="padding:8px 0;font-weight:600">${v}</td></tr>`,
    )
    .join("")}</table>`;
}

// ---------- Public API ----------
export async function sendOrderConfirmation(order: OrderCore): Promise<void> {
  const cfg = await loadSettings();
  const { brand } = await getResellerBrand(order.reseller_id);
  const total = money(Number(order.reseller_price ?? 0) * order.quantity);
  const shortId = order.id.slice(0, 8).toUpperCase();

  // SMS -> customer
  if (
    cfg.sms_enabled &&
    cfg.notify_customer &&
    cfg.statuses_sms.includes("pending") &&
    order.customer_phone
  ) {
    const msg = `${brand}: Hi ${order.customer_name}, your order #${shortId} for ${order.product_name} (x${order.quantity}) totaling ${total} is confirmed. Estimated delivery: ${cfg.delivery_eta}. Thank you!`;
    await sendSms(order.customer_phone, msg);
  }

  // Email -> customer
  if (
    cfg.email_enabled &&
    cfg.notify_customer &&
    cfg.statuses_email.includes("pending") &&
    order.customer_email
  ) {
    const html = baseTemplate(
      brand,
      "Order confirmed 🎉",
      `<p style="margin:0 0 16px">Hi ${escapeHtml(order.customer_name)}, thanks for your order! Here's your summary:</p>
       ${orderRowsHtml(order, total, brand)}
       <p style="margin:16px 0 0">Estimated delivery: <strong>${escapeHtml(cfg.delivery_eta)}</strong>.</p>`,
    );
    await sendEmail({
      from: `${cfg.from_name} <${cfg.from_email}>`,
      to: order.customer_email,
      subject: `${brand} — Order #${shortId} confirmed`,
      html,
      replyTo: cfg.reply_to,
    });
  }
}

export async function sendOrderStatusUpdate(
  order: OrderCore,
  newStatus: string,
): Promise<void> {
  const cfg = await loadSettings();
  const { brand, resellerPhone, resellerEmail } = await getResellerBrand(order.reseller_id);
  const shortId = order.id.slice(0, 8).toUpperCase();
  const label = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
  const total = money(Number(order.reseller_price ?? 0) * order.quantity);

  const smsCustomer = `${brand}: Update on order #${shortId} (${order.product_name}). Status: ${label}.${
    newStatus === "shipped" ? ` Expected in ${cfg.delivery_eta}.` : ""
  } Thank you!`;
  const smsReseller = `${brand} order #${shortId} for ${order.customer_name} is now "${label}".`;

  const jobs: Promise<unknown>[] = [];

  if (cfg.sms_enabled && cfg.statuses_sms.includes(newStatus)) {
    if (cfg.notify_customer && order.customer_phone) jobs.push(sendSms(order.customer_phone, smsCustomer));
    if (cfg.notify_reseller && resellerPhone) jobs.push(sendSms(resellerPhone, smsReseller));
  }

  if (cfg.email_enabled && cfg.statuses_email.includes(newStatus)) {
    const html = baseTemplate(
      brand,
      `Order ${label}`,
      `<p style="margin:0 0 16px">Your order status has been updated to <strong>${escapeHtml(label)}</strong>.</p>
       ${orderRowsHtml(order, total, brand)}
       ${newStatus === "shipped" ? `<p style="margin:16px 0 0">Expected delivery: <strong>${escapeHtml(cfg.delivery_eta)}</strong>.</p>` : ""}`,
    );
    const from = `${cfg.from_name} <${cfg.from_email}>`;
    if (cfg.notify_customer && order.customer_email) {
      jobs.push(
        sendEmail({
          from,
          to: order.customer_email,
          subject: `${brand} — Order #${shortId} ${label}`,
          html,
          replyTo: cfg.reply_to,
        }),
      );
    }
    if (cfg.notify_reseller && resellerEmail) {
      jobs.push(
        sendEmail({
          from,
          to: resellerEmail,
          subject: `[${brand}] Order #${shortId} is now ${label}`,
          html,
          replyTo: cfg.reply_to,
        }),
      );
    }
  }

  await Promise.all(jobs);
}
