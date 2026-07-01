import { createFileRoute } from "@tanstack/react-router";
import { Loader2, MapPin, Phone, Mail, Facebook, Instagram, MessageCircle, Globe, Store as StoreIcon } from "lucide-react";
import { TEMPLATES, usePublicStoreBySlug, getTemplateSettings } from "@/lib/eazystore-data";
import { AutoPartsTemplate } from "@/components/templates/autoparts-template";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";


export const Route = createFileRoute("/s/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — EazyStore` },
      { name: "description", content: `Shop online at ${params.slug} on EazyStore.` },
      { property: "og:title", content: `${params.slug} — EazyStore` },
      { property: "og:description", content: `Shop online at ${params.slug} on EazyStore.` },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PublicStorefront,
});

function PublicStorefront() {
  const { slug } = Route.useParams();
  const q = usePublicStoreBySlug(slug);

  if (q.isLoading) {
    return (
      <main className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!q.data) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div className="max-w-md space-y-3">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-foreground/5">
            <StoreIcon className="h-7 w-7 text-foreground/40" />
          </div>
          <h1 className="font-display text-2xl font-black">Store not found</h1>
          <p className="text-sm text-foreground/60">
            This storefront isn't published yet, or the address is wrong.
          </p>
        </div>
      </main>
    );
  }

  const { store, products, logoUrl } = q.data;

  const settings = getTemplateSettings(store, store.template);
  const templateLogoQ = useQuery({
    queryKey: ["template-logo-signed", settings.logoPath],
    enabled: !!settings.logoPath,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("store-logos")
        .createSignedUrl(settings.logoPath!, 60 * 60 * 24 * 7);
      if (error) throw error;
      return data?.signedUrl ?? null;
    },
  });
  const effectiveLogo = templateLogoQ.data ?? logoUrl;
  const featuredIds = settings.featuredProductIds ?? [];
  const orderedProducts = featuredIds.length
    ? [
        ...featuredIds.map((id) => products.find((p) => p.id === id)).filter(Boolean) as typeof products,
        ...products.filter((p) => !featuredIds.includes(p.id)),
      ]
    : products;

  if (store.template === "autoparts") {
    return (
      <AutoPartsTemplate
        store={store}
        products={orderedProducts}
        logoUrl={effectiveLogo}
        accentColor={settings.accentColor}
        defaultCategoryName={settings.defaultCategoryName}
      />
    );
  }


  const t = TEMPLATES.find((x) => x.id === store.template) ?? TEMPLATES[0];
  const dark = store.template === "minimal" || store.template === "techgrid" || store.template === "luxe";


  return (
    <main className="min-h-screen bg-neutral-50">
      {/* Hero */}
      <header className={`bg-gradient-to-br ${t.gradient} ${dark ? "text-white" : "text-neutral-900"}`}>
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-8 sm:py-12">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/20 ring-1 ring-white/30 sm:h-20 sm:w-20">
            {logoUrl ? (
              <img src={logoUrl} alt={`${store.name} logo`} className="h-full w-full object-cover" />
            ) : (
              <StoreIcon className="h-7 w-7" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-black sm:text-3xl">{store.name}</h1>
            <p className={`mt-1 text-sm ${dark ? "text-white/80" : "text-neutral-700"}`}>
              {store.tagline || store.category}
            </p>
          </div>
        </div>
      </header>

      {/* Products */}
      <section className="mx-auto max-w-5xl px-5 py-8">
        <h2 className="font-display text-xl font-black">Products</h2>
        {products.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-foreground/20 p-8 text-center text-sm text-foreground/60">
            No products listed yet. Check back soon!
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <article key={p.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
                <div className={`h-28 bg-gradient-to-br ${t.gradient} opacity-90`} />
                <div className="p-3">
                  <h3 className="truncate text-sm font-bold text-neutral-900">{p.name}</h3>
                  <p className="mt-0.5 text-sm font-black text-primary">৳ {p.price.toLocaleString()}</p>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Contact */}
      {(store.address || store.phone || store.contact_email ||
        store.facebook_url || store.instagram_url || store.whatsapp_number || store.website_url) && (
        <section className="mx-auto max-w-5xl px-5 pb-12">
          <h2 className="font-display text-xl font-black">Contact</h2>
          <div className="mt-4 grid gap-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:grid-cols-2">
            {store.address && <Row icon={MapPin}>{store.address}</Row>}
            {store.phone && <Row icon={Phone}><a href={`tel:${store.phone}`} className="hover:underline">{store.phone}</a></Row>}
            {store.contact_email && <Row icon={Mail}><a href={`mailto:${store.contact_email}`} className="hover:underline">{store.contact_email}</a></Row>}
            {store.facebook_url && <Row icon={Facebook}><a href={store.facebook_url} target="_blank" rel="noopener noreferrer" className="hover:underline">Facebook</a></Row>}
            {store.instagram_url && <Row icon={Instagram}><a href={store.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:underline">Instagram</a></Row>}
            {store.whatsapp_number && <Row icon={MessageCircle}><a href={`https://wa.me/${store.whatsapp_number.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="hover:underline">WhatsApp {store.whatsapp_number}</a></Row>}
            {store.website_url && <Row icon={Globe}><a href={store.website_url} target="_blank" rel="noopener noreferrer" className="hover:underline">{store.website_url}</a></Row>}
          </div>
        </section>
      )}

      <footer className="border-t border-neutral-200 bg-white py-6 text-center text-xs text-neutral-500">
        Powered by <a href="/" className="font-bold text-primary hover:underline">EazyStore</a>
      </footer>
    </main>
  );
}

function Row({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm text-neutral-700">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}
