# Logo & Icon Verification Checklist

চলুন step-by-step যাচাই করি নতুন লোগো সব জায়গায় ঠিকভাবে লোড হচ্ছে কিনা।

## 1. In-app screens (visible logo)

Preview URL: `https://id-preview--8415c091-a856-405d-8288-89ca4d1fcfe2.lovable.app`

Login না করে খুলুন:

- [ ] `/` — হেডার এবং হিরো সেকশনে লোগো
- [ ] `/auth` — অথ কার্ডের উপরে
- [ ] `/install` — ইনস্টল প্রম্পট পেজে
- [ ] `/offline` — অফলাইন ফলব্যাক পেজে

Login করার পর:

- [ ] সাইডবারে (`<AppSidebar>`) লোগো
- [ ] Mobile সাইডবার (hamburger খুললে)
- [ ] `/admin/customizer` → Branding সেকশনে current logo preview
- [ ] `/admin/customizer` → Dark logo সেকশনে dark variant preview (যদি আপলোড করা থাকে)

## 2. Splash screen (page reload)

- [ ] `Ctrl+Shift+R` (hard reload) — Emerald ব্যাকগ্রাউন্ডে লোগো স্প্ল্যাশ ~০.৩s
- [ ] Mobile pull-to-refresh — একই splash reappear করবে
- [ ] Slow 3G throttle (DevTools → Network) — splash-এ লোগো visible থাকবে বেশিক্ষণ

## 3. Browser tab favicon

- [ ] Chrome/Edge tab-এ নতুন favicon (ছোট 16×16)
- [ ] Firefox
- [ ] Safari desktop
- [ ] DevTools → Application → Manifest → Icons — সব সাইজ preview OK

## 4. PWA / Add to Home Screen

- [ ] Android Chrome → ⋮ → "Install app" — install prompt-এ 512px আইকন
- [ ] iOS Safari → Share → "Add to Home Screen" — home icon-এ নতুন লোগো
- [ ] ইতিমধ্যে installed অ্যাপে refresh করলে (উপর থেকে টেনে) manifest reload হবে

> iOS/Android install-time-এ icon cache করে। `?v=<n>` query string bump হলে
> ব্রাউজার নতুন URL হিসেবে fetch করে, তাই reinstall ছাড়াই আপডেট আসে।
> কিছু পুরনো iOS ভার্সনে তবু reinstall লাগতে পারে (platform-level limitation)।

## 5. Command-line spot check

```bash
# Verify each icon size returns 200 + PNG
for s in 16 32 48 64 96 144 180 192 256 384 512; do
  curl -s -o /dev/null -w "%{http_code} %{content_type} pwa-icon-${s}\n" \
    "https://easystorebd.lovable.app/pwa-icon-${s}.png?v=2"
done

# Manifest
curl -s https://easystorebd.lovable.app/manifest.webmanifest | jq .icons | head
```

## 6. Cache-bust verification (after admin uploads a new logo)

- [ ] Admin uploads → toast "Site settings saved"
- [ ] অন্য tab খুলে reload → নতুন লোগো instantly (via `site_settings.asset_version`)
- [ ] Installed PWA → next launch এ নতুন লোগো (reinstall ছাড়াই)

## 7. Lighthouse

Chrome DevTools → Lighthouse → PWA category:

- [ ] "Installable" ✓
- [ ] "PWA optimized" ✓
- [ ] No "icon" or "manifest" warnings

## 8. Dark / Light variant

- [ ] Toggle theme (top-right) — লোগো swap হয় যদি dark variant আপলোড করা থাকে
- [ ] Dark variant না থাকলে main লোগোই দুই মোডে দেখাবে (graceful fallback)

---

আপডেট করার সময়: নতুন লোগো ফাইল আপলোডের পর `src/lib/icon-version.ts`-এ
`ICON_VERSION` bump করুন (২ → ৩), অথবা admin panel থেকে save করুন — dark/light
আপলোডের সাথে সাথেই `asset_version` bump হবে।
