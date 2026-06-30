import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Plus, Package, Clock, CheckCircle2, XCircle, Trash2, Sparkles, Store as StoreIcon, ArrowLeft,
} from "lucide-react";
import { db, useStoreData, TEMPLATES, type Product } from "@/lib/eazystore-store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — EazyStore" },
      { name: "description", content: "Manage your store and list products." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { stores, products, activeStoreId } = useStoreData();
  const navigate = useNavigate();
  const store = useMemo(
    () => stores.find((s) => s.id === activeStoreId) ?? stores[stores.length - 1],
    [stores, activeStoreId],
  );

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");

  if (!store) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5 text-center">
        <div className="max-w-sm space-y-4">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl gradient-primary text-white">
            <StoreIcon className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-bold">No store yet</h1>
          <p className="text-sm text-muted-foreground">Set up your store with the onboarding wizard.</p>
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

  const myProducts = products.filter((p) => p.storeId === store.id);
  const tmpl = TEMPLATES.find((t) => t.id === store.template)!;
  const stats = {
    total: myProducts.length,
    pending: myProducts.filter((p) => p.status === "pending").length,
    approved: myProducts.filter((p) => p.status === "approved").length,
    rejected: myProducts.filter((p) => p.status === "rejected").length,
  };

  function addProduct() {
    const p = parseFloat(price);
    const s = parseInt(stock, 10);
    if (!name.trim() || isNaN(p) || isNaN(s)) return;
    db.addProduct({
      id: `p_${Date.now().toString(36)}`,
      storeId: store.id,
      name: name.trim(),
      price: p,
      stock: s,
      status: "pending",
      createdAt: Date.now(),
    });
    setName(""); setPrice(""); setStock(""); setShowForm(false);
  }

  return (
    <main className="min-h-screen bg-background pb-16 text-foreground">
      {/* Hero */}
      <div className={`relative overflow-hidden bg-gradient-to-br ${tmpl.gradient} text-white`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.25),transparent_60%)]" />
        <div className="mx-auto max-w-3xl px-5 pb-8 pt-6">
          <button
            onClick={() => navigate({ to: "/" })}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white/80 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </button>
          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
                {store.category} · {tmpl.name}
              </p>
              <h1 className="mt-1 truncate font-display text-3xl font-black sm:text-4xl">{store.name}</h1>
              <p className="mt-1 text-sm text-white/80">Welcome back, {store.ownerName}</p>
            </div>
            <Sparkles className="h-8 w-8 shrink-0 text-white/80" />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mx-auto -mt-6 grid max-w-3xl grid-cols-2 gap-3 px-5 sm:grid-cols-4">
        <StatCard label="Total" value={stats.total} icon={<Package className="h-4 w-4" />} tone="primary" />
        <StatCard label="Pending" value={stats.pending} icon={<Clock className="h-4 w-4" />} tone="warning" />
        <StatCard label="Approved" value={stats.approved} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
        <StatCard label="Rejected" value={stats.rejected} icon={<XCircle className="h-4 w-4" />} tone="destructive" />
      </div>

      {/* Add product */}
      <section className="mx-auto mt-6 max-w-3xl px-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Products</h2>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full gradient-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md"
          >
            <Plus className="h-4 w-4" /> {showForm ? "Close" : "New product"}
          </button>
        </div>

        {showForm && (
          <div className="mt-3 animate-fade-up rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                placeholder="Product name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl border-2 border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary sm:col-span-3"
              />
              <input
                type="number"
                inputMode="decimal"
                placeholder="Price (৳)"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="rounded-xl border-2 border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <input
                type="number"
                inputMode="numeric"
                placeholder="Stock"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="rounded-xl border-2 border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={addProduct}
                className="rounded-xl gradient-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm"
              >
                Submit for review
              </button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              New listings go to the Super Admin for review.
            </p>
          </div>
        )}

        <div className="mt-4 space-y-2.5">
          {myProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <Package className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-medium">No products yet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Tap "New product" to add your first listing.</p>
            </div>
          ) : (
            myProducts
              .slice()
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((p) => <ProductRow key={p.id} p={p} />)
          )}
        </div>
      </section>
    </main>
  );
}

function StatCard({
  label, value, icon, tone,
}: {
  label: string; value: number; icon: React.ReactNode;
  tone: "primary" | "warning" | "success" | "destructive";
}) {
  const toneCls = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/15 text-warning-foreground",
    success: "bg-success/15 text-success",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${toneCls}`}>{icon}</div>
      <div className="mt-2 text-2xl font-black tabular-nums">{value}</div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function ProductRow({ p }: { p: Product }) {
  const status = {
    pending: { cls: "bg-warning/15 text-warning-foreground", label: "Pending" },
    approved: { cls: "bg-success/15 text-success", label: "Approved" },
    rejected: { cls: "bg-destructive/10 text-destructive", label: "Rejected" },
  }[p.status];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm">
      <div className="min-w-0">
        <div className="truncate font-semibold">{p.name}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">৳{p.price.toLocaleString()}</span>
          <span>·</span>
          <span>{p.stock} in stock</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${status.cls}`}>{status.label}</span>
        <button
          onClick={() => db.deleteProduct(p.id)}
          aria-label="Delete"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
