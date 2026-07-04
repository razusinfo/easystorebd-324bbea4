import { createFileRoute, Link } from "@tanstack/react-router";
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Eye, Sparkles, X, Loader2, ShieldCheck, Settings2, Upload, Trash2, Palette, ArrowRight, Plus, AlertTriangle, ImageOff, RefreshCw } from "lucide-react";

import {
  TEMPLATES, useMyStore, useSaveTemplateSettings, getTemplateSettings,
  useMyProducts, uploadStoreLogo, deleteStoreLogo, DEFAULT_FOOTER,
  type TemplateId, type TemplateSettings, type FooterSettings, type FooterSocialKey,
} from "@/lib/eazystore-data";
import { useCategories } from "@/lib/categories-data";
import { AutoPartsTemplate } from "@/components/templates/autoparts-template";
import { BdLoveTemplate } from "@/components/templates/bdlove-template";
import { EazyStoreBasicTemplate } from "@/components/templates/eazystore-basic-template";
import { FlipmartTemplate } from "@/components/templates/flipmart-template";
import { FreshmartTemplate } from "@/components/templates/freshmart-template";
import {
  MinimalMonoPreview, BoutiqueBlushPreview, TechGridPreview,
  SportyPulsePreview, LuxeNoirPreview,
} from "@/components/templates/mini-previews";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import basicThemePreview from "@/assets/basic-theme-preview.png.asset.json";
import eazystoreBasicPreview from "@/assets/eazystore-basic-preview.png.asset.json";



export const Route = createFileRoute("/_authenticated/themes")({
  head: () => ({
    meta: [{ title: "Themes — EazyStore" }],
    links: [
      { rel: "preload", as: "image", href: basicThemePreview.url, fetchpriority: "low" },
      { rel: "preload", as: "image", href: eazystoreBasicPreview.url, fetchpriority: "low" },
    ],
  }),
  component: ThemesPage,
});

const PREVIEW_IMAGE_URLS = [basicThemePreview.url, eazystoreBasicPreview.url];
const warmedPreviews = new Set<string>();
function warmPreviewImages() {
  if (typeof window === "undefined") return;
  const run = () => {
    for (const url of PREVIEW_IMAGE_URLS) {
      if (warmedPreviews.has(url)) continue;
      warmedPreviews.add(url);
      const img = new Image();
      img.decoding = "async";
      img.src = url;
    }
  };
  const ric = (window as any).requestIdleCallback as ((cb: () => void) => number) | undefined;
  if (ric) ric(run);
  else window.setTimeout(run, 200);
}

function ThemesPage() {
  const storeQ = useMyStore();
  const save = useSaveTemplateSettings();
  const activeId = storeQ.data?.template as TemplateId | undefined;
  const [previewing, setPreviewing] = useState<TemplateId | null>(null);
  const [customizing, setCustomizing] = useState<TemplateId | null>(null);
  useEffect(() => { warmPreviewImages(); }, []);

  const handleActivate = async (id: TemplateId) => {
    if (!storeQ.data) return;
    try {
      await save.mutateAsync({
        storeId: storeQ.data.id,
        templateId: id,
        settings: {},
        currentMap: storeQ.data.template_settings ?? {},
        activate: true,
      });
      toast.success(`${TEMPLATES.find((t) => t.id === id)?.name} is now your active template`);
      setPreviewing(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not activate template");
    }
  };

  const activeTemplate = TEMPLATES.find((t) => t.id === activeId) ?? TEMPLATES[0];
  const activeSettings = getTemplateSettings(storeQ.data, activeTemplate.id);
  const activeAccent = activeSettings.accentColor || activeTemplate.accent;
  const themeMode: "light" | "dark" = activeSettings.themeMode ?? "light";
  const buyNowEnabled: boolean = activeSettings.buyNowEnabled ?? false;

  const patchActiveSettings = async (patch: Partial<TemplateSettings>, errMsg: string) => {
    if (!storeQ.data || !activeId) return;
    try {
      await save.mutateAsync({
        storeId: storeQ.data.id,
        templateId: activeId,
        currentMap: storeQ.data.template_settings ?? {},
        settings: { ...activeSettings, ...patch },
      });
    } catch (e: any) {
      toast.error(e?.message ?? errMsg);
    }
  };

  const setActiveAccent = (color: string) => patchActiveSettings({ accentColor: color }, "Could not update color");
  const setThemeMode = (mode: "light" | "dark") => patchActiveSettings({ themeMode: mode }, "Could not update theme mode");
  const setBuyNow = (enabled: boolean) => patchActiveSettings({ buyNowEnabled: enabled }, "Could not update setting");

  if (storeQ.isLoading) return <ThemesPageSkeleton />;
  if (storeQ.isError) {
    return (
      <ThemesErrorState
        message={(storeQ.error as any)?.message ?? "We couldn't load your store settings."}
        onRetry={() => storeQ.refetch()}
      />
    );
  }


  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      {/* Theme Builder banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 p-6 text-white shadow-lg sm:p-7">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-fuchsia-300/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20">
              <Palette className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className="whitespace-nowrap font-display text-xl font-black sm:text-2xl">Theme Builder</h2>
                <span className="rounded-md bg-amber-300 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-900">New</span>
              </div>

              <p className="mt-1 max-w-lg text-sm text-white/85">
                Create your own unique shop design with our powerful drag-and-drop builder.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/80">
                <span>◇ Drag &amp; drop sections</span>
                <span>◇ Custom layouts</span>
                <span>◇ Real-time preview</span>
                <span>◇ No coding required</span>
              </div>
            </div>
          </div>
          <Link
            to="/theme-builder"
            className="inline-flex shrink-0 items-center justify-center gap-2 self-start whitespace-nowrap rounded-full border border-white/40 bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white hover:text-violet-700 sm:self-auto"
          >
            Open Theme Builder <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>


      {/* Header */}
      <header className="mt-8 mb-4">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Storefront Templates
        </div>
        <h1 className="mt-1.5 font-display text-2xl font-black tracking-tight sm:text-3xl">Pick a design for your store</h1>
      </header>

      {/* Template row — real thumbnails, compact cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {TEMPLATES.map((t) => {
          const isActive = activeId === t.id;
          const settings = getTemplateSettings(storeQ.data, t.id);
          const swatch = settings.accentColor || t.accent;
          return (
            <button
              key={t.id}
              onClick={() => setPreviewing(t.id)}
              className={`group relative overflow-hidden rounded-2xl border-2 bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${
                isActive ? "border-primary ring-2 ring-primary/20" : "border-border"
              }`}
            >
              <div className="relative h-40 overflow-hidden bg-neutral-100">
                <ThumbnailBoundary>
                  <TemplateThumbnail id={t.id} gradient={t.gradient} accent={swatch} />
                </ThumbnailBoundary>
              </div>

              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <span className="truncate text-sm font-bold text-foreground">{t.name}</span>
                {isActive ? (
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <span className="h-4 w-4 shrink-0 rounded-full ring-2 ring-border" style={{ backgroundColor: swatch }} />
                )}
              </div>
              {t.premium && (
                <span className="absolute left-2 top-2 rounded-md bg-gradient-to-r from-amber-400 to-orange-500 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow">Premium</span>
              )}
            </button>
          );
        })}

        {/* More themes coming */}
        <div className="grid place-items-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 p-6 text-center text-white shadow-sm">
          <div>
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white/20 ring-1 ring-white/30">
              <Plus className="h-5 w-5" />
            </div>
            <p className="mt-2 text-sm font-bold">More themes coming</p>
          </div>
        </div>
      </div>

      {/* Full-width settings row */}
      <div className="mt-6 grid gap-3 sm:grid-cols-1 md:grid-cols-3">
        {/* Shop Theme Color */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
          <span className="min-w-0 text-sm font-bold leading-tight">Shop Theme Color</span>
          <div className="flex shrink-0 items-center gap-2">
            <input
              type="color"
              value={activeAccent}
              onChange={(e) => setActiveAccent(e.target.value)}
              className="h-8 w-12 cursor-pointer rounded-full border-0 bg-transparent p-0"
              aria-label="Shop theme color"
            />
            <div className="h-6 w-16 rounded-full lg:w-20" style={{ backgroundColor: activeAccent }} />
          </div>
        </div>

        {/* Shop Theme Mode */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
          <span className="min-w-0 text-sm font-bold leading-tight">Shop Theme Mode</span>
          <SegmentedToggle
            value={themeMode}
            onChange={(v) => setThemeMode(v as "light" | "dark")}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </div>

        {/* Enable Buy Now Button */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
          <span className="min-w-0 text-sm font-bold leading-tight">Enable Buy Now Button</span>
          <SegmentedToggle
            value={buyNowEnabled ? "yes" : "no"}
            onChange={(v) => setBuyNow(v === "yes")}
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
          />
        </div>
      </div>

      {/* Info bar + Preview panel */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 px-5 py-4 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
            <span className="min-w-0 truncate">
              <span className="font-bold">{activeTemplate.name}</span>{" "}
              <span className="text-muted-foreground">is active on your storefront.</span>
            </span>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => setCustomizing(activeTemplate.id)}
              disabled={!storeQ.data}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-accent disabled:opacity-50"
            >
              <Settings2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Customize</span>
            </button>
            <button
              onClick={() => handleActivate(activeTemplate.id)}
              disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-60"
            >
              {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Apply Theme
            </button>
          </div>
        </div>



        {/* Preview Your Shop */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-bold">Preview Your Shop</span>
            <button
              onClick={() => setPreviewing(activeTemplate.id)}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
              aria-label="Open full preview"
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>
          <div className="relative h-72 overflow-hidden bg-neutral-100">
            <ThumbnailBoundary panel>
              <TemplateThumbnail id={activeTemplate.id} gradient={activeTemplate.gradient} accent={activeAccent} />
            </ThumbnailBoundary>
          </div>

        </div>
      </div>

      {previewing && storeQ.data && (
        <LivePreviewModal
          id={previewing}
          isActive={activeId === previewing}
          settings={getTemplateSettings(storeQ.data, previewing)}
          storeId={storeQ.data.id}
          onClose={() => setPreviewing(null)}
          onActivate={() => handleActivate(previewing)}
          activating={save.isPending}
        />
      )}

      {customizing && storeQ.data && (
        <CustomizeDialog
          id={customizing}
          storeId={storeQ.data.id}
          currentMap={storeQ.data.template_settings ?? {}}
          initial={getTemplateSettings(storeQ.data, customizing)}
          onClose={() => setCustomizing(null)}
        />
      )}
    </div>
  );
}


// ---------- Customize dialog ----------

function CustomizeDialog({
  id, storeId, currentMap, initial, onClose,
}: {
  id: TemplateId;
  storeId: string;
  currentMap: Record<string, TemplateSettings>;
  initial: TemplateSettings;
  onClose: () => void;
}) {
  const t = TEMPLATES.find((x) => x.id === id)!;
  const save = useSaveTemplateSettings();
  const products = useMyProducts(storeId);
  const categories = useCategories(storeId);

  const [accent, setAccent] = useState(initial.accentColor || t.accent);
  const [logoPath, setLogoPath] = useState<string | null | undefined>(initial.logoPath);
  const [categoryId, setCategoryId] = useState<string | null>(initial.defaultCategoryId ?? null);
  const [featured, setFeatured] = useState<string[]>(initial.featuredProductIds ?? []);
  const [uploading, setUploading] = useState(false);
  const [footer, setFooter] = useState<Required<FooterSettings>>({
    showNav: initial.footer?.showNav ?? DEFAULT_FOOTER.showNav,
    navLinks: initial.footer?.navLinks ?? DEFAULT_FOOTER.navLinks,
    showSocials: initial.footer?.showSocials ?? DEFAULT_FOOTER.showSocials,
    socials: initial.footer?.socials ?? DEFAULT_FOOTER.socials,
    showCopyright: initial.footer?.showCopyright ?? DEFAULT_FOOTER.showCopyright,
  });
  const toggleFooterLink = (label: string) =>
    setFooter((f) => ({ ...f, navLinks: f.navLinks.map((l) => l.label === label ? { ...l, enabled: !l.enabled } : l) }));
  const toggleFooterSocial = (key: FooterSocialKey) =>
    setFooter((f) => ({ ...f, socials: f.socials.map((s) => s.key === key ? { ...s, enabled: !s.enabled } : s) }));


  const logoSigned = useSignedLogoUrl(logoPath);

  const toggleFeatured = (pid: string) => {
    setFeatured((f) => f.includes(pid) ? f.filter((x) => x !== pid) : (f.length >= 7 ? f : [...f, pid]));
  };

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const oldPath = logoPath;
      const path = await uploadStoreLogo(file);
      setLogoPath(path);
      if (oldPath) await deleteStoreLogo(oldPath).catch(() => {});
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onRemoveLogo = async () => {
    if (logoPath) await deleteStoreLogo(logoPath).catch(() => {});
    setLogoPath(null);
  };

  const onSave = async () => {
    try {
      const categoryName = categoryId ? categories.data?.find((c) => c.id === categoryId)?.name ?? null : null;
      await save.mutateAsync({
        storeId,
        templateId: id,
        currentMap,
        settings: {
          accentColor: accent,
          logoPath: logoPath ?? null,
          defaultCategoryId: categoryId,
          defaultCategoryName: categoryName,
          featuredProductIds: featured,
          footer,
        },

      });
      toast.success("Template settings saved");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-background shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg" style={{ backgroundColor: accent }} />
            <div>
              <h2 className="font-display text-lg font-black">Customize {t.name}</h2>
              <p className="text-xs text-muted-foreground">These settings apply when this template is active.</p>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-auto px-5 py-5">
          {/* Accent color */}
          <section>
            <h3 className="text-sm font-bold">Accent color</h3>
            <p className="text-xs text-muted-foreground">Used for buttons, badges, and links.</p>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="h-11 w-14 cursor-pointer rounded-md border border-border bg-transparent"
              />
              <input
                type="text"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="h-11 w-32 rounded-md border border-border bg-transparent px-3 font-mono text-sm"
              />
              <div className="flex gap-1.5">
                {["#DC2626", "#0F172A", "#EC4899", "#4F46E5", "#F97316", "#059669", "#D97706"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setAccent(c)}
                    className="h-8 w-8 rounded-full ring-2 ring-border transition hover:scale-110"
                    style={{ backgroundColor: c }}
                    aria-label={`Set accent ${c}`}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Logo */}
          <section>
            <h3 className="text-sm font-bold">Template logo</h3>
            <p className="text-xs text-muted-foreground">Overrides your store logo for this template only.</p>
            <div className="mt-3 flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-xl border border-border bg-muted">
                {logoSigned ? (
                  <img src={logoSigned} alt="Template logo" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] text-muted-foreground">No logo</span>
                )}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold hover:bg-accent">
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading..." : "Upload"}
                <input
                  type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }}
                />
              </label>
              {logoPath && (
                <button onClick={onRemoveLogo} className="inline-flex items-center gap-1 text-sm text-destructive hover:underline">
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              )}
            </div>
          </section>

          {/* Default category */}
          <section>
            <h3 className="text-sm font-bold">Default category</h3>
            <p className="text-xs text-muted-foreground">Shown as the highlighted section on the storefront.</p>
            <select
              value={categoryId ?? ""}
              onChange={(e) => setCategoryId(e.target.value || null)}
              className="mt-3 h-11 w-full rounded-md border border-border bg-transparent px-3 text-sm"
            >
              <option value="">— None —</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {(categories.data ?? []).length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">No categories yet. Create some in Categories.</p>
            )}
          </section>

          {/* Featured products */}
          <section>
            <h3 className="text-sm font-bold">Featured products <span className="text-xs font-normal text-muted-foreground">({featured.length}/7)</span></h3>
            <p className="text-xs text-muted-foreground">Selected products appear first in the featured grid.</p>
            <div className="mt-3 max-h-56 space-y-1.5 overflow-auto rounded-lg border border-border p-2">
              {(products.data ?? []).length === 0 && (
                <p className="p-3 text-center text-xs text-muted-foreground">No products yet.</p>
              )}
              {(products.data ?? []).map((p) => {
                const on = featured.includes(p.id);
                return (
                  <label key={p.id} className={`flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent ${on ? "bg-accent" : ""}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleFeatured(p.id)} className="h-4 w-4" />
                    <span className="flex-1 truncate font-semibold">{p.name}</span>
                    <span className="text-xs text-muted-foreground">৳ {p.price.toLocaleString()}</span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* Footer */}
          <section>
            <h3 className="text-sm font-bold">Footer</h3>
            <p className="text-xs text-muted-foreground">Pick which sections and links appear in your storefront footer.</p>

            <div className="mt-3 space-y-3 rounded-lg border border-border p-3">
              <label className="flex cursor-pointer items-center justify-between gap-2 text-sm">
                <span className="font-semibold">Show navigation links</span>
                <input type="checkbox" checked={footer.showNav} onChange={(e) => setFooter((f) => ({ ...f, showNav: e.target.checked }))} className="h-4 w-4" />
              </label>
              {footer.showNav && (
                <div className="grid grid-cols-2 gap-1.5 pl-1">
                  {footer.navLinks.map((l) => (
                    <label key={l.label} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                      <input type="checkbox" checked={l.enabled} onChange={() => toggleFooterLink(l.label)} className="h-4 w-4" />
                      <span className="truncate">{l.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 space-y-3 rounded-lg border border-border p-3">
              <label className="flex cursor-pointer items-center justify-between gap-2 text-sm">
                <span className="font-semibold">Show social icons</span>
                <input type="checkbox" checked={footer.showSocials} onChange={(e) => setFooter((f) => ({ ...f, showSocials: e.target.checked }))} className="h-4 w-4" />
              </label>
              {footer.showSocials && (
                <div className="grid grid-cols-2 gap-1.5 pl-1">
                  {footer.socials.map((s) => (
                    <label key={s.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm capitalize hover:bg-accent">
                      <input type="checkbox" checked={s.enabled} onChange={() => toggleFooterSocial(s.key)} className="h-4 w-4" />
                      <span>{s.key}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <label className="mt-3 flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
              <span className="font-semibold">Show copyright line</span>
              <input type="checkbox" checked={footer.showCopyright} onChange={(e) => setFooter((f) => ({ ...f, showCopyright: e.target.checked }))} className="h-4 w-4" />
            </label>
          </section>
        </div>


        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold hover:bg-accent">Cancel</button>
          <button
            onClick={onSave}
            disabled={save.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save settings
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Live preview ----------

function LivePreviewModal({
  id, isActive, settings, storeId, onClose, onActivate, activating,
}: {
  id: TemplateId; isActive: boolean; settings: TemplateSettings; storeId: string;
  onClose: () => void; onActivate: () => void; activating: boolean;
}) {
  const template = TEMPLATES.find((t) => t.id === id)!;
  const products = useMyProducts(storeId);
  const logoSigned = useSignedLogoUrl(settings.logoPath);
  const accent = settings.accentColor || template.accent;

  const orderedProducts = useMemo(() => {
    const list = products.data ?? [];
    const ids = settings.featuredProductIds ?? [];
    if (!ids.length) return list;
    return [
      ...ids.map((pid) => list.find((p) => p.id === pid)).filter(Boolean) as typeof list,
      ...list.filter((p) => !ids.includes(p.id)),
    ];
  }, [products.data, settings.featuredProductIds]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-neutral-900 px-4 py-3 text-white sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-8 w-8 shrink-0 rounded-lg" style={{ backgroundColor: accent }} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate font-display text-base font-black sm:text-lg">{template.name}</h2>
              {template.premium && (
                <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider">Premium</span>
              )}
            </div>
            <p className="truncate text-[11px] text-white/60">{template.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onActivate}
            disabled={isActive || activating}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:bg-emerald-600 disabled:opacity-60 sm:px-5"
          >
            {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isActive ? "Already Active" : "Choose This Template"}
          </button>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Close preview">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-neutral-100">
        {id === "autoparts" ? (
          <AutoPartsTemplate
            demo={orderedProducts.length === 0}
            products={orderedProducts.length ? orderedProducts : undefined}
            logoUrl={logoSigned}
            accentColor={accent}
            defaultCategoryName={settings.defaultCategoryName}
          />
        ) : id === "bdlove" ? (
          <BdLoveTemplate
            demo={orderedProducts.length === 0}
            products={orderedProducts.length ? orderedProducts : undefined}
            logoUrl={logoSigned}
            accentColor={accent}
            defaultCategoryName={settings.defaultCategoryName}
          />
        ) : id === "eazystore-basic" ? (
          <EazyStoreBasicTemplate
            demo={orderedProducts.length === 0}
            products={orderedProducts.length ? orderedProducts : undefined}
            logoUrl={logoSigned}
            accentColor={accent}
            defaultCategoryName={settings.defaultCategoryName}
            footer={settings.footer}
          />

        ) : id === "flipmart" || id === "megamart" || id === "trendmart" || id === "shopii" ? (
          <FlipmartTemplate
            demo={orderedProducts.length === 0}
            products={orderedProducts.length ? orderedProducts : undefined}
            logoUrl={logoSigned}
            accentColor={accent}
            defaultCategoryName={settings.defaultCategoryName}
            footer={settings.footer}
            sliderRows={id === "trendmart" || id === "shopii"}
            sectionTitles={
              id === "trendmart"
                ? { suggested: "Newly Added", trending: "Trendy Styles" }
                : id === "shopii"
                ? { suggested: "Top Products", trending: "Daily Discover" }
                : undefined
            }
          />
        ) : id === "freshmart" ? (
          <FreshmartTemplate
            demo={orderedProducts.length === 0}
            products={orderedProducts.length ? orderedProducts : undefined}
            logoUrl={logoSigned}
            accentColor={accent}
            defaultCategoryName={settings.defaultCategoryName}
            footer={settings.footer}
          />
        ) : (
          <PlaceholderPreview id={id} accent={accent} />
        )}
      </div>
    </div>
  );
}

function PlaceholderPreview({ id, accent }: { id: TemplateId; accent: string }) {
  const t = TEMPLATES.find((x) => x.id === id)!;
  return (
    <div className={`min-h-full bg-gradient-to-br ${t.gradient} p-10 text-white`}>
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-5xl font-black">{t.name}</h1>
        <p className="mt-3 text-lg opacity-90">{t.tagline}</p>
        <div className="mt-6 inline-block rounded-full px-4 py-1 text-xs font-bold" style={{ backgroundColor: accent }}>
          Accent preview
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-white/10 backdrop-blur-sm" />
          ))}
        </div>
        <p className="mt-8 text-sm opacity-70">Full preview coming soon. Activate to see it live on your storefront.</p>
      </div>
    </div>
  );
}

// ---------- Helpers ----------

function useSignedLogoUrl(path: string | null | undefined) {
  const q = useQuery({
    queryKey: ["signed-logo-tpl", path],
    enabled: !!path,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("store-logos")
        .createSignedUrl(path!, 60 * 60 * 24 * 7);
      if (error) throw error;
      return data?.signedUrl ?? null;
    },
  });
  // Refetch when path changes to null → returns undefined.
  useEffect(() => { /* noop, react-query handles */ }, [path]);
  return q.data ?? null;
}

/** Accurate scaled-down live render of the actual template for each card. */
function useInView<T extends Element>(rootMargin = "200px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (inView || !ref.current) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
          break;
        }
      }
    }, { rootMargin });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [inView, rootMargin]);
  return { ref, inView };
}

function ThumbSkeleton() {
  return <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-muted/60 to-muted" />;
}

function LazyThumbImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <ThumbSkeleton />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`h-full w-full object-cover object-top transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </>
  );
}

function TemplateThumbnail({ id, gradient, accent }: { id: TemplateId; gradient: string; accent: string }) {
  const { ref, inView } = useInView<HTMLDivElement>();

  if (id === "bdlove") {
    return (
      <div ref={ref} className="pointer-events-none absolute inset-0 overflow-hidden bg-white">
        {inView ? <LazyThumbImage src={basicThemePreview.url} alt="Basic Theme preview" /> : <ThumbSkeleton />}
      </div>
    );
  }
  if (id === "eazystore-basic") {
    return (
      <div ref={ref} className="pointer-events-none absolute inset-0 overflow-hidden bg-white">
        {inView ? <LazyThumbImage src={eazystoreBasicPreview.url} alt="EazyStore Basic preview" /> : <ThumbSkeleton />}
      </div>
    );
  }

  const FULL_W = 1280;
  const FULL_H = 1000;

  let inner: React.ReactNode = null;
  if (id === "autoparts") inner = <AutoPartsTemplate demo accentColor={accent} />;
  else if (id === "flipmart" || id === "megamart") inner = <FlipmartTemplate demo accentColor={accent} />;
  else if (id === "trendmart") inner = <FlipmartTemplate demo accentColor={accent} sliderRows sectionTitles={{ suggested: "Newly Added", trending: "Trendy Styles" }} />;
  else if (id === "freshmart") inner = <FreshmartTemplate demo accentColor={accent} />;
  else if (id === "minimal") inner = <MinimalMonoPreview accent={accent} />;
  else if (id === "boutique") inner = <BoutiqueBlushPreview accent={accent} />;
  else if (id === "techgrid") inner = <TechGridPreview accent={accent} />;
  else if (id === "sporty") inner = <SportyPulsePreview accent={accent} />;
  else if (id === "luxe") inner = <LuxeNoirPreview accent={accent} />;

  if (inner) {
    return (
      <div
        ref={ref}
        className="pointer-events-none absolute inset-0 overflow-hidden bg-white"
        style={{ containerType: "size" } as React.CSSProperties}
      >
        {inView ? (
          <div
            style={{
              width: FULL_W,
              height: FULL_H,
              transform: "scale(var(--tpl-scale, 0.28))",
              transformOrigin: "top left",
            }}
          >
            {inner}
          </div>
        ) : (
          <ThumbSkeleton />
        )}
        <style>{`
          @container (min-width: 260px) { [style*="--tpl-scale"] { --tpl-scale: 0.32; } }
          @container (min-width: 340px) { [style*="--tpl-scale"] { --tpl-scale: 0.42; } }
        `}</style>
      </div>
    );
  }

  // Final fallback
  return (
    <div className={`relative h-full w-full overflow-hidden bg-gradient-to-br ${gradient} p-4`}>
      <div className="h-2 w-16 rounded bg-white/40" />
      <div className="mt-1.5 h-3 w-32 rounded bg-white/70" />
      <div className="mt-1 h-3 w-24 rounded bg-white/70" />
      <div className="mt-3 h-6 w-20 rounded-full" style={{ backgroundColor: accent }} />
    </div>
  );
}

// ---------- Segmented pill toggle (Light/Dark, Yes/No) ----------

function SegmentedToggle({
  value, onChange, options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={
              active
                ? "inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-sm"
                : "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-foreground/70 hover:text-foreground"
            }
            aria-pressed={active}
          >
            {opt.label}
            {active && <Check className="h-3 w-3" />}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Loading / Error UI ----------


function ThemesPageSkeleton() {
  return (
    <div className="mx-auto max-w-[1400px] animate-pulse px-4 py-6 sm:px-6 sm:py-8">
      <div className="h-40 rounded-2xl bg-muted sm:h-36" />
      <div className="mt-8 mb-4 space-y-2">
        <div className="h-3 w-40 rounded bg-muted" />
        <div className="h-7 w-72 rounded bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="h-40 bg-muted" />
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="h-4 w-4 rounded-full bg-muted" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="h-16 rounded-2xl bg-muted" />
            <div className="h-16 rounded-2xl bg-muted" />
          </div>
          <div className="h-14 rounded-2xl bg-muted" />
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="h-12 bg-muted" />
          <div className="h-72 bg-muted/60" />
        </div>
      </div>
    </div>
  );
}

function ThemesErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-display text-xl font-black">Couldn't load your themes</h2>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        <button
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    </div>
  );
}

// Simple error boundary for thumbnail render failures — one template render
// crashing must not blank the whole page.
class ThumbnailBoundary extends Component<
  { children: ReactNode; panel?: boolean },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    // eslint-disable-next-line no-console
    console.warn("[themes] template preview failed:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 grid place-items-center bg-muted/40 text-muted-foreground">
          <div className="flex flex-col items-center gap-1.5 px-4 text-center">
            <ImageOff className={this.props.panel ? "h-7 w-7" : "h-5 w-5"} />
            <span className={this.props.panel ? "text-sm font-semibold" : "text-[11px] font-semibold"}>
              Preview unavailable
            </span>
            {this.props.panel && (
              <button
                onClick={() => this.setState({ hasError: false })}
                className="mt-1 inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold hover:bg-accent"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            )}
          </div>
        </div>
      );
    }
    return <>{this.props.children}</>;
  }
}

