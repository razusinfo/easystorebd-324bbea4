import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, Search, Package, AlertTriangle, RefreshCw, PackageX, History, ChevronRight, ChevronLeft, ShoppingCart, ChevronDown, ImageIcon, MoreVertical, Eye, Copy } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

import {
  useMyStore, useMyProductsPaged, useMyProductsStats, useDeleteProduct,
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


export const Route = createFileRoute("/_authenticated/products/")({
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

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [skuFilter, setSkuFilter] = useState("");
  const [debouncedSku, setDebouncedSku] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [deleting, setDeleting] = useState<ProductRow | null>(null);
  const [statusTarget, setStatusTarget] = useState<ProductRow | null>(null);

  // Debounce search + sku to avoid spamming API
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSku(skuFilter), 300);
    return () => clearTimeout(t);
  }, [skuFilter]);

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, debouncedSku, statusFilter, perPage]);

  const productsQ = useMyProductsPaged({
    storeId: store?.id,
    page,
    perPage,
    search: debouncedSearch,
    sku: debouncedSku,
    status: statusFilter,
  });
  const statsQ = useMyProductsStats(store?.id);

  const del = useDeleteProduct(store?.id);

  const rows = productsQ.data?.rows ?? [];
  const total = productsQ.data?.total ?? 0;
  const stats = statsQ.data ?? { count: 0, totalStock: 0, totalValue: 0, outOfStock: 0 };

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

  const hasFilters = !!debouncedSearch || !!debouncedSku || statusFilter !== "all";

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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input
            placeholder="Search by product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="relative w-full lg:w-64">
          <Input
            placeholder="Filter by SKU / Code..."
            value={skuFilter}
            onChange={(e) => setSkuFilter(e.target.value)}
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
      {storeQ.isLoading || (productsQ.isLoading && !productsQ.data) ? (
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
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Package}
          title={hasFilters ? "No matching products" : "No products yet"}
          desc={hasFilters ? "Try a different search or filter." : "Add your first product to start selling."}
          action={!hasFilters
            ? <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Add Product</Button>
            : undefined}
        />
      ) : (
        <ProductTable
          rows={rows}
          total={total}
          page={page}
          perPage={perPage}
          isFetching={productsQ.isFetching}
          onPageChange={setPage}
          onPerPageChange={setPerPage}
          onEdit={openEdit}
          onDelete={setDeleting}
          onChangeStatus={setStatusTarget}
        />
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

      {/* Status change */}
      <StatusChangeDialog
        product={statusTarget}
        storeId={store?.id}
        onClose={() => setStatusTarget(null)}
      />
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
  rows, total, page, perPage, isFetching, onPageChange, onPerPageChange,
  onEdit, onDelete, onChangeStatus,
}: {
  rows: ProductRow[];
  total: number;
  page: number;
  perPage: number;
  isFetching: boolean;
  onPageChange: (p: number) => void;
  onPerPageChange: (n: number) => void;
  onEdit: (p: ProductRow) => void;
  onDelete: (p: ProductRow) => void;
  onChangeStatus: (p: ProductRow) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * perPage;
  const pageRows = rows;


  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    setSelected((s) => {
      if (pageRows.every((r) => s.has(r.id))) {
        const n = new Set(s);
        pageRows.forEach((r) => n.delete(r.id));
        return n;
      }
      const n = new Set(s);
      pageRows.forEach((r) => n.add(r.id));
      return n;
    });
  };
  const allChecked = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Desktop table */}
      <div className="hidden sm:block">
        <div className="relative w-full overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-border bg-foreground/[0.02] text-left text-xs font-semibold text-foreground/60">
              <tr>
                <th className="w-10 px-3 py-3">
                  <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" />
                </th>
                <th className="w-8 px-1 py-3" />
                <th className="px-3 py-3">Product</th>
                <th className="w-20 px-3 py-3">Type</th>
                <th className="px-3 py-3">SKU</th>
                <th className="w-28 px-3 py-3 text-right">Price</th>
                <th className="w-28 px-3 py-3 text-right">
                  <span className="inline-flex items-center gap-1">Qty <ChevronDown className="h-3 w-3" /></span>
                </th>
                <th className="w-10 px-2 py-3" />
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.map((p) => (
                <tr key={p.id} className="hover:bg-foreground/[0.02]">
                  <td className="px-3 py-3 align-middle">
                    <Checkbox
                      checked={selected.has(p.id)}
                      onCheckedChange={() => toggle(p.id)}
                      aria-label={`Select ${p.name}`}
                    />
                  </td>
                  <td className="px-1 py-3 align-middle text-foreground/40">
                    <ChevronRight className="h-4 w-4" />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted/40">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-foreground/30" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium leading-tight text-foreground">
                          {p.name}
                          {p.sku ? ` (Code: ${p.sku})` : ""}
                        </p>
                        <p className="mt-0.5 text-[11px] text-foreground/50">
                          <button
                            type="button"
                            onClick={() => onChangeStatus(p)}
                            className="hover:opacity-80"
                          >
                            <StatusBadge status={p.status} />
                          </button>
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 align-middle text-[13px] text-foreground/70">Own</td>
                  <td className="px-3 py-3 align-middle">
                    <span className="block max-w-[280px] truncate text-[12px] text-foreground/60">
                      {p.sku ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right align-middle font-semibold text-primary">
                    ৳{p.price.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <div className="ml-auto flex h-8 w-24 items-center justify-between rounded-md border border-border px-2 text-[13px]">
                      <span className={p.stock === 0 ? "font-semibold text-amber-600 dark:text-amber-400" : "font-medium"}>
                        {p.stock}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 text-foreground/40" />
                    </div>
                  </td>
                  <td className="px-2 py-3 align-middle">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost" size="icon" aria-label="Actions"
                          className="h-8 w-8 text-foreground/70 hover:text-foreground"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onClick={() => onEdit(p)}>
                          <Eye className="mr-2 h-4 w-4" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(p)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info("Clone product coming soon")}>
                          <Copy className="mr-2 h-4 w-4" /> Clone product
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(p)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>

                  <td className="px-2 py-3 align-middle">
                    <Button
                      variant="ghost" size="icon" onClick={() => onEdit(p)} aria-label="Edit"
                      className="h-8 w-8 text-foreground/70 hover:text-foreground"
                    >
                      <ShoppingCart className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-foreground/[0.02] px-4 py-3 text-xs text-foreground/60">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2">
              {isFetching && <Loader2 className="h-3 w-3 animate-spin text-foreground/40" />}
              Showing {total === 0 ? 0 : start + 1}–{Math.min(start + pageRows.length, total)} of {total}
            </span>
            <select
              value={perPage}
              onChange={(e) => onPerPageChange(Number(e.target.value))}
              className="h-7 rounded-md border border-border bg-background px-2 text-[12px]"
              aria-label="Rows per page"
            >
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>per page</span>
          </div>
          <Pagination page={currentPage} totalPages={totalPages} onChange={onPageChange} />
        </div>

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

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const pages: (number | "…")[] = [];
  const push = (n: number | "…") => pages.push(n);
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) push(i);
  } else {
    push(1);
    if (page > 3) push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) push(i);
    if (page < totalPages - 2) push("…");
    push(totalPages);
  }
  const btn = "grid h-7 min-w-7 place-items-center rounded-md border border-transparent px-2 text-[12px] hover:border-border";
  return (
    <div className="flex items-center gap-1">
      <button className={btn} onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1} aria-label="Previous">
        <ChevronLeft className="h-3.5 w-3.5" /> Previous
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-1 text-foreground/40">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={
              p === page
                ? "grid h-7 min-w-7 place-items-center rounded-md bg-primary px-2 text-[12px] font-semibold text-primary-foreground"
                : btn
            }
          >
            {p}
          </button>
        )
      )}
      <button className={btn} onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} aria-label="Next">
        Next <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
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

// ---------- Status change with confirmation + audit log ----------

function StatusChangeDialog({
  product, storeId, onClose,
}: { product: ProductRow | null; storeId: string | undefined; onClose: () => void }) {
  const open = !!product;
  const update = useUpdateProductStatus(storeId);
  const logsQ = useProductAuditLogs(product?.id);
  const [next, setNext] = useState<ProductStatus>("pending");
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);

  // Reset local state whenever the target product changes.
  useEffect(() => {
    if (product) {
      setNext(product.status);
      setNotes("");
      setConfirming(false);
    }
  }, [product?.id]);


  if (!product) return null;

  const changed = next !== product.status;

  async function apply() {
    if (!product || !changed) return;
    try {
      await update.mutateAsync({ id: product.id, status: next, notes });
      toast.success(`Status updated to ${next}`);
      setConfirming(false);
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update status");
      setConfirming(false);
    }
  }

  return (
    <>
      <Dialog open={open && !confirming} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Change product status</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">{product.name}</span> — current status:{" "}
              <StatusBadge status={product.status} />
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm">New status</Label>
              <RadioGroup
                value={next}
                onValueChange={(v) => setNext(v as ProductStatus)}
                className="mt-2 grid grid-cols-1 gap-2"
              >
                {(["approved", "pending", "rejected"] as const).map((s) => (
                  <label
                    key={s}
                    className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 hover:bg-foreground/[0.03]"
                  >
                    <RadioGroupItem value={s} id={`st-${s}`} />
                    <div className="flex flex-1 items-center justify-between">
                      <span className="text-sm font-medium capitalize">{statusLabel(s)}</span>
                      <StatusBadge status={s} />
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm">Note (optional)</Label>
              <Textarea
                placeholder="Reason for this change (added to the audit log)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-2 min-h-[70px]"
                maxLength={500}
              />
              <p className="mt-1 text-right text-xs text-foreground/50">{notes.length}/500</p>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <History className="h-4 w-4" /> Audit log
              </div>
              <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-muted/20 p-2 text-xs">
                {logsQ.isLoading ? (
                  <div className="p-2 text-foreground/50">Loading…</div>
                ) : (logsQ.data ?? []).length === 0 ? (
                  <div className="p-2 text-foreground/50">No history yet.</div>
                ) : (
                  <ul className="space-y-1.5">
                    {logsQ.data!.map((l) => (
                      <li key={l.id} className="rounded bg-background px-2 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold capitalize">{l.action.replace("_", " ")}</span>
                          <span className="text-foreground/50">
                            {new Date(l.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-0.5 text-foreground/70">
                          {l.old_status && <span>{l.old_status} → </span>}
                          {l.new_status && <span className="font-medium">{l.new_status}</span>}
                          {l.notes && <span className="ml-2 italic text-foreground/60">“{l.notes}”</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={update.isPending}>Cancel</Button>
            <Button onClick={() => setConfirming(true)} disabled={!changed || update.isPending}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirming} onOpenChange={(o) => !o && setConfirming(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm status change</AlertDialogTitle>
            <AlertDialogDescription>
              Change status of <span className="font-semibold text-foreground">{product.name}</span> from{" "}
              <span className="font-semibold">{product.status}</span> to{" "}
              <span className="font-semibold">{next}</span>? This will be recorded in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={update.isPending}>Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); apply(); }}
              disabled={update.isPending}
            >
              {update.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function statusLabel(s: ProductStatus): string {
  if (s === "approved") return "Active (Approved)";
  if (s === "pending") return "Pending review";
  return "Inactive (Rejected)";
}
