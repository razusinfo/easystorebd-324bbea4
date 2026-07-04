import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package, Copy, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";


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
};

const ALL = "__all__";
const UNCAT = "__uncat__";

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return `৳${Number(n).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

function ResellerProductsPage() {
  const [tab, setTab] = useState<string>(ALL);

  const q = useQuery({
    queryKey: ["reseller_products"],
    queryFn: async (): Promise<ResellerRow[]> => {
      const { data, error } = await supabase
        .from("reseller_products")
        .select("id, external_id, name, description, image_url, image, price, reseller_price, category, source, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ResellerRow[];
    },
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    let hasUncat = false;
    for (const r of q.data ?? []) {
      if (r.category && r.category.trim()) set.add(r.category.trim());
      else hasUncat = true;
    }
    return { list: Array.from(set).sort((a, b) => a.localeCompare(b)), hasUncat };
  }, [q.data]);

  const filtered = useMemo(() => {
    const rows = q.data ?? [];
    if (tab === ALL) return rows;
    if (tab === UNCAT) return rows.filter((r) => !r.category || !r.category.trim());
    return rows.filter((r) => r.category === tab);
  }, [q.data, tab]);

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reseller Products</h1>
          <p className="text-sm text-muted-foreground">
            Products marked "Add to Reseller Marketplace" or synced from your Product Sales site.
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
          <p className="max-w-md text-sm text-muted-foreground">
            Enable "Add to Reseller Marketplace" on a product, or push one to <code>/api/public/reseller-sync</code>.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => {
            const img = p.image_url ?? p.image;
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
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Original</p>
                      <p className="text-sm font-medium line-through opacity-70">{fmt(p.price)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reseller</p>
                      <p className="text-base font-bold text-primary">{fmt(p.reseller_price)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {p.category && (
                      <Badge variant="secondary" className="text-[10px]">{p.category}</Badge>
                    )}
                    {p.source && (
                      <Badge variant="outline" className="text-[10px]">{p.source}</Badge>
                    )}
                  </div>
                  <CopyLinkButton url={shareUrl} />
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

