import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Copy, Check, Pencil, Store as StoreIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMyStore } from "@/lib/eazystore-data";
import { useCategories } from "@/lib/categories-data";
import { copyResellerProductToMyStore } from "@/lib/reseller-copy.functions";



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

function ResellerProductsPage() {
  const [tab, setTab] = useState<string>(ALL);

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
          "id, external_id, name, description, image_url, image, price, reseller_price, category, source, updated_at, price_overridden, image_overridden, user_reseller_settings(id, custom_price, custom_description, custom_image, user_id)",
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

  const categories = useMemo(() => {
    const set = new Set<string>();
    let hasUncat = false;
    for (const r of merged) {
      if (r.category && r.category.trim()) set.add(r.category.trim());
      else hasUncat = true;
    }
    return { list: Array.from(set).sort((a, b) => a.localeCompare(b)), hasUncat };
  }, [merged]);

  const filtered = useMemo(() => {
    if (tab === ALL) return merged;
    if (tab === UNCAT) return merged.filter((r) => !r.category || !r.category.trim());
    return merged.filter((r) => r.category === tab);
  }, [merged, tab]);

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reseller Products</h1>
          <p className="text-sm text-muted-foreground">
            Products marked "Add to Reseller Marketplace" or synced from your Product Sales site.
            Your edits stay in your shop only.
          </p>
        </div>
        {q.data && <Badge variant="secondary">{q.data.length} items</Badge>}
      </header>

      {(q.data?.length ?? 0) > 0 && (
        <Tabs value={tab} onValueChange={setTab} className="mb-4">
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : q.error ? (
        <p className="text-sm text-destructive">Failed to load: {(q.error as Error).message}</p>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
          <Package className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No reseller products in this category</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => {
            const img = p.displayImage;
            const shareUrl =
              typeof window !== "undefined"
                ? `${window.location.origin}/r/${p.external_id}`
                : `/r/${p.external_id}`;
            return (
              <Card key={p.id} className="overflow-hidden">
                <div className="aspect-square bg-muted">
                  {img ? (
                    <img src={img} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-muted-foreground">
                      <Package className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <h3 className="line-clamp-2 text-sm font-semibold">{p.name}</h3>
                  {p.displayDescription && (
                    <p className="line-clamp-2 text-[11px] text-muted-foreground">{p.displayDescription}</p>
                  )}
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Original</p>
                      <p className="text-sm font-medium line-through opacity-70">{fmt(p.price)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {p.isCustom ? "Your price" : "Reseller"}
                      </p>
                      <p className="text-base font-bold text-primary">{fmt(p.displayPrice)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {p.category && (
                      <Badge variant="secondary" className="text-[10px]">{p.category}</Badge>
                    )}
                    {p.isCustom && (
                      <Badge className="text-[10px]">My shop</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <CopyLinkButton url={shareUrl} row={p} storeId={storeId} />
                    {storeId && <AddToMyShopButton row={p} storeId={storeId} />}
                    {userId && <EditResellerButton row={p} userId={userId} />}
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



