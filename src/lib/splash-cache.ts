/**
 * Splash-logo browser cache helper.
 *
 * The initial <script> in src/routes/__root.tsx reads
 * `localStorage['storefront_logo_cache:<slug|host>']` to paint the correct
 * splash logo before React hydrates. When a reseller saves new settings,
 * we want that key to reflect the new logo immediately — before their next
 * storefront visit — so the very next reload paints the updated brand.
 *
 * This module is the single source of truth for that key layout so both
 * runtime writers (manage-shop, storefront-view) and unit tests agree.
 */

export const LOGO_CACHE_PREFIX = "storefront_logo_cache:";

export type PrimeInput = {
  /** Store slug (e.g. `sylhetionlineshop`). Required — used as base cache key. */
  slug: string;
  /** Custom domain from `stores.custom_domain`, may be null. */
  customDomain?: string | null;
  /** Signed / proxy URL for the storefront (header) logo. */
  logoUrl: string | null;
  /** Signed / proxy URL for the dedicated splash logo, or null when unset. */
  splashUrl: string | null;
  /** Reseller toggle — show splash logo on `<slug>.easystorebd.com`. */
  onSubdomain: boolean;
  /** Reseller toggle — show splash logo on their custom domain. */
  onCustomDomain: boolean;
  /**
   * Apex host used to build subdomain cache keys. Defaults to
   * `easystorebd.com` so tests can override without env plumbing.
   */
  apexHost?: string;
  /** Storage adapter — defaults to `window.localStorage`. */
  storage?: Pick<Storage, "setItem" | "removeItem">;
};

export type PrimeResult = {
  writes: Record<string, string>;
  removes: string[];
};

function safeStorage(
  override?: PrimeInput["storage"],
): PrimeInput["storage"] | null {
  if (override) return override;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Prime (or invalidate) all splash-logo cache keys for a store.
 *
 * Always returns the set of keys written / removed so callers and tests can
 * assert behaviour without inspecting storage directly.
 */
export function primeSplashCache(input: PrimeInput): PrimeResult {
  const {
    slug,
    customDomain,
    logoUrl,
    splashUrl,
    onSubdomain,
    onCustomDomain,
    apexHost = "easystorebd.com",
  } = input;

  const storage = safeStorage(input.storage);
  const writes: Record<string, string> = {};
  const removes: string[] = [];

  const commit = (rawKey: string, value: string | null) => {
    const fullKey = LOGO_CACHE_PREFIX + rawKey;
    try {
      if (value) {
        writes[rawKey] = value;
        storage?.setItem(fullKey, value);
      } else {
        removes.push(rawKey);
        storage?.removeItem(fullKey);
      }
    } catch {
      // Storage may be full, blocked (Safari private mode), or absent.
      // The in-memory `writes` / `removes` still reflect intent for the
      // caller and tests.
    }
  };

  // The slug key powers the /s/<slug> route and always uses the storefront logo.
  commit(slug, logoUrl);

  // Subdomain host key — reseller opts in via splash.on_subdomain.
  const subHost = `${slug}.${apexHost}`.toLowerCase();
  commit(subHost, onSubdomain ? splashUrl ?? logoUrl : logoUrl);

  // Custom-domain host key — only relevant when the store has one attached.
  if (customDomain && customDomain.trim()) {
    const cdKey = customDomain.trim().toLowerCase();
    commit(cdKey, onCustomDomain ? splashUrl ?? logoUrl : logoUrl);
  }

  return { writes, removes };
}
