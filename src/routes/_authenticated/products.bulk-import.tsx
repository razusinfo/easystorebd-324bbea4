import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Download, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { scrapeProductUrl, type ScrapedProduct } from "@/lib/product-scrape.functions";
import { parseBulkUrls } from "@/lib/product-url";
import { useIsSuperAdmin, useMyStore, useUpsertProduct } from "@/lib/eazystore-data";

export const Route = createFileRoute("/_authenticated/products/bulk-import")({
  head: () => ({
    meta: [
      { title: "Bulk Product Import — EasyStore" },
      { name: "description", content: "Paste multiple product URLs and import them at once." },
    ],
  }),
  component: BulkImportPage,
});

type Row = {
  url: string;
  status: "pending" | "fetching" | "ready" | "error" | "saving" | "saved";
  error?: string;
  data?: ScrapedProduct;
  // Editable overrides
  name?: string;
  description?: string;
  sellPrice?: string;
  stock?: string;
  brand?: string;
  images?: string[];
};

function BulkImportPage() {
  const navigate = useNavigate();
  const isSuperAdmin = useIsSuperAdmin();
  const { data: store } = useMyStore();
  const upsert = useUpsertProduct(store?.id);
  const [blob, setBlob] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto max-w-xl p-6 text-sm">
        <p>Super admin only.</p>
        <Link to="/products" className="text-primary underline">Back to Products</Link>
      </div>
    );
  }

  async function fetchAll() {
    const { urls, invalid } = parseBulkUrls(blob);
    setInvalid(invalid);
    if (urls.length === 0) {
      toast.error("No valid URLs found");
      return;
    }
    const init: Row[] = urls.map((u) => ({ url: u, status: "pending" }));
    setRows(init);
    setRunning(true);
    // Sequential to be gentle on target sites
    for (let i = 0; i < urls.length; i++) {
      setRows((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "fetching" } : r)),
      );
      try {
        const data = await scrapeProductUrl({ data: { url: urls[i] } });
        setRows((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  status: "ready",
                  data,
                  name: data.name,
                  description: data.description,
                  sellPrice: data.price != null ? String(data.price) : "",
                  stock: data.inStock === true ? "10" : data.inStock === false ? "0" : "",
                  brand: data.brand ?? "",
                  images: [...data.images],
                }
              : r,
          ),
        );
      } catch (e) {
        setRows((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? { ...r, status: "error", error: (e as Error)?.message ?? "Fetch failed" }
              : r,
          ),
        );
      }
    }
    setRunning(false);
    toast.success("Fetch complete — review and save");
  }

  async function retryRow(i: number) {
    const row = rows[i];
    if (!row) return;
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "fetching", error: undefined } : r)));
    try {
      const data = await scrapeProductUrl({ data: { url: row.url } });
      setRows((prev) =>
        prev.map((r, idx) =>
          idx === i
            ? {
                ...r,
                status: "ready",
                data,
                name: data.name,
                description: data.description,
                sellPrice: data.price != null ? String(data.price) : "",
                stock: data.inStock === true ? "10" : data.inStock === false ? "0" : "",
                brand: data.brand ?? "",
                images: [...data.images],
              }
            : r,
        ),
      );
    } catch (e) {
      setRows((prev) =>
        prev.map((r, idx) =>
          idx === i ? { ...r, status: "error", error: (e as Error)?.message ?? "Fetch failed" } : r,
        ),
      );
    }
  }

  async function saveRow(i: number) {
    const row = rows[i];
    if (!row || row.status !== "ready") return;
    if (!row.name?.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!row.sellPrice || Number.isNaN(Number(row.sellPrice))) {
      toast.error("Valid price required");
      return;
    }
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "saving" } : r)));
    try {
      const images = (row.images ?? []).filter(Boolean);
      await upsert.mutateAsync({
        name: row.name.trim(),
        description: row.description ?? "",
        price: Number(row.sellPrice),
        stock: row.stock ? Number(row.stock) : 0,
        imageUrl: images[0] ?? null,
        galleryUrls: images.slice(1),
        brand: row.brand?.trim() || null,
        sourceProductUrl: row.url,
      } as never);
      setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "saved" } : r)));
      toast.success(`Saved: ${row.name}`);
    } catch (e) {
      setRows((prev) =>
        prev.map((r, idx) =>
          idx === i
            ? { ...r, status: "ready", error: (e as Error)?.message ?? "Save failed" }
            : r,
        ),
      );
      toast.error((e as Error)?.message ?? "Save failed");
    }
  }

  async function saveAll() {
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].status === "ready") await saveRow(i);
    }
  }

  const readyCount = rows.filter((r) => r.status === "ready").length;
  const savedCount = rows.filter((r) => r.status === "saved").length;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/products" })} aria-label="Back to Products">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <h1 className="text-xl font-semibold">Bulk Product Import</h1>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <Label htmlFor="bulk-urls" className="text-sm font-medium">
          Paste product URLs (one per line or comma-separated)
        </Label>
        <Textarea
          id="bulk-urls"
          value={blob}
          onChange={(e) => setBlob(e.target.value)}
          placeholder="https://supplier.com/product/1&#10;https://supplier.com/product/2"
          rows={6}
          className="mt-2 font-mono text-xs"
        />
        {invalid.length > 0 && (
          <p className="mt-2 text-xs text-destructive">
            Skipped {invalid.length} invalid entr{invalid.length === 1 ? "y" : "ies"}: {invalid.slice(0, 3).join(", ")}
            {invalid.length > 3 ? "…" : ""}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={fetchAll} disabled={running || !blob.trim()}>
            {running ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Fetching…</> : <><Download className="mr-1 h-4 w-4" />Fetch All</>}
          </Button>
          {rows.length > 0 && (
            <Button variant="secondary" onClick={saveAll} disabled={running || readyCount === 0}>
              Save {readyCount} ready
            </Button>
          )}
          {rows.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {savedCount} saved · {readyCount} ready · {rows.length} total
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={row.url} className={cn(
            "rounded-lg border p-3",
            row.status === "saved" ? "border-emerald-500/40 bg-emerald-500/5" :
            row.status === "error" ? "border-destructive/40 bg-destructive/5" :
            "border-border bg-card",
          )}>
            <div className="flex items-start justify-between gap-2">
              <a href={row.url} target="_blank" rel="noreferrer noopener" className="min-w-0 flex-1 truncate text-xs text-muted-foreground underline">
                {row.url}
              </a>
              <span className="shrink-0 text-xs font-medium">
                {row.status === "pending" && "Queued"}
                {row.status === "fetching" && <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Fetching</span>}
                {row.status === "ready" && "Ready"}
                {row.status === "saving" && <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Saving</span>}
                {row.status === "saved" && <span className="inline-flex items-center gap-1 text-emerald-600"><Check className="h-3 w-3" />Saved</span>}
                {row.status === "error" && "Failed"}
              </span>
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remove row"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {row.status === "error" && (
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-destructive">
                <span>{row.error}</span>
                <Button size="sm" variant="outline" onClick={() => retryRow(i)}>Retry</Button>
              </div>
            )}

            {(row.status === "ready" || row.status === "saving" || row.status === "saved") && (
              <div className="mt-3 grid gap-3 md:grid-cols-[120px_1fr]">
                <div className="flex flex-wrap gap-1">
                  {(row.images ?? []).length === 0 ? (
                    <div className="flex h-20 w-20 items-center justify-center rounded border border-dashed text-[10px] text-muted-foreground">No image</div>
                  ) : (
                    (row.images ?? []).slice(0, 4).map((src, idx) => (
                      <div key={src + idx} className="group relative">
                        <img src={src} alt="" className="h-14 w-14 rounded border object-cover" />
                        <button
                          type="button"
                          onClick={() =>
                            setRows((prev) =>
                              prev.map((r, ri) =>
                                ri === i ? { ...r, images: (r.images ?? []).filter((_, ii) => ii !== idx) } : r,
                              ),
                            )
                          }
                          className="absolute -right-1 -top-1 hidden rounded-full bg-destructive p-0.5 text-destructive-foreground group-hover:block"
                          aria-label="Remove image"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label className="text-[11px]">Name</Label>
                    <Input
                      value={row.name ?? ""}
                      onChange={(e) => setRows((p) => p.map((r, ri) => (ri === i ? { ...r, name: e.target.value } : r)))}
                      disabled={row.status !== "ready"}
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Price</Label>
                    <Input
                      type="number"
                      value={row.sellPrice ?? ""}
                      onChange={(e) => setRows((p) => p.map((r, ri) => (ri === i ? { ...r, sellPrice: e.target.value } : r)))}
                      disabled={row.status !== "ready"}
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Stock</Label>
                    <Input
                      type="number"
                      value={row.stock ?? ""}
                      onChange={(e) => setRows((p) => p.map((r, ri) => (ri === i ? { ...r, stock: e.target.value } : r)))}
                      disabled={row.status !== "ready"}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-[11px]">Brand</Label>
                    <Input
                      value={row.brand ?? ""}
                      onChange={(e) => setRows((p) => p.map((r, ri) => (ri === i ? { ...r, brand: e.target.value } : r)))}
                      disabled={row.status !== "ready"}
                    />
                  </div>
                  <div className="sm:col-span-2 flex justify-end">
                    <Button size="sm" onClick={() => saveRow(i)} disabled={row.status !== "ready"}>
                      {row.status === "saved" ? "Saved" : "Save"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
