## Goal

Keep the current desktop layouts unchanged, and add a proper mobile-friendly view for every page in the app. Desktop users see exactly what they see today; phone users get a layout that fits a ~360–430px screen with no horizontal scroll, readable text, and reachable controls.

## Approach

One codebase, responsive breakpoints — not a separate mobile app. Every page keeps its current desktop composition (`sm:`/`md:`/`lg:` classes) and gets a mobile-first base layout underneath. Where desktop uses a sidebar, mobile gets a top bar + drawer. Where desktop uses multi-column grids or wide tables, mobile stacks into a single column or card list.

## Pages to cover

Public pages
- `/` — Landing (nav, hero, features, pricing, footer)
- `/auth`, `/login`, `/reset-password`
- `/s/$slug` — Public storefront

Authenticated app (shares the sidebar shell in `_authenticated/route.tsx`)
- Dashboard, Onboarding, Manage shop, Products, Categories, Orders, Customers
- Analytics, Promo codes, Spotlights, Landing pages, Themes, Theme builder
- Courier, SMS settings, Mobile app, Admin

## What changes on mobile

- Sidebar shell → hidden by default, opens as a slide-in drawer from a hamburger in a sticky top bar. Desktop `lg:` sidebar untouched.
- Landing nav → hamburger drawer with the same links + CTA.
- Hero + split layouts → single column, image below text, tighter padding.
- Feature/step/pricing grids → 1 column on mobile, 2 on tablet, 3+ on desktop (already the pattern in most places — audit and fix outliers).
- Tables (Products, Orders, Customers, Admin users, Audit logs) → keep the table for `md:` and up; on mobile render the same data as stacked cards with the key fields on top.
- Forms and dialogs → full-width inputs, `min-h-11` tap targets, sticky action bar at the bottom of long forms.
- Storefront → product grid drops to 2 columns on mobile, filter/sort become a bottom sheet.
- Fix any row that currently overflows: apply the `grid-cols-[minmax(0,1fr)_auto] + min-w-0 + shrink-0 + truncate` pattern to header rows containing text + widgets.

## Global infrastructure (small, one-time)

- Confirm `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` in `src/routes/__root.tsx` (already present).
- Add a `useIsMobile()` hook usage where a component needs to switch component (not just styling), e.g. sidebar vs drawer. `src/hooks/use-mobile.tsx` already exists — reuse it.
- Introduce a shared `MobileTopBar` used by the authenticated shell that renders the hamburger + page title + user menu on `< lg` widths.
- Introduce a `ResponsiveTable` pattern: a `<table className="hidden md:table">` plus a `<div className="md:hidden">` card list, both fed from the same rows array.

## Rollout order

To keep each change reviewable, ship in batches:

1. Shell + landing: `_authenticated/route.tsx` sidebar drawer, landing nav drawer, `/auth`, `/login`, `/reset-password`.
2. Merchant core: Dashboard, Onboarding, Manage shop, Products, Categories, Orders, Customers.
3. Storefront + growth: `/s/$slug`, Analytics, Promo codes, Spotlights, Landing pages, Themes, Theme builder.
4. Ops + admin: Courier, SMS settings, Mobile app, Admin (users, audit logs).

Each batch is verified by loading the affected routes at 375px width in the preview and checking: no horizontal scroll, no overlapping controls, all primary actions reachable without pinching.

## Technical details

- Tailwind breakpoints stay default: `sm:640`, `md:768`, `lg:1024`, `xl:1280`. Mobile = base classes, then progressive enhancement upward.
- Sidebar drawer uses the existing shadcn `Sheet` component (already installed) so styling stays consistent with the app.
- Tables become cards on mobile by rendering both markups conditionally with Tailwind's `hidden`/`md:hidden` — no JS branching, so SSR stays clean.
- No route duplication, no `/m/*` routes, no user-agent sniffing. One responsive tree per page.
- Non-goal: PWA install, native app packaging, offline support. Those are separate asks.

## Out of scope

- No visual redesign of desktop.
- No new pages or features.
- No changes to business logic, data model, or auth.
