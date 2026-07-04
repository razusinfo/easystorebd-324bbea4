import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/reseller-products")({
  component: ResellerProductsPage,
});

type ResellerRow = {
  id: string;
  external_id: string;
  name: string;
  description: string | null;
  image: string | null;
  price: number;
  reseller_price: number | null;
  source: string | null;
  updated_at: string;
};

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return `৳${Number(n).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

function ResellerProductsPage() {
  const q = useQuery({
    queryKey: ["reseller_products"],
    queryFn: async (): Promise<ResellerRow[]> => {
      const { data, error } = await supabase
        .from("reseller_products")
        .select("id, external_id, name, description, image, price, reseller_price, source, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ResellerRow[];
    },
  });

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reseller Products</h1>
          <p className="text-sm text-muted-foreground">
            Products synced from your Product Sales site via the reseller webhook.
          </p>
        </div>
        {q.data && <Badge variant="secondary">{q.data.length} items</Badge>}
      </header>

      {q.isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : q.error ? (
        <p className="text-sm text-destructive">Failed to load: {(q.error as Error).message}</p>
      ) : !q.data || q.data.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
          <Package className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No reseller products yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Products pushed from your Product Sales site to <code>/api/public/reseller-sync</code> will appear here.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {q.data.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <div className="aspect-square bg-muted">
                {p.image ? (
                  <img src={p.image} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
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
                {p.source && (
                  <Badge variant="outline" className="text-[10px]">
                    {p.source}
                  </Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
