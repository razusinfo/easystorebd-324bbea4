import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Store as StoreIcon, Save, Check, Loader2, Copy, ExternalLink, Globe,
  ArrowLeft, Shirt, Cpu, Trophy, Palette, AlertCircle,
} from "lucide-react";
import {
  TEMPLATES, useMyStore, useUpdateStore,
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
  const [category, setCategory] = useState<Category>("Clothes");
  const [template, setTemplate] = useState<TemplateId>("minimal");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hydrate form whenever the store loads/changes.
  useEffect(() => {
    if (myStore.data) {
      setName(myStore.data.name);
      setCategory(myStore.data.category);
      setTemplate(myStore.data.template);
    }
  }, [myStore.data?.id]);

  const storeUrl = useMemo(
    () => (name ? `www.${slugify(name)}.eazystore.app` : ""),
    [name],
  );

  const dirty = useMemo(() => {
    if (!myStore.data) return false;
    return (
      name.trim() !== myStore.data.name ||
      category !== myStore.data.category ||
      template !== myStore.data.template
    );
  }, [myStore.data, name, category, template]);

  const trimmed = name.trim();
  const canSave = dirty && trimmed.length >= 2 && !update.isPending;

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
        category,
        template,
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
    <main className="relative mx-auto min-h-screen w-full max-w-2xl bg-gradient-to-b from-[#eee6fb] via-[#efe9fc] to-[#f4eefd] pb-28">
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
          Update your store name, category, and template.
        </p>
      </section>

      {/* Store URL preview */}
      <section className="mt-4 px-5">
        <div className="flex items-center gap-2 rounded-2xl border border-white bg-white/70 px-3 py-2.5 shadow-sm backdrop-blur">
          <Globe className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground/80">
            {storeUrl || "your-store.eazystore.app"}
          </span>
          <button
            onClick={copyUrl}
            className="grid h-7 w-7 place-items-center rounded-lg text-primary hover:bg-primary/10"
            aria-label="Copy URL"
          >
            <Copy className="h-4 w-4" />
          </button>
          <a
            href={storeUrl ? `https://${storeUrl}` : "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="grid h-7 w-7 place-items-center rounded-lg text-primary hover:bg-primary/10"
            aria-label="Open store"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* Store name */}
      <section className="mt-5 px-5">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <label htmlFor="store-name" className="block font-display text-sm font-black">
            Store name
          </label>
          <p className="text-[11px] text-foreground/60">
            This will appear in your dashboard and store URL.
          </p>
          <input
            id="store-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-medium outline-none ring-primary/30 focus:ring-2"
            placeholder="My awesome shop"
          />
          <div className="mt-1 text-right text-[10px] text-foreground/50">
            {name.length}/60
          </div>
        </div>
      </section>

      {/* Category */}
      <section className="mt-4 px-5">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="font-display text-sm font-black">Category</h2>
          <p className="text-[11px] text-foreground/60">
            Choose what best describes your store.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => {
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`group flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                    active
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-border bg-background hover:border-primary/40"
                  }`}
                >
                  <c.icon className={`h-5 w-5 ${active ? "text-primary" : "text-foreground/60"}`} />
                  <span className="font-display text-xs font-black">{c.id}</span>
                  <span className="text-[10px] text-foreground/60">{c.sub}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Template */}
      <section className="mt-4 px-5">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-black">Storefront template</h2>
          </div>
          <p className="text-[11px] text-foreground/60">
            Pick a look. You can change it anytime.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TEMPLATES.map((t) => {
              const active = template === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplate(t.id)}
                  className={`group overflow-hidden rounded-xl border text-left transition-all ${
                    active
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div
                    className={`relative h-16 w-full bg-gradient-to-br ${t.gradient}`}
                  >
                    {active && (
                      <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white text-primary shadow">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <div className="p-2">
                    <div className="font-display text-xs font-black leading-tight">
                      {t.name}
                    </div>
                    <div className="truncate text-[10px] text-foreground/60">
                      {t.tagline}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Error */}
      {error && (
        <section className="mt-3 px-5">
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        </section>
      )}

      {/* Save bar (sticky bottom) */}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-2xl px-3 pb-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/95 px-4 py-3 shadow-[0_10px_30px_-10px_rgba(79,70,229,0.35)] backdrop-blur">
          <div className="min-w-0 text-xs">
            {savedAt ? (
              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-600">
                <Check className="h-3.5 w-3.5" />
                Saved
              </span>
            ) : dirty ? (
              <span className="font-semibold text-foreground/70">Unsaved changes</span>
            ) : (
              <span className="text-foreground/50">All changes saved</span>
            )}
          </div>
          <button
            onClick={onSave}
            disabled={!canSave}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl gradient-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
          >
            {update.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save changes
              </>
            )}
          </button>
        </div>
      </div>
    </main>
  );
}
