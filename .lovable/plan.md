
# Make Basic Theme Links & Cart Actually Work

Right now the Basic Theme storefront looks finished but almost nothing is clickable — category items, footer links (Company / About Us / Team / Products / Blogs / Pricing), and the **Add to cart** button are all dead `href="#"` / no-op buttons. This plan turns them into working features.

## What will work after this

1. **Add to cart** button on each product card actually adds the item to a cart.
2. A **cart drawer** opens from the header cart icon showing items, quantities, remove, and total.
3. **Checkout** button in the drawer submits the order into the existing `orders` + `order_items` tables (guest checkout with name / phone / address).
4. **Category sidebar** items filter the product grid (both desktop sidebar and mobile drawer).
5. **Footer links** navigate to real pages (`/s/$slug/about`, `/contact`, `/products`, etc.) instead of `#`. Each page is a simple, on-brand page using the store's own content (about text, contact info, product list).
6. **Search bar** filters products by name as the user types.

## How it will be built (technical)

### Cart (client-side, per-store, persisted)
- New `src/lib/cart-store.ts` — Zustand store keyed by `storeId`, persisted in `localStorage`.
- Items: `{ productId, name, price, imageUrl, qty }`. Actions: `add`, `remove`, `setQty`, `clear`, selectors for `count` and `total`.

### Cart drawer
- New `src/components/storefront/cart-drawer.tsx` using existing shadcn `Sheet`.
- Header cart icon shows a live count badge and opens the drawer.
- Checkout form (name, phone, address, optional note) inserts a row into `orders` + one row per line into `order_items`, then clears the cart and shows a "Thanks — order #… placed" confirmation. Uses the existing anon-safe insert policies already on those tables.

### Category filter
- Selected category held in local state inside `EazyStoreBasicTemplate`.
- Filter `products` by `category_id` (already on `products`). "All Products" clears the filter.
- Active pill uses the theme accent color, as today.

### Footer & pages
- Replace footer `<a href>` values with TanStack `<Link>` to new routes under `src/routes/s.$slug.about.tsx`, `contact.tsx`, `team.tsx`, `products.tsx`, `blogs.tsx`, `pricing.tsx`.
- Each page reuses the store header/footer chrome from the Basic Theme so the look stays consistent, and pulls content from the existing `stores` row (about, address, phone, email, socials). Pages that have no data yet (Team, Blogs, Pricing) render a friendly empty state — no fake demo content.
- Add the missing routes with `head()` metadata so they're SEO-friendly and shareable.

### Search
- Controlled input in the header filters the visible product list by case-insensitive substring on `name`.

## Not in scope (ask before adding)

- Payment gateway integration (Stripe / bKash) — checkout only records the order for now.
- Product detail page (clicking a product card). Can be a follow-up.
- Cart syncing across devices (server-side cart) — local cart is enough for guest checkout.
