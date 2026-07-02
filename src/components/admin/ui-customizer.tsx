import { useEffect, useMemo, useState } from "react";
import {
  Loader2, Upload, Trash2, Palette, Plus, ArrowUp, ArrowDown, Save,
  Home, Package, ShoppingCart, Users, Settings, Truck, Tag, MessageSquare,
  Heart, Star, Layers, Grid, Store, Gift, Phone, Mail, Zap, Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  useSiteSettings, useUpdateSiteSettings, useSignedSiteAsset,
  uploadSiteAsset, deleteSiteAsset,
  SIDEBAR_ICONS, HEX_COLOR_RE, isValidUrl,
  type SiteSettings, type SidebarCategory, type SidebarIcon,
} from "@/lib/site-settings";
import { toast } from "sonner";
import {
  MinimalMonoPreview, BoutiqueBlushPreview, TechGridPreview,
  SportyPulsePreview, LuxeNoirPreview,
} from "@/components/templates/mini-previews";

type PreviewTemplateId = "default" | "minimal" | "boutique" | "techgrid" | "sporty" | "luxe";
const PREVIEW_TEMPLATES: { id: PreviewTemplateId; label: string }[] = [
  { id: "default", label: "Default (sidebar + grid)" },
  { id: "minimal", label: "Minimal Mono" },
  { id: "boutique", label: "Boutique Blush" },
  { id: "techgrid", label: "Tech Grid" },
  { id: "sporty", label: "Sporty Pulse" },
  { id: "luxe", label: "Luxe Noir" },
];

const ICON_MAP: Record<string, LucideIcon> = {
  Home, Package, ShoppingCart, Users, Settings, Truck, Tag, MessageSquare,
  Heart, Star, Layers, Grid, Store, Gift, Phone, Mail, Zap, Sparkles,
};

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <header className="mb-4">
        <h3 className="font-display text-lg font-bold">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </header>
      {children}
    </section>
  );
}

export function UICustomizer() {
  const settingsQ = useSiteSettings();
  const update = useUpdateSiteSettings();

  if (settingsQ.isLoading) {
    return (
      <div className="grid min-h-[300px] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (settingsQ.isError || !settingsQ.data) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Could not load site settings. Try refreshing.
      </div>
    );
  }
  return <CustomizerForm initial={settingsQ.data} onSave={(patch) => update.mutateAsync(patch)} saving={update.isPending} />;
}

function CustomizerForm({
  initial, onSave, saving,
}: {
  initial: SiteSettings;
  onSave: (patch: Partial<SiteSettings>) => Promise<SiteSettings>;
  saving: boolean;
}) {
  const [logoPath, setLogoPath] = useState<string | null>(initial.logo_url);
  const [faviconPath, setFaviconPath] = useState<string | null>(initial.favicon_url);
  const [color, setColor] = useState(initial.primary_color);
  const [cats, setCats] = useState<SidebarCategory[]>(initial.sidebar_categories);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp_url ?? "");
  const [email, setEmail] = useState(initial.contact_email ?? "");
  const [phone, setPhone] = useState(initial.contact_phone ?? "");
  const [facebook, setFacebook] = useState(initial.facebook_url ?? "");
  const [instagram, setInstagram] = useState(initial.instagram_url ?? "");
  const [previewTemplate, setPreviewTemplate] = useState<PreviewTemplateId>("default");

  useEffect(() => {
    setLogoPath(initial.logo_url);
    setFaviconPath(initial.favicon_url);
    setColor(initial.primary_color);
    setCats(initial.sidebar_categories);
    setWhatsapp(initial.whatsapp_url ?? "");
    setEmail(initial.contact_email ?? "");
    setPhone(initial.contact_phone ?? "");
    setFacebook(initial.facebook_url ?? "");
    setInstagram(initial.instagram_url ?? "");
  }, [initial]);

  const logoUrl = useSignedSiteAsset(logoPath);
  const faviconUrl = useSignedSiteAsset(faviconPath);

  const dirty = useMemo(() => (
    logoPath !== initial.logo_url ||
    faviconPath !== initial.favicon_url ||
    color !== initial.primary_color ||
    JSON.stringify(cats) !== JSON.stringify(initial.sidebar_categories) ||
    whatsapp !== (initial.whatsapp_url ?? "") ||
    email !== (initial.contact_email ?? "") ||
    phone !== (initial.contact_phone ?? "") ||
    facebook !== (initial.facebook_url ?? "") ||
    instagram !== (initial.instagram_url ?? "")
  ), [logoPath, faviconPath, color, cats, whatsapp, email, phone, facebook, instagram, initial]);

  async function handleUpload(file: File, kind: "logo" | "favicon") {
    try {
      const path = await uploadSiteAsset(file, kind);
      if (kind === "logo") setLogoPath(path);
      else setFaviconPath(path);
      toast.success(`${kind === "logo" ? "Logo" : "Favicon"} uploaded`);
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    }
  }

  async function handleRemoveLogo() {
    if (logoPath) { try { await deleteSiteAsset(logoPath); } catch {} }
    setLogoPath(null);
  }
  async function handleRemoveFavicon() {
    if (faviconPath) { try { await deleteSiteAsset(faviconPath); } catch {} }
    setFaviconPath(null);
  }

  function addCategory() {
    setCats((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: "New Category", icon: "Package", href: "/", order: prev.length },
    ]);
  }
  function updateCat(id: string, patch: Partial<SidebarCategory>) {
    setCats((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function removeCat(id: string) {
    setCats((prev) => prev.filter((c) => c.id !== id).map((c, i) => ({ ...c, order: i })));
  }
  function move(id: string, dir: -1 | 1) {
    setCats((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next.map((c, i) => ({ ...c, order: i }));
    });
  }

  async function saveAll() {
    if (!HEX_COLOR_RE.test(color)) return toast.error("Primary color must be a valid hex like #5B21B6");
    if (!isValidUrl(whatsapp) || !isValidUrl(facebook) || !isValidUrl(instagram)) {
      return toast.error("URLs must start with http:// or https://");
    }
    if (cats.some((c) => !c.label.trim() || !c.href.trim())) {
      return toast.error("Every category needs a label and href");
    }
    try {
      await onSave({
        logo_url: logoPath,
        favicon_url: faviconPath,
        primary_color: color,
        sidebar_categories: cats,
        whatsapp_url: whatsapp || null,
        contact_email: email || null,
        contact_phone: phone || null,
        facebook_url: facebook || null,
        instagram_url: instagram || null,
      });
      toast.success("Site settings saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className="space-y-6 min-w-0">

      {/* Branding */}
      <Section title="Branding" description="Main logo and browser tab favicon shown across the site.">
        <div className="grid gap-6 sm:grid-cols-2">
          <AssetUploader
            label="Main logo"
            preview={logoUrl.data ?? null}
            onFile={(f) => handleUpload(f, "logo")}
            onRemove={handleRemoveLogo}
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
          />
          <AssetUploader
            label="Favicon"
            preview={faviconUrl.data ?? null}
            onFile={(f) => handleUpload(f, "favicon")}
            onRemove={handleRemoveFavicon}
            accept="image/png,image/x-icon,image/svg+xml"
            square
          />
        </div>
      </Section>

      {/* Primary color */}
      <Section title="Primary color" description="Used for buttons, active tabs, and accents.">
        <div className="flex flex-wrap items-center gap-4">
          <label className="relative inline-flex h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-border shadow-sm">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            <span className="h-full w-full" style={{ backgroundColor: color }} />
          </label>
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
            placeholder="#5B21B6"
            maxLength={7}
          />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Palette className="h-4 w-4" /> Live preview:
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow"
              style={{ backgroundColor: color }}
            >
              Sample button
            </button>
          </div>
        </div>
      </Section>

      {/* Sidebar categories */}
      <Section
        title="Sidebar categories"
        description="Reorder, rename, or add categories shown in the site sidebar."
      >
        <div className="space-y-2">
          {cats.length === 0 && (
            <p className="text-sm text-muted-foreground">No categories yet. Add your first one below.</p>
          )}
          {cats.map((c, i) => {
            const Icon = ICON_MAP[c.icon] ?? Package;
            return (
              <div key={c.id} className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-xl border border-border bg-background p-2">
                <div className="flex flex-col">
                  <button type="button" onClick={() => move(c.id, -1)} disabled={i === 0}
                          className="grid h-6 w-6 place-items-center rounded hover:bg-muted disabled:opacity-30">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => move(c.id, 1)} disabled={i === cats.length - 1}
                          className="grid h-6 w-6 place-items-center rounded hover:bg-muted disabled:opacity-30">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">
                    <Icon className="h-4 w-4" />
                  </div>
                  <input
                    value={c.label}
                    onChange={(e) => updateCat(c.id, { label: e.target.value })}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                    placeholder="Label"
                  />
                </div>
                <input
                  value={c.href}
                  onChange={(e) => updateCat(c.id, { href: e.target.value })}
                  className="min-w-0 rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-xs"
                  placeholder="/path or https://…"
                />
                <select
                  value={c.icon}
                  onChange={(e) => updateCat(c.id, { icon: e.target.value as SidebarIcon })}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                >
                  {SIDEBAR_ICONS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => removeCat(c.id)}
                  className="grid h-9 w-9 place-items-center rounded-lg text-destructive hover:bg-destructive/10"
                  aria-label="Delete category"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={addCategory}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
        >
          <Plus className="h-4 w-4" /> Add category
        </button>
      </Section>

      {/* Contact & links */}
      <Section title="Contact & social links" description="Used by the floating WhatsApp button and site footer.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="WhatsApp URL" value={whatsapp} onChange={setWhatsapp} placeholder="https://wa.me/8801XXXXXXXXX" />
          <Field label="Contact email" value={email} onChange={setEmail} type="email" placeholder="hello@example.com" />
          <Field label="Contact phone" value={phone} onChange={setPhone} placeholder="+8801XXXXXXXXX" />
          <Field label="Facebook URL" value={facebook} onChange={setFacebook} placeholder="https://facebook.com/…" />
          <Field label="Instagram URL" value={instagram} onChange={setInstagram} placeholder="https://instagram.com/…" />
        </div>
      </Section>

      {/* Save bar */}
      <div className="sticky bottom-0 -mx-4 flex items-center justify-between rounded-t-2xl border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <p className="text-sm text-muted-foreground">
          {dirty ? "Unsaved changes" : "All changes saved"}
        </p>
        <button
          type="button"
          onClick={saveAll}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </button>
      </div>
      </div>

      <aside className="lg:sticky lg:top-4 lg:self-start space-y-3">
        <div className="rounded-xl border border-border bg-card p-3">
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">
            Preview on template
          </label>
          <select
            value={previewTemplate}
            onChange={(e) => setPreviewTemplate(e.target.value as PreviewTemplateId)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {PREVIEW_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
        {previewTemplate === "default" ? (
          <StorefrontPreview
            color={color}
            logoUrl={logoUrl.data ?? null}
            cats={cats}
            whatsapp={whatsapp}
          />
        ) : (
          <TemplateMiniPreview templateId={previewTemplate} accent={color} />
        )}
      </aside>
    </div>
  );
}

function StorefrontPreview({
  color, logoUrl, cats, whatsapp,
}: {
  color: string;
  logoUrl: string | null;
  cats: SidebarCategory[];
  whatsapp: string;
}) {
  const safeColor = HEX_COLOR_RE.test(color) ? color : "#5B21B6";
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Live preview</span>
      </div>

      <div className="relative" style={{ ["--pv" as any]: safeColor }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3" style={{ backgroundColor: safeColor }}>
          <div className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-6 max-w-[100px] object-contain" />
            ) : (
              <span className="text-sm font-bold text-white">Your Store</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white/20 text-white"><ShoppingCart className="h-3.5 w-3.5" /></span>
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white/20 text-white"><Users className="h-3.5 w-3.5" /></span>
          </div>
        </div>

        <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-0">
          {/* Sidebar */}
          <div className="border-r border-border bg-muted/30 p-2">
            <div className="space-y-1">
              {cats.slice(0, 8).map((c, i) => {
                const Icon = ICON_MAP[c.icon] ?? Package;
                const active = i === 0;
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium"
                    style={active ? { backgroundColor: safeColor, color: "white" } : { color: "hsl(var(--foreground))" }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="truncate">{c.label}</span>
                  </div>
                );
              })}
              {cats.length === 0 && (
                <div className="px-2 py-1.5 text-[11px] text-muted-foreground">No categories</div>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="h-3 w-24 rounded bg-muted" />
              <button
                type="button"
                className="rounded-md px-2.5 py-1 text-[10px] font-bold text-white"
                style={{ backgroundColor: safeColor }}
              >
                Shop now
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="overflow-hidden rounded-lg border border-border bg-background">
                  <div className="aspect-square bg-muted" />
                  <div className="space-y-1 p-1.5">
                    <div className="h-2 w-3/4 rounded bg-muted" />
                    <div className="h-2 w-1/2 rounded" style={{ backgroundColor: safeColor, opacity: 0.7 }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Tabs demo */}
            <div className="mt-3 flex gap-3 border-b border-border text-[10px] font-semibold">
              <span className="border-b-2 pb-1" style={{ borderColor: safeColor, color: safeColor }}>Featured</span>
              <span className="pb-1 text-muted-foreground">New</span>
              <span className="pb-1 text-muted-foreground">Sale</span>
            </div>
          </div>
        </div>

        {/* WhatsApp float */}
        {whatsapp && (
          <div
            className="absolute bottom-3 right-3 grid h-8 w-8 place-items-center rounded-full text-white shadow-lg"
            style={{ backgroundColor: "#25D366" }}
            title={whatsapp}
          >
            <MessageSquare className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  );
}



function AssetUploader({
  label, preview, onFile, onRemove, accept, square,
}: {
  label: string;
  preview: string | null;
  onFile: (f: File) => void;
  onRemove: () => void;
  accept: string;
  square?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{label}</div>
      <div className={`relative flex ${square ? "h-24 w-24" : "h-24"} items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/30`}>
        {preview ? (
          <img src={preview} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-muted-foreground">No image</span>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted">
          <Upload className="h-3.5 w-3.5" /> Upload
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.currentTarget.value = "";
            }}
          />
        </label>
        {preview && (
          <button type="button" onClick={onRemove} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold text-muted-foreground">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}
