# Logo System Upgrade — Plan

চারটি কাজ একসাথে করা হবে। প্রতিটি স্বতন্ত্র ও পরপর ডেলিভার করা যাবে।

## 1. Verification Checklist (docs only)

`LOGO_VERIFICATION.md` যোগ করা হবে — চেকলিস্ট আকারে:

- হেডার/সাইডবার/ফুটার/অথ পেজে লোগো দৃশ্যমান (রুট: `/`, `/auth`, `/login`, `/dashboard`, `/s/<slug>`, `/install`, `/offline`, `/reset-password`)
- হার্ড রিলোডে (Ctrl+Shift+R) স্প্ল্যাশ দেখাচ্ছে
- ব্রাউজার ট্যাবে favicon
- মোবাইল "Add to Home Screen"–এ নতুন আইকন
- Chrome DevTools → Application → Manifest ও Icons প্রিভিউ
- Lighthouse PWA স্কোর

কমান্ড: `curl -I <preview>/pwa-icon-512.png`-এর মতো verifier snippets দেওয়া হবে।

## 2. PWA Icon Cache-Busting (আনইনস্টল ছাড়া আপডেট)

সমস্যা: iOS/Android ইনস্টল টাইমে `manifest.webmanifest`-এর `icons[].src` ক্যাশ করে; একই path-এ নতুন ফাইল দিলেও রিফ্রেশ হয় না।

সমাধান:

- `public/manifest.webmanifest`-এ প্রতিটি আইকন src-এ version query যোগ: `/pwa-icon-192.png?v=2`
- `__root.tsx`-এর `<link rel="icon">`/`apple-touch-icon` href-গুলোতেও একই `?v=2`
- একটি ছোট constant `ICON_VERSION` ফাইল (`src/lib/icon-version.ts`) — নতুন লোগো বদলালে এই সংখ্যা bump করলেই hosts নতুন URL fetch করে
- বিদ্যমান sw.js (থাকলে) inspect করে stale icon cache entries পরিষ্কার করা হবে; না থাকলে kill-switch worker যোগ করা হবে না (PWA skill অনুযায়ী unnecessary)

সীমাবদ্ধতা স্পষ্ট করে বলা হবে: ইতিমধ্যে ইনস্টলড iOS অ্যাপে হোম-স্ক্রিন আইকন আপডেট OS-এর হাতে; কিছু ডিভাইসে reinstall লাগতেই পারে (এটি platform limitation, code দিয়ে workaround নেই)।

## 3. Dark/Light Logo Variant Support

`src/components/brand-logo.tsx` নতুন কম্পোনেন্ট:

- `useTheme()` হুক থেকে current mode পড়বে
- Props: `variant?: "auto" | "light" | "dark"`, `className`
- `site_settings` টেবিলে দুটি নতুন কলাম: `logo_url_light`, `logo_url_dark` (existing `logo_url` কে fallback হিসেবে ব্যবহার)
- হেডার/সাইডবার/অথ পেজে existing `<img src={logo}>` কল-সাইটগুলো `<BrandLogo/>`-এ রিপ্লেস
- default asset (`eazystore-logo.png.asset.json`) fallback হিসেবে থাকবে

Migration: `alter table public.site_settings add column logo_url_light text, add column logo_url_dark text`

## 4. Admin Logo Upload (সব জায়গায় auto-update)

`/_authenticated/admin` (বা existing `ui-customizer.tsx`)-এ "Brand Logo" সেকশন যোগ:

- দুটি upload slot: **Light mode logo**, **Dark mode logo** (+ single "Universal" fallback)
- Supabase Storage bucket `brand-assets` (public) — tool দিয়ে তৈরি হবে
- Upload → public URL → `site_settings.logo_url_light` / `logo_url_dark` / `logo_url`-এ save
- Save করার পর `ICON_VERSION` auto-bump করার জন্য একটি server function `bumpAssetVersion` — `site_settings.asset_version` int কলাম; manifest ও `<link>` tags এই version query হিসেবে read করবে
- Live preview thumbnail দেখাবে সেভ করার আগে
- RLS: শুধু `super_admin` role update করতে পারবে

সব consumer (`BrandLogo`, splash script, manifest generator) `site_settings` থেকে reactively পড়বে, ফলে upload করার সাথে সাথেই সব পেজে reflect হবে (splash-এ localStorage cache mechanism–এর মতো)।

## Technical Details

**Files to add:**
- `LOGO_VERIFICATION.md`
- `src/lib/icon-version.ts`
- `src/components/brand-logo.tsx`
- Migration: `site_settings` তে `logo_url_light`, `logo_url_dark`, `asset_version` কলাম
- Storage bucket: `brand-assets` (public)

**Files to modify:**
- `public/manifest.webmanifest` — icons-এ `?v={ICON_VERSION}`
- `src/routes/__root.tsx` — icon links-এ version, splash `<img>`-কে dynamic (site_settings থেকে)
- `src/components/app-sidebar.tsx`, `src/components/storefront-view.tsx`, auth pages — `<BrandLogo/>` ব্যবহার
- `src/components/admin/ui-customizer.tsx` — নতুন Brand Logo সেকশন

**Order:** 1 → 2 → 3 → 4 (docs first, তারপর infra, তারপর UI, শেষে admin flow)

## Questions

কাজ শুরু করার আগে কনফার্ম করুন:

- (A) চারটাই একসাথে করব, নাকি একটা একটা করে (যেমন আগে শুধু admin upload)?
- (B) Dark/light আলাদা লোগো: আপনি কি এখনই dark variant দেবেন, নাকি admin panel বানানোর পর আপনি নিজে upload করবেন?
- (C) `asset_version` auto-bump: প্রতিবার admin logo save করলে automatic bump হবে — ঠিক আছে?
