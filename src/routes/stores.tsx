import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Store as StoreIcon } from "lucide-react";
import { listPublicStores } from "@/lib/tenant-resolver.functions";
import { buildSubdomainStorefrontUrl } from "@/lib/storefront-host";
import eazystoreLogo from "@/assets/eazystore-logo.png.asset.json";
import { EasyStoreWordmark } from "@/components/eazystore-wordmark";

const storesQueryOptions = queryOptions({
  queryKey: ["public-stores"],
  queryFn: () => listPublicStores(),
});

export const Route = createFileRoute("/stores")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(storesQueryOptions),
  head: () => ({
    meta: [
      { title: "Browse Stores — EasyStore" },
      {
        name: "description",
        content:
          "Discover published EasyStore storefronts. Shop from local merchants across Bangladesh.",
      },
      { property: "og:title", content: "Browse Stores — EasyStore" },
      {
        property: "og:description",
        content: "Discover published EasyStore storefronts.",
      },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Couldn&apos;t load stores: {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm">No stores found.</div>
  ),
  component: StoresPage,
});

function StoresPage() {
  const { data } = useSuspenseQuery(storesQueryOptions);
  const stores = data.stores;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-5">
        <a href="https://easystorebd.com" className="flex items-center gap-2">
          <img
            src={eazystoreLogo.url}
            alt="EasyStore"
            className="h-9 w-9 rounded-xl object-contain"
          />
          <EasyStoreWordmark className="text-lg" />
        </a>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16">
        <div className="mb-6">
          <h1 className="text-2xl font-bold sm:text-3xl">Browse Stores</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stores.length} published storefront{stores.length === 1 ? "" : "s"}
          </p>
        </div>

        {stores.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
            No stores have been published yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {stores.map((s) => {
              const url = buildSubdomainStorefrontUrl(s.slug) ?? `/s/${s.slug}`;
              return (
                <a
                  key={s.id}
                  href={url}
                  className="group flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center transition hover:border-primary/40 hover:shadow-sm"
                >
                  {s.logo_url ? (
                    <img
                      src={s.logo_url}
                      alt={s.name}
                      loading="lazy"
                      className="h-14 w-14 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
                      <StoreIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold group-hover:text-primary">
                      {s.name}
                    </div>
                    {s.tagline && (
                      <div className="truncate text-xs text-muted-foreground">
                        {s.tagline}
                      </div>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
