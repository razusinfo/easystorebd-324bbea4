import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Plus, Package, Clock, CheckCircle2, XCircle, Trash2, Sparkles, Store as StoreIcon,
  Pencil, X as XIcon, Loader2, LogOut, ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  useMyStore, useMyProducts, useUpsertProduct, useDeleteProduct, useIsSuperAdmin,
  TEMPLATES, type ProductRow,
} from "@/lib/eazystore-data";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — EazyStore" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const myStore = useMyStore();
  const products = useMyProducts(myStore.data?.id);
  const upsert = useUpsertProduct(myStore.data?.id);
  const remove = useDeleteProduct(myStore.data?.id);
  const isAdmin = useIsSuperAdmin();

  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setPrice(String(editing.price));
      setStock(String(editing.stock));
      setShowForm(true);
    }
  }, [editing]);

  if (myStore.isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!myStore.data) {
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

  const store = myStore.data;
  const tmpl = TEMPLATES.find((t) => t.id === store.template) ?? TEMPLATES[0];
  const list = products.data ?? [];
  const stats = useMemoStats(list);

  function resetForm() {
    setEditing(null); setName(""); setPrice(""); setStock(""); setErr(null); setShowForm(false);
  }

  async function submit() {
    setErr(null);
    const p = parseFloat(price);
    const s = parseInt(stock, 10);
    if (!name.trim() || isNaN(p) || p < 0 || isNaN(s) || s < 0) {
      setErr("Enter a name, a non-negative price, and stock.");
      return;
    }
    try {
      await upsert.mutateAsync({ id: editing?.id, name: name.trim(), price: p, stock: s });
      resetForm();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <main className="min-h-screen bg-background pb-16 text-foreground">
      <div className={`relative overflow-hidden bg-gradient-to-br ${tmpl.gradient} text-white`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.25),transparent_60%)]" />
        <div className="mx-auto max-w-3xl px-5 pb-8 pt-6">
          <div className="flex items-center justify-between gap-3">
            <Link to="/" className="text-xs font-medium text-white/80 hover:text-white">← Home</Link>
            <div className="flex items-center gap-2">
              {isAdmin.data && (
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur hover:bg-white/25"
                >
                  <ShieldCheck className="h-3 w-3" /> Admin
                </Link>
              )}
              <button
                onClick={signOut}
                className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur hover:bg-white/25"
              >
                <LogOut className="h-3 w-3" /> Sign out
              </button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
                {store.category} · {tmpl.name}
              </p>
              <h1 className="mt-1 truncate font-display text-3xl font-black sm:text-4xl">{store.name}</h1>
            </div>
            <Sparkles className="h-8 w-8 shrink-0 text-white/80" />
          </div>
        </div>
      </div>

      <div className="mx-auto -mt-6 grid max-w-3xl grid-cols-2 gap-3 px-5 sm:grid-cols-4">
        <StatCard label="Total" value={stats.total} icon={<Package className="h-4 w-4" />} tone="primary" />
        <StatCard label="Pending" value={stats.pending} icon={<Clock className="h-4 w-4" />} tone="warning" />
        <StatCard label="Approved" value={stats.approved} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
        <StatCard label="Rejected" value={stats.rejected} icon={<XCircle className="h-4 w-4" />} tone="destructive" />
      </div>

      <section className="mx-auto mt-6 max-w-3xl px-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Products</h2>
          <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="inline-flex items-center gap-1.5 rounded-full gradient-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md"
          >
            {showForm ? <XIcon className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Close" : "New product"}
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
                type="number" inputMode="decimal" placeholder="Price (৳)" value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="rounded-xl border-2 border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <input
                type="number" inputMode="numeric" placeholder="Stock" value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="rounded-xl border-2 border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={submit}
                disabled={upsert.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-xl gradient-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm disabled:opacity-50"
              >
                {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Save changes" : "Submit for review"}
              </button>
            </div>
            {err && <p className="mt-2 text-xs font-medium text-destructive">{err}</p>}
            <p className="mt-2 text-[11px] text-muted-foreground">
              {editing ? "Edits go back to pending review." : "New listings go to the Super Admin for review."}
            </p>
          </div>
        )}

        <div className="mt-4 space-y-2.5">
          {products.isLoading ? (
            <div className="grid place-items-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <Package className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-medium">No products yet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Tap "New product" to add your first listing.</p>
            </div>
          ) : (
            list.map((p) => (
              <ProductRowView
                key={p.id}
                p={p}
                onEdit={() => setEditing(p)}
                onDelete={() => remove.mutate(p.id)}
              />
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function useMemoStats(list: ProductRow[]) {
  return useMemo(
    () => ({
      total: list.length,
      pending: list.filter((p) => p.status === "pending").length,
      approved: list.filter((p) => p.status === "approved").length,
      rejected: list.filter((p) => p.status === "rejected").length,
    }),
    [list],
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

function ProductRowView({
  p, onEdit, onDelete,
}: { p: ProductRow; onEdit: () => void; onDelete: () => void }) {
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
          <span className="tabular-nums">৳{Number(p.price).toLocaleString()}</span>
          <span>·</span>
          <span>{p.stock} in stock</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${status.cls}`}>{status.label}</span>
        <button
          onClick={onEdit} aria-label="Edit"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={() => { if (confirm("Delete this product?")) onDelete(); }}
          aria-label="Delete"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
