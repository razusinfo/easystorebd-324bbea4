import { createFileRoute, notFound } from "@tanstack/react-router";
import { Package } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

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
};

export const Route = createFileRoute("/r/$id")({
  loader: async ({ params }): Promise<ResellerRow> => {
    const { data, error } = await supabase
      .from("reseller_products")
      .select("id, external_id, name, description, image_url, image, price, reseller_price, category")
      .or(`external_id.eq.${params.id},id.eq.${params.id}`)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw notFound();
    return data as ResellerRow;
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.name} — Reseller` },
            { name: "description", content: loaderData.description ?? loaderData.name },
            { property: "og:title", content: loaderData.name },
            { property: "og:description", content: loaderData.description ?? loaderData.name },
            ...(loaderData.image_url || loaderData.image
              ? [{ property: "og:image", content: (loaderData.image_url ?? loaderData.image) as string }]
              : []),
          ],
        }
      : { meta: [{ title: "Reseller Product" }] },
  errorComponent: ({ error }) => <div className="p-6 text-destructive">Failed to load: {error.message}</div>,
  notFoundComponent: () => <div className="p-6">Product not found.</div>,
  component: ResellerProductPage,
});

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return `৳${Number(n).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

function ResellerProductPage() {
  const p = Route.useLoaderData();
  const img = p.image_url ?? p.image;
  return (
    <main className="mx-auto grid min-h-screen max-w-4xl gap-6 p-4 sm:p-8 md:grid-cols-2">
      <div className="aspect-square overflow-hidden rounded-2xl bg-muted">
        {img ? (
          <img src={img} alt={p.name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground">
            <Package className="h-10 w-10" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {p.category && <p className="text-xs uppercase tracking-wide text-muted-foreground">{p.category}</p>}
        <h1 className="text-2xl font-bold">{p.name}</h1>
        {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-3xl font-black text-primary">{fmt(p.reseller_price)}</span>
          <span className="text-sm text-muted-foreground line-through">{fmt(p.price)}</span>
        </div>
      </div>
    </main>
  );
}
