// Wildcard-subdomain routing helpers for the public storefront.
// Recognized apex domains where `<slug>.<apex>` should render a storefront.
export const STOREFRONT_APEX_DOMAINS = ["eazystore.xyz"] as const;

const RESERVED_SUBS = new Set(["www", "app", "admin", "api", "mail", "webmail", "ftp", "cdn", "static"]);

export function getStorefrontSlugFromHost(hostname: string | undefined | null): string | null {
  if (!hostname) return null;
  const h = hostname.toLowerCase().split(":")[0];
  for (const apex of STOREFRONT_APEX_DOMAINS) {
    if (h === apex) return null;
    if (h.endsWith(`.${apex}`)) {
      const sub = h.slice(0, -(apex.length + 1));
      if (!sub || sub.includes(".")) return null;
      if (RESERVED_SUBS.has(sub)) return null;
      return sub;
    }
  }
  return null;
}

export function buildSubdomainStorefrontUrl(slug: string, protocol = "https:"): string | null {
  if (!slug) return null;
  const apex = STOREFRONT_APEX_DOMAINS[0];
  if (!apex) return null;
  return `${protocol}//${slug}.${apex}/`;
}
