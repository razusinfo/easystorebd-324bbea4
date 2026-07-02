import { Loader2, MapPin, Phone, Mail, Facebook, Instagram, MessageCircle, Globe, Store as StoreIcon } from "lucide-react";
import { TEMPLATES, usePublicStoreBySlug, getTemplateSettings } from "@/lib/eazystore-data";
import { AutoPartsTemplate } from "@/components/templates/autoparts-template";
import { BdLoveTemplate } from "@/components/templates/bdlove-template";
import { EazyStoreBasicTemplate } from "@/components/templates/eazystore-basic-template";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export function StorefrontView({ slug }: { slug: string }) {
  const q = usePublicStoreBySlug(slug);

  const store = q.data?.store;
  const settings = getTemplateSettings(store, store?.template ?? "minimal");
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

  const { products, logoUrl } = q.data;
  const s = q.data.store;

  const effectiveLogo = templateLogoQ.data ?? logoUrl;
  const featuredIds = settings.featuredProductIds ?? [];
  const orderedProducts = featuredIds.length
    ? [
        ...(featuredIds.map((id) => products.find((p) => p.id === id)).filter(Boolean) as typeof products),
        ...products.filter((p) => !featuredIds.includes(p.id)),
      ]
    : products;

  if (s.template === "autoparts") {
    return (
      <AutoPartsTemplate
        store={s}
        products={orderedProducts}
        logoUrl={effectiveLogo}
        accentColor={settings.accentColor}
        defaultCategoryName={settings.defaultCategoryName}
      />
    );
  }

  if (s.template === "bdlove") {
    return (
      <BdLoveTemplate
        store={s}
        products={orderedProducts}
        logoUrl={effectiveLogo}
        accentColor={settings.accentColor}
        defaultCategoryName={settings.defaultCategoryName}
      />
    );
  }

  if (s.template === "eazystore-basic") {
    return (
      <EazyStoreBasicTemplate
        store={s}
        products={orderedProducts}
        logoUrl={effectiveLogo}
        accentColor={settings.accentColor}
        defaultCategoryName={settings.defaultCategoryName}
        footer={settings.footer}
      />
    );
  }



  const t = TEMPLATES.find((x) => x.id === s.template) ?? TEMPLATES[0];
  const dark = s.template === "minimal" || s.template === "techgrid" || s.template === "luxe";

  return (
    <main className="min-h-screen bg-neutral-50">
      <header className={`bg-gradient-to-br ${t.gradient} ${dark ? "text-white" : "text-neutral-900"}`}>
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-8 sm:py-12">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/20 ring-1 ring-white/30 sm:h-20 sm:w-20">
            {logoUrl ? (
              <img src={logoUrl} alt={`${s.name} logo`} className="h-full w-full object-cover" />
            ) : (
              <StoreIcon className="h-7 w-7" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-black sm:text-3xl">{s.name}</h1>
            <p className={`mt-1 text-sm ${dark ? "text-white/80" : "text-neutral-700"}`}>
              {s.tagline || s.category}
            </p>
          </div>
        </div>
      </header>

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

      {(s.address || s.phone || s.contact_email ||
        s.facebook_url || s.instagram_url || s.whatsapp_number || s.website_url) && (
        <section className="mx-auto max-w-5xl px-5 pb-12">
          <h2 className="font-display text-xl font-black">Contact</h2>
          <div className="mt-4 grid gap-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:grid-cols-2">
            {s.address && <Row icon={MapPin}>{s.address}</Row>}
            {s.phone && <Row icon={Phone}><a href={`tel:${s.phone}`} className="hover:underline">{s.phone}</a></Row>}
            {s.contact_email && <Row icon={Mail}><a href={`mailto:${s.contact_email}`} className="hover:underline">{s.contact_email}</a></Row>}
            {s.facebook_url && <Row icon={Facebook}><a href={s.facebook_url} target="_blank" rel="noopener noreferrer" className="hover:underline">Facebook</a></Row>}
            {s.instagram_url && <Row icon={Instagram}><a href={s.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:underline">Instagram</a></Row>}
            {s.whatsapp_number && <Row icon={MessageCircle}><a href={`https://wa.me/${s.whatsapp_number.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="hover:underline">WhatsApp {s.whatsapp_number}</a></Row>}
            {s.website_url && <Row icon={Globe}><a href={s.website_url} target="_blank" rel="noopener noreferrer" className="hover:underline">{s.website_url}</a></Row>}
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
