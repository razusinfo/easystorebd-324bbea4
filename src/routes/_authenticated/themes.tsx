import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Eye, Sparkles, X, Loader2, ShieldCheck } from "lucide-react";
import { TEMPLATES, useMyStore, useUpdateStore, type TemplateId } from "@/lib/eazystore-data";
import { AutoPartsTemplate } from "@/components/templates/autoparts-template";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/themes")({
  head: () => ({ meta: [{ title: "Themes — EazyStore" }] }),
  component: ThemesPage,
});

function ThemesPage() {
  const storeQ = useMyStore();
  const update = useUpdateStore();
  const activeId = storeQ.data?.template as TemplateId | undefined;
  const [previewing, setPreviewing] = useState<TemplateId | null>(null);

  const handleActivate = async (id: TemplateId) => {
    if (!storeQ.data) return;
    try {
      await update.mutateAsync({ id: storeQ.data.id, template: id } as any);
      toast.success(`${TEMPLATES.find((t) => t.id === id)?.name} is now your active template`);
      setPreviewing(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not activate template");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Storefront Templates
        </div>
        <h1 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">Pick a design for your store</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Browse premium, ready-made layouts. Preview any template full-screen, then activate it for your live storefront in one click.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((t) => {
          const isActive = activeId === t.id;
          return (
            <article
              key={t.id}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              {/* Thumbnail preview */}
              <div className="relative h-56 overflow-hidden bg-neutral-100">
                <TemplateThumbnail id={t.id} gradient={t.gradient} accent={t.accent} />

                {/* Hover overlay */}
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
                  <button
                    onClick={() => setPreviewing(t.id)}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-neutral-900 shadow-md transition hover:scale-105"
                  >
                    <Eye className="h-4 w-4" /> Live Preview
                  </button>
                </div>

                {/* Badges */}
                {t.premium && (
                  <span className="absolute left-3 top-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow">
                    Premium
                  </span>
                )}
                {isActive && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow">
                    <ShieldCheck className="h-3 w-3" /> Active
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-black">{t.name}</h3>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t.category}</p>
                  </div>
                  <div className="h-6 w-6 shrink-0 rounded-full ring-2 ring-border" style={{ backgroundColor: t.accent }} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{t.tagline}</p>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setPreviewing(t.id)}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold hover:bg-accent hover:text-accent-foreground"
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => handleActivate(t.id)}
                    disabled={isActive || update.isPending || !storeQ.data}
                    className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50"
                  >
                    {isActive ? (<span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Active</span>) : "Activate"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Live preview modal */}
      {previewing && (
        <LivePreviewModal
          id={previewing}
          isActive={activeId === previewing}
          onClose={() => setPreviewing(null)}
          onActivate={() => handleActivate(previewing)}
          activating={update.isPending}
        />
      )}
    </div>
  );
}

function LivePreviewModal({
  id, isActive, onClose, onActivate, activating,
}: { id: TemplateId; isActive: boolean; onClose: () => void; onActivate: () => void; activating: boolean }) {
  const template = TEMPLATES.find((t) => t.id === id)!;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
      {/* Preview toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-neutral-900 px-4 py-3 text-white sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-8 w-8 shrink-0 rounded-lg" style={{ backgroundColor: template.accent }} />
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
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable preview surface */}
      <div className="flex-1 overflow-auto bg-neutral-100">
        {id === "autoparts" ? (
          <AutoPartsTemplate demo />
        ) : (
          <PlaceholderPreview id={id} />
        )}
      </div>
    </div>
  );
}

function PlaceholderPreview({ id }: { id: TemplateId }) {
  const t = TEMPLATES.find((x) => x.id === id)!;
  return (
    <div className={`min-h-full bg-gradient-to-br ${t.gradient} p-10 text-white`}>
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-5xl font-black">{t.name}</h1>
        <p className="mt-3 text-lg opacity-90">{t.tagline}</p>
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

/** Compact stylized SVG thumbnails so each card is visually distinct. */
function TemplateThumbnail({ id, gradient, accent }: { id: TemplateId; gradient: string; accent: string }) {
  if (id === "autoparts") {
    return (
      <div className="relative h-full w-full overflow-hidden bg-neutral-50">
        {/* Fake browser chrome */}
        <div className="flex items-center gap-1 bg-white px-2 py-1.5">
          <span className="h-2 w-2 rounded-full bg-red-400" />
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <div className="ml-2 h-2 flex-1 rounded bg-neutral-100" />
        </div>
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2">
          <div className="h-3 w-3 rounded" style={{ backgroundColor: accent }} />
          <div className="h-2 w-10 rounded bg-neutral-800" />
          <div className="ml-2 h-3 flex-1 rounded bg-neutral-100" />
          <div className="h-3 w-3 rounded" style={{ backgroundColor: accent }} />
        </div>
        {/* Category strip */}
        <div className="flex items-center gap-2 px-3 py-1.5">
          <div className="h-3 w-14 rounded-sm" style={{ backgroundColor: accent }} />
          <div className="h-1.5 w-8 rounded bg-neutral-300" />
          <div className="h-1.5 w-8 rounded bg-neutral-300" />
          <div className="h-1.5 w-8 rounded bg-neutral-300" />
        </div>
        {/* Sidebar + hero */}
        <div className="grid grid-cols-[45px_1fr] gap-2 px-3">
          <div className="space-y-1 rounded bg-white p-1.5 shadow-sm">
            {[...Array(6)].map((_, i) => <div key={i} className="h-1 rounded bg-neutral-200" />)}
          </div>
          <div className="relative overflow-hidden rounded bg-gradient-to-br from-neutral-800 to-neutral-900 p-2">
            <div className="h-1.5 w-16 rounded bg-white/60" />
            <div className="mt-1 h-2 w-24 rounded bg-white" />
            <div className="mt-1 h-2 w-20 rounded bg-white" />
            <div className="mt-2 h-3 w-12 rounded" style={{ backgroundColor: accent }} />
            <div className="absolute right-1 top-1 h-10 w-10 rounded-full bg-white/10" />
          </div>
        </div>
        {/* Product row */}
        <div className="mt-2 grid grid-cols-5 gap-1.5 px-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded bg-white p-1 shadow-sm">
              <div className="h-6 rounded bg-neutral-100" />
              <div className="mt-0.5 h-1 rounded bg-neutral-300" />
              <div className="mt-0.5 h-1 w-3/4 rounded" style={{ backgroundColor: accent }} />
            </div>
          ))}
        </div>
        {/* Promo ribbon */}
        <div className="absolute bottom-1.5 left-3 right-3 flex items-center justify-between rounded bg-red-50 px-2 py-1">
          <div className="flex items-center gap-1">
            <span className="rounded px-1 py-0.5 text-[8px] font-black text-white" style={{ backgroundColor: accent }}>-39%</span>
            <div className="h-1 w-16 rounded bg-neutral-300" />
          </div>
          <div className="h-2 w-10 rounded border border-dashed border-red-400 bg-white" />
        </div>
      </div>
    );
  }

  // Generic stylized thumbnail
  return (
    <div className={`relative h-full w-full bg-gradient-to-br ${gradient} p-4`}>
      <div className="h-2 w-16 rounded bg-white/40" />
      <div className="mt-1.5 h-3 w-32 rounded bg-white/70" />
      <div className="mt-1 h-3 w-24 rounded bg-white/70" />
      <div className="mt-3 h-6 w-20 rounded-full bg-white/90" />
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="aspect-square rounded bg-white/20 backdrop-blur-sm" />
        ))}
      </div>
    </div>
  );
}
