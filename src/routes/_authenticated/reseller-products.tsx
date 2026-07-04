import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Copy, Check, Pencil } from "lucide-react";
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

  const q = useQuery({
    queryKey: ["reseller_products"],
    queryFn: async (): Promise<ResellerRow[]> => {
      const { data, error } = await supabase
        .from("reseller_products")
        .select("id, external_id, name, description, image_url, image, price, reseller_price, category, source, updated_at, price_overridden, image_overridden")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ResellerRow[];
    },
  });

  const settingsQ = useQuery({
    enabled: !!userId,
    queryKey: ["user_reseller_settings", userId],
    queryFn: async (): Promise<UserSetting[]> => {
      const { data, error } = await supabase
        .from("user_reseller_settings")
        .select("id, reseller_product_id, custom_price, custom_description, custom_image")
        .eq("user_id", userId as string);
      if (error) throw error;
      return (data ?? []) as UserSetting[];
    },
  });

  const merged = useMemo<DisplayRow[]>(() => {
    const map = new Map<string, UserSetting>();
    for (const s of settingsQ.data ?? []) map.set(s.reseller_product_id, s);
    return (q.data ?? []).map((r) => {
      const s = map.get(r.id);
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
  }, [q.data, settingsQ.data]);

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
                  <div className="flex gap-2">
                    <CopyLinkButton url={shareUrl} />
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

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="mt-1 w-full gap-1.5"
      onClick={onCopy}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy Link"}
    </Button>
  );
}

function EditResellerButton({ row }: { row: ResellerRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState<string>(row.reseller_price != null ? String(row.reseller_price) : "");
  const [image, setImage] = useState<string>(row.image_url ?? row.image ?? "");

  useEffect(() => {
    if (open) {
      setPrice(row.reseller_price != null ? String(row.reseller_price) : "");
      setImage(row.image_url ?? row.image ?? "");
    }
  }, [open, row]);

  const mut = useMutation({
    mutationFn: async () => {
      const trimmedImg = image.trim();
      const parsedPrice = price.trim() === "" ? null : Number(price);
      if (parsedPrice != null && !Number.isFinite(parsedPrice)) throw new Error("Invalid price");

      const origPrice = row.reseller_price ?? null;
      const origImg = row.image_url ?? row.image ?? "";
      const priceChanged = parsedPrice !== origPrice;
      const imageChanged = trimmedImg !== origImg;

      const payload = {
        reseller_price: parsedPrice,
        image: trimmedImg || null,
        image_url: trimmedImg || null,
        updated_at: new Date().toISOString(),
        ...(priceChanged ? { price_overridden: true } : {}),
        ...(imageChanged ? { image_overridden: true } : {}),
      };

      const { error } = await supabase.from("reseller_products").update(payload).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reseller product updated");
      qc.invalidateQueries({ queryKey: ["reseller_products"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetOverrides = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("reseller_products")
        .update({ price_overridden: false, image_overridden: false })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Overrides cleared — will re-sync from main product");
      qc.invalidateQueries({ queryKey: ["reseller_products"] });
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
          <DialogTitle>Edit reseller product</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="rp-price">Reseller Price</Label>
            <Input
              id="rp-price"
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
            <p className="text-[11px] text-muted-foreground">
              Original: ৳{Number(row.price).toLocaleString()} — manual edits won't be overwritten by sync.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="rp-image">Product Image URL</Label>
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
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={resetOverrides.isPending || (!row.price_overridden && !row.image_overridden)}
            onClick={() => resetOverrides.mutate()}
          >
            Reset to synced values
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => mut.mutate()} disabled={mut.isPending}>
              {mut.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


