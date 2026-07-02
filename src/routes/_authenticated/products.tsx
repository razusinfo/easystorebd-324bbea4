import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, Search, Package, AlertTriangle, RefreshCw, PackageX, History } from "lucide-react";
import { toast } from "sonner";

import {
  useMyStore, useMyProducts, useDeleteProduct,
  useUpdateProductStatus, useProductAuditLogs,
  type ProductRow, type ProductStatus,
} from "@/lib/eazystore-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";


export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Products — EazyStore" },
      { name: "description", content: "Manage your store's products: add, edit, and delete inventory with live stock and price tracking." },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const navigate = useNavigate();
  const storeQ = useMyStore();
  const store = storeQ.data;
  const productsQ = useMyProducts(store?.id);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "all">("all");
  const [deleting, setDeleting] = useState<ProductRow | null>(null);
  const [statusTarget, setStatusTarget] = useState<ProductRow | null>(null);

  const del = useDeleteProduct(store?.id);


  const products = productsQ.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, search, statusFilter]);

  const stats = useMemo(() => {
    const totalStock = products.reduce((s, p) => s + p.stock, 0);
    const totalValue = products.reduce((s, p) => s + p.stock * p.price, 0);
    const outOfStock = products.filter((p) => p.stock === 0).length;
    return { count: products.length, totalStock, totalValue, outOfStock };
  }, [products]);

  const openNew = () => navigate({ to: "/products/new" });
  const openEdit = (p: ProductRow) =>
    navigate({ to: "/products/$productId/edit", params: { productId: p.id } });

  async function handleDelete() {
    if (!deleting) return;
    try {
      await del.mutateAsync(deleting.id);
      toast.success("Product deleted");
      setDeleting(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete");
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black sm:text-3xl">Products</h1>
          <p className="text-sm text-foreground/60">Manage your store inventory.</p>
        </div>
        <Button onClick={openNew} disabled={!store}>
          <Plus className="mr-1 h-4 w-4" /> Add Product
        </Button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Products" value={stats.count.toString()} />
        <StatCard label="Total Stock" value={stats.totalStock.toLocaleString()} />
        <StatCard label="Inventory Value" value={`৳ ${stats.totalValue.toLocaleString()}`} />
        <StatCard label="Out of Stock" value={stats.outOfStock.toString()} tone={stats.outOfStock ? "warn" : "muted"} />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1 text-xs">
          {(["all", "pending", "approved", "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={
                statusFilter === s
                  ? "rounded-md bg-primary px-3 py-1.5 font-bold text-primary-foreground capitalize"
                  : "rounded-md px-3 py-1.5 font-medium text-foreground/60 capitalize hover:bg-foreground/5"
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {storeQ.isLoading || productsQ.isLoading ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-border p-16">
          <Loader2 className="h-6 w-6 animate-spin text-foreground/40" />
        </div>
      ) : productsQ.isError ? (
        <ErrorState onRetry={() => productsQ.refetch()} />
      ) : !store ? (
        <EmptyState
          icon={PackageX}
          title="No store yet"
          desc="Complete onboarding to create your store before adding products."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={products.length === 0 ? "No products yet" : "No matching products"}
          desc={products.length === 0
            ? "Add your first product to start selling."
            : "Try a different search or filter."}
          action={products.length === 0
            ? <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Add Product</Button>
            : undefined}
        />
      ) : (
        <ProductTable rows={filtered} onEdit={openEdit} onDelete={setDeleting} onChangeStatus={setStatusTarget} />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-foreground">{deleting?.name}</span> will be
              permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={del.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {del.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}


function StatCard({ label, value, tone }: { label: string; value: string; tone?: "warn" | "muted" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">{label}</p>
      <p className={
        tone === "warn"
          ? "mt-1 font-display text-2xl font-black text-amber-600 dark:text-amber-400"
          : "mt-1 font-display text-2xl font-black"
      }>
        {value}
      </p>
    </div>
  );
}

function ProductTable({
  rows, onEdit, onDelete, onChangeStatus,
}: { rows: ProductRow[]; onEdit: (p: ProductRow) => void; onDelete: (p: ProductRow) => void; onChangeStatus: (p: ProductRow) => void }) {

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Desktop table */}
      <div className="hidden sm:block">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-foreground/50">
            <tr>
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-4 py-3 font-semibold">Price</th>
              <th className="px-4 py-3 font-semibold">Stock</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-foreground/[0.02]">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 font-bold text-primary">৳ {p.price.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={p.stock === 0 ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
                    {p.stock === 0 ? "Out of stock" : p.stock.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onChangeStatus(p)}
                    className="inline-flex items-center gap-1 rounded-full hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Change status"
                    title="Click to change status"
                  >
                    <StatusBadge status={p.status} />
                  </button>
                </td>

                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(p)} aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" onClick={() => onDelete(p)} aria-label="Delete"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y divide-border sm:hidden">
        {rows.map((p) => (
          <li key={p.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="mt-0.5 font-bold text-primary">৳ {p.price.toLocaleString()}</p>
                <p className={
                  p.stock === 0
                    ? "mt-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400"
                    : "mt-0.5 text-xs text-foreground/60"
                }>
                  {p.stock === 0 ? "Out of stock" : `${p.stock.toLocaleString()} in stock`}
                </p>
                <div className="mt-2">
                  <button type="button" onClick={() => onChangeStatus(p)} aria-label="Change status">
                    <StatusBadge status={p.status} />
                  </button>
                </div>

              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => onEdit(p)} aria-label="Edit">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost" size="icon" onClick={() => onDelete(p)} aria-label="Delete"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: ProductStatus }) {
  const cls =
    status === "approved"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : status === "rejected"
      ? "bg-destructive/15 text-destructive"
      : "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  );
}

function EmptyState({
  icon: Icon, title, desc, action,
}: { icon: any; title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-foreground/5">
        <Icon className="h-7 w-7 text-foreground/40" />
      </div>
      <h2 className="mt-4 font-display text-lg font-black">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-foreground/60">{desc}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-destructive/40 bg-destructive/5 p-12 text-center">
      <AlertTriangle className="h-7 w-7 text-destructive" />
      <h2 className="mt-3 font-display text-lg font-black">Failed to load products</h2>
      <p className="mt-1 text-sm text-foreground/60">Check your connection and try again.</p>
      <Button variant="outline" onClick={onRetry} className="mt-4">
        <RefreshCw className="mr-1 h-4 w-4" /> Try again
      </Button>
    </div>
  );
}
