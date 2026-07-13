import { createFileRoute, Link } from "@tanstack/react-router";
import { usePublicStoreBySlug } from "@/lib/eazystore-data";
import { StorefrontPage } from "@/components/storefront/storefront-page";
import { MapPin, Phone, Mail, Globe, Facebook, Instagram, MessageCircle } from "lucide-react";
import { loadStoreHeadInfo, storefrontFaviconLinks, storefrontSectionMeta } from "@/lib/storefront-head";

export const Route = createFileRoute("/s/$slug/about")({
  loader: async ({ params }) => loadStoreHeadInfo(params.slug),
  head: ({ params, loaderData }) => ({
    meta: storefrontSectionMeta({ slug: params.slug, storeName: loaderData?.storeName ?? null, section: "About" }),
    links: storefrontFaviconLinks(params.slug),
  }),
  component: AboutPage,
});

function AboutPage() {
  const { slug } = Route.useParams();
  const q = usePublicStoreBySlug(slug);
  const s = q.data?.store;

  return (
    <StorefrontPage slug={slug} title="About Us">
      <p className="text-neutral-700 leading-relaxed">
        {s?.tagline || `${s?.name ?? "This store"} is a shop on EasyStore. We offer quality products at fair prices.`}
      </p>
      {(s?.address || s?.phone || s?.contact_email || s?.website_url ||
        s?.facebook_url || s?.instagram_url || s?.whatsapp_number) && (
        <>
          <h2 className="mt-6 mb-3 font-display text-lg font-bold">Get in touch</h2>
          <ul className="space-y-2 text-sm text-neutral-700">
            {s?.address && <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span>{s.address}</span></li>}
            {s?.phone && <li className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" /><a className="hover:underline" href={`tel:${s.phone}`}>{s.phone}</a></li>}
            {s?.contact_email && <li className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0" /><a className="hover:underline" href={`mailto:${s.contact_email}`}>{s.contact_email}</a></li>}
            {s?.website_url && <li className="flex items-center gap-2"><Globe className="h-4 w-4 shrink-0" /><a className="hover:underline" href={s.website_url} target="_blank" rel="noreferrer">{s.website_url}</a></li>}
            {s?.facebook_url && <li className="flex items-center gap-2"><Facebook className="h-4 w-4 shrink-0" /><a className="hover:underline" href={s.facebook_url} target="_blank" rel="noreferrer">Facebook</a></li>}
            {s?.instagram_url && <li className="flex items-center gap-2"><Instagram className="h-4 w-4 shrink-0" /><a className="hover:underline" href={s.instagram_url} target="_blank" rel="noreferrer">Instagram</a></li>}
            {s?.whatsapp_number && <li className="flex items-center gap-2"><MessageCircle className="h-4 w-4 shrink-0" /><a className="hover:underline" href={`https://wa.me/${s.whatsapp_number.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer">WhatsApp {s.whatsapp_number}</a></li>}
          </ul>
        </>
      )}
      <div className="mt-6">
        <Link to="/s/$slug" params={{ slug }} className="acc-text text-sm font-semibold hover:underline">
          Browse all products →
        </Link>
      </div>
    </StorefrontPage>
  );
}
