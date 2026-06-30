import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Store as StoreIcon, Save, Check, Loader2, Copy, ExternalLink, Globe,
  ArrowLeft, Shirt, Cpu, Trophy, Palette, AlertCircle, Upload, Trash2,
  MapPin, Phone, Mail, Facebook, Instagram, MessageCircle, Eye, Smartphone, Monitor,
  Rocket, X,
} from "lucide-react";
import {
  TEMPLATES, useMyStore, useUpdateStore, useLogoSignedUrl,
  uploadStoreLogo, deleteStoreLogo,
  type Category, type TemplateId,
} from "@/lib/eazystore-data";

export const Route = createFileRoute("/_authenticated/manage-shop")({
  head: () => ({ meta: [{ title: "Manage Shop — EazyStore" }] }),
  component: ManageShop,
});

const CATEGORIES: { id: Category; icon: any; sub: string }[] = [
  { id: "Clothes", icon: Shirt, sub: "Fashion & apparel" },
  { id: "Electronics", icon: Cpu, sub: "Gadgets & devices" },
  { id: "Sports", icon: Trophy, sub: "Gear & fitness" },
];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "mystore";
}

function ManageShop() {
  const myStore = useMyStore();
  const update = useUpdateStore();

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [category, setCategory] = useState<Category>("Clothes");
  const [template, setTemplate] = useState<TemplateId>("minimal");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [website, setWebsite] = useState("");

  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [localLogoUrl, setLocalLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"mobile" | "desktop">("mobile");
  const [showStorefront, setShowStorefront] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const signedLogo = useLogoSignedUrl(logoPath);

  useEffect(() => {
    const s = myStore.data;
    if (s) {
      setName(s.name);
      setTagline(s.tagline ?? "");
      setCategory(s.category);
      setTemplate(s.template);
      setAddress(s.address ?? "");
      setPhone(s.phone ?? "");
      setContactEmail(s.contact_email ?? "");
      setFacebook(s.facebook_url ?? "");
      setInstagram(s.instagram_url ?? "");
      setWhatsapp(s.whatsapp_number ?? "");
      setWebsite(s.website_url ?? "");
      setLogoPath(s.logo_url);
    }
  }, [myStore.data?.id]);

  useEffect(() => {
    return () => { if (localLogoUrl) URL.revokeObjectURL(localLogoUrl); };
  }, [localLogoUrl]);

  const logoDisplay = localLogoUrl || signedLogo.data || null;

  const storeUrl = useMemo(
    () => (name ? `www.${slugify(name)}.eazystore.app` : ""),
    [name],
  );

  const dirty = useMemo(() => {
    const s = myStore.data;
    if (!s) return false;
    return (
      name.trim() !== s.name ||
      (tagline.trim() || null) !== (s.tagline || null) ||
      category !== s.category ||
      template !== s.template ||
      (address.trim() || null) !== (s.address || null) ||
      (phone.trim() || null) !== (s.phone || null) ||
      (contactEmail.trim() || null) !== (s.contact_email || null) ||
      (facebook.trim() || null) !== (s.facebook_url || null) ||
      (instagram.trim() || null) !== (s.instagram_url || null) ||
      (whatsapp.trim() || null) !== (s.whatsapp_number || null) ||
      (website.trim() || null) !== (s.website_url || null) ||
      logoPath !== s.logo_url
    );
  }, [myStore.data, name, tagline, category, template, address, phone, contactEmail, facebook, instagram, whatsapp, website, logoPath]);

  const trimmed = name.trim();
  const canSave = dirty && trimmed.length >= 2 && !update.isPending;

  async function onPickLogo(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Logo must be 2MB or smaller.");
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalLogoUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
    setUploadingLogo(true);
    try {
      const oldPath = logoPath;
      const path = await uploadStoreLogo(file);
      setLogoPath(path);
      if (oldPath && oldPath !== path) await deleteStoreLogo(oldPath);
    } catch (e: any) {
      setError(e?.message ?? "Could not upload logo.");
      setLocalLogoUrl(null);
    } finally {
      setUploadingLogo(false);
    }
  }

  async function onRemoveLogo() {
    setError(null);
    const oldPath = logoPath;
    setLogoPath(null);
    setLocalLogoUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    if (oldPath) {
      try { await deleteStoreLogo(oldPath); } catch {}
    }
  }

  async function onSave() {
    setError(null);
    if (!myStore.data) return;
    if (trimmed.length < 2) {
      setError("Store name must be at least 2 characters.");
      return;
    }
    try {
      await update.mutateAsync({
        id: myStore.data.id,
        name: trimmed,
        tagline: tagline.trim() || null,
        category,
        template,
        address: address.trim() || null,
        phone: phone.trim() || null,
        contact_email: contactEmail.trim() || null,
        facebook_url: facebook.trim() || null,
        instagram_url: instagram.trim() || null,
        whatsapp_number: whatsapp.trim() || null,
        website_url: website.trim() || null,
        logo_url: logoPath,
      });
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    } catch (e: any) {
      setError(e?.message ?? "Could not save. Please try again.");
    }
  }

  async function copyUrl() {
    if (!storeUrl) return;
    try { await navigator.clipboard.writeText(`https://${storeUrl}`); } catch {}
  }

  async function onPublishAndView() {
    setError(null);
    setPublishing(true);
    try {
      if (dirty && myStore.data && trimmed.length >= 2) {
        await onSave();
      }
      setShowStorefront(true);
    } finally {
      setPublishing(false);
    }
  }

  if (myStore.isLoading) {
    return (
      <main className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!myStore.data) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-5 text-center">
        <div className="max-w-sm space-y-4">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl gradient-primary text-white">
            <StoreIcon className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-bold">No store yet</h1>
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

  return (
    <main className="relative mx-auto min-h-screen w-full max-w-6xl bg-gradient-to-b from-[#eee6fb] via-[#efe9fc] to-[#f4eefd] pb-28">
      {/* Header */}
      <section className="px-5 pt-5">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/70 hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <h1 className="mt-2 font-display text-3xl font-black tracking-tight">
          Manage Shop
        </h1>
        <p className="mt-1 text-sm text-foreground/70">
          Brand your store, share contact info, and pick a storefront look.
        </p>
      </section>

      <div className="mt-4 grid gap-4 px-5 lg:grid-cols-[1fr_400px]">
        {/* LEFT: editor */}
        <div className="space-y-4">
          {/* URL */}
          <div className="flex items-center gap-2 rounded-2xl border border-white bg-white/70 px-3 py-2.5 shadow-sm backdrop-blur">
            <Globe className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground/80">
              {storeUrl || "your-store.eazystore.app"}
            </span>
            <button onClick={copyUrl} className="grid h-7 w-7 place-items-center rounded-lg text-primary hover:bg-primary/10" aria-label="Copy URL">
              <Copy className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowStorefront(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold text-primary hover:bg-primary/20"
              aria-label="Visit storefront"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Visit
            </button>
          </div>

          {/* Logo */}
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="font-display text-sm font-black">Store logo</h2>
            <p className="text-[11px] text-foreground/60">PNG, JPG, or SVG. Max 2MB. Square works best.</p>
            <div className="mt-3 flex items-center gap-4">
              <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-dashed border-foreground/20 bg-foreground/5">
                {logoDisplay ? (
                  <img src={logoDisplay} alt="Store logo" className="h-full w-full object-cover" />
                ) : (
                  <StoreIcon className="h-7 w-7 text-foreground/40" />
                )}
              </div>
              <div className="flex flex-1 flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickLogo(f); e.target.value = ""; }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingLogo}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
                >
                  {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {logoPath ? "Replace" : "Upload"}
                </button>
                {logoPath && (
                  <button
                    type="button"
                    onClick={onRemoveLogo}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Store name + tagline */}
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <label htmlFor="store-name" className="block font-display text-sm font-black">Store name</label>
            <input
              id="store-name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
              className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-medium outline-none ring-primary/30 focus:ring-2"
              placeholder="My awesome shop"
            />
            <label htmlFor="store-tagline" className="mt-4 block font-display text-sm font-black">Tagline</label>
            <input
              id="store-tagline" type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={120}
              className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-medium outline-none ring-primary/30 focus:ring-2"
              placeholder="Quality clothes at honest prices"
            />
          </section>

          {/* Category */}
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="font-display text-sm font-black">Category</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {CATEGORIES.map((c) => {
                const active = category === c.id;
                return (
                  <button
                    key={c.id} type="button" onClick={() => setCategory(c.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                      active ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    <c.icon className={`h-5 w-5 ${active ? "text-primary" : "text-foreground/60"}`} />
                    <span className="font-display text-xs font-black">{c.id}</span>
                    <span className="text-[10px] text-foreground/60">{c.sub}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Contact */}
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="font-display text-sm font-black">Contact details</h2>
            <p className="text-[11px] text-foreground/60">Shown publicly on your storefront.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field icon={MapPin} label="Address" className="sm:col-span-2">
                <input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200}
                  className="w-full bg-transparent text-sm outline-none" placeholder="Shop 12, Zindabazar, Sylhet" />
              </Field>
              <Field icon={Phone} label="Phone">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel"
                  className="w-full bg-transparent text-sm outline-none" placeholder="+8801XXXXXXXXX" />
              </Field>
              <Field icon={Mail} label="Email">
                <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} type="email"
                  className="w-full bg-transparent text-sm outline-none" placeholder="hello@yourstore.com" />
              </Field>
            </div>
          </section>

          {/* Socials */}
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="font-display text-sm font-black">Social & links</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field icon={Facebook} label="Facebook URL">
                <input value={facebook} onChange={(e) => setFacebook(e.target.value)}
                  className="w-full bg-transparent text-sm outline-none" placeholder="https://facebook.com/yourpage" />
              </Field>
              <Field icon={Instagram} label="Instagram URL">
                <input value={instagram} onChange={(e) => setInstagram(e.target.value)}
                  className="w-full bg-transparent text-sm outline-none" placeholder="https://instagram.com/yourhandle" />
              </Field>
              <Field icon={MessageCircle} label="WhatsApp number">
                <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full bg-transparent text-sm outline-none" placeholder="+8801XXXXXXXXX" />
              </Field>
              <Field icon={Globe} label="Website URL">
                <input value={website} onChange={(e) => setWebsite(e.target.value)}
                  className="w-full bg-transparent text-sm outline-none" placeholder="https://example.com" />
              </Field>
            </div>
          </section>

          {/* Template */}
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              <h2 className="font-display text-sm font-black">Storefront template</h2>
            </div>
            <p className="text-[11px] text-foreground/60">Pick a look — preview updates live on the right.</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {TEMPLATES.map((t) => {
                const active = template === t.id;
                return (
                  <button
                    key={t.id} type="button" onClick={() => setTemplate(t.id)}
                    className={`overflow-hidden rounded-xl border text-left transition-all ${
                      active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className={`relative h-16 w-full bg-gradient-to-br ${t.gradient}`}>
                      {active && (
                        <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white text-primary shadow">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    <div className="p-2">
                      <div className="font-display text-xs font-black leading-tight">{t.name}</div>
                      <div className="truncate text-[10px] text-foreground/60">{t.tagline}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* RIGHT: live storefront preview */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground/70">
                <Eye className="h-3.5 w-3.5" /> Live preview
              </div>
              <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
                <button
                  onClick={() => setPreviewMode("mobile")}
                  className={`grid h-7 w-7 place-items-center rounded-md ${previewMode === "mobile" ? "bg-primary text-primary-foreground" : "text-foreground/60"}`}
                  aria-label="Mobile preview"
                >
                  <Smartphone className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setPreviewMode("desktop")}
                  className={`grid h-7 w-7 place-items-center rounded-md ${previewMode === "desktop" ? "bg-primary text-primary-foreground" : "text-foreground/60"}`}
                  aria-label="Desktop preview"
                >
                  <Monitor className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <StorefrontPreview
              mode={previewMode}
              template={template}
              name={trimmed || "Your store"}
              tagline={tagline}
              category={category}
              logo={logoDisplay}
              phone={phone}
              address={address}
              facebook={facebook}
              instagram={instagram}
              whatsapp={whatsapp}
              website={website}
            />
          </div>
        </aside>
      </div>

      {/* Save bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-6xl px-3 pb-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/95 px-4 py-3 shadow-[0_10px_30px_-10px_rgba(79,70,229,0.35)] backdrop-blur">
          <div className="min-w-0 text-xs">
            {savedAt ? (
              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-600">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            ) : dirty ? (
              <span className="font-semibold text-foreground/70">Unsaved changes</span>
            ) : (
              <span className="text-foreground/50">All changes saved</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onSave}
              disabled={!canSave}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-white px-4 py-2.5 text-sm font-bold text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
            >
              {update.isPending ? (<><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>) : (<><Save className="h-4 w-4" /> Save</>)}
            </button>
            <button
              onClick={onPublishAndView}
              disabled={publishing || update.isPending || trimmed.length < 2}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl gradient-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            >
              {publishing ? (<><Loader2 className="h-4 w-4 animate-spin" /> Publishing…</>) : (<><Rocket className="h-4 w-4" /> Publish & View</>)}
            </button>
          </div>
        </div>
      </div>

      {/* Storefront modal */}
      {showStorefront && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm"
          onClick={() => setShowStorefront(false)}
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
            <div className="flex min-w-0 items-center gap-2">
              <Globe className="h-4 w-4 shrink-0 text-primary-foreground/90" />
              <span className="truncate text-sm font-semibold">
                {storeUrl || "your-store.eazystore.app"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-white/20 bg-white/10 p-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); setPreviewMode("mobile"); }}
                  className={`grid h-7 w-7 place-items-center rounded-md ${previewMode === "mobile" ? "bg-white text-primary" : "text-white/70"}`}
                  aria-label="Mobile"
                >
                  <Smartphone className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setPreviewMode("desktop"); }}
                  className={`grid h-7 w-7 place-items-center rounded-md ${previewMode === "desktop" ? "bg-white text-primary" : "text-white/70"}`}
                  aria-label="Desktop"
                >
                  <Monitor className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                onClick={() => setShowStorefront(false)}
                className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white hover:bg-white/20"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div
            className="flex flex-1 items-start justify-center overflow-auto p-4 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={previewMode === "desktop" ? "w-full max-w-4xl" : ""}>
              <StorefrontPreview
                mode={previewMode}
                template={template}
                name={trimmed || "Your store"}
                tagline={tagline}
                category={category}
                logo={logoDisplay}
                phone={phone}
                address={address}
                facebook={facebook}
                instagram={instagram}
                whatsapp={whatsapp}
                website={website}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Field({
  icon: Icon, label, children, className = "",
}: { icon: any; label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-foreground/60">
        <Icon className="h-3 w-3" /> {label}
      </span>
      <div className="rounded-xl border border-input bg-background px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/30">
        {children}
      </div>
    </label>
  );
}

function StorefrontPreview({
  mode, template, name, tagline, category, logo,
  phone, address, facebook, instagram, whatsapp, website,
}: {
  mode: "mobile" | "desktop";
  template: TemplateId;
  name: string;
  tagline: string;
  category: Category;
  logo: string | null;
  phone: string; address: string;
  facebook: string; instagram: string; whatsapp: string; website: string;
}) {
  const t = TEMPLATES.find((x) => x.id === template)!;
  const frame =
    mode === "mobile"
      ? "mx-auto w-[280px] rounded-[28px] border-[10px] border-neutral-900 shadow-xl"
      : "w-full rounded-xl border border-neutral-200 shadow-sm";

  const dark = template === "minimal" || template === "techgrid" || template === "luxe";
  const txt = dark ? "text-white" : "text-neutral-900";
  const sub = dark ? "text-white/70" : "text-neutral-600";

  const products = [
    { name: "Featured item", price: "৳ 1,200" },
    { name: "New arrival", price: "৳ 850" },
    { name: "Bestseller", price: "৳ 2,400" },
    { name: "Special", price: "৳ 599" },
  ];

  return (
    <div className={frame}>
      <div className="overflow-hidden rounded-[18px] bg-white">
        {/* Header */}
        <div className={`bg-gradient-to-br ${t.gradient} p-3 ${txt}`}>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white/20 ring-1 ring-white/30">
              {logo ? (
                <img src={logo} alt="" className="h-full w-full object-cover" />
              ) : (
                <StoreIcon className="h-4 w-4 text-white" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-black leading-tight">{name}</div>
              <div className={`truncate text-[10px] ${sub}`}>{tagline || category}</div>
            </div>
          </div>
        </div>

        {/* Products grid */}
        <div className="grid grid-cols-2 gap-1.5 p-2">
          {products.map((p, i) => (
            <div key={i} className="overflow-hidden rounded-md border border-neutral-200">
              <div className={`h-14 bg-gradient-to-br ${t.gradient} opacity-80`} />
              <div className="p-1.5">
                <div className="truncate text-[10px] font-bold text-neutral-900">{p.name}</div>
                <div className="text-[9px] font-semibold text-neutral-600">{p.price}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Contact / socials footer */}
        <div className="space-y-1 border-t border-neutral-100 bg-neutral-50 p-2 text-[9px] text-neutral-700">
          {address && <div className="flex items-start gap-1"><MapPin className="mt-0.5 h-2.5 w-2.5 shrink-0" /><span className="truncate">{address}</span></div>}
          {phone && <div className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" /><span>{phone}</span></div>}
          {(facebook || instagram || whatsapp || website) && (
            <div className="flex items-center gap-2 pt-1">
              {facebook && <Facebook className="h-3 w-3 text-blue-600" />}
              {instagram && <Instagram className="h-3 w-3 text-pink-600" />}
              {whatsapp && <MessageCircle className="h-3 w-3 text-emerald-600" />}
              {website && <Globe className="h-3 w-3 text-neutral-700" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
