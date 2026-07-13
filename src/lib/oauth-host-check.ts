// Client-side validation: is the current host safe for managed OAuth?
// Lovable's managed Google OAuth flow requires `/~oauth/*` proxy interception
// which only works on Lovable-hosted origins (*.lovable.app) and custom domains
// that are verified/connected inside the Lovable Domains dashboard.
// A reseller subdomain like `slug.easystorebd.com` DOES work IF the apex has
// wildcard DNS + active Lovable connection. When it does not, `/~oauth/initiate`
// returns 404. This helper detects that case and redirects auth to the canonical
// apex origin so registration/login always succeed.

import { STOREFRONT_APEX_DOMAINS, getStorefrontSlugFromHost } from "@/lib/storefront-host";

// The primary canonical origin where OAuth is always known-good.
export const CANONICAL_AUTH_ORIGIN = "https://easystorebd.com";
// Fallback (Lovable-hosted) origin — always OAuth-safe.
export const LOVABLE_AUTH_ORIGIN = "https://easystorebd.lovable.app";

export type OAuthHostCheck =
  | { ok: true; origin: string }
  | { ok: false; reason: "reseller-subdomain" | "unknown-host"; redirectTo: string };

export function checkOAuthHost(hostname: string, href: string): OAuthHostCheck {
  const h = hostname.toLowerCase();
  // Any *.lovable.app preview/published URL is fine — Lovable proxy owns it.
  if (h.endsWith(".lovable.app") || h === "lovable.app") return { ok: true, origin: `https://${h}` };
  // Localhost dev — always fine.
  if (h === "localhost" || h === "127.0.0.1") return { ok: true, origin: `http://${hostname}` };
  // Canonical apexes — fine.
  const apexHit = STOREFRONT_APEX_DOMAINS.find((a) => h === a || h === `www.${a}`);
  if (apexHit) return { ok: true, origin: `https://${apexHit}` };
  // Reseller subdomain of a known apex — /~oauth may not be proxied if the
  // apex's wildcard/Lovable connection isn't fully active. Push OAuth to the
  // canonical apex and come back to the original URL after sign-in.
  if (getStorefrontSlugFromHost(h)) {
    const target = new URL("/auth", CANONICAL_AUTH_ORIGIN);
    target.searchParams.set("redirect", href);
    return { ok: false, reason: "reseller-subdomain", redirectTo: target.toString() };
  }
  // Unknown custom domain — fall back to Lovable-hosted origin.
  const target = new URL("/auth", LOVABLE_AUTH_ORIGIN);
  target.searchParams.set("redirect", href);
  return { ok: false, reason: "unknown-host", redirectTo: target.toString() };
}

// True when the message from the OAuth SDK looks like the /~oauth 404 case.
export function isOAuth404(message: string | undefined | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes("404") || m.includes("not found") || m.includes("failed to fetch");
}
