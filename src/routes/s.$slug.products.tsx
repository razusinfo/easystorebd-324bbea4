import { createFileRoute, Link } from "@tanstack/react-router";
import { usePublicStoreBySlug, productGridClass } from "@/lib/eazystore-data";
import { StorefrontPage } from "@/components/storefront/storefront-page";
import { loadStoreHeadInfo, storefrontFaviconLinks, storefrontSectionMeta } from "@/lib/storefront-head";


export const Route = createFileRoute("/s/$slug/products")({
  loader: async ({ params }) => loadStoreHeadInfo(params.slug),
  head: ({ params, loaderData }) => ({
    meta: storefrontSectionMeta({ slug: params.slug, storeName: loaderData?.storeName ?? null, section: "Products" }),
    links: storefrontFaviconLinks(params.slug),
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const { slug } = Route.useParams();
  const q = usePublicStoreBySlug(slug);
  const products = q.data?.products ?? [];
  const gridClass = productGridClass(q.data?.store?.shop_settings);

  return (
    <StorefrontPage slug={slug} title="All Products">
      {products.length === 0 ? (
        <p className="text-neutral-600">No products listed yet.</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-neutral-600">{products.length} product{products.length === 1 ? "" : "s"}</p>
          <div className={gridClass}>

            {products.map((p) => (
              <Link
                key={p.id}
                to="/s/$slug"
                params={{ slug }}
                className="group overflow-hidden rounded-xl bg-neutral-50 ring-1 ring-neutral-200 transition hover:shadow-md"
              >
                <div className="aspect-square bg-gradient-to-br from-neutral-100 to-white">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 min-h-[2.6em] text-sm font-medium text-neutral-800">{p.name}</p>
                  <p className="acc-text mt-1 font-display text-base font-black">{p.price.toLocaleString()} ৳</p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </StorefrontPage>
  );
}
