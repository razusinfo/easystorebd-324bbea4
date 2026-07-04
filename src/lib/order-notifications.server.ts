// Server-only helpers to send SMS notifications for reseller orders.
// Uses BulkSMSBD (already configured for phone OTP).

type OrderCore = {
  id: string;
  product_name: string;
  quantity: number;
  reseller_price: number | string | null;
  customer_name: string;
  customer_phone: string | null;
  reseller_id: string;
  status?: string | null;
};

const DELIVERY_ETA = "3-5 business days";

async function sendSms(phone: string, message: string): Promise<void> {
  const apiKey = process.env.BULKSMSBD_API_KEY;
  const senderId = process.env.BULKSMSBD_SENDER_ID;
  if (!apiKey || !senderId) {
    console.warn("[order-sms] BulkSMSBD not configured; skipping SMS");
    return;
  }
  const number = phone.replace(/^\+/, "").replace(/\s+/g, "");
  if (!number) return;
  const url = new URL("https://bulksmsbd.net/api/smsapi");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("type", "text");
  url.searchParams.set("number", number);
  url.searchParams.set("senderid", senderId);
  url.searchParams.set("message", message);
  try {
    const res = await fetch(url.toString(), { method: "GET" });
    const text = await res.text();
    if (!res.ok) console.warn("[order-sms] send failed:", res.status, text);
  } catch (e) {
    console.warn("[order-sms] send error:", (e as Error).message);
  }
}

async function getResellerBrand(resellerId: string): Promise<{
  brand: string;
  resellerPhone: string | null;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: store } = await supabaseAdmin
    .from("stores")
    .select("name, phone, whatsapp_number")
    .eq("owner_user_id", resellerId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("store, name")
    .eq("id", resellerId)
    .maybeSingle();
  const brand =
    store?.name || profile?.store || profile?.name || "Our Shop";
  const resellerPhone = store?.phone || store?.whatsapp_number || null;
  return { brand, resellerPhone };
}

function money(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return `৳${v.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

export async function sendOrderConfirmation(order: OrderCore): Promise<void> {
  if (!order.customer_phone) return;
  const { brand } = await getResellerBrand(order.reseller_id);
  const total = money(Number(order.reseller_price ?? 0) * order.quantity);
  const shortId = order.id.slice(0, 8).toUpperCase();
  const msg =
    `${brand}: Hi ${order.customer_name}, your order #${shortId} for ` +
    `${order.product_name} (x${order.quantity}) totaling ${total} is confirmed. ` +
    `Estimated delivery: ${DELIVERY_ETA}. Thank you!`;
  await sendSms(order.customer_phone, msg);
}

export async function sendOrderStatusUpdate(
  order: OrderCore,
  newStatus: string,
): Promise<void> {
  const { brand, resellerPhone } = await getResellerBrand(order.reseller_id);
  const shortId = order.id.slice(0, 8).toUpperCase();
  const label = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
  const customerMsg =
    `${brand}: Update on order #${shortId} (${order.product_name}). ` +
    `Status: ${label}.` +
    (newStatus === "shipped" ? ` Expected in ${DELIVERY_ETA}.` : "") +
    ` Thank you!`;
  const resellerMsg =
    `${brand} order #${shortId} for ${order.customer_name} ` +
    `is now "${label}".`;

  await Promise.all([
    order.customer_phone ? sendSms(order.customer_phone, customerMsg) : Promise.resolve(),
    resellerPhone ? sendSms(resellerPhone, resellerMsg) : Promise.resolve(),
  ]);
}
