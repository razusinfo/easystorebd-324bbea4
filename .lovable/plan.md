
## What's already built (skip)

- **Domain setup wizard** — `admin-platform-domain-setup.tsx` (5-step Cloudflare + wildcard flow).
- **Custom domain mapping UI + real-time SSL status** — `domain-settings.tsx` polls `custom_domains` for Verifying/Setting up/Live and shows DNS instructions.
- **Subdomain host parser** — `src/lib/storefront-host.ts` + SSR host detection in `routes/index.tsx`.

So this plan focuses on the two missing pieces: **central tenant resolver with cache** and **unknown-subdomain fallback**.

## What to build

### 1. Central tenant resolver (`src/lib/tenant-resolver.functions.ts`)

One server function that, given a `host`, returns a single normalized `TenantResult`:

```text
{ kind: "apex" }                              // easystorebd.com / www
{ kind: "subdomain", slug, store }            // <slug>.easystorebd.com → resolved store
{ kind: "custom", slug, store, domain }       // custom domain → resolved store
{ kind: "unknown-sub", attempted: "<slug>" }  // subdomain has no matching store
{ kind: "unknown-custom", host }              // host not recognized at all
```

Resolution order inside the handler:
1. Strip port, lowercase host.
2. If `host` matches a `STOREFRONT_APEX_DOMAINS` apex or a reserved sub (`www`, `app`, `admin`…), return `apex`.
3. If it's `<slug>.<apex>`: look up `stores` by `slug` → `subdomain` or `unknown-sub`.
4. Otherwise treat as custom domain: look up `custom_domains` (status=`active`) joined to `stores` → `custom` or `unknown-custom`.

**Cache:** in-module `Map<host, { result, expiresAt }>` with 60 s TTL for hits, 10 s TTL for misses. Keyed by host only. Simple LRU cap (e.g. 500 entries). Runs per Worker instance; that's the intended edge cache — no external dependency.

### 2. Wire the resolver into `routes/index.tsx`

Replace the current `getSubdomainSlug` with `resolveTenant`:

- Loader calls `resolveTenant({ data: { host } })` (host from `getRequestHost()` server-side; fall back to `window.location.hostname` client-side via a small isomorphic helper).
- Landing component branches on `result.kind`:
  - `apex` → existing marketing landing.
  - `subdomain` / `custom` → `<StorefrontView slug={result.slug} />`.
  - `unknown-sub` / `unknown-custom` → new `<UnknownTenant />` component (see #3).

### 3. Unknown-subdomain fallback (`src/components/unknown-tenant.tsx`)

Full-page component (not a redirect — a redirect across apex→subdomain loses the host and confuses users). Shows:

- EasyStore logo + wordmark.
- "Store `<attempted>` doesn't exist" headline in Bangla + English.
- Two CTAs: **Go to easystorebd.com** (external link to apex) and **Browse stores** (link to a new `/stores` public listing route).
- Sets `<meta name="robots" content="noindex">` via `head()` on the route (guard on loader data kind).

Also add a minimal `src/routes/stores.tsx` that server-fetches published stores via a public server fn (publishable client + narrow `TO anon` policy on `stores.is_public=true` — already exists) and renders a simple grid of storefront links using `buildSubdomainStorefrontUrl`.

### 4. Wildcard splat safety net

Keep the existing `src/routes/$.tsx` (or add one) to catch unmatched paths **on a resolved storefront** and forward to `StorefrontView` for slug-based product URLs. Nothing to change if it already exists — verify only.

## Files touched

- **New:** `src/lib/tenant-resolver.functions.ts`, `src/lib/tenant-resolver.server.ts` (cache + DB helpers), `src/components/unknown-tenant.tsx`, `src/routes/stores.tsx`.
- **Edit:** `src/routes/index.tsx` (swap loader + branch on tenant kind).
- **No DB migration** — `stores`, `custom_domains` already exist.

## Technical notes

- Handler-only imports for cache map & Supabase client to stay compatible with `?tss-serverfn-split` (helpers live in `.server.ts`).
- Cache lives inside the `.server.ts` module scope; per-Worker warm cache is enough at current traffic.
- Public reads use the **publishable-key** server client (not `supabaseAdmin`) with the existing `TO anon` SELECT policies on `stores` and `custom_domains`.
- SSR host detection uses `getRequestHost()` inside the handler; client fallback stays for hydration parity.
- `unknown-sub` renders 200 (not 404) so branded pages don't get de-indexed as errors, but sets `robots: noindex`.

## Out of scope

Wizard and domain-mapping dashboard — already shipped. No changes there unless you want tweaks.
