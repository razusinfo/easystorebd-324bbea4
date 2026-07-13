// Client-side validation: is the current host safe for managed OAuth?
// Lovable's managed Google OAuth flow requires `/~oauth/*` proxy interception
// which only works on Lovable-hosted origins (*.lovable.app) and custom domains
// that are verified/connected inside the Lovable Domains dashboard.
// A reseller subdomain like `slug.easystorebd.com` DOES work IF the apex has
// wildcard DNS + active Lovable connection. When it does not, `/~oauth/initiate`
// returns 404. This helper detects that case and redirects auth to the canonical
// apex origin so registration/login always succeed.

import { STOREFRONT_APEX_DOMAINS, getStorefrontSlugFromHost } from "@/lib/storefront-host";

// OAuth is most reliable on the Lovable-published app origin because the
// managed `/~oauth/*` broker is guaranteed to exist there. Custom/cPanel
// domains can return 404 if the proxy connection is incomplete, so auth pages
// bounce those hosts here before starting Google.
export const CANONICAL_AUTH_ORIGIN = "https://easystorebd.lovable.app";
export const LOVABLE_AUTH_ORIGIN = CANONICAL_AUTH_ORIGIN;

export type OAuthHostCheck =
  | { ok: true; origin: string }
  | { ok: false; reason: "reseller-subdomain" | "unknown-host"; redirectTo: string };

export function checkOAuthHost(hostname: string, href: string): OAuthHostCheck {
  const h = hostname.toLowerCase();
  // Any *.lovable.app preview/published URL is fine — Lovable proxy owns it.
  if (h.endsWith(".lovable.app") || h === "lovable.app") return { ok: true, origin: `https://${h}` };
  // Localhost dev — always fine.
  if (h === "localhost" || h === "127.0.0.1") return { ok: true, origin: `http://${hostname}` };
  // Custom apex/reseller domains may not have `/~oauth/*` proxying in cPanel or
  // while DNS is still settling. Use the published app origin for sign-in.
  const apexHit = STOREFRONT_APEX_DOMAINS.find((a) => h === a || h === `www.${a}`);
  if (apexHit) {
    const target = new URL(new URL(href).pathname || "/auth", CANONICAL_AUTH_ORIGIN);
    const original = new URL(href);
    original.searchParams.forEach((value, key) => target.searchParams.set(key, value));
    return { ok: false, reason: "unknown-host", redirectTo: target.toString() };
  }
  // Reseller subdomain of a known apex — push OAuth to the published app origin.
  if (getStorefrontSlugFromHost(h)) {
    const original = new URL(href);
    const target = new URL(original.pathname === "/login" ? "/login" : "/auth", CANONICAL_AUTH_ORIGIN);
    const existingRedirect = original.searchParams.get("redirect");
    if (existingRedirect?.startsWith("/")) target.searchParams.set("redirect", existingRedirect);
    return { ok: false, reason: "reseller-subdomain", redirectTo: target.toString() };
  }
  // Unknown custom domain — fall back to Lovable-hosted origin.
  const target = new URL("/auth", LOVABLE_AUTH_ORIGIN);
  const original = new URL(href);
  const existingRedirect = original.searchParams.get("redirect");
  if (existingRedirect?.startsWith("/")) target.searchParams.set("redirect", existingRedirect);
  return { ok: false, reason: "unknown-host", redirectTo: target.toString() };
}

// True when the message from the OAuth SDK looks like the /~oauth 404 case.
export function isOAuth404(message: string | undefined | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes("404") || m.includes("not found") || m.includes("failed to fetch");
}
