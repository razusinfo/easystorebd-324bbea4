import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Package, ShoppingBag, Users, Globe, FolderTree, Megaphone,
  Store as StoreIcon, LayoutTemplate, Tag, BarChart3, FileBarChart,
  Truck, Gem, ReceiptText, LifeBuoy, Zap, Copy, ExternalLink,
  Home, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyStore, useMyProducts, buildStorefrontUrl } from "@/lib/eazystore-data";
import { EazyStoreWordmark } from "@/components/eazystore-wordmark";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — EazyStore" }] }),
  component: Dashboard,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}


function Dashboard() {
  const myStore = useMyStore();
  const products = useMyProducts(myStore.data?.id);
  const [name, setName] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      const fn =
        (u?.user_metadata?.full_name as string | undefined) ||
        (u?.user_metadata?.name as string | undefined) ||
        u?.email?.split("@")[0] ||
        "there";
      setName(fn);
    });
  }, []);

  const stats = useMemo(() => {
    const list = products.data ?? [];
    return {
      products: list.filter((p) => p.status === "approved").length,
      totalProducts: list.length,
    };
  }, [products.data]);

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
            Set up your store with the onboarding wizard.
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

  const store = myStore.data;
  const isLive = !!(store.published && store.slug);
  const storeUrl = isLive ? buildStorefrontUrl(store.slug!) : null;
  const storeUrlDisplay = storeUrl
    ? storeUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : "Not published yet";
  const date = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "short",
  });

  async function copyUrl() {
    if (!storeUrl) return;
    try { await navigator.clipboard.writeText(storeUrl); } catch {}
  }

  return (
    <main className="relative mx-auto min-h-screen w-full max-w-2xl bg-gradient-to-b from-[#eee6fb] via-[#efe9fc] to-[#f4eefd] pb-28 lg:max-w-7xl lg:bg-none lg:pb-8">
      {/* Greeting */}
      <section className="px-5 pt-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <p className="text-sm text-foreground/70">{greeting()},</p>
            <h1 className="truncate font-display text-4xl font-black tracking-tight">
              {name || "there"}
            </h1>
            <div className="mt-2 inline-flex items-center gap-1.5 text-sm">
              <span className={`inline-block h-2 w-2 rounded-full ${isLive ? "bg-emerald-500" : "bg-amber-500"}`} />
              <span className="truncate text-foreground/80">{store.name} · {isLive ? "Live" : "Draft"}</span>
            </div>
          </div>
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-black text-white shadow-lg ring-4 ring-white/60">
            <span className="font-display text-lg font-black">
              {store.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </div>

        {/* URL chip */}
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white bg-white/70 px-3 py-2.5 shadow-sm backdrop-blur">
          <Globe className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground/80">
            {storeUrlDisplay}
          </span>
          <button
            onClick={copyUrl}
            disabled={!storeUrl}
            className="grid h-7 w-7 place-items-center rounded-lg text-primary hover:bg-primary/10 disabled:opacity-40 disabled:hover:bg-transparent"
            aria-label="Copy URL"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>

        {/* Visit & Manage tabs */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {storeUrl ? (
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl gradient-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <ExternalLink className="h-4 w-4" />
              Visit
            </a>
          ) : (
            <Link
              to="/manage-shop"
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl gradient-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <ExternalLink className="h-4 w-4" />
              Publish
            </Link>
          )}
          <Link
            to="/manage-shop"
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-white bg-white/80 px-4 py-2.5 text-sm font-bold text-primary shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <StoreIcon className="h-4 w-4" />
            Manage
          </Link>
        </div>
      </section>


      {/* Promo banner */}
      <section className="mt-4 px-5">
        <div className="overflow-hidden rounded-2xl bg-white p-4 shadow-sm">
          <div className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground/60">Introducing</p>
              <p className="text-xl">
                <EazyStoreWordmark className="text-xl align-baseline" /> <span className="font-display font-black text-primary">Experts</span>
              </p>
              <p className="mt-0.5 text-xs text-foreground/70">
                From confusion to clarity — structured guidance for your business.
              </p>
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
              <LifeBuoy className="h-7 w-7" />
            </div>
          </div>
        </div>
        <div className="mt-2 flex justify-center gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === 0 ? "w-5 bg-primary" : "w-1.5 bg-primary/30"
              }`}
            />
          ))}
        </div>
      </section>

      {/* Quick actions */}
      <section className="mt-6 px-5">
        <h2 className="mb-3 font-display text-2xl font-black">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <QuickCard to="/categories" icon={FolderTree} title="Categories" sub="Organize products" />
          <QuickCard to="/customers" icon={Users} title="Customers" sub="Browse buyers" />
          <QuickCard to="/manage-shop" icon={StoreIcon} title="Manage Shop" sub="Profile & settings" />
          <QuickCard to="/landing-pages" icon={LayoutTemplate} title="Landing Pages" sub="Custom pages" />
          <QuickCard to="/promo-codes" icon={Tag} title="Promo Codes" sub="Discounts" />
          <QuickCard to="/analytics" icon={BarChart3} title="Analytics" sub="Detailed reports" />
          <QuickCard to="/analytics" icon={FileBarChart} title="Reports" sub="Sales summary" />
          <QuickCard to="/courier" icon={Truck} title="Courier" sub="Ship & track" />
          <QuickCard to="/spotlights" icon={Megaphone} title="Spotlights" sub="Promote items" />
          <QuickCard to="/themes" icon={LayoutTemplate} title="Themes" sub="Storefront look" />
        </div>
      </section>

      {/* Account */}
      <section className="mt-6 px-5">
        <div className="grid grid-cols-2 gap-3">
          <QuickCard to="/manage-shop" icon={Gem} title="Subscription" sub="Plans & add-ons" />
          <QuickCard to="/manage-shop" icon={ReceiptText} title="Billing" sub="Invoices & receipts" />
          <QuickCard to="/manage-shop" icon={LifeBuoy} title="Help" sub="Talk to us" />
        </div>
      </section>

      {/* Today's revenue */}
      <section className="mt-5 px-5">
        <div className="relative overflow-hidden rounded-3xl gradient-primary p-5 text-primary-foreground shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.25),transparent_60%)]" />
          <div className="relative flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider backdrop-blur">
              <Zap className="h-3 w-3" /> Today's revenue
            </span>
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-primary">— —</span>
          </div>
          <div className="relative mt-4">
            <div className="font-display text-5xl font-black tabular-nums">৳ 0</div>
            <p className="mt-1 text-sm text-white/80">৳ 0 this month · {date}</p>
          </div>
          <div className="relative mt-6 h-1 w-full rounded-full bg-white/20">
            <div className="h-1 w-full rounded-full bg-white/60" />
          </div>
        </div>
      </section>

      {/* Stat cards */}
      <section className="mt-4 px-5">
        <div className="grid grid-cols-2 gap-3">
          <StatTile icon={<ReceiptText className="h-5 w-5" />} value={0} label="Orders" sub="today · 0 mo" tone="violet" />
          <StatTile icon={<Package className="h-5 w-5" />} value={stats.products} label="Products" sub="active" tone="violet" />
          <StatTile icon={<Users className="h-5 w-5" />} value={0} label="Customers" sub="all time" tone="peach" />
          <StatTile icon={<Globe className="h-5 w-5" />} value={0} label="Visits" sub="website" tone="sky" />
        </div>
      </section>

      {/* Bottom nav (mobile-friendly; visible on all sizes within this max-w pane) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-2xl lg:hidden">
        <div className="relative mx-3 mb-3 grid grid-cols-3 items-end rounded-3xl border border-white/60 bg-white/90 px-4 py-2 shadow-[0_10px_30px_-10px_rgba(79,70,229,0.35)] backdrop-blur">
          <Link to="/products" className="flex flex-col items-center gap-0.5 py-2 text-foreground/70">
            <StoreIcon className="h-5 w-5" />
            <span className="text-[11px] font-semibold">Products</span>
          </Link>
          <div className="flex justify-center">
            <Link
              to="/dashboard"
              className="-mt-8 grid h-14 w-14 place-items-center rounded-full gradient-primary text-primary-foreground shadow-lg ring-4 ring-white"
              aria-label="Home"
            >
              <Home className="h-6 w-6" />
            </Link>
          </div>
          <Link to="/orders" className="flex flex-col items-center gap-0.5 py-2 text-foreground/70">
            <ShoppingBag className="h-5 w-5" />
            <span className="text-[11px] font-semibold">Orders</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}

function QuickCard({
  to, icon: Icon, title, sub,
}: { to: string; icon: any; title: string; sub: string }) {
  return (
    <Link
      to={to}
      className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-display text-sm font-black leading-tight">
          {title}
        </span>
        <span className="block truncate text-[11px] text-foreground/60">{sub}</span>
      </span>
      <span className="text-foreground/30 transition-transform group-hover:translate-x-0.5">›</span>
    </Link>
  );
}

function StatTile({
  icon, value, label, sub, tone,
}: {
  icon: React.ReactNode; value: number; label: string; sub: string;
  tone: "violet" | "peach" | "sky";
}) {
  const toneCls = {
    violet: "bg-primary/10 text-primary",
    peach: "bg-orange-100 text-orange-500",
    sky: "bg-sky-100 text-sky-500",
  }[tone];
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <span className={`inline-grid h-9 w-9 place-items-center rounded-xl ${toneCls}`}>
        {icon}
      </span>
      <div className="mt-3 font-display text-3xl font-black tabular-nums">{value}</div>
      <div className="mt-0.5 font-display text-sm font-black">{label}</div>
      <div className="text-[11px] text-foreground/60">{sub}</div>
    </div>
  );
}
