// Server-only helpers for tenant resolution.
// Runs inside createServerFn handlers only — safe to hold module-scope cache
// per Worker instance.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { STOREFRONT_APEX_DOMAINS } from "@/lib/storefront-host";

export type TenantStore = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  tagline: string | null;
};

export type TenantResult =
  | { kind: "apex" }
  | { kind: "subdomain"; slug: string; store: TenantStore }
  | { kind: "custom"; slug: string; store: TenantStore; domain: string }
  | { kind: "unknown-sub"; attempted: string }
  | { kind: "unknown-custom"; host: string };

const RESERVED_SUBS = new Set([
  "www", "app", "admin", "api", "mail", "webmail", "ftp", "cdn", "static",
]);

// Per-Worker warm cache.
type CacheEntry = { result: TenantResult; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const HIT_TTL_MS = 60_000;
const MISS_TTL_MS = 10_000;
const MAX_ENTRIES = 500;

function cacheGet(host: string): TenantResult | null {
  const hit = cache.get(host);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(host);
    return null;
  }
  return hit.result;
}

function cacheSet(host: string, result: TenantResult) {
  if (cache.size >= MAX_ENTRIES) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  const ttl =
    result.kind === "unknown-sub" || result.kind === "unknown-custom"
      ? MISS_TTL_MS
      : HIT_TTL_MS;
  cache.set(host, { result, expiresAt: Date.now() + ttl });
}

function normalizeHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.toLowerCase().split(":")[0]!.trim() || null;
}

function apexMatch(host: string): string | null {
  for (const apex of STOREFRONT_APEX_DOMAINS) {
    if (host === apex || host === `www.${apex}`) return apex;
    if (host.endsWith(`.${apex}`)) return apex;
  }
  return null;
}

function subdomainOf(host: string, apex: string): string | null {
  if (host === apex || host === `www.${apex}`) return null;
  if (!host.endsWith(`.${apex}`)) return null;
  const sub = host.slice(0, -(apex.length + 1));
  if (!sub || sub.includes(".")) return null;
  if (RESERVED_SUBS.has(sub)) return null;
  return sub;
}

function serverClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function fetchStoreBySlug(slug: string): Promise<TenantStore | null> {
  const sb = serverClient();
  const { data } = await sb
    .from("stores")
    .select("id, slug, name, logo_url, tagline, published")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (!data || !data.slug) return null;
  return { id: data.id, slug: data.slug, name: data.name, logo_url: data.logo_url, tagline: data.tagline };
}

async function fetchStoreByCustomDomain(
  host: string,
): Promise<{ store: TenantStore; domain: string } | null> {
  const sb = serverClient();
  const { data } = await sb
    .from("custom_domains")
    .select("domain, status, stores!inner(id, slug, name, logo_url, tagline, published)")
    .eq("domain", host)
    .eq("status", "active")
    .maybeSingle();
  const store = (data as unknown as {
    domain: string;
    stores: {
      id: string; slug: string | null; name: string;
      logo_url: string | null; tagline: string | null; published: boolean;
    } | null;
  } | null)?.stores;
  if (!data || !store || !store.published || !store.slug) return null;
  return {
    domain: data.domain,
    store: { id: store.id, slug: store.slug, name: store.name, logo_url: store.logo_url, tagline: store.tagline },
  };
}

// Best-effort audit; never throws.
async function recordUnknownAudit(
  host: string,
  kind: "unknown-sub" | "unknown-custom",
  attempted: string | null,
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Upsert-then-increment via RPC-less pattern: try increment first, insert if not present.
    const { data: existing } = await supabaseAdmin
      .from("tenant_resolver_audit")
      .select("hit_count")
      .eq("host", host)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin
        .from("tenant_resolver_audit")
        .update({ hit_count: (existing.hit_count ?? 0) + 1, last_seen: new Date().toISOString(), kind, attempted })
        .eq("host", host);
    } else {
      await supabaseAdmin
        .from("tenant_resolver_audit")
        .insert({ host, kind, attempted, hit_count: 1 });
    }
  } catch (e) {
    console.warn("tenant audit write failed", e);
  }
}

async function resolveCore(rawHost: string | null | undefined): Promise<TenantResult> {
  const host = normalizeHost(rawHost);
  if (!host) return { kind: "apex" };

  const apex = apexMatch(host);
  if (apex) {
    const sub = subdomainOf(host, apex);
    if (!sub) return { kind: "apex" };
    const store = await fetchStoreBySlug(sub);
    return store
      ? { kind: "subdomain", slug: sub, store }
      : { kind: "unknown-sub", attempted: sub };
  }
  const match = await fetchStoreByCustomDomain(host);
  return match
    ? { kind: "custom", slug: match.store.slug, store: match.store, domain: match.domain }
    : { kind: "unknown-custom", host };
}

export async function resolveTenantServer(
  rawHost: string | null | undefined,
): Promise<TenantResult> {
  const host = normalizeHost(rawHost);
  if (!host) return { kind: "apex" };

  const cached = cacheGet(host);
  if (cached) return cached;

  const result = await resolveCore(host);

  if (result.kind === "unknown-sub" || result.kind === "unknown-custom") {
    const attempted = result.kind === "unknown-sub" ? result.attempted : null;
    console.warn(`[tenant-resolver] unknown ${result.kind}: host=${host} attempted=${attempted ?? "-"}`);
    // Fire-and-forget audit.
    void recordUnknownAudit(host, result.kind, attempted);
  }

  cacheSet(host, result);
  return result;
}

// Cache-bypassing resolver for the debug view.
export async function resolveTenantFresh(
  rawHost: string | null | undefined,
): Promise<TenantResult> {
  return resolveCore(rawHost);
}

// Read the unknown-tenant redirect toggle (best-effort; defaults to false).
export async function getUnknownTenantRedirect(): Promise<boolean> {
  try {
    const sb = serverClient();
    const { data } = await sb
      .from("site_settings")
      .select("unknown_tenant_redirect")
      .eq("id", "singleton")
      .maybeSingle();
    return Boolean((data as { unknown_tenant_redirect?: boolean } | null)?.unknown_tenant_redirect);
  } catch {
    return false;
  }
}
