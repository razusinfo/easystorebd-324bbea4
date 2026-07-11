# Domain Management System

তিনটি ফিচার একসাথে যোগ করা হবে: (1) Super Admin-এর জন্য Cloudflare wildcard setup wizard, (2) real-time domain/SSL status dashboard, (3) Store Owner-এর জন্য custom domain mapping UI।

## ১. Database Schema

নতুন টেবিল `custom_domains`:

```sql
CREATE TABLE public.custom_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  domain text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  -- pending | verifying | dns_ok | ssl_pending | live | failed | offline
  verification_token text NOT NULL,
  dns_target text NOT NULL DEFAULT '185.158.133.1',
  ssl_issued_at timestamptz,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

GRANT + RLS: owner reads/writes own rows; super_admin reads all; anon SELECT নয়।

নতুন টেবিল `platform_domain_setup` (singleton, Super Admin wildcard progress):

```sql
CREATE TABLE public.platform_domain_setup (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cloudflare_added boolean DEFAULT false,
  nameservers_updated boolean DEFAULT false,
  dns_records_added boolean DEFAULT false,
  ssl_mode_set boolean DEFAULT false,
  lovable_wildcard_connected boolean DEFAULT false,
  current_step int DEFAULT 1,
  updated_at timestamptz DEFAULT now()
);
```

## ২. Server Functions (`src/lib/custom-domains.functions.ts`)

- `addCustomDomain({ storeId, domain })` — validate, insert, generate token
- `checkDomainStatus({ domainId })` — DNS lookup (A record → 185.158.133.1), TXT verify, HTTPS probe; update status
- `listMyDomains()` — store owner view
- `removeCustomDomain({ domainId })`
- `getPlatformSetup()` / `updatePlatformSetupStep({ step, done })` — Super Admin

DNS check server-side: `dns.promises.resolve4()` (Node built-in, Cloudflare Worker সমর্থন করে) + `fetch(https://${domain}, { method: 'HEAD' })` SSL probe।

## ৩. UI Components

### `src/routes/_authenticated/admin-platform-domain-setup.tsx` (Super Admin)
৫-step wizard:
1. **Cloudflare Account** — signup link, "I've added easystorebd.com" checkbox
2. **Nameservers** — Cloudflare-provided NS দেখানোর ইনপুট + registrar guide
3. **DNS Records** — copy-paste table (A `@`, A `www`, A `*` → 185.158.133.1, Proxied)
4. **SSL Mode** — Full mode confirm
5. **Lovable Connect** — `*.easystorebd.com` proxy-mode instructions + verify button (probes `test-verify.easystorebd.com`)

প্রতি step-এ progress bar, next/back, database-এ auto-save।

### `src/routes/_authenticated/domain-settings.tsx` (Store Owner)
- Current subdomain দেখানো (`<slug>.easystorebd.com`, copy button)
- "Add Custom Domain" ফর্ম (নিজস্ব domain যেমন `myshop.com`)
- Instructions card: A record → 185.158.133.1, TXT `_lovable` verification
- Domain list with real-time status badge + "Recheck" button + delete
- Live SSL confirmation: green ✓ "SSL active" যখন HTTPS probe সফল

### `src/components/domain-status-badge.tsx`
Reusable badge: pending (gray) → verifying (yellow, spinner) → dns_ok (blue) → ssl_pending (orange) → live (green ✓) → failed (red)।

## ৪. Real-time Status

TanStack Query with `refetchInterval: 15000` non-live domains-এর জন্য; live হলে 60s। Manual "Recheck now" button `checkDomainStatus` invoke করবে।

Storefront resolver (`src/lib/storefront-host.ts`) update: hostname যদি `custom_domains` টেবিলে থাকে → সেই store লোড করবে।

## ৫. Sidebar

- Super Admin: "Platform Domain Setup" menu item
- Store Owner: "Domain Settings" menu item

## ৬. Files to Create/Modify

**New:**
- `supabase/migrations/*_custom_domains.sql`
- `src/lib/custom-domains.functions.ts`
- `src/routes/_authenticated/admin-platform-domain-setup.tsx`
- `src/routes/_authenticated/domain-settings.tsx`
- `src/components/domain-status-badge.tsx`
- `src/components/domain-setup-wizard.tsx`

**Modify:**
- `src/lib/storefront-host.ts` — custom domain lookup
- `src/components/app-sidebar.tsx` — new menu items
- `src/routeTree.gen.ts` — auto-regenerated

## Notes

- DNS checks run server-side only (Node `dns` module)
- Rate limit recheck: max 1/minute per domain
- Custom domains still need user to point A record; wizard কেবল guide, DNS পুশ নয়
