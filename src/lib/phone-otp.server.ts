import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";

type AuthUser = {
  id: string;
  phone?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type AdminClient = {
  auth: {
    admin: {
      listUsers: (args: { page: number; perPage: number }) => Promise<{ data?: { users?: AuthUser[] }; error?: { message: string } | null }>;
    };
  };
};

export function hashPhoneOtpCode(phone: string, code: string): string {
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

export function constantTimeEqualHash(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function createOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function createTemporaryPassword(): string {
  return `${randomBytes(24).toString("base64url")}!Aa9`;
}

function normalizePhone(phone: string | undefined | null): string {
  return (phone ?? "").replace(/\D+/g, "");
}

function phoneMatches(user: AuthUser, expectedPhone: string): boolean {
  const target = normalizePhone(expectedPhone);
  if (target.length < 6) return false;
  const metadata = user.user_metadata ?? {};
  const candidates = [
    user.phone,
    typeof metadata.phone === "string" ? metadata.phone : undefined,
    typeof metadata.mobile === "string" ? metadata.mobile : undefined,
  ].map(normalizePhone);
  return candidates.some((candidate) => {
    if (candidate.length < 6) return false;
    return candidate === target || candidate.endsWith(target) || target.endsWith(candidate);
  });
}

export async function findUserByPhone(supabaseAdmin: AdminClient, phone: string): Promise<AuthUser | null> {
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error("Could not verify phone number");
    const users = data?.users ?? [];
    const match = users.find((user) => phoneMatches(user, phone));
    if (match) return match;
    if (users.length < 200) return null;
  }
  return null;
}

export async function sendBulkSmsBd(phone: string, message: string): Promise<void> {
  const apiKey = process.env.BULKSMSBD_API_KEY;
  const senderId = process.env.BULKSMSBD_SENDER_ID;
  if (!apiKey || !senderId) {
    throw new Error("SMS provider is not configured. Please contact support.");
  }
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
  if (!res.ok || (json && json.response_code !== undefined && json.response_code !== 202)) {
    const msg = json?.error_message || text || `BulkSMSBD HTTP ${res.status}`;
    console.error("BulkSMSBD send failed:", msg);
    throw new Error(`Failed to send SMS: ${msg}`);
  }
}
