// Server-only helpers for the reseller product-request notification flow:
// - insert admin_notifications rows for the in-app bell
// - send Resend emails to super admins and to the requesting reseller

type AdminClient = {
  from: (table: string) => any;
  auth: { admin: { getUserById: (id: string) => Promise<{ data: { user: any } | null; error: any }> } };
};

async function sendEmail(opts: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
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
        from: opts.from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!res.ok) console.warn("[product-request email] failed:", res.status, await res.text());
  } catch (e) {
    console.warn("[product-request email] error:", (e as Error).message);
  }
}

function shell(brand: string, heading: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)">
        <tr><td style="padding:20px 24px;background:#0f172a;color:#fff;font-weight:700;font-size:16px">${brand}</td></tr>
        <tr><td style="padding:24px">
          <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a">${heading}</h1>
          ${body}
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function primaryButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin:16px 0;padding:12px 20px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">${label}</a>`;
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

function siteOrigin(): string {
  return process.env.SITE_URL || "https://eazystorebd.lovable.app";
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
  const { name: resellerName, email: resellerEmail } = await getUserEmail(admin, input.reseller_id);
  const requester = resellerName || resellerEmail || "A reseller";
  const link = `${siteOrigin()}/admin`;

  // 1. In-app notification for the bell.
  await admin.from("admin_notifications").insert({
    type: "product_request_submitted",
    title: "New product request",
    body: `${requester} requested "${input.name}" at ৳${input.price}`,
    link,
    related_id: input.request_id,
  });

  // 2. Email each super admin.
  const admins = await getSuperAdminEmails(admin);
  const from = "EazyStore <orders@resend.dev>";
  const html = shell(
    "EazyStore",
    "New product request",
    `<p><strong>${requester}</strong> submitted a new product to review.</p>
     <ul style="line-height:1.7">
       <li><strong>Product:</strong> ${input.name}</li>
       <li><strong>Requested price:</strong> ৳${input.price}</li>
       <li><strong>Reseller:</strong> ${resellerEmail ?? "—"}</li>
     </ul>
     ${primaryButton(link, "Review pending requests")}`,
  );
  await Promise.all(
    admins.map((to) =>
      sendEmail({ from, to, subject: `New product request: ${input.name}`, html }),
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
  const link = `${siteOrigin()}/reseller-products`;
  const html = shell(
    "EazyStore",
    "🎉 Your product is live!",
    `<p>Great news — your requested product <strong>${input.name}</strong> has been approved and is now live in the Reseller Marketplace.</p>
     <ul style="line-height:1.7">
       <li><strong>Reseller price:</strong> ৳${input.reseller_price}</li>
     </ul>
     ${primaryButton(link, "Open Reseller Products")}
     <p style="margin-top:12px;color:#64748b;font-size:12px">Add it to your shop to start selling.</p>`,
  );
  await sendEmail({
    from: "EazyStore <orders@resend.dev>",
    to: email,
    subject: `Your product "${input.name}" is now live`,
    html,
  });
}
