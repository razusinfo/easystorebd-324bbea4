import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Search, Package, Store as StoreIcon, ChevronLeft, ChevronRight, PencilLine, PlusCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { normalizeSupplier, PRIMARY_SUPPLIER } from "@/lib/marketplace-supplier";
import { copyResellerProductToMyStore } from "@/lib/reseller-copy.functions";
import { updateMyStorePriceForResellerProduct } from "@/lib/marketplace-actions.functions";
import { useMyStore } from "@/lib/eazystore-data";

export const Route = createFileRoute("/_authenticated/supplier-marketplace")({
  head: () => ({
    meta: [
      { title: "Supplier Marketplace — EasyStore" },
      { name: "description", content: "Browse supplier products and add them to your store with your own retail price." },
    ],
  }),
  component: SupplierMarketplacePage,
});

const ALL = "__all__";
const PAGE_SIZE = 24;

type Row = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  image: string | null;
  price: number;
  reseller_price: number | null;
  category: string | null;
  source: string | null;
  stock: number;
  original_product_id: string | null;
  gallery_urls: string[] | null;
};

type OriginalMeta = { id: string; sku: string | null; product_serial: string | null; brand: string | null; supplier_id: string | null };
type SupplierOption = { id: string; name: string };

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return `৳${Number(n).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

function SupplierMarketplacePage() {
  const qc = useQueryClient();
  const { data: myStore } = useMyStore();

  const [search, setSearch] = useState("");
  const [supplier, setSupplier] = useState<string>(ALL);
  const [category, setCategory] = useState<string>(ALL);
  const [page, setPage] = useState(1);

  const productsQuery = useQuery({
    queryKey: ["supplier-marketplace", "reseller_products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reseller_products")
        .select("id,name,description,image_url,image,price,reseller_price,category,source,stock,original_product_id,gallery_urls")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  // Fetch original product metadata (SKU / IMEI / brand) for rows that link back
  // to a source product, so cards can display it.
  const originalIds = useMemo(
    () => Array.from(new Set((productsQuery.data ?? []).map((r) => r.original_product_id).filter(Boolean))) as string[],
    [productsQuery.data],
  );
  const originalsQuery = useQuery({
    queryKey: ["supplier-marketplace", "originals", originalIds.slice(0).sort().join(",")],
    enabled: originalIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,sku,product_serial,brand,supplier_id")
        .in("id", originalIds);
      if (error) throw error;
      const map = new Map<string, OriginalMeta>();
      for (const p of (data ?? []) as OriginalMeta[]) map.set(p.id, p);
      return map;
    },
  });

  // Resolve supplier display names from profiles for every supplier_id seen.
  const supplierIds = useMemo(() => {
    const s = new Set<string>();
    for (const meta of originalsQuery.data?.values() ?? []) {
      if (meta.supplier_id) s.add(meta.supplier_id);
    }
    return Array.from(s);
  }, [originalsQuery.data]);
  const suppliersProfilesQuery = useQuery({
    queryKey: ["supplier-marketplace", "supplier-profiles", supplierIds.slice(0).sort().join(",")],
    enabled: supplierIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,name,store").in("id", supplierIds);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const p of (data ?? []) as Array<{ id: string; name: string | null; store: string | null }>) {
        map.set(p.id, p.store || p.name || "Supplier");
      }
      return map;
    },
  });

  // Helper: resolve display supplier for a given row via supplier_id
  // (preferred, joined through products.supplier_id) with a fallback to the
  // legacy `source` string when the row has no linked original product.
  const supplierIdOf = (r: Row): string | null => {
    if (!r.original_product_id) return null;
    return originalsQuery.data?.get(r.original_product_id)?.supplier_id ?? null;
  };
  const supplierNameOf = (r: Row): string => {
    const id = supplierIdOf(r);
    if (id) return suppliersProfilesQuery.data?.get(id) ?? "Supplier";
    return normalizeSupplier(r.source);
  };

  // What the reseller already has in their store — keyed by source_reseller_product_id.
  const addedQuery = useQuery({
    queryKey: ["supplier-marketplace", "added", myStore?.id ?? null],
    enabled: !!myStore?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, price, source_reseller_product_id")
        .eq("store_id", myStore!.id)
        .not("source_reseller_product_id", "is", null);
      if (error) throw error;
      const map = new Map<string, { id: string; price: number }>();
      for (const p of (data ?? []) as Array<{ id: string; price: number; source_reseller_product_id: string }>) {
        map.set(p.source_reseller_product_id, { id: p.id, price: Number(p.price) });
      }
      return map;
    },
  });

  // Supplier options keyed by supplier_id (from products.supplier_id via the
  // originals join). Rows without a linked original fall back to their
  // legacy `source` string keyed by "src:<name>" so they remain filterable.
  const suppliers = useMemo<SupplierOption[]>(() => {
    const byId = new Map<string, SupplierOption>();
    for (const r of productsQuery.data ?? []) {
      const id = supplierIdOf(r);
      if (id) {
        if (!byId.has(id)) {
          byId.set(id, { id, name: suppliersProfilesQuery.data?.get(id) ?? "Supplier" });
        }
      } else {
        const name = normalizeSupplier(r.source);
        const key = `src:${name}`;
        if (!byId.has(key)) byId.set(key, { id: key, name });
      }
    }
    return Array.from(byId.values()).sort((a, b) => {
      if (a.name === PRIMARY_SUPPLIER) return -1;
      if (b.name === PRIMARY_SUPPLIER) return 1;
      return a.name.localeCompare(b.name);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productsQuery.data, originalsQuery.data, suppliersProfilesQuery.data]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const r of productsQuery.data ?? []) {
      const c = (r.category ?? "").trim();
      if (c) s.add(c);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [productsQuery.data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (productsQuery.data ?? []).filter((r) => {
      if (supplier !== ALL) {
        const id = supplierIdOf(r);
        const key = id ?? `src:${normalizeSupplier(r.source)}`;
        if (key !== supplier) return false;
      }
      if (category !== ALL && (r.category ?? "").trim() !== category) return false;
      if (term) {
        const orig = r.original_product_id ? originalsQuery.data?.get(r.original_product_id) : null;
        const hay = [
          r.name,
          r.category ?? "",
          supplierNameOf(r),
          orig?.sku ?? "",
          orig?.product_serial ?? "",
          orig?.brand ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productsQuery.data, originalsQuery.data, suppliersProfilesQuery.data, search, supplier, category]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset to page 1 whenever filters change.
  const filterKey = `${search}|${supplier}|${category}`;
  useMemoResetPage(filterKey, setPage);

  const [addOpen, setAddOpen] = useState<Row | null>(null);
  const [editOpen, setEditOpen] = useState<{ row: Row; currentPrice: number } | null>(null);

  const addMutation = useMutation({
    mutationFn: async (args: { reseller_product_id: string; custom_price: number }) => {
      const res = await copyResellerProductToMyStore({ data: args });
      return res;
    },
    onSuccess: (res) => {
      if (res.skipped) {
        toast.info("Already in your store — you can edit the retail price.");
      } else {
        toast.success("Added to your store");
      }
      qc.invalidateQueries({ queryKey: ["supplier-marketplace", "added"] });
      setAddOpen(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to add product";
      toast.error(msg);
    },
  });

  const editMutation = useMutation({
    mutationFn: async (args: { reseller_product_id: string; price: number }) => {
      return await updateMyStorePriceForResellerProduct({ data: args });
    },
    onSuccess: () => {
      toast.success("Retail price updated");
      qc.invalidateQueries({ queryKey: ["supplier-marketplace", "added"] });
      setEditOpen(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to update price";
      toast.error(msg);
    },
  });

  return (
    <div className="container mx-auto px-3 py-4 space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Supplier Marketplace</h1>
        <p className="text-sm text-muted-foreground">
          Browse products from all suppliers and add them to your store with your own retail price.
        </p>
      </div>

      {/* Filters */}
      <Card className="p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="relative md:col-span-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, SKU, brand…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              data-testid="marketplace-search"
            />
          </div>
          <Select value={supplier} onValueChange={setSupplier}>
            <SelectTrigger data-testid="marketplace-supplier">
              <SelectValue placeholder="All suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All suppliers</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger data-testid="marketplace-category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>
            {productsQuery.isLoading
              ? "Loading products…"
              : `${filtered.length} product${filtered.length === 1 ? "" : "s"}`}
          </div>
          <div>
            Page {currentPage} of {totalPages}
          </div>
        </div>
      </Card>

      {/* Grid */}
      {productsQuery.isError ? (
        <Card className="p-6 text-center text-sm text-destructive">Failed to load products.</Card>
      ) : pageRows.length === 0 && !productsQuery.isLoading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No products match the current filters.
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {pageRows.map((r) => {
            const supplierName = normalizeSupplier(r.source);
            const orig = r.original_product_id ? originalsQuery.data?.get(r.original_product_id) : null;
            const added = addedQuery.data?.get(r.id) ?? null;
            const image = r.image_url ?? r.image ?? null;
            const price = r.reseller_price ?? r.price;
            const outOfStock = (r.stock ?? 0) <= 0;
            return (
              <Card key={r.id} className="p-2 flex flex-col gap-2" data-testid={`marketplace-card-${r.id}`}>
                <div className="relative aspect-square w-full overflow-hidden rounded bg-muted">
                  {image ? (
                    <img src={image} alt={r.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Package className="h-8 w-8" />
                    </div>
                  )}
                  {outOfStock && (
                    <div className="absolute inset-0 bg-black/50 text-white text-xs flex items-center justify-center font-semibold">
                      Out of stock
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">{r.name}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <StoreIcon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{supplierName}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">{fmt(price)}</span>
                    <span className={outOfStock ? "text-destructive" : "text-muted-foreground"}>
                      Stock: {r.stock ?? 0}
                    </span>
                  </div>
                  {(orig?.sku || orig?.product_serial) && (
                    <div className="text-[10px] text-muted-foreground truncate">
                      {orig?.sku && <span>SKU: {orig.sku}</span>}
                      {orig?.sku && orig?.product_serial && <span> · </span>}
                      {orig?.product_serial && <span>IMEI: {orig.product_serial}</span>}
                    </div>
                  )}
                  {r.category && (
                    <Badge variant="secondary" className="text-[10px] font-normal">{r.category}</Badge>
                  )}
                </div>
                {added ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setEditOpen({ row: r, currentPrice: added.price })}
                    data-testid={`marketplace-edit-${r.id}`}
                  >
                    <PencilLine className="h-3.5 w-3.5 mr-1" />
                    Edit My Price ({fmt(added.price)})
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={outOfStock}
                    onClick={() => setAddOpen(r)}
                    data-testid={`marketplace-add-${r.id}`}
                  >
                    <PlusCircle className="h-3.5 w-3.5 mr-1" />
                    Add to My Store
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <div className="text-sm">
            Page {currentPage} / {totalPages}
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <AddDialog
        row={addOpen}
        onClose={() => setAddOpen(null)}
        onSubmit={(price) => addOpen && addMutation.mutate({ reseller_product_id: addOpen.id, custom_price: price })}
        loading={addMutation.isPending}
      />
      <EditDialog
        state={editOpen}
        onClose={() => setEditOpen(null)}
        onSubmit={(price) =>
          editOpen && editMutation.mutate({ reseller_product_id: editOpen.row.id, price })
        }
        loading={editMutation.isPending}
      />
    </div>
  );
}

function useMemoResetPage(key: string, setPage: (n: number) => void) {
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

function AddDialog({
  row,
  onClose,
  onSubmit,
  loading,
}: {
  row: Row | null;
  onClose: () => void;
  onSubmit: (price: number) => void;
  loading: boolean;
}) {
  const supplierPrice = row ? (row.reseller_price ?? row.price) : 0;
  const [price, setPrice] = useState<string>("");

  useEffect(() => {
    if (row) setPrice(String(supplierPrice));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id]);

  const priceNum = Number(price);
  const invalid = !Number.isFinite(priceNum) || priceNum < 0;

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to My Store</DialogTitle>
          <DialogDescription>
            Set your retail price for “{row?.name}”. Supplier price: {fmt(supplierPrice)}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="marketplace-add-price">Your retail price (৳)</Label>
          <Input
            id="marketplace-add-price"
            data-testid="marketplace-add-price-input"
            type="number"
            inputMode="decimal"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Your profit per unit: {fmt(Math.max(0, priceNum - supplierPrice))}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            disabled={invalid || loading}
            onClick={() => onSubmit(priceNum)}
            data-testid="marketplace-add-confirm"
          >
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Add to Store
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  state,
  onClose,
  onSubmit,
  loading,
}: {
  state: { row: Row; currentPrice: number } | null;
  onClose: () => void;
  onSubmit: (price: number) => void;
  loading: boolean;
}) {
  const supplierPrice = state ? (state.row.reseller_price ?? state.row.price) : 0;
  const [price, setPrice] = useState<string>("");

  useEffect(() => {
    if (state) setPrice(String(state.currentPrice));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.row.id]);

  const priceNum = Number(price);
  const invalid = !Number.isFinite(priceNum) || priceNum < 0;

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Retail Price</DialogTitle>
          <DialogDescription>
            You already added “{state?.row.name}” to your store. Update your retail price below. Supplier price:
            {" "}{fmt(supplierPrice)}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="marketplace-edit-price">Your retail price (৳)</Label>
          <Input
            id="marketplace-edit-price"
            data-testid="marketplace-edit-price-input"
            type="number"
            inputMode="decimal"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Your profit per unit: {fmt(Math.max(0, priceNum - supplierPrice))}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            disabled={invalid || loading}
            onClick={() => onSubmit(priceNum)}
            data-testid="marketplace-edit-confirm"
          >
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Save Price
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
