import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Store as StoreIcon, Loader2, Globe, FileText, Truck, Landmark, BarChart3,
  MessageSquare, MessageCircle, Share2, Save, Check, Copy, ExternalLink,
  Upload, Trash2, Rocket, X, ArrowLeft, Lock, Pencil,
} from "lucide-react";
import { toast } from "sonner";

import {
  useMyStore, useUpdateStore, useLogoSignedUrl, uploadStoreLogo, deleteStoreLogo,
  usePublishStore, useChangeSlug, slugifyStoreName, buildStorefrontUrl,
  TEMPLATES,
  type Category, type TemplateId, type ShopSettings,
} from "@/lib/eazystore-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/manage-shop")({
  head: () => ({
    meta: [
      { title: "Manage Shop — EazyStore" },
      { name: "description", content: "Manage all shop configurations — settings, domain, policy, delivery, payments, SEO and support in one place." },
    ],
  }),
  component: ManageShopPage,
});

type CardKey =
  | "settings" | "domain" | "policy" | "delivery" | "payment"
  | "seo" | "sms" | "chat" | "social";

const CARDS: {
  key: CardKey;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}[] = [
  { key: "settings", title: "Shop Settings", desc: "General shop configurations — name, logo, category and template.", icon: StoreIcon },
  { key: "domain", title: "Shop Domain", desc: "Manage your shop URL, publish status and custom slug.", icon: Globe },
  { key: "policy", title: "Shop Policy", desc: "Define return, refund, shipping, privacy and terms policies.", icon: FileText },
  { key: "delivery", title: "Delivery Support", desc: "Set delivery charges inside/outside Dhaka and free-shipping rules.", icon: Truck },
  { key: "payment", title: "Payment Gateway", desc: "Configure bKash, Nagad, Rocket, bank transfer and COD.", icon: Landmark },
  { key: "seo", title: "SEO & Marketing Integrations", desc: "Google Tag Manager, Facebook Pixel, TikTok Pixel and more.", icon: BarChart3, badge: "New" },
  { key: "sms", title: "SMS Support", desc: "SMS notifications to keep customers updated in real time.", icon: MessageSquare },
  { key: "chat", title: "Chat Support", desc: "Enable Messenger, WhatsApp or Tawk.to live chat on your store.", icon: MessageCircle },
  { key: "social", title: "Social Links", desc: "Connect Facebook, Instagram, WhatsApp and your website.", icon: Share2 },
];

function ManageShopPage() {
  const storeQ = useMyStore();
  const [open, setOpen] = useState<CardKey | null>(null);

  if (storeQ.isLoading) {
    return (
      <main className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }
  if (!storeQ.data) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-5 text-center">
        <div className="max-w-sm space-y-4">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl gradient-primary text-white">
            <StoreIcon className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">No store yet</h1>
          <p className="text-sm text-muted-foreground">
            Set up your store with the onboarding wizard first.
          </p>
          <Link
            to="/onboarding"
            className="inline-flex items-center justify-center rounded-2xl gradient-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-md"
          >
            Start onboarding
          </Link>
        </div>
      </main>
    );
  }

  const store = storeQ.data;

  if (open === "settings") {
    return <ShopSettingsView store={store} onBack={() => setOpen(null)} />;
  }
  if (open === "domain") {
    return <ShopDomainView store={store} onBack={() => setOpen(null)} />;
  }

  return (
    <main className="mx-auto w-full max-w-6xl p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Manage Shop</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set up and customize your shop to ensure a smooth and efficient experience.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <button
            key={c.key}
            onClick={() => setOpen(c.key)}
            className="group relative text-left rounded-xl border bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all"
          >
            {c.badge && (
              <span className="absolute top-3 right-3 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                {c.badge}
              </span>
            )}
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center mb-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <c.icon className="h-5 w-5" />
            </div>
            <div className="font-semibold">{c.title}</div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.desc}</p>
          </button>
        ))}
      </div>

      {open === "policy" && <ShopPolicyDialog store={store} onClose={() => setOpen(null)} />}
      {open === "delivery" && <DeliveryDialog store={store} onClose={() => setOpen(null)} />}
      {open === "payment" && <PaymentDialog store={store} onClose={() => setOpen(null)} />}
      {open === "seo" && <SeoDialog store={store} onClose={() => setOpen(null)} />}
      {open === "sms" && <SmsDialog onClose={() => setOpen(null)} />}
      {open === "chat" && <ChatDialog store={store} onClose={() => setOpen(null)} />}
      {open === "social" && <SocialDialog store={store} onClose={() => setOpen(null)} />}
    </main>
  );
}


// -------- Reusable dialog shell --------
function SectionDialog({
  title, description, onClose, children, footer,
}: {
  title: string; description?: string; onClose: () => void;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4 py-2">{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

// -------- Shop Settings (full-page view like reference) --------
const BUSINESS_TYPES = [
  "Not Selected", "Clothing & Apparel", "Shoes & Footwear", "Accessories & Jewelry",
  "Beauty & Cosmetics", "Electronics & Gadgets", "Home & Furniture", "Books & Media",
  "Toys & Games", "Sports & Outdoors", "Health & Wellness", "Food & Beverage",
  "Pet Supplies", "Grocery", "Telecommunication Items", "Pharmaceuticals",
  "Utilities", "Others",
];
const COUNTRIES = [
  { code: "BD", name: "Bangladesh", flag: "🇧🇩" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰" },
  { code: "NP", name: "Nepal", flag: "🇳🇵" },
  { code: "BT", name: "Bhutan", flag: "🇧🇹" },
  { code: "LK", name: "Sri Lanka", flag: "🇱🇰" },
  { code: "MV", name: "Maldives", flag: "🇲🇻" },
  { code: "AF", name: "Afghanistan", flag: "🇦🇫" },
  { code: "MM", name: "Myanmar", flag: "🇲🇲" },
  { code: "TH", name: "Thailand", flag: "🇹🇭" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "PH", name: "Philippines", flag: "🇵🇭" },
  { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰" },
  { code: "TW", name: "Taiwan", flag: "🇹🇼" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "QA", name: "Qatar", flag: "🇶🇦" },
  { code: "KW", name: "Kuwait", flag: "🇰🇼" },
  { code: "BH", name: "Bahrain", flag: "🇧🇭" },
  { code: "OM", name: "Oman", flag: "🇴🇲" },
  { code: "JO", name: "Jordan", flag: "🇯🇴" },
  { code: "LB", name: "Lebanon", flag: "🇱🇧" },
  { code: "IR", name: "Iran", flag: "🇮🇷" },
  { code: "IQ", name: "Iraq", flag: "🇮🇶" },
  { code: "TR", name: "Turkey", flag: "🇹🇷" },
  { code: "EG", name: "Egypt", flag: "🇪🇬" },
  { code: "MA", name: "Morocco", flag: "🇲🇦" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "KE", name: "Kenya", flag: "🇰🇪" },
  { code: "ET", name: "Ethiopia", flag: "🇪🇹" },
  { code: "GH", name: "Ghana", flag: "🇬🇭" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "CL", name: "Chile", flag: "🇨🇱" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "IE", name: "Ireland", flag: "🇮🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "BE", name: "Belgium", flag: "🇧🇪" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "AT", name: "Austria", flag: "🇦🇹" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "NO", name: "Norway", flag: "🇳🇴" },
  { code: "DK", name: "Denmark", flag: "🇩🇰" },
  { code: "FI", name: "Finland", flag: "🇫🇮" },
  { code: "PL", name: "Poland", flag: "🇵🇱" },
  { code: "CZ", name: "Czechia", flag: "🇨🇿" },
  { code: "GR", name: "Greece", flag: "🇬🇷" },
  { code: "RU", name: "Russia", flag: "🇷🇺" },
  { code: "UA", name: "Ukraine", flag: "🇺🇦" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
];


function ShopSettingsView({ store, onBack }: { store: any; onBack: () => void }) {
  const update = useUpdateStore();
  const g = (store.shop_settings?.general ?? {}) as any;

  // Basic
  const [name, setName] = useState(store.name);
  const [businessType, setBusinessType] = useState<string>(g.business_type ?? "Clothing & Apparel");
  const [email, setEmail] = useState(store.contact_email ?? "");
  const [phone, setPhone] = useState(store.phone ?? "");
  const [country, setCountry] = useState<string>(g.country ?? "BD");
  const [address, setAddress] = useState(store.address ?? "");

  // Toggles
  const [lang, setLang] = useState<"en" | "bn">(g.default_language ?? "en");
  const [themeBuilder, setThemeBuilder] = useState<boolean>(!!g.theme_builder_active);
  const [maintainStock, setMaintainStock] = useState<boolean>(!!g.maintain_stock);
  const [showSold, setShowSold] = useState<boolean>(g.show_sold_count ?? true);
  const [allowDl, setAllowDl] = useState<boolean>(g.allow_image_downloads ?? true);
  const [showEmail, setShowEmail] = useState<boolean>(!!g.show_email_field);
  const [enablePromo, setEnablePromo] = useState<boolean>(g.enable_promo ?? true);
  const [showPop, setShowPop] = useState<boolean>(!!g.show_popularity_filter);
  const [autoVariant, setAutoVariant] = useState<boolean>(g.auto_select_variant ?? true);
  const [orderLimit, setOrderLimit] = useState<string>(g.per_hour_order_limit?.toString() ?? "");
  const [vat, setVat] = useState<string>(g.vat_percent?.toString() ?? "0");

  // Sidebar
  const [logoPath, setLogoPath] = useState<string | null>(store.logo_url);
  const [localLogo, setLocalLogo] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const signedLogo = useLogoSignedUrl(logoPath);

  const [faviconPath, setFaviconPath] = useState<string | null>(g.favicon_url ?? null);
  const [localFavicon, setLocalFavicon] = useState<string | null>(null);
  const [uploadingFav, setUploadingFav] = useState(false);
  const favRef = useRef<HTMLInputElement>(null);
  const signedFav = useLogoSignedUrl(faviconPath);

  const [themeColor, setThemeColor] = useState<string>(g.theme_color ?? "#7c3aed");

  const logo = localLogo || signedLogo.data || null;
  const favicon = localFavicon || signedFav.data || null;

  const slug = store.slug || slugifyStoreName(store.name);
  const shopUrl = slug ? buildStorefrontUrl(slug) : "";
  const qrUrl = shopUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(shopUrl)}`
    : "";
  const businessId = store.id.replace(/-/g, "").slice(0, 6).toUpperCase();

  async function pickLogo(f: File) {
    if (!f.type.startsWith("image/")) return toast.error("Please choose an image.");
    if (f.size > 2 * 1024 * 1024) return toast.error("Logo must be ≤ 2MB.");
    setLocalLogo(URL.createObjectURL(f));
    setUploadingLogo(true);
    try {
      const old = logoPath;
      const p = await uploadStoreLogo(f);
      setLogoPath(p);
      if (old && old !== p) await deleteStoreLogo(old);
    } catch (e: any) { toast.error(e?.message ?? "Upload failed."); }
    finally { setUploadingLogo(false); }
  }
  async function pickFavicon(f: File) {
    if (!f.type.startsWith("image/")) return toast.error("Please choose an image.");
    if (f.size > 512 * 1024) return toast.error("Favicon must be ≤ 512KB.");
    setLocalFavicon(URL.createObjectURL(f));
    setUploadingFav(true);
    try {
      const old = faviconPath;
      const p = await uploadStoreLogo(f);
      setFaviconPath(p);
      if (old && old !== p) await deleteStoreLogo(old);
    } catch (e: any) { toast.error(e?.message ?? "Upload failed."); }
    finally { setUploadingFav(false); }
  }

  async function saveAll() {
    try {
      const merged = {
        ...(store.shop_settings ?? {}),
        general: {
          ...(store.shop_settings?.general ?? {}),
          business_type: businessType,
          country,
          default_language: lang,
          favicon_url: faviconPath,
          theme_color: themeColor,
          theme_builder_active: themeBuilder,
          maintain_stock: maintainStock,
          show_sold_count: showSold,
          allow_image_downloads: allowDl,
          show_email_field: showEmail,
          enable_promo: enablePromo,
          show_popularity_filter: showPop,
          auto_select_variant: autoVariant,
          per_hour_order_limit: orderLimit === "" ? null : Number(orderLimit),
          vat_percent: vat === "" ? null : Number(vat),
        },
      };
      await update.mutateAsync({
        id: store.id,
        name: name.trim(),
        contact_email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        logo_url: logoPath,
        shop_settings: merged,
      });
      toast.success("Shop settings updated.");
    } catch (e: any) { toast.error(e?.message ?? "Save failed."); }
  }

  async function saveThemeColor() {
    try {
      await update.mutateAsync({
        id: store.id,
        shop_settings: {
          ...(store.shop_settings ?? {}),
          general: { ...(store.shop_settings?.general ?? {}), theme_color: themeColor },
        },
      });
      toast.success("Theme color saved.");
    } catch (e: any) { toast.error(e?.message ?? "Save failed."); }
  }

  return (
    <main className="mx-auto w-full max-w-7xl p-4 md:p-6">
      <div className="flex items-center gap-3 mb-5">
        <Button variant="outline" size="icon" onClick={onBack} className="rounded-full h-9 w-9">
          <X className="h-4 w-4" />
        </Button>
        <h1 className="text-xl md:text-2xl font-bold">Shop Settings</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* LEFT column */}
        <div className="space-y-5">
          {/* Basic Info */}
          <section className="rounded-xl border bg-card p-5">
            <h2 className="font-semibold mb-4">Shop Basic Info</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Business ID</Label>
                <Input value={businessId} readOnly className="bg-muted/40" />
              </div>
              <div>
                <Label>Business Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Business Type</Label>
                <Select value={businessType} onValueChange={setBusinessType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[228px]">
                    {BUSINESS_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Shop Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label>Shop Phone Number</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <Label>Country</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Shop Address</Label>
                <Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
            </div>
          </section>

          {/* Shop Settings toggles */}
          <section className="rounded-xl border bg-card p-5">
            <h2 className="font-semibold mb-4">Shop Settings</h2>

            <div className="flex items-center justify-between py-2">
              <div className="text-sm font-medium">Default language</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setLang("en")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border ${lang === "en" ? "border-primary text-primary bg-primary/5" : "border-transparent"}`}
                >🇺🇸 English</button>
                <button
                  onClick={() => setLang("bn")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border ${lang === "bn" ? "border-primary text-primary bg-primary/5" : "border-transparent"}`}
                >🇧🇩 Bangla</button>
              </div>
            </div>

            <ToggleRow
              label="Theme Builder"
              onLabel="ACTIVE" offLabel="INACTIVE"
              desc="When inactive, your storefront falls back to the default theme."
              checked={themeBuilder} onChange={setThemeBuilder}
            />
            <ToggleRow
              label="Maintain Stock Quantity"
              desc="Enabling ensures products with zero stock are marked Out of Stock and cannot be ordered."
              checked={maintainStock} onChange={setMaintainStock}
            />
            <ToggleRow
              label="Show Product Sold Count"
              checked={showSold} onChange={setShowSold}
            />
            <ToggleRow
              label="Allow Product Image Downloads"
              onLabel="YES" offLabel="NO"
              desc="When enabled, individual products can control their own image download settings."
              checked={allowDl} onChange={setAllowDl}
            />
            <ToggleRow
              label="Show Email Field for Place Order"
              onLabel="YES" offLabel="NO"
              desc="When disabled, the email field will be hidden from the checkout page."
              checked={showEmail} onChange={setShowEmail}
            />
            <ToggleRow
              label="Enable Promo Code for Place Order"
              onLabel="YES" offLabel="NO"
              desc="Customers can apply promo codes during checkout to receive discounts."
              checked={enablePromo} onChange={setEnablePromo}
            />
            <ToggleRow
              label="Show Product Filter by Popularity (Highest Sold)"
              onLabel="YES" offLabel="NO"
              desc="When disabled, popularity-based sorting will be hidden on storefront filters."
              checked={showPop} onChange={setShowPop}
            />
            <ToggleRow
              label="Auto Select Mandatory Variant"
              onLabel="YES" offLabel="NO"
              desc="First option of a mandatory variant will be selected by default on the product page."
              checked={autoVariant} onChange={setAutoVariant}
            />

            <div className="mt-4">
              <Label>Per Hour Order Limit</Label>
              <Input
                type="number" placeholder="No limit"
                value={orderLimit} onChange={(e) => setOrderLimit(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum number of orders a single customer can place per hour. Leave empty for no limit.
              </p>
            </div>

            <div className="mt-4">
              <Label>VAT / Tax Percentage</Label>
              <Input type="number" value={vat} onChange={(e) => setVat(e.target.value)} />
            </div>

            <div className="flex justify-end mt-5">
              <Button onClick={saveAll} disabled={update.isPending}>
                {update.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Update Shop Settings
              </Button>
            </div>
          </section>
        </div>

        {/* RIGHT sidebar */}
        <aside className="space-y-5">
          {/* QR */}
          <section className="rounded-xl border bg-card p-5">
            <h3 className="font-semibold mb-3">Shop QR</h3>
            <div className="mx-auto w-full max-w-[240px] aspect-square rounded-lg border bg-white p-3 grid place-items-center">
              {qrUrl ? (
                <img src={qrUrl} alt="QR code" className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">Publish shop to get QR</span>
              )}
            </div>
            <p className="text-xs text-center text-muted-foreground mt-3">Scan the QR to visit your shop</p>
            {shopUrl && (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-primary/5 px-3 py-2 text-xs">
                <span className="flex-1 truncate text-primary">{shopUrl}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(shopUrl); toast.success("Copied"); }}
                  className="text-primary hover:opacity-80"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <input ref={logoRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && pickLogo(e.target.files[0])} />
            <Button
              className="w-full mt-3 gradient-primary text-primary-foreground"
              onClick={() => logoRef.current?.click()}
              disabled={uploadingLogo}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadingLogo ? "Uploading..." : "Upload Shop Logo"}
            </Button>
            {logo && (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <img src={logo} alt="logo" className="h-8 w-8 rounded object-cover border" />
                <span>Current logo</span>
                <button className="ml-auto text-destructive"
                  onClick={() => { setLogoPath(null); setLocalLogo(null); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </section>

          {/* Favicon */}
          <section className="rounded-xl border bg-card p-5">
            <h3 className="font-semibold mb-3">Shop Favicon</h3>
            <div className="w-full aspect-video border-2 border-dashed rounded-lg grid place-items-center bg-muted/30 overflow-hidden">
              {favicon ? (
                <img src={favicon} alt="favicon" className="max-h-full object-contain" />
              ) : (
                <div className="text-muted-foreground">
                  <Upload className="h-8 w-8 mx-auto opacity-40" />
                </div>
              )}
            </div>
            <input ref={favRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && pickFavicon(e.target.files[0])} />
            <Button
              className="w-full mt-3 gradient-primary text-primary-foreground"
              onClick={() => favRef.current?.click()}
              disabled={uploadingFav}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadingFav ? "Uploading..." : "Upload Shop Favicon"}
            </Button>
          </section>

          {/* Theme color */}
          <section className="rounded-xl border bg-card p-5">
            <h3 className="font-semibold text-primary mb-3">Shop Theme</h3>
            <input
              type="color" value={themeColor}
              onChange={(e) => setThemeColor(e.target.value)}
              className="w-full h-40 rounded-lg border cursor-pointer"
            />
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="h-5 w-5 rounded border" style={{ background: themeColor }} />
              <Input value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="h-8" />
            </div>
            <Button
              className="w-full mt-3 gradient-primary text-primary-foreground"
              onClick={saveThemeColor}
              disabled={update.isPending}
            >
              Save Theme Color
            </Button>
          </section>
        </aside>
      </div>
    </main>
  );
}

function ToggleRow({
  label, desc, checked, onChange, onLabel, offLabel,
}: {
  label: string; desc?: string; checked: boolean;
  onChange: (v: boolean) => void; onLabel?: string; offLabel?: string;
}) {
  return (
    <div className="py-3 border-t first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(onLabel || offLabel) && (
            <span className="text-[10px] uppercase font-bold text-muted-foreground">
              {checked ? onLabel : offLabel}
            </span>
          )}
          <Switch checked={checked} onCheckedChange={onChange} />
        </div>
      </div>
    </div>
  );
}


// -------- Shop Domain (full-page view like reference) --------
function ShopDomainView({ store, onBack }: { store: any; onBack: () => void }) {
  const publish = usePublishStore();
  const changeSlug = useChangeSlug();
  const updateStore = useUpdateStore();
  const currentSlug = store.slug || slugifyStoreName(store.name);
  const [slug, setSlug] = useState<string>(currentSlug);
  const [editing, setEditing] = useState(false);
  const url = slug ? buildStorefrontUrl(slug) : "";
  const host = url ? url.replace(/^https?:\/\//, "").replace(/\/$/, "") : "";

  const canCustomDomain = store.plan_tier && store.plan_tier !== "free";
  const customDomain: string | null = store.custom_domain ?? null;
  const [customDialogOpen, setCustomDialogOpen] = useState(false);

  async function saveSlug() {
    try {
      await changeSlug.mutateAsync({ id: store.id, slug });
      toast.success("Domain updated.");
      setEditing(false);
    } catch (e: any) { toast.error(e?.message ?? "Domain change failed."); }
  }
  async function publishNow() {
    try {
      await publish.mutateAsync({ id: store.id, name: store.name, desiredSlug: slug });
      toast.success("Shop published.");
    } catch (e: any) { toast.error(e?.message ?? "Publish failed."); }
  }
  function copy(v: string) {
    navigator.clipboard.writeText(v);
    toast.success("Copied");
  }
  async function removeDomain() {
    if (!confirm("Reset your shop domain to a default slug?")) return;
    const next = slugifyStoreName(store.name);
    try {
      await changeSlug.mutateAsync({ id: store.id, slug: next });
      setSlug(next);
      toast.success("Domain reset.");
    } catch (e: any) { toast.error(e?.message ?? "Reset failed."); }
  }
  async function removeCustomDomain() {
    if (!confirm("Remove your custom domain? You can add it back anytime.")) return;
    try {
      await updateStore.mutateAsync({ id: store.id, custom_domain: null } as any);
      toast.success("Custom domain removed.");
    } catch (e: any) { toast.error(e?.message ?? "Remove failed."); }
  }

  const RESOLVED_IPS = ["185.158.133.1", "185.158.133.2"];

  return (
    <main className="mx-auto w-full max-w-5xl p-4 md:p-6">
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={onBack}
          className="grid h-9 w-9 place-items-center rounded-full border bg-card hover:bg-accent"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-2xl font-bold tracking-tight">Shop Domain</h1>
      </div>

      <section className="mb-4">
        <h2 className="text-sm font-semibold mb-3">Shop Domains</h2>

        <div className="rounded-xl border bg-card p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">Free Domain</div>
                <p className="text-xs text-muted-foreground">Get your shop online instantly</p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full border border-primary/30 text-primary bg-primary/10">
              Free
            </span>
          </div>

          <div className="mt-4 rounded-lg border p-3 md:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Globe className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  {editing ? (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        value={slug}
                        onChange={(e) => setSlug(slugifyStoreName(e.target.value))}
                        className="h-9"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveSlug} disabled={changeSlug.isPending}>
                          {changeSlug.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setSlug(currentSlug); setEditing(false); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="font-semibold truncate">{host || "—"}</div>
                      <p className="text-xs text-muted-foreground">Free domain</p>
                    </>
                  )}
                </div>
              </div>
              {!editing && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => url && window.open(url, "_blank")}
                    className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent text-muted-foreground"
                    aria-label="Open"
                  ><ExternalLink className="h-4 w-4" /></button>
                  <button
                    onClick={() => copy(url)}
                    className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent text-muted-foreground"
                    aria-label="Copy"
                  ><Copy className="h-4 w-4" /></button>
                  <button
                    onClick={() => setEditing(true)}
                    className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent text-muted-foreground"
                    aria-label="Edit"
                  ><Pencil className="h-4 w-4" /></button>
                  <button
                    onClick={removeDomain}
                    className="grid h-8 w-8 place-items-center rounded-md hover:bg-destructive/10 text-destructive"
                    aria-label="Reset"
                  ><Trash2 className="h-4 w-4" /></button>
                </div>
              )}
            </div>

            <div className="mt-4 border-t pt-3">
              <div className="text-xs text-muted-foreground mb-2">Resolved IPs</div>
              <div className="flex flex-wrap gap-2">
                {RESOLVED_IPS.map((ip) => (
                  <button
                    key={ip}
                    onClick={() => copy(ip)}
                    className="inline-flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1 text-xs font-mono hover:bg-accent"
                  >
                    {ip}
                    <Copy className="h-3 w-3 opacity-60" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg border bg-muted/30 p-3">
            <div className="text-xs">
              <div className="font-medium">
                {store.published ? "Your storefront is live." : "Storefront is not published yet."}
              </div>
              <div className="text-muted-foreground">Publishing makes your free domain publicly accessible.</div>
            </div>
            <Button size="sm" onClick={publishNow} disabled={publish.isPending}>
              {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Rocket className="h-4 w-4 mr-2" />}
              {store.published ? "Republish" : "Publish"}
            </Button>
          </div>
        </div>
      </section>

      {/* Custom Domain section — locked (Free) OR editable (Pro/Business) */}
      <section>
        {canCustomDomain ? (
          <div className="rounded-xl border bg-card p-4 md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold">Custom Domain</div>
                  <p className="text-xs text-muted-foreground">Use your own domain for a professional look.</p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full border border-emerald-300 text-emerald-700 bg-emerald-50">
                Pro
              </span>
            </div>

            {customDomain ? (
              <div className="mt-4 rounded-lg border p-3 md:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                      <Globe className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{customDomain}</div>
                      <p className="text-xs text-muted-foreground">Custom domain</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => window.open(`https://${customDomain}`, "_blank")}
                      className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent text-muted-foreground"
                      aria-label="Open"
                    ><ExternalLink className="h-4 w-4" /></button>
                    <button
                      onClick={() => copy(`https://${customDomain}`)}
                      className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent text-muted-foreground"
                      aria-label="Copy"
                    ><Copy className="h-4 w-4" /></button>
                    <button
                      onClick={() => setCustomDialogOpen(true)}
                      className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent text-muted-foreground"
                      aria-label="Edit"
                    ><Pencil className="h-4 w-4" /></button>
                    <button
                      onClick={removeCustomDomain}
                      className="grid h-8 w-8 place-items-center rounded-md hover:bg-destructive/10 text-destructive"
                      aria-label="Delete"
                    ><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <Button onClick={() => setCustomDialogOpen(true)}>
                  <Globe className="h-4 w-4 mr-2" /> Add custom domain
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="relative rounded-xl border bg-card p-6 overflow-hidden">
            <div className="pointer-events-none select-none opacity-40 blur-[3px]">
              <div className="flex items-start gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10" />
                <div className="space-y-1">
                  <div className="h-3 w-40 bg-muted rounded" />
                  <div className="h-2 w-56 bg-muted rounded" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full bg-muted rounded" />
                <div className="h-3 w-4/5 bg-muted rounded" />
                <div className="h-3 w-3/5 bg-muted rounded" />
                <div className="h-3 w-2/3 bg-muted rounded" />
              </div>
            </div>

            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center max-w-sm px-6">
                <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-items-center">
                  <Lock className="h-6 w-6" />
                </div>
                <div className="font-semibold">Upgrade to add a custom domain</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Connect your own domain and make your shop look professional with a custom URL.
                </p>
                <Button asChild className="mt-4">
                  <Link to="/upgrade">View Plans →</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

      {customDialogOpen && (
        <CustomDomainDialog
          storeId={store.id}
          initial={customDomain ?? ""}
          onClose={() => setCustomDialogOpen(false)}
        />
      )}
    </main>
  );
}

// -------- Custom Domain dialog --------
const DOMAIN_RE = /^(?!-)(?:[a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,}$/i;

function CustomDomainDialog({
  storeId, initial, onClose,
}: { storeId: string; initial: string; onClose: () => void }) {
  const update = useUpdateStore();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initial;

  function normalize(v: string) {
    return v
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "");
  }

  async function onSave() {
    const clean = normalize(value);
    if (!clean) {
      setError("Domain is required.");
      return;
    }
    if (clean.length > 253) {
      setError("Domain is too long (max 253 characters).");
      return;
    }
    if (!DOMAIN_RE.test(clean)) {
      setError("Enter a valid domain like myshop.com or shop.myshop.com.");
      return;
    }
    setError(null);
    try {
      await update.mutateAsync({ id: storeId, custom_domain: clean } as any);
      toast.success(isEdit ? "Custom domain updated." : "Custom domain added.");
      onClose();
    } catch (e: any) {
      const msg = e?.message ?? "Save failed.";
      if (String(msg).includes("stores_custom_domain_unique") || String(e?.code) === "23505") {
        setError("This domain is already used by another shop.");
      } else {
        setError(msg);
      }
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit custom domain" : "Add custom domain"}</DialogTitle>
          <DialogDescription>
            Enter the domain you own (without <code>https://</code>). Example: <code>myshop.com</code>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="custom-domain">Domain</Label>
          <Input
            id="custom-domain"
            placeholder="myshop.com"
            value={value}
            onChange={(e) => { setValue(e.target.value); if (error) setError(null); }}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">
            After saving, point an A record to <code>185.158.133.1</code> at your DNS provider.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>Cancel</Button>
          <Button onClick={onSave} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {isEdit ? "Save changes" : "Add domain"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// -------- Generic settings-section save helper --------
function useSaveSection(store: any) {
  const update = useUpdateStore();
  const save = async (patch: Partial<ShopSettings>) => {
    const merged: ShopSettings = { ...(store.shop_settings ?? {}), ...patch };
    await update.mutateAsync({ id: store.id, shop_settings: merged });
  };
  return { save, isPending: update.isPending };
}

// -------- Policy --------
function ShopPolicyDialog({ store, onClose }: { store: any; onClose: () => void }) {
  const p = store.shop_settings?.policy ?? {};
  const [ret, setRet] = useState(p.return ?? "");
  const [refund, setRefund] = useState(p.refund ?? "");
  const [ship, setShip] = useState(p.shipping ?? "");
  const [terms, setTerms] = useState(p.terms ?? "");
  const [privacy, setPrivacy] = useState(p.privacy ?? "");
  const { save, isPending } = useSaveSection(store);

  async function onSave() {
    try {
      await save({ policy: { return: ret, refund, shipping: ship, terms, privacy } });
      toast.success("Policies saved."); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Save failed."); }
  }

  return (
    <SectionDialog
      title="Shop Policy" description="Define store policies shown to customers."
      onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={onSave} disabled={isPending}><Save className="h-4 w-4 mr-2" />Save</Button>
      </>}
    >
      <div><Label>Return policy</Label><Textarea rows={3} value={ret} onChange={(e) => setRet(e.target.value)} /></div>
      <div><Label>Refund policy</Label><Textarea rows={3} value={refund} onChange={(e) => setRefund(e.target.value)} /></div>
      <div><Label>Shipping policy</Label><Textarea rows={3} value={ship} onChange={(e) => setShip(e.target.value)} /></div>
      <div><Label>Terms & conditions</Label><Textarea rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} /></div>
      <div><Label>Privacy policy</Label><Textarea rows={3} value={privacy} onChange={(e) => setPrivacy(e.target.value)} /></div>
    </SectionDialog>
  );
}

// -------- Delivery --------
function DeliveryDialog({ store, onClose }: { store: any; onClose: () => void }) {
  const d = store.shop_settings?.delivery ?? {};
  const [inside, setInside] = useState<string>(d.inside_dhaka?.toString() ?? "");
  const [sub, setSub] = useState<string>(d.sub_dhaka?.toString() ?? "");
  const [outside, setOutside] = useState<string>(d.outside_dhaka?.toString() ?? "");
  const [free, setFree] = useState<string>(d.free_above?.toString() ?? "");
  const [note, setNote] = useState(d.note ?? "");
  const { save, isPending } = useSaveSection(store);

  const n = (v: string) => (v.trim() === "" ? null : Number(v));

  async function onSave() {
    try {
      await save({ delivery: { inside_dhaka: n(inside), sub_dhaka: n(sub), outside_dhaka: n(outside), free_above: n(free), note } });
      toast.success("Delivery settings saved."); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Save failed."); }
  }

  return (
    <SectionDialog
      title="Delivery Support" description="Shipping charges applied at checkout."
      onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={onSave} disabled={isPending}><Save className="h-4 w-4 mr-2" />Save</Button>
      </>}
    >
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Inside Dhaka (৳)</Label><Input type="number" value={inside} onChange={(e) => setInside(e.target.value)} /></div>
        <div><Label>Sub Dhaka (৳)</Label><Input type="number" value={sub} onChange={(e) => setSub(e.target.value)} /></div>
        <div><Label>Outside Dhaka (৳)</Label><Input type="number" value={outside} onChange={(e) => setOutside(e.target.value)} /></div>
        <div><Label>Free shipping above (৳)</Label><Input type="number" value={free} onChange={(e) => setFree(e.target.value)} /></div>
      </div>
      <div><Label>Delivery note</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Delivery within 2–3 days" /></div>
    </SectionDialog>
  );
}

// -------- Payment --------
function PaymentDialog({ store, onClose }: { store: any; onClose: () => void }) {
  const p = store.shop_settings?.payment ?? {};
  const [cod, setCod] = useState<boolean>(p.cod ?? true);
  const [bkash, setBkash] = useState(p.bkash ?? "");
  const [nagad, setNagad] = useState(p.nagad ?? "");
  const [rocket, setRocket] = useState(p.rocket ?? "");
  const [bankName, setBankName] = useState(p.bank_name ?? "");
  const [bankAcc, setBankAcc] = useState(p.bank_account ?? "");
  const [bankBranch, setBankBranch] = useState(p.bank_branch ?? "");
  const [ins, setIns] = useState(p.instructions ?? "");
  const { save, isPending } = useSaveSection(store);

  async function onSave() {
    try {
      await save({ payment: { cod, bkash, nagad, rocket, bank_name: bankName, bank_account: bankAcc, bank_branch: bankBranch, instructions: ins } });
      toast.success("Payment settings saved."); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Save failed."); }
  }

  return (
    <SectionDialog
      title="Payment Gateway" description="Payment methods offered at checkout."
      onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={onSave} disabled={isPending}><Save className="h-4 w-4 mr-2" />Save</Button>
      </>}
    >
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <div className="font-medium text-sm">Cash on Delivery</div>
          <div className="text-xs text-muted-foreground">Accept payment on delivery.</div>
        </div>
        <Switch checked={cod} onCheckedChange={setCod} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label>bKash</Label><Input value={bkash} onChange={(e) => setBkash(e.target.value)} placeholder="01XXXXXXXXX" /></div>
        <div><Label>Nagad</Label><Input value={nagad} onChange={(e) => setNagad(e.target.value)} placeholder="01XXXXXXXXX" /></div>
        <div><Label>Rocket</Label><Input value={rocket} onChange={(e) => setRocket(e.target.value)} placeholder="01XXXXXXXXX" /></div>
      </div>
      <div className="rounded-lg border p-3 space-y-2">
        <div className="text-sm font-medium">Bank transfer</div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Bank name</Label><Input value={bankName} onChange={(e) => setBankName(e.target.value)} /></div>
          <div><Label>Account no.</Label><Input value={bankAcc} onChange={(e) => setBankAcc(e.target.value)} /></div>
        </div>
        <div><Label>Branch</Label><Input value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} /></div>
      </div>
      <div><Label>Payment instructions</Label><Textarea rows={2} value={ins} onChange={(e) => setIns(e.target.value)} /></div>
    </SectionDialog>
  );
}

// -------- SEO --------
function SeoDialog({ store, onClose }: { store: any; onClose: () => void }) {
  const s = store.shop_settings?.seo ?? {};
  const [mt, setMt] = useState(s.meta_title ?? "");
  const [md, setMd] = useState(s.meta_description ?? "");
  const [gtm, setGtm] = useState(s.google_tag_manager ?? "");
  const [ga, setGa] = useState(s.google_analytics ?? "");
  const [fbp, setFbp] = useState(s.facebook_pixel ?? "");
  const [tt, setTt] = useState(s.tiktok_pixel ?? "");
  const { save, isPending } = useSaveSection(store);

  async function onSave() {
    try {
      await save({ seo: { meta_title: mt, meta_description: md, google_tag_manager: gtm, google_analytics: ga, facebook_pixel: fbp, tiktok_pixel: tt } });
      toast.success("SEO & marketing saved."); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Save failed."); }
  }

  return (
    <SectionDialog
      title="SEO & Marketing Integrations" description="Tracking pixels and search metadata."
      onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={onSave} disabled={isPending}><Save className="h-4 w-4 mr-2" />Save</Button>
      </>}
    >
      <div><Label>Meta title</Label><Input value={mt} onChange={(e) => setMt(e.target.value)} /></div>
      <div><Label>Meta description</Label><Textarea rows={2} value={md} onChange={(e) => setMd(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Google Tag Manager ID</Label><Input value={gtm} onChange={(e) => setGtm(e.target.value)} placeholder="GTM-XXXXXX" /></div>
        <div><Label>Google Analytics ID</Label><Input value={ga} onChange={(e) => setGa(e.target.value)} placeholder="G-XXXXXXX" /></div>
        <div><Label>Facebook Pixel ID</Label><Input value={fbp} onChange={(e) => setFbp(e.target.value)} /></div>
        <div><Label>TikTok Pixel ID</Label><Input value={tt} onChange={(e) => setTt(e.target.value)} /></div>
      </div>
    </SectionDialog>
  );
}

// -------- SMS (info + link) --------
function SmsDialog({ onClose }: { onClose: () => void }) {
  return (
    <SectionDialog
      title="SMS Support" description="SMS notifications for OTP and order updates."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Link to="/sms-settings" onClick={onClose}>
            <Button><ExternalLink className="h-4 w-4 mr-2" />Open SMS settings</Button>
          </Link>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        SMS templates and provider settings are managed centrally. Open the SMS Settings page to configure OTP template, sender signature and app name.
      </p>
    </SectionDialog>
  );
}

// -------- Chat --------
function ChatDialog({ store, onClose }: { store: any; onClose: () => void }) {
  const c = store.shop_settings?.chat ?? {};
  const [enabled, setEnabled] = useState<boolean>(c.enabled ?? false);
  const [msg, setMsg] = useState(c.messenger_url ?? "");
  const [wa, setWa] = useState(c.whatsapp_number ?? store.whatsapp_number ?? "");
  const [tawk, setTawk] = useState(c.tawk_to_id ?? "");
  const { save, isPending } = useSaveSection(store);

  async function onSave() {
    try {
      await save({ chat: { enabled, messenger_url: msg, whatsapp_number: wa, tawk_to_id: tawk } });
      toast.success("Chat support saved."); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Save failed."); }
  }

  return (
    <SectionDialog
      title="Chat Support" description="Enable live chat on your storefront."
      onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={onSave} disabled={isPending}><Save className="h-4 w-4 mr-2" />Save</Button>
      </>}
    >
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <div className="font-medium text-sm">Enable chat widget</div>
          <div className="text-xs text-muted-foreground">Show a floating chat button on your store.</div>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>
      <div><Label>Messenger page URL</Label><Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="https://m.me/yourpage" /></div>
      <div><Label>WhatsApp number</Label><Input value={wa} onChange={(e) => setWa(e.target.value)} placeholder="8801XXXXXXXXX" /></div>
      <div><Label>Tawk.to widget ID</Label><Input value={tawk} onChange={(e) => setTawk(e.target.value)} /></div>
    </SectionDialog>
  );
}

// -------- Social --------
function SocialDialog({ store, onClose }: { store: any; onClose: () => void }) {
  const update = useUpdateStore();
  const [fb, setFb] = useState(store.facebook_url ?? "");
  const [ig, setIg] = useState(store.instagram_url ?? "");
  const [wa, setWa] = useState(store.whatsapp_number ?? "");
  const [web, setWeb] = useState(store.website_url ?? "");
  const [phone, setPhone] = useState(store.phone ?? "");
  const [email, setEmail] = useState(store.contact_email ?? "");
  const [addr, setAddr] = useState(store.address ?? "");

  async function onSave() {
    try {
      await update.mutateAsync({
        id: store.id,
        facebook_url: fb.trim() || null,
        instagram_url: ig.trim() || null,
        whatsapp_number: wa.trim() || null,
        website_url: web.trim() || null,
        phone: phone.trim() || null,
        contact_email: email.trim() || null,
        address: addr.trim() || null,
      });
      toast.success("Contact & socials saved."); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Save failed."); }
  }

  return (
    <SectionDialog
      title="Social Links & Contact" description="How customers can reach you."
      onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={onSave} disabled={update.isPending}><Save className="h-4 w-4 mr-2" />Save</Button>
      </>}
    >
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Facebook URL</Label><Input value={fb} onChange={(e) => setFb(e.target.value)} /></div>
        <div><Label>Instagram URL</Label><Input value={ig} onChange={(e) => setIg(e.target.value)} /></div>
        <div><Label>WhatsApp number</Label><Input value={wa} onChange={(e) => setWa(e.target.value)} /></div>
        <div><Label>Website</Label><Input value={web} onChange={(e) => setWeb(e.target.value)} /></div>
        <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div><Label>Contact email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      </div>
      <div><Label>Address</Label><Textarea rows={2} value={addr} onChange={(e) => setAddr(e.target.value)} /></div>
    </SectionDialog>
  );
}
