import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Copy, Check, Pencil, Store as StoreIcon, PlusCircle, X, Upload, Loader2, Trash2, Search, Truck, ShoppingBag, Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMyStore, uploadProductImage, useIsSuperAdmin } from "@/lib/eazystore-data";
import { useCategories } from "@/lib/categories-data";
import { copyResellerProductToMyStore } from "@/lib/reseller-copy.functions";
import { submitProductRequest } from "@/lib/product-requests.functions";
import { revokeResellerProduct } from "@/lib/admin-settings.functions";
import { useI18n } from "@/lib/i18n";
import { sortOutOfStockToBottom, computeIsOutOfStock } from "@/lib/stock-sync-core";



export const Route = createFileRoute("/_authenticated/reseller-products")({
  component: ResellerProductsPage,
});

type ResellerRow = {
  id: string;
  external_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  image: string | null;
  price: number;
  reseller_price: number | null;
  category: string | null;
  source: string | null;
  updated_at: string;
  price_overridden: boolean | null;
  image_overridden: boolean | null;
  stock: number;
};

const ALL = "__all__";
const UNCAT = "__uncat__";

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return `৳${Number(n).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

type UserSetting = {
  id: string;
  reseller_product_id: string;
  custom_price: number | null;
  custom_description: string | null;
  custom_image: string | null;
};

type DisplayRow = ResellerRow & {
  displayPrice: number | null;
  displayImage: string | null;
  displayDescription: string | null;
  isCustom: boolean;
  customSettingId: string | null;
};

const PRIMARY_SUPPLIER = "Sylheti Online Shop";

function SupplierStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}


function ResellerProductsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<string>(ALL);
  const [supplier, setSupplier] = useState<string>(ALL);
  const [search, setSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [supplierSearch, setSupplierSearch] = useState<string>("");
  const [supplierSort, setSupplierSort] = useState<string>("recommended");





  const userQ = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });
  const userId = userQ.data?.id ?? null;
  const myStoreQ = useMyStore();
  const storeId = myStoreQ.data?.id ?? null;
  const isSuperAdmin = useIsSuperAdmin();

  // LEFT JOIN reseller_products ← user_reseller_settings (only current user's row).
  // PostgREST embeds are LEFT JOINs by default; the .eq filter on the embedded
  // resource limits which child rows attach without dropping parents.
  const q = useQuery({
    enabled: !!userId,
    queryKey: ["reseller_products", userId],
    queryFn: async (): Promise<DisplayRow[]> => {
      const { data, error } = await supabase
        .from("reseller_products")
        .select(
          "id, external_id, name, description, image_url, image, price, reseller_price, category, source, updated_at, price_overridden, image_overridden, stock, user_reseller_settings(id, custom_price, custom_description, custom_image, user_id)",
        )
        .eq("user_reseller_settings.user_id", userId as string)
        .order("updated_at", { ascending: false });
      if (error) throw error;

      return ((data ?? []) as unknown as Array<
        ResellerRow & { user_reseller_settings: UserSetting[] | null }
      >).map((r) => {
        const s = r.user_reseller_settings?.[0] ?? null;
        const baseImg = r.image_url ?? r.image;
        return {
          ...r,
          displayPrice: s?.custom_price ?? r.reseller_price,
          displayImage: s?.custom_image ?? baseImg,
          displayDescription: s?.custom_description ?? r.description,
          isCustom: !!s,
          customSettingId: s?.id ?? null,
        };
      });
    },
  });

  const merged = q.data ?? [];

  const suppliers = useMemo(() => {
    const map = new Map<string, { name: string; count: number; logo: string | null }>();
    for (const r of merged) {
      const name = (r.source && r.source.trim()) || PRIMARY_SUPPLIER;
      const existing = map.get(name);
      if (existing) {
        existing.count += 1;
        if (!existing.logo && r.displayImage) existing.logo = r.displayImage;
      } else {
        map.set(name, { name, count: 1, logo: r.displayImage ?? null });
      }
    }
    const list = Array.from(map.values());
    const term = supplierSearch.trim().toLowerCase();
    const filtered = term ? list.filter((s) => s.name.toLowerCase().includes(term)) : list;
    filtered.sort((a, b) => {
      // Sylheti Online Shop always first
      if (a.name === PRIMARY_SUPPLIER) return -1;
      if (b.name === PRIMARY_SUPPLIER) return 1;
      if (supplierSort === "most-products") return b.count - a.count;
      if (supplierSort === "name") return a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
    return filtered;
  }, [merged, supplierSearch, supplierSort]);


  const bySupplier = useMemo(() => {
    if (supplier === ALL) return merged;
    return merged.filter((r) => ((r.source && r.source.trim()) || PRIMARY_SUPPLIER) === supplier);
  }, [merged, supplier]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    let hasUncat = false;
    for (const r of bySupplier) {
      if (r.category && r.category.trim()) set.add(r.category.trim());
      else hasUncat = true;
    }
    return { list: Array.from(set).sort((a, b) => a.localeCompare(b)), hasUncat };
  }, [bySupplier]);

  const filtered = useMemo(() => {
    let base =
      tab === ALL
        ? bySupplier
        : tab === UNCAT
          ? bySupplier.filter((r) => !r.category || !r.category.trim())
          : bySupplier.filter((r) => r.category === tab);

    const term = search.trim().toLowerCase();
    if (term) {
      base = base.filter(
        (r) =>
          r.name.toLowerCase().includes(term) ||
          (r.description ?? "").toLowerCase().includes(term) ||
          (r.category ?? "").toLowerCase().includes(term),
      );
    }

    const sorted = [...base];
    if (sortBy === "price-asc") {
      sorted.sort((a, b) => (a.displayPrice ?? Infinity) - (b.displayPrice ?? Infinity));
    } else if (sortBy === "price-desc") {
      sorted.sort((a, b) => (b.displayPrice ?? -Infinity) - (a.displayPrice ?? -Infinity));
    } else if (sortBy === "stock-desc") {
      sorted.sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0));
    } else if (sortBy === "stock-asc") {
      sorted.sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
    } else if (sortBy === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    // Out-of-stock always pushed to the bottom regardless of sort.
    return sortOutOfStockToBottom(sorted);
  }, [bySupplier, tab, search, sortBy]);



  // Deep link support: /reseller-products?highlight=<id> — scrolls to and
  // temporarily rings the matching card.
  const [highlightId, setHighlightId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("highlight");
    if (!id) return;
    setHighlightId(id);
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-rp-id="${id}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
    const clear = setTimeout(() => setHighlightId(null), 4000);
    return () => { clearTimeout(timer); clearTimeout(clear); };
  }, [q.data]);

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reseller Products</h1>
          <p className="text-sm text-muted-foreground">
            Products marked "Add to Reseller Marketplace" or synced from your Product Sales site.
            Your edits stay in your shop only.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {q.data && <Badge variant="secondary">{q.data.length} items</Badge>}
          <RequestProductButton />
        </div>
      </header>
      <MyRequestsStrip />

      <section className="mb-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold">Supplier Catalog</h2>
          <p className="text-sm text-muted-foreground">
            Choose a supplier to browse their products and add to your store
          </p>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              placeholder="Search suppliers..."
              className="h-9 pl-9"
            />
          </div>
          <Select value={supplierSort} onValueChange={setSupplierSort}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recommended">Recommended</SelectItem>
              <SelectItem value="most-products">Most Products</SelectItem>
              <SelectItem value="name">Name (A–Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p className="mb-3 text-xs text-muted-foreground">
          {suppliers.length} supplier{suppliers.length === 1 ? "" : "s"} available
        </p>

        {q.isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl border bg-muted/40" />
            ))}
          </div>
        ) : suppliers.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No suppliers found.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <button
              type="button"
              onClick={() => { setSupplier(ALL); setTab(ALL); setSearch(""); }}
              className={`rounded-xl border bg-card p-4 text-left transition-all hover:shadow-md ${
                supplier === ALL ? "border-primary ring-2 ring-primary/20" : "border-border"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <StoreIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold">All Suppliers</h3>
                  <span className="mt-0.5 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                    Everything
                  </span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                <SupplierStat icon={Package} label="Products" value={String(merged.length)} />
                <SupplierStat icon={Truck} label="Delivery" value="৳0" />
                <SupplierStat icon={Star} label="Orders" value="0" />
              </div>
            </button>

            {suppliers.map((s) => {
              const active = supplier === s.name;
              return (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => { setSupplier(s.name); setTab(ALL); setSearch(""); }}
                  className={`rounded-xl border bg-card p-4 text-left transition-all hover:shadow-md ${
                    active ? "border-primary ring-2 ring-primary/20" : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                      {s.logo ? (
                        <img src={s.logo} alt={s.name} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <StoreIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold">{s.name}</h3>
                      <span className="mt-0.5 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                        Standard
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    <SupplierStat icon={Package} label="Products" value={String(s.count)} />
                    <SupplierStat icon={Truck} label="Delivery" value="৳0" />
                    <SupplierStat icon={Star} label="Orders" value="0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>





      {(q.data?.length ?? 0) > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="h-9 pr-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="name">Name (A–Z)</SelectItem>
              <SelectItem value="price-asc">Price: Low → High</SelectItem>
              <SelectItem value="price-desc">Price: High → Low</SelectItem>
              <SelectItem value="stock-desc">Stock: High → Low</SelectItem>
              <SelectItem value="stock-asc">Stock: Low → High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {(q.data?.length ?? 0) > 0 && (
        <Tabs value={tab} onValueChange={setTab} className="mb-3">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value={ALL}>All</TabsTrigger>
            {categories.list.map((c) => (
              <TabsTrigger key={c} value={c}>{c}</TabsTrigger>
            ))}
            {categories.hasUncat && <TabsTrigger value={UNCAT}>Uncategorized</TabsTrigger>}
          </TabsList>
        </Tabs>
      )}

      {q.isLoading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-lg border bg-card">
              <div className="aspect-square animate-pulse bg-muted" />
              <div className="space-y-1.5 p-2">
                <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                <div className="h-6 w-full animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : q.error ? (
        <p className="text-sm text-destructive">Failed to load: {(q.error as Error).message}</p>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 p-8 text-center">
          <Package className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">
            {search
              ? `No products match "${search}"`
              : supplier !== ALL
                ? `No products from ${supplier} yet`
                : "No reseller products in this category"}
          </p>
          <p className="text-xs text-muted-foreground">
            {search || supplier !== ALL
              ? "Try clearing filters or picking another supplier."
              : "Check back soon or request a product from the Sylheti team."}
          </p>
          {(search || supplier !== ALL || tab !== ALL) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => { setSearch(""); setSupplier(ALL); setTab(ALL); }}
            >
              Clear filters
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((p) => {
            const img = p.displayImage;
            const outOfStock = computeIsOutOfStock(p.stock);
            const shareUrl =
              typeof window !== "undefined"
                ? `${window.location.origin}/r/${p.external_id}`
                : `/r/${p.external_id}`;
            return (
              <Card
                key={p.id}
                data-rp-id={p.id}
                className={`overflow-hidden transition-shadow ${outOfStock ? "opacity-60 grayscale" : ""} ${highlightId === p.id ? "ring-2 ring-primary shadow-lg" : ""}`}
                aria-disabled={outOfStock || undefined}
              >
                <div className="relative aspect-square bg-muted">
                  {img ? (
                    <img src={img} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-muted-foreground">
                      <Package className="h-6 w-6" />
                    </div>
                  )}
                  {outOfStock && (
                    <div className="pointer-events-none absolute inset-0 flex items-start justify-center bg-black/30 pt-2">
                      <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg">
                        {t("outOfStock")}
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 p-2">
                  <h3 className="line-clamp-2 text-xs font-semibold leading-tight">{p.name}</h3>
                  <div className="flex items-baseline justify-between gap-1">
                    <p className="text-[11px] font-medium line-through opacity-60">{fmt(p.price)}</p>
                    <p className="text-sm font-bold text-primary">{fmt(p.displayPrice)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {p.category && (
                      <Badge variant="secondary" className="px-1.5 py-0 text-[9px]">{p.category}</Badge>
                    )}
                    {p.isCustom && (
                      <Badge className="px-1.5 py-0 text-[9px]">My shop</Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <CopyLinkButton url={shareUrl} row={p} storeId={storeId} />
                    {storeId && <AddToMyShopButton row={p} storeId={storeId} disabled={outOfStock} />}
                    {userId && <EditResellerButton row={p} userId={userId} />}
                    {isSuperAdmin.data && <AdminRevokeButton row={p} />}
                  </div>

                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CopyLinkButton({
  url,
  row,
  storeId,
}: {
  url: string;
  row: DisplayRow;
  storeId: string | null;
}) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function copyToMyProducts() {
    if (!storeId) return { skipped: true as const, reason: "no-store" };
    // Server enforces validation (price, quantity, category, warranty/serial),
    // dedup, RLS, and writes an audit log entry for every attempt.
    const res = await copyResellerProductToMyStore({
      data: { reseller_product_id: row.id },
    });
    if (res.skipped) return { skipped: true as const, reason: "exists" };
    return { skipped: false as const };
  }

  async function onCopy() {
    setBusy(true);
    let linkCopied = false;
    try {
      try {
        await navigator.clipboard.writeText(url);
        linkCopied = true;
      } catch {
        // Non-fatal — still attempt the product copy.
      }

      const result = await copyToMyProducts();
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);

      const linkPart = linkCopied ? "Link copied" : "Link copy failed";
      if (result.skipped && result.reason === "exists") {
        toast.success(`${linkPart} · already in your products`);
      } else if (result.skipped && result.reason === "no-store") {
        toast.success(linkPart);
      } else {
        toast.success(`${linkPart} · added to your products`);
        qc.invalidateQueries({ queryKey: ["products"] });
      }
    } catch (e) {
      const msg = (e as Error).message || "Copy failed";
      if (linkCopied) {
        toast.error(`Link copied, but product copy failed: ${msg}`);
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="mt-1 w-full gap-1.5"
      onClick={onCopy}
      disabled={busy}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : busy ? "Copying…" : "Copy Link"}
    </Button>
  );
}

function EditResellerButton({ row, userId }: { row: DisplayRow; userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState<string>(row.displayPrice != null ? String(row.displayPrice) : "");
  const [image, setImage] = useState<string>(row.displayImage ?? "");
  const [desc, setDesc] = useState<string>(row.displayDescription ?? "");

  useEffect(() => {
    if (open) {
      setPrice(row.displayPrice != null ? String(row.displayPrice) : "");
      setImage(row.displayImage ?? "");
      setDesc(row.displayDescription ?? "");
    }
  }, [open, row]);

  const settingsKey = ["reseller_products", userId];

  const save = useMutation({
    mutationFn: async () => {
      const parsedPrice = price.trim() === "" ? null : Number(price);
      if (parsedPrice != null && !Number.isFinite(parsedPrice)) throw new Error("Invalid price");
      const trimmedImg = image.trim() || null;
      const trimmedDesc = desc.trim() || null;

      // Only store fields that differ from the base reseller_products row.
      const basePrice = row.reseller_price ?? null;
      const baseImg = row.image_url ?? row.image ?? null;
      const baseDesc = row.description ?? null;

      const payload = {
        user_id: userId,
        reseller_product_id: row.id,
        custom_price: parsedPrice !== basePrice ? parsedPrice : null,
        custom_image: trimmedImg !== baseImg ? trimmedImg : null,
        custom_description: trimmedDesc !== baseDesc ? trimmedDesc : null,
      };

      const { error } = await supabase
        .from("user_reseller_settings")
        .upsert(payload, { onConflict: "user_id,reseller_product_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved to your shop");
      qc.invalidateQueries({ queryKey: settingsKey });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = useMutation({
    mutationFn: async () => {
      if (!row.customSettingId) return;
      const { error } = await supabase
        .from("user_reseller_settings")
        .delete()
        .eq("id", row.customSettingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reverted to default reseller data");
      qc.invalidateQueries({ queryKey: settingsKey });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-1 w-full gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-3.5 w-3.5" /> Edit
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Customize for your shop</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="rp-price">Your Price</Label>
            <Input
              id="rp-price"
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
            <p className="text-[11px] text-muted-foreground">
              Default reseller price: ৳{Number(row.reseller_price ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="rp-desc">Your Description</Label>
            <textarea
              id="rp-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder={row.description ?? "Describe this product for your shop"}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rp-image">Your Image URL</Label>
            <Input
              id="rp-image"
              type="url"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://..."
            />
            {image && (
              <img src={image} alt="preview" className="mt-2 h-24 w-24 rounded-md object-cover" />
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Only you see these values. The original product and shared reseller catalog are not modified.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={reset.isPending || !row.isCustom}
            onClick={() => reset.mutate()}
          >
            Revert to default
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type MediaItem = { url: string; kind: "image" | "video" };

function AddToMyShopButton({ row, storeId, disabled }: { row: DisplayRow; storeId: string; disabled?: boolean }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<string>("");
  const [price, setPrice] = useState<string>(
    row.displayPrice != null ? String(row.displayPrice) : row.reseller_price != null ? String(row.reseller_price) : "",
  );
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const catsQ = useCategories(storeId);
  const categories = catsQ.data ?? [];

  // Detect if this reseller product is already listed in the user's store.
  const alreadyAddedQ = useQuery({
    enabled: !!storeId && !!row.id,
    queryKey: ["reseller-already-added", storeId, row.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("source_reseller_product_id", row.id);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });
  const alreadyAdded = alreadyAddedQ.data === true;

  // Fetch original product's media (images + video). reseller_products.external_id
  // holds the original product's UUID.
  const mediaQ = useQuery({
    enabled: open && !!row.external_id,
    queryKey: ["reseller-product-media", row.external_id],
    queryFn: async (): Promise<MediaItem[]> => {
      const { data } = await supabase
        .from("products")
        .select("image_url, video_url, gallery_urls")
        .eq("id", row.external_id)
        .maybeSingle();
      const items: MediaItem[] = [];
      const seen = new Set<string>();
      const pushImg = (u: string | null | undefined) => {
        if (u && !seen.has(u)) { seen.add(u); items.push({ url: u, kind: "image" }); }
      };
      pushImg(data?.image_url ?? row.image_url ?? row.image);
      (data?.gallery_urls ?? []).forEach(pushImg);
      if (data?.video_url && !seen.has(data.video_url)) {
        seen.add(data.video_url);
        items.push({ url: data.video_url, kind: "video" });
      }
      return items;
    },
  });
  const media = mediaQ.data ?? [];

  useEffect(() => {
    if (open) {
      setCategoryId("");
      setExcluded(new Set());
      setPrice(
        row.displayPrice != null
          ? String(row.displayPrice)
          : row.reseller_price != null
            ? String(row.reseller_price)
            : "",
      );
    }
  }, [open, row]);

  const trimmedName = row.name?.trim() ?? "";
  const parsedPrice = Number(price);
  const priceValid = price.trim() !== "" && Number.isFinite(parsedPrice) && parsedPrice >= 0;
  const selectedMedia = media.filter((m) => !excluded.has(m.url));
  const canSubmit =
    !!categoryId && priceValid && trimmedName.length > 0 && categories.length > 0;

  const toggleMedia = (url: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const add = useMutation({
    mutationFn: async () => {
      if (!trimmedName) throw new Error("পণ্যের নাম নেই / Product name missing");
      if (!categoryId) throw new Error("অনুগ্রহ করে একটি ক্যাটাগরি নির্বাচন করুন / Please select a category");
      if (price.trim() === "" || !Number.isFinite(parsedPrice)) {
        throw new Error("সঠিক দাম লিখুন / Enter a valid price");
      }
      if (parsedPrice < 0) throw new Error("দাম ঋণাত্মক হতে পারে না / Price cannot be negative");

      return copyResellerProductToMyStore({
        data: {
          reseller_product_id: row.id,
          category_id: categoryId,
          custom_price: parsedPrice,
          // If media list is empty (older products), send null → copy defaults.
          selected_media: media.length > 0 ? selectedMedia.map((m) => m.url) : null,
        },
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["reseller-already-added", storeId, row.id] });
      if (res.skipped) {
        toast.info("এই পণ্যটি আগে থেকেই আপনার ওয়েবসাইটে আছে / This product is already on your website");
      } else {
        toast.success("আপনার শপে সফলভাবে যোগ করা হয়েছে! / Product added to your shop successfully!");
        qc.invalidateQueries({ queryKey: ["products"] });
      }
      setOpen(false);
    },
    onError: (e: unknown) => {
      if (e instanceof Response && e.status === 403) {
        toast.error("অনুমতি নেই (403) / You are not allowed to add this product");
        return;
      }
      const msg = (e as Error)?.message || "";
      if (/forbidden/i.test(msg) || /403/.test(msg)) {
        toast.error("অনুমতি নেই (403) / " + msg);
        return;
      }
      toast.error(msg || "যোগ করা যায়নি / Failed to add");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size="sm"
        variant={alreadyAdded ? "secondary" : "default"}
        className="mt-1 w-full gap-1.5"
        onClick={() => {
          if (alreadyAdded) {
            toast.info("এই পণ্যটি আগে থেকেই আপনার ওয়েবসাইটে আছে / This product is already on your website");
            return;
          }
          setOpen(true);
        }}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        title={
          disabled
            ? t("outOfStockFromSupplier")
            : alreadyAdded
              ? "Already on your website"
              : undefined
        }
      >
        <StoreIcon className="h-3.5 w-3.5" />{" "}
        {disabled
          ? t("outOfStock")
          : alreadyAdded
            ? "ওয়েবসাইটে আছে / Already added"
            : t("addToMyShop")}
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>আমার শপে যোগ করুন / Add to My Shop</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>পণ্য / Product</Label>
            <p className="text-sm text-muted-foreground">{row.name}</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="ams-category">ক্যাটাগরি নির্বাচন করুন / Select Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="ams-category">
                <SelectValue
                  placeholder={
                    catsQ.isLoading
                      ? "লোড হচ্ছে… / Loading…"
                      : "একটি ক্যাটাগরি বেছে নিন / Choose a category"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {categories.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    কোনো ক্যাটাগরি নেই। আগে ক্যাটাগরি তৈরি করুন। / No categories yet.
                  </div>
                ) : (
                  categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {!categoryId && (
              <p className="text-[11px] text-destructive">
                ক্যাটাগরি আবশ্যক / Category is required
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="ams-price">আপনার বিক্রয় মূল্য / Your Selling Price</Label>
            <Input
              id="ams-price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              aria-invalid={price.trim() !== "" && !priceValid}
            />
            {price.trim() !== "" && !priceValid && (
              <p className="text-[11px] text-destructive">
                সঠিক ধনাত্মক মূল্য দিন / Enter a valid non-negative price
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              রিসেলার মূল্য / Reseller: ৳{Number(row.reseller_price ?? 0).toLocaleString()} · মূল /
              Original: ৳{Number(row.price ?? 0).toLocaleString()}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>মিডিয়া নির্বাচন করুন / Select Media to Import</Label>
              {!mediaQ.isLoading && media.length > 0 && (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setExcluded(new Set())}
                    disabled={excluded.size === 0}
                  >
                    সব নির্বাচন / Select all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setExcluded(new Set(media.map((m) => m.url)))}
                    disabled={selectedMedia.length === 0}
                  >
                    সব বাদ / Clear
                  </Button>
                </div>
              )}
            </div>
            {mediaQ.isLoading ? (
              <div className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                মিডিয়া লোড হচ্ছে… / Loading media…
              </div>
            ) : media.length === 0 ? (
              <div className="flex flex-col items-center gap-1 rounded-md border border-dashed p-6 text-center">
                <Package className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium">
                  কোনো ছবি বা ভিডিও নেই / No images or videos available
                </p>
                <p className="text-[11px] text-muted-foreground">
                  এই পণ্যটির সাথে কোনো মিডিয়া কপি করার জন্য নেই।
                </p>
              </div>
            ) : (

              <>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {media.map((m) => {
                    const checked = !excluded.has(m.url);
                    return (
                      <label
                        key={m.url}
                        className={`relative block cursor-pointer overflow-hidden rounded-md border-2 ${
                          checked ? "border-primary" : "border-muted opacity-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="absolute right-1 top-1 z-10 h-4 w-4"
                          checked={checked}
                          onChange={() => toggleMedia(m.url)}
                        />
                        {m.kind === "image" ? (
                          <img src={m.url} alt="" className="aspect-square w-full object-cover" />
                        ) : (
                          <video
                            src={m.url}
                            className="aspect-square w-full bg-black object-cover"
                            muted
                          />
                        )}
                        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] text-white">
                          {m.kind === "image" ? "IMG" : "VIDEO"}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {selectedMedia.length} / {media.length} নির্বাচিত / selected
                </p>
              </>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            বাতিল / Cancel
          </Button>
          <Button
            type="button"
            onClick={() => add.mutate()}
            disabled={add.isPending || !canSubmit}
          >
            {add.isPending ? "যোগ করা হচ্ছে… / Adding…" : "নিশ্চিত করুন / Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------- Request Product --------

type MyRequestRow = {
  id: string;
  name: string;
  price: number;
  status: "pending" | "approved" | "rejected";
  reseller_price: number | null;
  admin_notes: string | null;
  created_at: string;
};

function useMyRequests() {
  return useQuery({
    queryKey: ["my-product-requests"],
    queryFn: async (): Promise<MyRequestRow[]> => {
      const { data, error } = await supabase
        .from("product_requests")
        .select("id, name, price, status, reseller_price, admin_notes, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MyRequestRow[];
    },
  });
}

function MyRequestsStrip() {
  const rq = useMyRequests();
  // Hide approved requests — once approved, the product appears in the marketplace list above.
  const rows = (rq.data ?? []).filter((r) => r.status !== "approved");
  if (rows.length === 0) return null;
  return (
    <div className="mb-4 space-y-2">
      <h2 className="text-sm font-semibold">My Product Requests</h2>
      <div className="flex flex-wrap gap-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
            <div className="font-medium">{r.name}</div>
            <div className="mt-0.5 flex items-center gap-2">
              <Badge
                variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}
                className="text-[10px]"
              >
                {r.status}
              </Badge>
              <span className="text-muted-foreground">{fmt(r.price)}</span>
              {r.reseller_price != null && (
                <span className="text-primary">→ {fmt(r.reseller_price)}</span>
              )}
            </div>
            {r.admin_notes && <div className="mt-1 text-muted-foreground">{r.admin_notes}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestProductButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" variant="outline" className="gap-1">
        <PlusCircle className="h-4 w-4" /> Request Product
      </Button>
      {open && <RequestProductDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}

function RequestProductDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const MAX_IMAGES = 8;
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB per image
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  const trimmedName = name.trim();
  const trimmedDesc = description.trim();
  const priceNum = Number(price);

  const errors: string[] = [];
  if (trimmedName.length < 2) errors.push("Name must be at least 2 characters");
  if (trimmedName.length > 120) errors.push("Name too long (max 120)");
  if (trimmedDesc.length > 2000) errors.push("Description too long (max 2000)");
  if (price.trim().length === 0 || !Number.isFinite(priceNum)) errors.push("Enter a valid price");
  else if (priceNum < 0) errors.push("Price cannot be negative");
  else if (priceNum > 10_000_000) errors.push("Price too large");
  const canSubmit = errors.length === 0 && !uploading;

  async function onPickFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast.error(`Max ${MAX_IMAGES} images`);
      return;
    }
    const list = Array.from(files).slice(0, remaining);
    for (const f of list) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        toast.error(`${f.name}: unsupported type (JPEG/PNG/WEBP/GIF only)`);
        return;
      }
      if (f.size > MAX_IMAGE_BYTES) {
        toast.error(`${f.name}: exceeds 5 MB limit`);
        return;
      }
    }
    setUploading(true);
    try {
      const uploads = await Promise.all(list.map((f) => uploadProductImage(f)));
      setImages((prev) => [...prev, ...uploads.map((u) => u.publicUrl)].slice(0, MAX_IMAGES));
    } catch (e) {
      toast.error(`Upload failed: ${(e as Error).message}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const submit = useMutation({
    mutationFn: async () => {
      await submitProductRequest({
        data: {
          name: trimmedName,
          description: trimmedDesc || null,
          price: priceNum,
          images,
        },
      });
    },
    onSuccess: () => {
      toast.success("অনুরোধ জমা হয়েছে! / Product request submitted!");
      qc.invalidateQueries({ queryKey: ["my-product-requests"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a Product / পণ্যের অনুরোধ</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name" />
          </div>
          <div>
            <Label>Price (৳) *</Label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional details"
            />
          </div>
          <div>
            <Label>Images</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {images.map((url) => (
                <div key={url} className="relative">
                  <img src={url} alt="" className="h-16 w-16 rounded-md object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((p) => p.filter((x) => x !== url))}
                    className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border border-dashed border-border text-muted-foreground hover:bg-muted">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={(e) => onPickFiles(e.target.files)}
                />
              </label>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              JPEG/PNG/WEBP/GIF · up to 5 MB · max 8 images
            </p>
          </div>
          {errors.length > 0 && (
            <ul className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
              {errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel / বাতিল
          </Button>
          <Button onClick={() => submit.mutate()} disabled={!canSubmit || submit.isPending || uploading}>
            {submit.isPending ? "Submitting…" : "Submit / জমা দিন"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function AdminRevokeButton({ row }: { row: DisplayRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: async () =>
      revokeResellerProduct({ data: { id: row.id, reason: reason.trim() || undefined } }),
    onSuccess: () => {
      toast.success(`"${row.name}" deleted from the marketplace.`);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["reseller_products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["my-products"] });
      qc.invalidateQueries({ queryKey: ["public-store"] });
      qc.invalidateQueries({ queryKey: ["admin", "reseller-audit-logs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        className="mt-1 gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete "{row.name}" from marketplace?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This permanently removes the product from the reseller marketplace, unlists it from every reseller shop that added it, and notifies the affected resellers. This cannot be undone.
        </p>
        <div className="space-y-1">
          <Label>Reason (optional, shared with resellers)</Label>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Quality standards not met"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" disabled={m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "Deleting…" : "Delete product"}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
