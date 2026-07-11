# Splash Logo — Tests, Cache Headers, Audit, Preview

## 1. Automated cache-invalidation tests

New file `src/lib/splash-cache.ts` extracting the `primeSplashCache` helper (currently inline in `manage-shop.tsx`) so it can be unit-tested in isolation.

New file `src/lib/splash-cache.test.ts` (Vitest, jsdom) covering:
- Writes cache entry under `storefront_logo_cache:<slug>` immediately.
- Writes additional entries for subdomain host (`slug.easystorebd.com`) and custom domain host when those toggles are enabled.
- Skips subdomain / custom-domain entries when their toggle is off.
- Overwrites previously cached URL for the same key (invalidation).
- Removes entries when logo path is cleared (`null`).
- No-op when `localStorage` is unavailable (SSR guard).

Refactor `manage-shop.tsx` save flow to call the shared helper.

## 2. Cache-control + invalidation headers

New public server route `src/routes/api/public/splash-logo.$.ts` that streams a signed storage object for splash logos with:
- `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=86400` — short browser TTL, longer edge TTL, SWR for instant next-load feel while still allowing quick invalidation.
- Strong `ETag` derived from the storage object's `updated_at` + path; returns `304` on `If-None-Match` match.
- `Vary: Accept-Encoding`.
- Query param `?v=<updated_at_ms>` supported for hard cache-bust after save.

Reseller code (`storefront-view.tsx`, `manage-shop.tsx` prime) switches to referencing this proxy URL (`/api/public/splash-logo/<store_id>?v=<ts>`) instead of raw signed URLs when caching, so a save automatically busts the cache via the new `?v=` param while CDN still serves cached bytes for other visitors.

## 3. Audit log entries

Migration adds a lightweight `public.splash_logo_audit_logs` table:

```text
id, store_id, actor_id, action ('upload'|'change'|'remove'),
old_path, new_path, affected_scopes text[]   -- e.g. ['subdomain','custom_domain']
host_snapshot text, created_at
```

RLS: super_admin sees all; store owner sees own rows. GRANTs per project rules.

`manage-shop.tsx` save flow inserts an audit row (via a small `createServerFn`) whenever `splash.logo_path`, `on_subdomain`, or `on_custom_domain` changes, computing:
- `action` = upload/change/remove from old vs new path.
- `affected_scopes` from the toggled-on flags.
- `host_snapshot` from `window.location.host`.

## 4. Splash preview page

New route `src/routes/_authenticated/splash-preview.tsx`:
- Loads current store's `shop_settings.splash` and store slug + custom domain.
- Renders side-by-side device frames (mobile + desktop) for each enabled scope:
  - Slug preview: `slug.easystorebd.com`
  - Custom-domain preview (if set + enabled)
  - Fallback shop-logo preview when splash disabled/missing
- Each frame reuses the same splash markup/CSS as `__root.tsx` (extracted into `src/components/splash-frame.tsx`) so preview is pixel-accurate.
- Toggle buttons to simulate dark background, slow-3G (delays image load), and "cold cache" (bypass localStorage).
- Deep-link button "Open live storefront" per scope.

Manage-shop adds a "Preview splash" link to the new page next to the splash section.

## Technical details

- Files added:
  - `src/lib/splash-cache.ts`, `src/lib/splash-cache.test.ts`
  - `src/routes/api/public/splash-logo.$.ts`
  - `src/lib/splash-audit.functions.ts` (server fn wrapping insert)
  - `src/components/splash-frame.tsx`
  - `src/routes/_authenticated/splash-preview.tsx`
  - Supabase migration for `splash_logo_audit_logs` (+ GRANTs, RLS, index on `store_id, created_at desc`).
- Files edited:
  - `src/routes/_authenticated/manage-shop.tsx` — use shared cache helper, call audit fn, add preview link.
  - `src/components/storefront-view.tsx` — cache proxy URL instead of raw signed URL.
  - `src/routes/__root.tsx` — extract splash markup into `SplashFrame` (kept as inline `<script>` for FOUC-free boot; component version used only by preview page).
- No schema change to `stores.shop_settings` (already has `splash` sub-object).
- Vitest already configured (see `client-bundle-guard.test.ts`); new test uses `@testing-library/jsdom` style `localStorage` mock — no new deps expected.
