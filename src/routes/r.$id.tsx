import { createFileRoute, notFound } from "@tanstack/react-router";
import { Check, Code2, Package } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
        <EmbedCodeButton id={p.external_id || p.id} name={p.name} />
      </div>
    </main>
  );
}

function EmbedCodeButton({ id, name }: { id: string; name: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/r/${id}`;
  const iframe = `<iframe src="${url}" width="100%" height="620" style="border:0;max-width:480px" loading="lazy" title="${name.replace(/"/g, "&quot;")}"></iframe>`;
  const script = `<div data-reseller-product="${id}"></div>\n<script src="${origin}/embed.js" async></script>`;

  const copy = async (kind: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    toast.success("Embed code copied");
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="mt-4 w-fit" variant="outline">
          <Code2 className="mr-2 h-4 w-4" /> Generate Embed Code
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Embed this product</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="iframe">
          <TabsList>
            <TabsTrigger value="iframe">Iframe</TabsTrigger>
            <TabsTrigger value="script">JavaScript</TabsTrigger>
          </TabsList>
          <TabsContent value="iframe" className="space-y-2">
            <p className="text-xs text-muted-foreground">Paste this into any HTML page.</p>
            <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">{iframe}</pre>
            <Button size="sm" onClick={() => copy("iframe", iframe)}>
              {copied === "iframe" ? <Check className="mr-2 h-4 w-4" /> : <Code2 className="mr-2 h-4 w-4" />}
              Copy iframe
            </Button>
          </TabsContent>
          <TabsContent value="script" className="space-y-2">
            <p className="text-xs text-muted-foreground">Drop-in JavaScript snippet.</p>
            <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">{script}</pre>
            <Button size="sm" onClick={() => copy("script", script)}>
              {copied === "script" ? <Check className="mr-2 h-4 w-4" /> : <Code2 className="mr-2 h-4 w-4" />}
              Copy script
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
