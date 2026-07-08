import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Copy, Check, Pencil, Store as StoreIcon, PlusCircle, X, Upload, Loader2, Trash2, Link2, AlertTriangle, Truck, ShieldCheck, Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import eazystoreLogo from "@/assets/sylheti-online-shop-logo.png.asset.json";
import nusratLogo from "@/assets/nusrat-telecom-logo.png.asset.json";



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
const NUSRAT_SUPPLIER = "Nusrat Telecom";
// Internal sync sources that all represent the primary shop, not an external supplier.
const INTERNAL_SOURCES = new Set(["trigger", "internal", "sylheti", "sylheti online shop"]);
// External sources pushed by HisabNikas-24 → surfaced under the Nusrat Telecom supplier.
const NUSRAT_SOURCES = new Set([
  "hisabnikas",
  "hisabnikas-24",
  "hisab-nikas",
  "hisab-nikas-24",
  "hisab nikas",
  "hisab nikas-24",
  "nusrat",
  "nusrat telecom",
]);
function normalizeSupplier(source: string | null | undefined): string {
  const s = (source ?? "").trim();
  if (!s || INTERNAL_SOURCES.has(s.toLowerCase())) return PRIMARY_SUPPLIER;
  if (NUSRAT_SOURCES.has(s.toLowerCase())) return NUSRAT_SUPPLIER;
  return s;
}

function ResellerProductsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<string>(ALL);
  const [supplier, setSupplier] = useState<string>(ALL);
  const [search, setSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [infoSupplier, setInfoSupplier] = useState<string | null>(null);




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

  // Delivered reseller orders — counted live from the DB, plus a fixed baseline
  // so historical deliveries are represented. New deliveries increment this.
  const DELIVERY_BASELINE = 58;
  const deliveredQ = useQuery({
    queryKey: ["reseller_orders_delivered_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("reseller_orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "delivered");
      if (error) throw error;
      return count ?? 0;
    },
  });
  const primaryDeliveries = DELIVERY_BASELINE + (deliveredQ.data ?? 0);

  const suppliers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of merged) {
      const s = normalizeSupplier(r.source);
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const list = Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
    list.sort((a, b) => {
      if (a.name === PRIMARY_SUPPLIER) return -1;
      if (b.name === PRIMARY_SUPPLIER) return 1;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [merged]);

  const infoSupplierCategories = useMemo(() => {
    if (!infoSupplier) return [];
    const counts = new Map<string, number>();
    for (const r of merged) {
      if (normalizeSupplier(r.source) !== infoSupplier) continue;
      const c = (r.category ?? "").trim();
      if (!c) continue;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);
  }, [infoSupplier, merged]);

  const bySupplier = useMemo(() => {
    if (supplier === ALL) return merged;
    return merged.filter((r) => normalizeSupplier(r.source) === supplier);
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

      {suppliers.length > 0 && (
        <section className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {suppliers.length} supplier{suppliers.length === 1 ? "" : "s"} available
            </p>
            <button
              type="button"
              onClick={() => { setSupplier(ALL); setTab(ALL); setSearch(""); }}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                supplier === ALL
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              All · {merged.length}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suppliers.map((s) => {
              const active = supplier === s.name;
              const initials = s.name
                .split(/\s+/)
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              const deliveries = s.name === PRIMARY_SUPPLIER ? primaryDeliveries : 0;
              return (
                <div
                  key={s.name}
                  className={`inline-flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                    active ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => { setSupplier(s.name); setTab(ALL); setSearch(""); }}
                    className="flex items-center gap-2 text-left"
                    title={`View products from ${s.name}`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-[11px] font-bold text-muted-foreground">
                      {s.name === PRIMARY_SUPPLIER ? (
                        <img src={eazystoreLogo.url} alt={s.name} className="h-full w-full object-contain" />
                      ) : s.name === NUSRAT_SUPPLIER ? (
                        <img src={nusratLogo.url} alt={s.name} className="h-full w-full object-cover" />
                      ) : initials ? (
                        initials
                      ) : (
                        <StoreIcon className="h-4 w-4" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="max-w-[140px] truncate text-[12px] font-semibold leading-tight">
                        {s.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <span
                          className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
                        >
                          Products: {s.count}
                        </span>
                        <span
                          className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
                        >
                          Deliveries: {deliveries}
                        </span>
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setInfoSupplier(s.name); }}
                    className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`About ${s.name}`}
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <SupplierInfoDialog
        open={infoSupplier !== null}
        supplierName={infoSupplier}
        productCount={infoSupplier ? (suppliers.find((s) => s.name === infoSupplier)?.count ?? 0) : 0}
        deliveries={infoSupplier === PRIMARY_SUPPLIER ? primaryDeliveries : 0}
        topCategories={infoSupplierCategories}
        onClose={() => setInfoSupplier(null)}
      />




      {(q.data?.length ?? 0) > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-[220px] sm:max-w-[240px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
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
          <div className="ml-auto flex items-center gap-2">
            <Select
              value={supplier}
              onValueChange={(v) => { setSupplier(v); setTab(ALL); }}
            >
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Select Supplier">
                  {supplier === ALL ? "Select Supplier" : supplier}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Select Supplier</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.name} value={s.name}>
                    {s.name} ({s.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
          {filtered.map((p) => {
            const img = p.displayImage;
            const outOfStock = computeIsOutOfStock(p.stock);
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
                  {outOfStock ? (
                    <div className="pointer-events-none absolute inset-0 flex items-start justify-center bg-black/30 pt-2">
                      <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg">
                        {t("outOfStock")}
                      </span>
                    </div>
                  ) : (
                    <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                      স্টক আছে: {p.stock ?? 0}
                    </span>
                  )}
                </div>
                <div className="space-y-1 p-1.5">
                  <h3 className="line-clamp-2 text-[11px] font-semibold leading-tight">{p.name}</h3>
                  <div className="flex items-baseline justify-between gap-1">
                    <p className="text-[10px] font-medium line-through opacity-60">{fmt(p.price)}</p>
                    <p className="text-xs font-bold text-primary">{fmt(p.displayPrice)}</p>
                  </div>
                  <div className="flex flex-wrap gap-0.5">
                    {p.category && (
                      <Badge variant="secondary" className="px-1 py-0 text-[8px]">{p.category}</Badge>
                    )}
                    {p.isCustom && (
                      <Badge className="px-1 py-0 text-[8px]">My shop</Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {storeId && <AddToMyShopButton row={p} storeId={storeId} disabled={outOfStock} />}
                    {(userId || isSuperAdmin.data) && (
                      <div className="mt-1 flex w-full gap-1">
                        {userId && <EditResellerButton row={p} userId={userId} />}
                        {isSuperAdmin.data && <AdminRevokeButton row={p} />}
                      </div>
                    )}
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
        className="flex-1 gap-1.5"
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
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [confirmReaddOpen, setConfirmReaddOpen] = useState(false);
  const supplierName = normalizeSupplier(row.source);
  const agreementKey = `reseller-agreement-accepted:${supplierName}`;
  const [categoryId, setCategoryId] = useState<string>("");
  const [price, setPrice] = useState<string>(
    row.displayPrice != null ? String(row.displayPrice) : row.reseller_price != null ? String(row.reseller_price) : "",
  );
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const catsQ = useCategories(storeId);
  const categories = catsQ.data ?? [];

  // Detect if this reseller product is already listed in the user's store.
  // - "own"      → the original product itself (external_id) belongs to this store.
  // - "added"    → a resold copy exists with source_reseller_product_id = row.id.
  // external_id is only merged into the OR filter when it looks like a UUID so
  // PostgREST does not reject the query for non-UUID legacy sources.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const externalIdIsUuid = !!row.external_id && UUID_RE.test(row.external_id);
  const alreadyAddedQ = useQuery({
    enabled: !!storeId && !!row.id,
    queryKey: ["reseller-already-added", storeId, row.id, row.external_id],
    staleTime: 0,
    queryFn: async () => {
      const orFilter = externalIdIsUuid
        ? `source_reseller_product_id.eq.${row.id},id.eq.${row.external_id}`
        : `source_reseller_product_id.eq.${row.id}`;
      const { data, error } = await supabase
        .from("products")
        .select("id, source_reseller_product_id, store_id")
        .eq("store_id", storeId)
        .or(orFilter)
        .limit(50);
      if (error) throw error;
      // Defence in depth: even though we already filter by store_id, only
      // count rows that actually belong to the current store.
      const rows = (data ?? []).filter((r) => r.store_id === storeId);
      const isOwn =
        externalIdIsUuid && rows.some((r) => r.id === row.external_id);
      const addedByCopy = rows.some(
        (r) => r.source_reseller_product_id === row.id,
      );
      return { added: isOwn || addedByCopy, isOwn };
    },
  });
  const alreadyAdded = alreadyAddedQ.data?.added === true;
  const isOwnProduct = alreadyAddedQ.data?.isOwn === true;

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
    onSuccess: async (res) => {
      // Await the refetch so the button label ("Add My Site" → "Already added"
      // / "Your Product") updates the moment the mutation resolves. Poll a few
      // times to survive brief write-then-read replica lag.
      const key = ["reseller-already-added", storeId, row.id, row.external_id];
      const readState = () =>
        qc.getQueryData<{ added: boolean; isOwn: boolean }>(key);
      for (let attempt = 0; attempt < 4; attempt++) {
        await qc.refetchQueries({ queryKey: key, exact: true });
        if (readState()?.added) break;
        await new Promise((r) => setTimeout(r, 400));
      }
      if (res.skipped) {
        toast.info("এই পণ্যটি আগে থেকেই আপনার ওয়েবসাইটে আছে / This product is already on your website");
      } else {
        toast.success("আপনার শপে সফলভাবে যোগ করা হয়েছে! / Product added to your shop successfully!");
        qc.invalidateQueries({ queryKey: ["products"] });
      }
      setOpen(false);
    },
    onError: (e: unknown) => {
      // Rollback: refetch the "already added" state so the trigger button
      // returns to its true label ("Add My Site" / "Already added" / "Your
      // Product") instead of getting stuck on the loading label.
      qc.invalidateQueries({
        queryKey: ["reseller-already-added", storeId, row.id, row.external_id],
      });
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
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size="sm"
        variant={isOwnProduct ? "outline" : alreadyAdded ? "secondary" : "default"}
        className="mt-1 w-full gap-1.5"
        onClick={() => {
          if (isOwnProduct) {
            toast.info("এটি আপনার নিজের প্রডাক্ট / This is your own product");
            return;
          }
          // Confirm before re-adding an already-listed product to prevent
          // accidental duplicate resells.
          if (alreadyAdded) {
            setConfirmReaddOpen(true);
            return;
          }
          openAddFlow();
        }}
        disabled={disabled || add.isPending}
        aria-disabled={disabled || add.isPending || undefined}
        aria-busy={add.isPending || undefined}
        title={
          disabled
            ? t("outOfStockFromSupplier")
            : alreadyAdded
              ? "Already on your website"
              : undefined
        }
      >
        {add.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <StoreIcon className="h-3.5 w-3.5" />
        )}{" "}
        {add.isPending
          ? "Adding…"
          : disabled
            ? t("outOfStock")
            : isOwnProduct
              ? "Your Product"
              : alreadyAdded
                ? "ওয়েবসাইটে আছে / Already added"
                : "Add My Site"}
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
    <Dialog open={agreementOpen} onOpenChange={setAgreementOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <Link2 className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle>Supplier Connection Agreement</DialogTitle>
              <p className="text-sm text-muted-foreground">
                You are about to connect with <span className="font-semibold text-foreground">{supplierName}</span>
              </p>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg bg-muted/60 p-3 space-y-1">
            <p className="text-sm font-semibold">Terms and Conditions for Resellers</p>
            <p className="text-xs text-muted-foreground">
              It is the reseller's responsibility to provide the customer's correct address and phone number when placing an order. The reseller shall bear the liability if product delivery fails due to incorrect information.
            </p>
            <p className="text-xs text-muted-foreground">
              An advance fee of <span className="font-semibold">80 Taka</span> is charged for each shipment; this amount is refunded after the product is successfully delivered.
            </p>
          </div>
          <div className="rounded-lg bg-muted/60 p-3 space-y-1">
            <p className="text-sm font-semibold">Return and Refund Policy</p>
            <p className="text-xs text-muted-foreground">
              If the product is damaged or defective, we will replace it or issue a refund, provided an <span className="font-semibold">unboxing video</span> is submitted as proof.
            </p>
            <p className="text-xs text-muted-foreground">
              Any complaints must be reported within <span className="font-semibold">24/48 hours</span> of product delivery; complaints made after this period will not be accepted.
            </p>
          </div>
          <div className="rounded-lg bg-muted/60 p-3 space-y-1">
            <p className="text-sm font-semibold">Confidentiality and Conduct</p>
            <p className="text-xs text-muted-foreground">
              No promotional activities may be conducted that tarnish the reputation of our company's name or branding.
            </p>
            <p className="text-xs text-muted-foreground">
              Engagement in any <span className="font-semibold">fraudulent activity</span> will result in the immediate cancellation of the reseller status.
            </p>
          </div>
          <label className="flex items-start gap-2 pt-1">
            <Checkbox
              checked={agreed}
              onCheckedChange={(v) => setAgreed(v === true)}
              className="mt-0.5"
            />
            <span className="text-xs text-muted-foreground">
              I have read and agree to the <span className="font-semibold text-foreground">Terms and Conditions</span>, <span className="font-semibold text-foreground">Return &amp; Refund Policy</span>, and <span className="font-semibold text-foreground">Confidentiality</span> guidelines outlined above.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setAgreementOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!agreed}
            onClick={() => {
              try {
                window.localStorage.setItem(agreementKey, "1");
              } catch {
                // ignore
              }
              setAgreementOpen(false);
              setOpen(true);
            }}
          >
            Agree & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
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
        className="flex-1 gap-1.5"
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

function SupplierInfoDialog({
  open,
  supplierName,
  productCount,
  deliveries,
  topCategories,
  onClose,
}: {
  open: boolean;
  supplierName: string | null;
  productCount: number;
  deliveries: number;
  topCategories: string[];
  onClose: () => void;
}) {
  const name = supplierName ?? "";
  const isPrimary = name === PRIMARY_SUPPLIER;
  const isNusrat = name === NUSRAT_SUPPLIER;
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Supplier Info</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-sm font-bold text-muted-foreground">
              {isPrimary ? (
                <img src={eazystoreLogo.url} alt={name} className="h-full w-full object-contain" />
              ) : isNusrat ? (
                <img src={nusratLogo.url} alt={name} className="h-full w-full object-cover" />
              ) : initials ? (
                initials
              ) : (
                <StoreIcon className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold">{name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                  <ShieldCheck className="h-3 w-3" /> Verified
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Platform Courier
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-muted/50 px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground">Products</p>
              <p className="text-sm font-bold">{productCount}</p>
            </div>
            <div className="rounded-md bg-muted/50 px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground">Deliveries</p>
              <p className="text-sm font-bold">{deliveries}</p>
            </div>
          </div>
          {topCategories.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Top Categories</p>
              <div className="flex flex-wrap gap-1">
                {topCategories.map((c) => (
                  <span key={c} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-md border border-dashed p-2.5 text-[11px] text-muted-foreground">
            For supplier privacy, direct contact details are hidden. All orders, payments and delivery are handled through the platform.
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

