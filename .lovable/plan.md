
## Scope

New Super Admin-only sidebar group "EasyStore365.com Control" containing 4 management modules for the marketplace project, backed by new Supabase tables with realtime.

## Sidebar changes (`src/components/app-sidebar.tsx`)

Add a new admin-gated group below existing Admin group:
- Marketplace Orders → `/admin-marketplace/orders`
- Campaign & Banner Manager → `/admin-marketplace/campaigns`
- Flash Sale Controller → `/admin-marketplace/flash-sales`
- Category & Menu Settings → `/admin-marketplace/categories`

Group only renders when `useIsSuperAdmin().data === true`.

## Database (single migration)

New tables in `public` schema, RLS super-admin only via `has_role(auth.uid(),'admin')`, plus GRANTs and `updated_at` triggers, added to `supabase_realtime` publication:

1. `marketplace_orders` — id, order_code, customer_name, customer_phone, reseller_store_name, reseller_store_id (nullable fk), total_amount numeric, status enum(`pending|shipped|delivered|cancelled`), notes, timestamps.
2. `marketplace_campaigns` — id, name, slug, description, banner_url, starts_at, ends_at, is_active bool default false, sort_order, timestamps.
3. `marketplace_flash_sales` — id, product_id uuid fk products, discount_percent int check 1–95, ends_at timestamptz, is_active bool, timestamps; unique(product_id) while active.
4. `marketplace_categories` — id, name, slug, parent_id self-fk, image_url, sort_order, is_hidden bool default false, timestamps.

Public read policies (`TO anon` SELECT) with `is_active = true` / `is_hidden = false` filters so EasyStore365.com frontend can consume; admins have full CRUD.

Storage: new bucket `marketplace-banners` (public read) for banner images via `supabase--storage_create_bucket`.

## Routes (all under `_authenticated/`, super-admin gated in loader/component)

- `src/routes/_authenticated/admin-marketplace/orders.tsx` — table with inline editable status `<Select>`, search, pagination, realtime subscription.
- `src/routes/_authenticated/admin-marketplace/campaigns.tsx` — grid of campaign cards with Active/Inactive `<Switch>`, banner upload (existing storage helper pattern), date range pickers, add/edit dialog.
- `src/routes/_authenticated/admin-marketplace/flash-sales.tsx` — product search combobox (queries `products`), assign discount% + end datetime, list with Remove button, countdown display.
- `src/routes/_authenticated/admin-marketplace/categories.tsx` — CRUD tree (reuse patterns from existing `category-editor.tsx`), Hide toggle, Delete confirm.

## Data layer

- `src/lib/marketplace-admin.ts` — React Query hooks (`useMarketplaceOrders`, `useUpdateOrderStatus`, `useCampaigns`, `useToggleCampaign`, `useFlashSales`, `useMarketplaceCategories`, etc.) using browser supabase client (RLS enforces admin).
- Each list hook attaches a `postgres_changes` realtime channel in a `useEffect` and invalidates the query on change.

## UI

Match existing dashboard styling (semantic tokens, shadcn `Card`, `Table`, `Badge`, `Switch`, `Select`, `Dialog`). Add a subtle "Marketplace Management" header banner on each page to keep it visually distinct.

## Out of scope

- The public EasyStore365.com frontend consumption (this project only exposes admin CRUD + public-read policies).
- Auto-deactivating flash sales past `ends_at` (frontend filters on `ends_at > now()`; a scheduled job can be added later).

Approve to proceed — I'll ship the migration first (needs your approval), then the routes/sidebar/hooks in follow-up edits.
