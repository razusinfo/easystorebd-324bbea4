import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSiteSettings } from "@/lib/site-settings";
import { Search, ShoppingCart, Globe, ChevronDown, Store as StoreIcon, Menu, X, Twitter, Youtube, Instagram, Facebook } from "lucide-react";
import type { StoreRow, ProductRow, FooterSettings } from "@/lib/eazystore-data";
import { DEFAULT_FOOTER, productGridClass, logoStyle, logoAlignClass } from "@/lib/eazystore-data";


import { useCartStore, useStoreCart, cartCount, type CartItem } from "@/lib/cart-store";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import { CustomerAuth } from "@/components/storefront/customer-auth";

type Props = {
  store?: Partial<StoreRow> & { name: string };
  products?: ProductRow[];
  logoUrl?: string | null;
  demo?: boolean;
  accentColor?: string;
  defaultCategoryName?: string | null;
  footer?: FooterSettings;
  categories?: { id: string; name: string }[];
};


const DEMO_CATEGORIES = [
  "All Products",
  "Smartwatches",
  "Best Headphone and Earbuds",
  "Best T-Shirt",
  "পাঞ্জাবি কালেকশন",
  "All Gift Package",
  "পাঞ্জাবি কম্বো পেকেজ",
  "Best Shirt",
  "Audio Adapter",
  "Best LED Table RGD",
  "Power Bank",
  "Game Controller",
  "Hand Mixer",
  "iOT Devices",
  "Juicer",
  "Laptop Cooler",
  "Laptop Table",
];

const DEMO_PRODUCTS = [
  { name: "Waterproof Bike Phone Holder With Magnetic Lock", price: 2150, save: null, hue: "from-sky-100 to-sky-50" },
  { name: "Yellow Duck With Egg Shape Led Night Light", price: 200, save: null, hue: "from-amber-100 to-yellow-50" },
  { name: "AY-49 Video Vlogger Kits With Microphone & LED Fill Light", price: 640, save: 30, hue: "from-cyan-100 to-sky-50" },
  { name: "3G/4G LTE All Operator SIM Supported WiFi Modem & Router", price: 1350, save: 150, hue: "from-neutral-100 to-white" },
  { name: "Xiaomi Mijia Automatic Air Freshener Spray – Perfume", price: 2500, save: null, hue: "from-orange-50 to-amber-50" },
  { name: "Elf Rechargeable Table Lamp", price: 500, save: 50, hue: "from-sky-200 to-cyan-100" },
  { name: "Led Mirror Digital Clock", price: 920, save: 30, hue: "from-blue-100 to-indigo-50" },
  { name: "Triangle Wooden Style Digital Led Clock", price: 1351, save: 49, hue: "from-teal-200 to-emerald-100" },
];

function hexToRgb(hex?: string): string | null {
  if (!hex) return null;
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  if (Number.isNaN(n) || v.length !== 6) return null;
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

// Map default footer labels to canonical storefront routes.
const LABEL_TO_SUBPATH: Record<string, string> = {
  "Home": "",
  "Company": "",
  "About Us": "about",
  "Team": "team",
  "Products": "products",
  "Blogs": "blogs",
  "Pricing": "pricing",
  "Contact": "contact",
};

export function EazyStoreBasicTemplate({
  store, products, logoUrl, demo = false, accentColor, defaultCategoryName, footer, categories,
}: Props) {
  // Only use demo categories in preview mode.
  const catList: string[] = demo
    ? DEMO_CATEGORIES
    : ["All Products", ...(categories ?? []).map((c) => c.name)];

  const f: Required<FooterSettings> = {
    showNav: footer?.showNav ?? DEFAULT_FOOTER.showNav,
    navLinks: footer?.navLinks ?? DEFAULT_FOOTER.navLinks,
    showSocials: footer?.showSocials ?? DEFAULT_FOOTER.showSocials,
    socials: footer?.socials ?? DEFAULT_FOOTER.socials,
    showCopyright: footer?.showCopyright ?? DEFAULT_FOOTER.showCopyright,
  };
  const enabledLinks = f.navLinks.filter((l) => l.enabled && l.label !== "Blogs" && l.label !== "Pricing");
  const enabledSocials = f.socials.filter((s) => s.enabled);
  const socialIconMap = { twitter: Twitter, youtube: Youtube, instagram: Instagram, facebook: Facebook } as const;
  const hasFooter =
    (f.showNav && enabledLinks.length > 0) ||
    (f.showSocials && enabledSocials.length > 0) ||
    f.showCopyright;

  const [mobileCatsOpen, setMobileCatsOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<string>(defaultCategoryName || "All Products");
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);

  const siteSettings = useSiteSettings().data;
  const whatsappHref = siteSettings?.whatsapp_url || "#";
  const name = (store?.name ?? "EAZYSTORE").toUpperCase();
  const slug = store?.slug;
  const storeId = store?.id;
  const useDemo = demo || !products || products.length === 0;

  // Filter real products by category + search text.
  const catIdByName = useMemo(() => {
    const m: Record<string, string> = {};
    (categories ?? []).forEach((c) => { m[c.name] = c.id; });
    return m;
  }, [categories]);

  const visibleProducts = useMemo(() => {
    if (useDemo) return [] as ProductRow[];
    const q = search.trim().toLowerCase();
    return (products ?? []).filter((p) => {
      if (activeCat !== "All Products") {
        const wantId = catIdByName[activeCat];
        if (!wantId || p.category_id !== wantId) return false;
      }
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, activeCat, search, catIdByName, useDemo]);

  const gridProducts = useDemo
    ? DEMO_PRODUCTS.map((p) => ({ id: null as string | null, ...p, imageUrl: null as string | null }))
    : visibleProducts.slice(0, 60).map((p, i) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        save: i % 3 === 0 ? Math.max(20, Math.round(p.price * 0.08)) : null,
        hue: DEMO_PRODUCTS[i % DEMO_PRODUCTS.length].hue,
        imageUrl: p.image_url ?? null,
      }));

  const accent = accentColor || "#5B21B6";
  const rgb = hexToRgb(accent) ?? "91, 33, 182";

  const cartItems: CartItem[] = useStoreCart(storeId);
  const addToCart = useCartStore((s) => s.add);
  const badgeCount = cartCount(cartItems);

  const style = `
    .eazystore-basic-scope { --acc: ${accent}; --acc-rgb: ${rgb}; }
    .eazystore-basic-scope .acc-bg { background-color: var(--acc); }
    .eazystore-basic-scope .acc-text { color: var(--acc); }
    .eazystore-basic-scope .acc-soft { background-color: rgba(var(--acc-rgb), 0.10); color: var(--acc); }
    .eazystore-basic-scope .acc-soft:hover { background-color: rgba(var(--acc-rgb), 0.18); }
    .eazystore-basic-scope .acc-ring:focus { border-color: var(--acc); box-shadow: 0 0 0 3px rgba(var(--acc-rgb), 0.15); }
  `;

  function handleAdd(p: { id: string | null; name: string; price: number; imageUrl: string | null }) {
    if (!storeId || !p.id) return;
    addToCart(storeId, {
      productId: p.id,
      name: p.name,
      price: p.price,
      imageUrl: p.imageUrl,
    });
    setCartOpen(true);
  }

  function selectCategory(c: string) {
    setActiveCat(c);
    setMobileCatsOpen(false);
  }

  // Resolve a footer link: if user provided a URL, use it; otherwise map known labels to routes.
  function footerLinkFor(label: string, href?: string) {
    if (href && href.trim()) return { external: true, to: href };
    const sub = LABEL_TO_SUBPATH[label];
    if (sub !== undefined && slug) return { external: false, to: sub ? `/s/${slug}/${sub}` : `/s/${slug}` };
    return null;
  }

  return (
    <div className="eazystore-basic-scope min-h-screen bg-neutral-100 font-sans text-neutral-900">
      <style dangerouslySetInnerHTML={{ __html: style }} />

      {/* Header */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6 sm:py-4">
          {/* Logo */}
          <div className={`flex min-w-0 items-center gap-2 sm:gap-3 ${logoAlignClass(store?.shop_settings)}`}>
            <button
              type="button"
              onClick={() => setMobileCatsOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-full text-neutral-700 hover:bg-neutral-100 lg:hidden"
              aria-label="Open categories"
            >
              <Menu className="h-5 w-5" />
            </button>
            {slug ? (
              <Link
                to="/s/$slug"
                params={{ slug }}
                className="flex items-center gap-2 sm:gap-3"
                aria-label={`${name} home`}
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`${name} logo`}
                    style={logoStyle(store?.shop_settings)}
                    className="shrink-0 object-contain"
                  />
                ) : (
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-neutral-900 sm:h-14 sm:w-14">
                    <StoreIcon className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                  </div>
                )}
                <h1 className="store-name hidden text-xl sm:block sm:text-2xl md:text-[26px]">
                  {name}
                </h1>

              </Link>
            ) : (
              <>
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`${name} logo`}
                    style={logoStyle(store?.shop_settings)}
                    className="shrink-0 object-contain"
                  />
                ) : (
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-neutral-900 sm:h-14 sm:w-14">
                    <StoreIcon className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                  </div>
                )}
                <h1 className="store-name hidden text-xl sm:block sm:text-2xl md:text-[26px]">
                  {name}
                </h1>

              </>
            )}
          </div>



          {/* Search pill */}
          <div className="relative min-w-0">
            <input
              type="text"
              placeholder="Search items"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="acc-ring w-full rounded-full border border-neutral-200 bg-white py-3 pl-5 pr-14 text-sm outline-none placeholder:text-neutral-400 sm:py-3.5 sm:text-base"
            />
            <button
              type="button"
              className="acc-bg absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-white sm:h-10 sm:w-10"
              aria-label="Search"
            >
              <Search className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="acc-bg relative grid h-11 w-11 place-items-center rounded-full text-white shadow-md sm:h-14 sm:w-14"
              aria-label="Cart"
            >
              <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
              {badgeCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-white px-1 text-[11px] font-black text-neutral-900 shadow ring-2 ring-white">
                  {badgeCount}
                </span>
              )}
            </button>
            <CustomerAuth />
            <button type="button" className="hidden items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 sm:flex">
              EN <Globe className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Mobile store name */}
        <div className="border-t border-neutral-100 px-4 py-2 text-center sm:hidden">
          <span className="store-name text-lg">{name}</span>
        </div>
      </header>

      {/* Content */}
      <section className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6">
          {/* Sidebar categories (desktop) */}
          <aside className="hidden rounded-2xl bg-white p-4 shadow-sm sm:p-5 lg:block">
            <h2 className="mb-3 font-display text-xl font-black text-neutral-900">Categories</h2>
            <ul className="max-h-[70vh] space-y-1 overflow-y-auto pr-1">
              {catList.map((c) => {
                const active = c === activeCat;
                return (
                  <li key={c}>
                    <button
                      type="button"
                      onClick={() => selectCategory(c)}
                      className={
                        active
                          ? "acc-bg block w-full text-left rounded-xl px-4 py-3 text-base font-bold text-white sm:text-[17px]"
                          : "block w-full text-left rounded-xl px-4 py-3 text-base font-medium text-neutral-700 hover:bg-neutral-100 sm:text-[17px]"
                      }
                    >
                      {c}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>


          {/* Main product area */}
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-4 shadow-sm sm:px-6">
              <h2 className="font-display text-xl font-black sm:text-2xl">{activeCat}</h2>
              <label className="flex items-center gap-2 text-sm text-neutral-600">
                <span className="hidden sm:inline">Sort by:</span>
                <span className="relative">
                  <select className="appearance-none rounded-md border border-neutral-300 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-neutral-800 outline-none">
                    <option>Default</option>
                    <option>Price: Low to High</option>
                    <option>Price: High to Low</option>
                    <option>Newest</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                </span>
              </label>
            </div>

            {/* Product grid */}
            {gridProducts.length === 0 ? (
              <div className="rounded-2xl bg-white p-10 text-center text-sm text-neutral-500 shadow-sm">
                No products match{search ? ` "${search}"` : ""}{activeCat !== "All Products" ? ` in ${activeCat}` : ""}.
              </div>
            ) : (
              <div className={productGridClass(store?.shop_settings)}>
                {gridProducts.map((p, i) => (
                  <ProductCard
                    key={p.id ?? i}
                    {...p}
                    onAdd={p.id ? () => handleAdd(p) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Mobile categories drawer */}
      {mobileCatsOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileCatsOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="font-display text-lg font-black">Categories</h2>
              <button
                type="button"
                onClick={() => setMobileCatsOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full hover:bg-neutral-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="flex-1 space-y-1 overflow-y-auto p-3">
              {catList.map((c) => {
                const active = c === activeCat;
                return (
                  <li key={c}>
                    <button
                      type="button"
                      onClick={() => selectCategory(c)}
                      className={
                        active
                          ? "acc-bg block w-full text-left rounded-xl px-4 py-3 text-base font-bold text-white"
                          : "block w-full text-left rounded-xl px-4 py-3 text-base font-medium text-neutral-700 hover:bg-neutral-100"
                      }
                    >
                      {c}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
      )}


      {/* Footer */}
      {hasFooter && (
        <footer className="mt-10 border-t border-neutral-200 bg-white pb-24 sm:pb-0">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-14">
            {f.showNav && enabledLinks.length > 0 && (
              <nav
                className="grid grid-cols-2 gap-x-4 gap-y-2 text-center sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-12 sm:gap-y-3"
              >
                {enabledLinks.map((l) => {
                  const displayLabel = l.label === "Company" ? "Home" : l.label;
                  const resolved = footerLinkFor(l.label, l.href);
                  const cls = "font-display text-sm font-bold text-neutral-900 transition hover:acc-text sm:text-lg";
                  if (!resolved) {
                    return <span key={l.label} className={cls}>{displayLabel}</span>;
                  }
                  if (resolved.external) {
                    return (
                      <a key={l.label} href={resolved.to} className={cls} target="_blank" rel="noreferrer">
                        {displayLabel}
                      </a>
                    );
                  }
                  return (
                    <Link key={l.label} to={resolved.to} className={cls}>
                      {displayLabel}
                    </Link>
                  );
                })}
              </nav>
            )}

            {f.showSocials && enabledSocials.length > 0 && (
              <div className={`${f.showNav && enabledLinks.length > 0 ? "mt-6 sm:mt-8" : ""} flex items-center justify-center gap-3 sm:gap-6`}>
                {enabledSocials.map((s) => {
                  const Icon = socialIconMap[s.key];
                  return (
                    <a
                      key={s.key}
                      href={s.url || "#"}
                      target={s.url ? "_blank" : undefined}
                      rel={s.url ? "noreferrer" : undefined}
                      aria-label={s.key}
                      className="grid h-9 w-9 place-items-center rounded-full text-neutral-700 transition hover:acc-soft sm:h-10 sm:w-10"
                    >
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </a>
                  );
                })}
              </div>
            )}

            {f.showCopyright && (
              <p className={`${(f.showNav && enabledLinks.length > 0) || (f.showSocials && enabledSocials.length > 0) ? "mt-6 sm:mt-8" : ""} text-center text-sm font-medium text-neutral-700 sm:text-base`}>
                Copyright © {new Date().getFullYear()} {name}
              </p>
            )}
          </div>
        </footer>
      )}

      {/* Floating WhatsApp */}
      <a
        href={whatsappHref}
        aria-label="WhatsApp"
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-4 right-4 grid h-12 w-12 place-items-center rounded-full bg-white text-emerald-500 shadow-lg ring-1 ring-neutral-200 hover:scale-105 sm:h-14 sm:w-14"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 sm:h-7 sm:w-7">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.15-.174.2-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.017 2C6.492 2 2 6.492 2 12.017c0 1.888.526 3.66 1.44 5.184L2 22l4.938-1.295a9.96 9.96 0 004.079.87c5.525 0 10.017-4.492 10.017-10.017 0-2.673-1.042-5.19-2.938-7.086A9.937 9.937 0 0012.017 2z" />
        </svg>
      </a>

      {storeId && (
        <CartDrawer
          storeId={storeId}
          storeName={name}
          open={cartOpen}
          onOpenChange={setCartOpen}
        />
      )}



    </div>
  );
}

function ProductCard({
  id, name, price, save, hue, imageUrl, onAdd, storeSlug,
}: {
  id?: string | null;
  name: string;
  price: number;
  save: number | null;
  hue: string;
  imageUrl?: string | null;
  onAdd?: () => void;
  storeSlug?: string;
}) {
  const linkable = !!id && !!storeSlug;
  const Wrapper: any = linkable ? Link : "div";
  const wrapperProps = linkable
    ? { to: "/s/$slug/p/$productId", params: { slug: storeSlug!, productId: id! } }
    : {};
  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200 transition hover:shadow-md">
      <Wrapper
        {...wrapperProps}
        className={linkable ? "block cursor-pointer" : "block"}
      >
        <div className={`relative aspect-square bg-gradient-to-br ${hue}`}>
          {save != null && (
            <span className="absolute left-3 top-3 z-10 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white shadow">
              Save {save} ৳
            </span>
          )}
          {imageUrl ? (
            <img src={imageUrl} alt={name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 grid place-items-center opacity-40">
              <div className="h-24 w-24 rounded-2xl bg-white/60" />
            </div>
          )}
        </div>
        <div className="px-3 pb-2 pt-3 sm:px-4">
          <h3 className="line-clamp-2 min-h-[2.6em] text-sm font-medium leading-snug text-neutral-800 sm:text-[15px]">
            {name}
          </h3>
          <div className="mt-2 acc-text font-display text-lg font-black sm:text-xl">
            {price.toLocaleString()} ৳
          </div>
        </div>
      </Wrapper>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd?.(); }}
        disabled={!onAdd}
        className="acc-soft flex w-full items-center justify-center gap-2 border-t border-neutral-100 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        <ShoppingCart className="h-4 w-4" /> Add to cart
      </button>
    </article>
  );
}

