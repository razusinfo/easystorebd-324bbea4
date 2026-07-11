import { createFileRoute } from "@tanstack/react-router";
import { usePublicStoreBySlug } from "@/lib/eazystore-data";
import { StorefrontPage } from "@/components/storefront/storefront-page";
import { MapPin, Phone, Mail, MessageCircle, Facebook, Instagram, Globe } from "lucide-react";

export const Route = createFileRoute("/s/$slug/contact")({
  head: ({ params }) => ({
    meta: [
      { title: `Contact — ${params.slug}` },
      { name: "description", content: `Contact ${params.slug} on EasyStore.` },
      { property: "og:title", content: `Contact — ${params.slug}` },
      { property: "og:description", content: `Reach out to ${params.slug}.` },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { slug } = Route.useParams();
  const q = usePublicStoreBySlug(slug);
  const s = q.data?.store;

  const rows: { icon: React.ComponentType<{ className?: string }>; content: React.ReactNode }[] = [];
  if (s?.address) rows.push({ icon: MapPin, content: s.address });
  if (s?.phone) rows.push({ icon: Phone, content: <a className="hover:underline" href={`tel:${s.phone}`}>{s.phone}</a> });
  if (s?.contact_email) rows.push({ icon: Mail, content: <a className="hover:underline" href={`mailto:${s.contact_email}`}>{s.contact_email}</a> });
  if (s?.whatsapp_number) rows.push({ icon: MessageCircle, content: <a className="hover:underline" href={`https://wa.me/${s.whatsapp_number.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer">WhatsApp {s.whatsapp_number}</a> });
  if (s?.facebook_url) rows.push({ icon: Facebook, content: <a className="hover:underline" href={s.facebook_url} target="_blank" rel="noreferrer">Facebook</a> });
  if (s?.instagram_url) rows.push({ icon: Instagram, content: <a className="hover:underline" href={s.instagram_url} target="_blank" rel="noreferrer">Instagram</a> });
  if (s?.website_url) rows.push({ icon: Globe, content: <a className="hover:underline" href={s.website_url} target="_blank" rel="noreferrer">{s.website_url}</a> });

  return (
    <StorefrontPage slug={slug} title="Contact">
      {rows.length === 0 ? (
        <p className="text-neutral-600">The store hasn't added contact details yet.</p>
      ) : (
        <ul className="space-y-3 text-neutral-700">
          {rows.map((r, i) => (
            <li key={i} className="flex items-start gap-3">
              <r.icon className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" />
              <span>{r.content}</span>
            </li>
          ))}
        </ul>
      )}
    </StorefrontPage>
  );
}
