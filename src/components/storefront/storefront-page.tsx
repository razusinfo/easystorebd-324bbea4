import { useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ShoppingCart, Store as StoreIcon, ArrowLeft } from "lucide-react";
import { usePublicStoreBySlug, logoStyle, logoAlignClass } from "@/lib/eazystore-data";
import { useStoreCart, cartCount } from "@/lib/cart-store";
import { CustomerAuth } from "@/components/storefront/customer-auth";
import { DevelopedByBadge, useShowDevelopedBadge } from "@/lib/branding";

type Props = {
  slug: string;
  title: string;
  children: React.ReactNode;
};

function hexToRgb(hex?: string): string | null {
  if (!hex) return null;
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  if (Number.isNaN(n) || v.length !== 6) return null;
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** Chrome (header + footer + accent) reused across storefront sub-pages. */
export function StorefrontPage({ slug, title, children }: Props) {
  const q = usePublicStoreBySlug(slug);
  const store = q.data?.store;
  const storeId = store?.id;
  const items = useStoreCart(storeId);
  const count = cartCount(items);

  useEffect(() => {
    try { window.localStorage.setItem("last_store_slug", slug); } catch { /* ignore */ }
  }, [slug]);

  const accent = "#5B21B6";
  const rgb = hexToRgb(accent) ?? "91, 33, 182";
  const style = useMemo(() => `
    .eazystore-basic-scope { --acc: ${accent}; --acc-rgb: ${rgb}; }
    .eazystore-basic-scope .acc-bg { background-color: var(--acc); }
    .eazystore-basic-scope .acc-text { color: var(--acc); }
    .eazystore-basic-scope .acc-soft { background-color: rgba(var(--acc-rgb), 0.10); color: var(--acc); }
  `, [accent, rgb]);

  if (q.isLoading) {
    return <main className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading…</main>;
  }
  if (!store) {
    return (
      <main className="min-h-screen grid place-items-center p-6 text-center">
        <div className="max-w-md space-y-2">
          <StoreIcon className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="font-display text-xl font-black">Store not found</h1>
          <p className="text-sm text-muted-foreground">This storefront isn't published yet, or the address is wrong.</p>
        </div>
      </main>
    );
  }

  const name = (store.name ?? "EAZYSTORE").toUpperCase();
  const logo = q.data?.logoUrl ?? null;

  return (
    <div className="eazystore-basic-scope min-h-screen bg-neutral-100 font-sans text-neutral-900">
      <style dangerouslySetInnerHTML={{ __html: style }} />

      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <Link to="/s/$slug" params={{ slug }} className={`flex min-w-0 flex-1 items-center gap-2 sm:gap-3 ${logoAlignClass(store.shop_settings)}`}>
            {logo ? (
              <img
                src={logo}
                alt={`${name} logo`}
                style={logoStyle(store.shop_settings)}
                className="shrink-0 object-contain"
              />
            ) : (
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-neutral-900 sm:h-14 sm:w-14">
                <StoreIcon className="h-5 w-5 text-white" />
              </div>
            )}
            <h1 className="store-name hidden text-xl sm:block">{name}</h1>
          </Link>


          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/s/$slug"
              params={{ slug }}
              className="relative acc-bg grid h-11 w-11 place-items-center rounded-full text-white shadow-md"
              aria-label="Shop"
            >
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-white px-1 text-[11px] font-black text-neutral-900 shadow ring-2 ring-white">
                  {count}
                </span>
              )}
            </Link>
            <CustomerAuth />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <Link
          to="/s/$slug"
          params={{ slug }}
          className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-600 hover:acc-text"
        >
          <ArrowLeft className="h-4 w-4" /> Back to store
        </Link>
        <h1 className="mb-6 font-display text-3xl font-black sm:text-4xl">{title}</h1>
        <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">{children}</div>
      </main>

      <footer className="mt-10 border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <p className="text-center text-sm font-medium text-neutral-700 sm:text-base">
            Copyright © {new Date().getFullYear()} {name}
          </p>
          {showDevBadge && <DevelopedByBadge className="mt-1" />}
        </div>
      </footer>
    </div>
  );
}
