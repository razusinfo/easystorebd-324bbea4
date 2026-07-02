# Superadmin UI Customizer

Build a new tab inside the existing Super Admin page (`/admin`) that lets a super_admin control site-wide branding and layout, saved to a new `site_settings` table and applied instantly across the app.

## 1. Database

New table `public.site_settings` (single-row, keyed by `id = 'global'`):

- `logo_url` (text, nullable) — main logo (path in `site-assets` bucket)
- `favicon_url` (text, nullable)
- `primary_color` (text, hex, default `#5B21B6`)
- `sidebar_categories` (jsonb, default `[]`) — array of `{ id, label, icon, href, order }`
- `whatsapp_url` (text, nullable)
- `contact_email` (text, nullable)
- `contact_phone` (text, nullable)
- `facebook_url`, `instagram_url` (text, nullable)
- `updated_at`, `updated_by`

RLS + grants:

- `GRANT SELECT` to `anon` and `authenticated` (so public site reads it).
- `GRANT INSERT/UPDATE` only via policy checking `has_role(auth.uid(), 'super_admin')`.
- Policy: everyone can read; only super_admin can write.

New Supabase Storage bucket `site-assets` (public) for logo + favicon uploads.

## 2. Data layer — `src/lib/site-settings.ts`

- `type SiteSettings` matching columns.
- `useSiteSettings()` — public `useQuery` (5 min stale), used everywhere.
- `useUpdateSiteSettings()` — super_admin-only mutation, invalidates cache.
- `uploadSiteAsset(file, kind: "logo" | "favicon")` — uploads to `site-assets`, returns public URL.

## 3. UI — new tab in `/admin` ("UI Customizer")

Extend the existing tabs in `src/routes/_authenticated/admin.tsx` with a new `"customizer"` tab (super_admin gated by existing `useIsSuperAdmin`). Sections:

1. **Branding**
   - Logo uploader (preview + replace + remove)
   - Favicon uploader (preview + replace)
2. **Primary color** — HTML `<input type="color">` + hex text field with live preview swatch. Persists to `primary_color`.
3. **Sidebar categories** — inline list editor: reorder (up/down), rename, pick icon from a fixed lucide set (`Home, Package, ShoppingCart, Users, Settings, Truck, Tag, MessageSquare, ...`), set `href`, add/delete rows. Saved as ordered array.
4. **Contact & links** — WhatsApp URL, email, phone, Facebook, Instagram — with URL validation (zod).

Save button per section with optimistic toast; disable save while pristine.

## 4. Applying settings globally

- **Primary color**: root layout reads `useSiteSettings()` and injects `<style>:root{--primary: <hex>;}</style>` and sets the shadcn `--primary` token → instantly recolors buttons/active tabs.
- **Favicon**: root route `head().links` uses `settings.favicon_url` when present.
- **Logo & sidebar categories**: read from `useSiteSettings()` in the shared app header/sidebar components.
- **WhatsApp floating button**: existing storefront templates read `settings.whatsapp_url` instead of the current `#` placeholder.

## 5. Technical notes

- New route file NOT needed — reuse `/admin` with a new tab.
- All writes go through Supabase RLS; no server function needed since the browser client + RLS is enough for this admin write path.
- Zod validation on the customizer form (hex color regex, https URLs, non-empty labels).
- The categories JSON is validated before save; icon values restricted to the fixed lucide set to avoid arbitrary code.

## Files to touch

- New migration: create `site_settings` table + grants + policies + `site-assets` bucket seed row.
- New: `src/lib/site-settings.ts`
- Edit: `src/routes/_authenticated/admin.tsx` (add tab + panel)
- New: `src/components/admin/ui-customizer.tsx` (panel body)
- Edit: `src/routes/__root.tsx` (inject primary color + favicon)
- Edit: BdLove / EazyStoreBasic templates (WhatsApp link + shared logo fallback)

## Out of scope (ask before adding)

- Per-store overrides (this is one global site-wide setting)
- Dark-mode secondary palette
- Full theme editor for radii, fonts, spacing
