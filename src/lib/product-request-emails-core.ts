// Pure, framework-free builders for the product-request notification flow.
// Exported so unit tests can assert exact Resend payloads and CTA URLs
// without touching the network.

import { escapeHtml } from "@/lib/html-escape";

export const DEFAULT_SITE_ORIGIN = "https://eazystorebd.lovable.app";
export const ADMIN_REQUESTS_PATH = "/admin";
// Reseller-facing marketplace page (matches src/routes/_authenticated/reseller-products.tsx).
export const RESELLER_PRODUCTS_PATH = "/reseller-products";
export const EMAIL_FROM = "EazyStore <orders@resend.dev>";

export function resolveSiteOrigin(env: NodeJS.ProcessEnv = process.env): string {
  return env.SITE_URL || DEFAULT_SITE_ORIGIN;
}

export function adminRequestsUrl(origin: string = resolveSiteOrigin()): string {
  return `${origin}${ADMIN_REQUESTS_PATH}`;
}

export function resellerProductsUrl(origin: string = resolveSiteOrigin()): string {
  return `${origin}${RESELLER_PRODUCTS_PATH}`;
}

function shell(brand: string, heading: string, body: string): string {
  const safeBrand = escapeHtml(brand);
  const safeHeading = escapeHtml(heading);
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)">
        <tr><td style="padding:20px 24px;background:#0f172a;color:#fff;font-weight:700;font-size:16px">${safeBrand}</td></tr>
        <tr><td style="padding:24px">
          <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a">${safeHeading}</h1>
          ${body}
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function primaryButton(href: string, label: string): string {
  // Only http(s) URLs are allowed as the CTA href so a caller can't smuggle
  // `javascript:` or `data:` links into the button.
  const safeHref = /^https?:\/\//i.test(href) ? escapeHtml(href) : "#";
  return `<a href="${safeHref}" style="display:inline-block;margin:16px 0;padding:12px 20px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(label)}</a>`;
}

export type SubmittedInput = {
  resellerName: string | null;
  resellerEmail: string | null;
  productName: string;
  price: number;
  origin?: string;
};

export type ResendPayload = {
  from: string;
  to: string;
  subject: string;
  html: string;
};

export function buildSubmittedEmailPayload(
  adminEmail: string,
  input: SubmittedInput,
): ResendPayload {
  const origin = input.origin ?? resolveSiteOrigin();
  const link = adminRequestsUrl(origin);
  const requester = input.resellerName || input.resellerEmail || "A reseller";
  return {
    from: EMAIL_FROM,
    to: adminEmail,
    subject: `New product request: ${input.productName}`,
    html: shell(
      "EazyStore",
      "New product request",
      `<p><strong>${escapeHtml(requester)}</strong> submitted a new product to review.</p>
       <ul style="line-height:1.7">
         <li><strong>Product:</strong> ${escapeHtml(input.productName)}</li>
         <li><strong>Requested price:</strong> ৳${escapeHtml(String(input.price))}</li>
         <li><strong>Reseller:</strong> ${escapeHtml(input.resellerEmail ?? "—")}</li>
       </ul>
       ${primaryButton(link, "Review pending requests")}`,
    ),
  };
}

export type ApprovedInput = {
  resellerEmail: string;
  productName: string;
  resellerPrice: number;
  origin?: string;
};

export function buildApprovedEmailPayload(input: ApprovedInput): ResendPayload {
  const origin = input.origin ?? resolveSiteOrigin();
  const link = resellerProductsUrl(origin);
  return {
    from: EMAIL_FROM,
    to: input.resellerEmail,
    subject: `Your product "${input.productName}" is now live`,
    html: shell(
      "EazyStore",
      "🎉 Your product is live!",
      `<p>Great news — your requested product <strong>${escapeHtml(input.productName)}</strong> has been approved and is now live in the Reseller Marketplace.</p>
       <ul style="line-height:1.7">
         <li><strong>Reseller price:</strong> ৳${escapeHtml(String(input.resellerPrice))}</li>
       </ul>
       ${primaryButton(link, "Open Reseller Products")}
       <p style="margin-top:12px;color:#64748b;font-size:12px">Add it to your shop to start selling.</p>`,
    ),
  };
}

export function buildSubmittedNotificationRow(input: {
  request_id: string;
  resellerName: string | null;
  resellerEmail: string | null;
  productName: string;
  price: number;
  origin?: string;
}) {
  const requester = input.resellerName || input.resellerEmail || "A reseller";
  return {
    type: "product_request_submitted",
    title: "New product request",
    body: `${requester} requested "${input.productName}" at ৳${input.price}`,
    link: adminRequestsUrl(input.origin),
    related_id: input.request_id,
  };
}
