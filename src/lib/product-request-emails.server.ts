// Server-only helpers for the reseller product-request notification flow.
// Pure payload/URL builders live in ./product-request-emails-core so tests
// can assert them without importing this server-only module.

import {
  buildApprovedEmailPayload,
  buildSubmittedEmailPayload,
  buildSubmittedNotificationRow,
  resolveSiteOrigin,
  type ResendPayload,
} from "./product-request-emails-core";

type AdminClient = {
  from: (table: string) => any;
  auth: { admin: { getUserById: (id: string) => Promise<{ data: { user: any } | null; error: any }> } };
};

async function sendEmail(payload: ResendPayload): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[product-request email] RESEND_API_KEY not set; skipping");
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
        from: payload.from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
    });
    if (!res.ok) console.warn("[product-request email] failed:", res.status, await res.text());
  } catch (e) {
    console.warn("[product-request email] error:", (e as Error).message);
  }
}

async function getSuperAdminEmails(admin: AdminClient): Promise<string[]> {
  const { data: rows } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "super_admin");
  const ids: string[] = (rows ?? []).map((r: any) => r.user_id);
  const emails: string[] = [];
  for (const id of ids) {
    const { data } = await admin.auth.admin.getUserById(id);
    const e = data?.user?.email;
    if (e) emails.push(e);
  }
  return emails;
}

async function getUserEmail(admin: AdminClient, userId: string): Promise<{ email: string | null; name: string | null }> {
  const { data } = await admin.auth.admin.getUserById(userId);
  const u = data?.user;
  const email = u?.email ?? null;
  const name =
    u?.user_metadata?.full_name ||
    u?.user_metadata?.name ||
    (email ? email.split("@")[0] : null);
  return { email, name };
}

export async function notifyRequestSubmitted(
  admin: AdminClient,
  input: {
    request_id: string;
    reseller_id: string;
    name: string;
    price: number;
  },
): Promise<void> {
  const origin = resolveSiteOrigin();
  const { name: resellerName, email: resellerEmail } = await getUserEmail(admin, input.reseller_id);

  await admin.from("admin_notifications").insert(
    buildSubmittedNotificationRow({
      request_id: input.request_id,
      resellerName,
      resellerEmail,
      productName: input.name,
      price: input.price,
      origin,
    }),
  );

  const admins = await getSuperAdminEmails(admin);
  await Promise.all(
    admins.map((to) =>
      sendEmail(
        buildSubmittedEmailPayload(to, {
          resellerName,
          resellerEmail,
          productName: input.name,
          price: input.price,
          origin,
        }),
      ),
    ),
  );
}

export async function notifyRequestApproved(
  admin: AdminClient,
  input: {
    request_id: string;
    reseller_id: string;
    name: string;
    reseller_price: number;
  },
): Promise<void> {
  const { email } = await getUserEmail(admin, input.reseller_id);
  if (!email) return;
  await sendEmail(
    buildApprovedEmailPayload({
      resellerEmail: email,
      productName: input.name,
      resellerPrice: input.reseller_price,
    }),
  );
}
