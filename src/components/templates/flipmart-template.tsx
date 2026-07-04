import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search, ShoppingCart, Menu, X, Store as StoreIcon,
  Shirt, Laptop, Headphones, Home, Watch, Sparkles, Camera, Gamepad2, Sofa, Baby,
  Facebook, Instagram, Twitter, Youtube, ChevronRight,
} from "lucide-react";
import type { StoreRow, ProductRow, FooterSettings } from "@/lib/eazystore-data";
import { DEFAULT_FOOTER, productGridClass, logoStyle, logoAlignClass } from "@/lib/eazystore-data";
import { useCartStore, useStoreCart, cartCount, type CartItem } from "@/lib/cart-store";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import { CustomerAuth } from "@/components/storefront/customer-auth";
import { DevelopedByBadge, useShowDevelopedBadge } from "@/lib/branding";

type Props = {
  store?: Partial<StoreRow> & { name: string };
  products?: ProductRow[];
  logoUrl?: string | null;
  demo?: boolean;
  accentColor?: string;
  defaultCategoryName?: string | null;
  footer?: FooterSettings;
  categories?: { id: string; name: string; parent_id?: string | null }[];
};

const DEMO_CATEGORY_ICONS = [
  { name: "Fashion", Icon: Shirt, tint: "from-rose-100 to-rose-50" },
  { name: "Electronics", Icon: Laptop, tint: "from-sky-100 to-sky-50" },
  { name: "Audio", Icon: Headphones, tint: "from-violet-100 to-violet-50" },
  { name: "Home", Icon: Home, tint: "from-amber-100 to-amber-50" },
  { name: "Watches", Icon: Watch, tint: "from-emerald-100 to-emerald-50" },
  { name: "Beauty", Icon: Sparkles, tint: "from-pink-100 to-pink-50" },
  { name: "Cameras", Icon: Camera, tint: "from-neutral-100 to-neutral-50" },
  { name: "Gaming", Icon: Gamepad2, tint: "from-indigo-100 to-indigo-50" },
  { name: "Furniture", Icon: Sofa, tint: "from-orange-100 to-orange-50" },
  { name: "Kids", Icon: Baby, tint: "from-teal-100 to-teal-50" },
];

const DEMO_PRODUCTS = [
  { name: "Pulvinar augue", price: 89, old: null, hue: "from-neutral-50 to-white" },
  { name: "Markus ligula", price: 27, old: 55, hue: "from-neutral-100 to-neutral-50" },
  { name: "Rorbi pulvina", price: 79, old: null, hue: "from-red-50 to-red-100" },
  { name: "Morbi varius", price: 45, old: 55, hue: "from-amber-50 to-yellow-100" },
  { name: "Fusce nec", price: 99, old: 100, hue: "from-neutral-100 to-neutral-50" },
  { name: "Dignissim", price: 80, old: 100, hue: "from-yellow-50 to-orange-50" },
  { name: "Eratcelerisqu", price: 142, old: 136, hue: "from-rose-100 to-red-50" },
  { name: "Red justo", price: 300, old: null, hue: "from-pink-100 to-rose-50" },
];

function hexToRgb(hex?: string): string | null {
  if (!hex) return null;
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  if (Number.isNaN(n) || v.length !== 6) return null;
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

const LABEL_TO_SUBPATH: Record<string, string> = {
  "Home": "", "Company": "", "About Us": "about", "Team": "team",
  "Products": "products", "Blogs": "blogs", "Pricing": "pricing", "Contact": "contact",
};

export function FlipmartTemplate({
  store, products, logoUrl, demo = false, accentColor, defaultCategoryName, footer, categories,
}: Props) {
  const accent = accentColor || "#2563eb";
  const yellow = "#fbbf24";
  const rgb = hexToRgb(accent) ?? "37, 99, 235";
  const name = (store?.name ?? "FLIPMART").toUpperCase();
  const slug = store?.slug;
  const storeId = store?.id;

  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<string>(defaultCategoryName || "All");

  const cartItems: CartItem[] = useStoreCart(storeId);
  const addToCart = useCartStore((s) => s.add);
  const badgeCount = cartCount(cartItems);

  // Category rail
  const railCats = useMemo(() => {
    if (demo || !categories?.length) return DEMO_CATEGORY_ICONS;
    const roots = categories.filter((c) => !c.parent_id).slice(0, 12);
    return roots.map((c, i) => ({
      id: c.id,
      name: c.name,
      Icon: DEMO_CATEGORY_ICONS[i % DEMO_CATEGORY_ICONS.length].Icon,
      tint: DEMO_CATEGORY_ICONS[i % DEMO_CATEGORY_ICONS.length].tint,
    }));
  }, [demo, categories]);

  const matchIdsByName = useMemo(() => {
    const cats = categories ?? [];
    const byParent = new Map<string, string[]>();
    cats.forEach((c) => {
      if (c.parent_id) {
        const arr = byParent.get(c.parent_id) ?? [];
        arr.push(c.id);
        byParent.set(c.parent_id, arr);
      }
    });
    const collect = (id: string, acc: Set<string>) => {
      acc.add(id);
      (byParent.get(id) ?? []).forEach((cid) => collect(cid, acc));
    };
    const m: Record<string, string[]> = {};
    cats.forEach((c) => {
      const s = new Set<string>();
      collect(c.id, s);
      m[c.name] = Array.from(s);
    });
    return m;
  }, [categories]);

  const filtered = useMemo(() => {
    if (demo) return [] as ProductRow[];
    const q = search.trim().toLowerCase();
    return (products ?? []).filter((p) => {
      if (activeCat !== "All") {
        const wantIds = matchIdsByName[activeCat];
        if (!wantIds || !p.category_id || !wantIds.includes(p.category_id)) return false;
      }
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [demo, products, activeCat, search, matchIdsByName]);

  const premium = demo
    ? DEMO_PRODUCTS.slice(0, 5).map((p) => ({ id: null as string | null, ...p, imageUrl: null as string | null }))
    : filtered.slice(0, 5).map((p, i) => ({
        id: p.id, name: p.name, price: p.price,
        old: i % 2 === 0 ? Math.round(p.price * 1.2) : null,
        hue: DEMO_PRODUCTS[i % DEMO_PRODUCTS.length].hue,
        imageUrl: p.image_url ?? null,
      }));
  const collection = demo
    ? DEMO_PRODUCTS.slice(2, 8).map((p) => ({ id: null as string | null, ...p, imageUrl: null as string | null }))
    : filtered.slice(5, 17).map((p, i) => ({
        id: p.id, name: p.name, price: p.price,
        old: i % 3 === 0 ? Math.round(p.price * 1.15) : null,
        hue: DEMO_PRODUCTS[i % DEMO_PRODUCTS.length].hue,
        imageUrl: p.image_url ?? null,
      }));

  const f: Required<FooterSettings> = {
    showNav: footer?.showNav ?? DEFAULT_FOOTER.showNav,
    navLinks: footer?.navLinks ?? DEFAULT_FOOTER.navLinks,
    showSocials: footer?.showSocials ?? DEFAULT_FOOTER.showSocials,
    socials: footer?.socials ?? DEFAULT_FOOTER.socials,
    showCopyright: footer?.showCopyright ?? DEFAULT_FOOTER.showCopyright,
  };
  const enabledLinks = f.navLinks.filter((l) => l.enabled);
  const enabledSocials = f.socials.filter((s) => s.enabled);
  const socialIconMap = { twitter: Twitter, youtube: Youtube, instagram: Instagram, facebook: Facebook } as const;
  const showDevBadge = useShowDevelopedBadge(demo ? null : (store as any));

  const style = `
    .flipmart-scope { --acc: ${accent}; --acc-rgb: ${rgb}; --yl: ${yellow}; }
    .flipmart-scope .acc-bg { background-color: var(--acc); }
    .flipmart-scope .acc-text { color: var(--acc); }
    .flipmart-scope .acc-ring:focus { border-color: var(--acc); box-shadow: 0 0 0 3px rgba(var(--acc-rgb), 0.15); }
    .flipmart-scope .yl-bg { background-color: var(--yl); }
    .flipmart-scope .yl-text { color: var(--yl); }
  `;

  function handleAdd(p: { id: string | null; name: string; price: number; imageUrl: string | null }) {
    if (!storeId || !p.id) return;
    addToCart(storeId, { productId: p.id, name: p.name, price: p.price, imageUrl: p.imageUrl });
    setCartOpen(true);
  }

  function footerLinkFor(label: string, href?: string) {
    if (href && href.trim()) return { external: true, to: href };
    const sub = LABEL_TO_SUBPATH[label];
    if (sub !== undefined && slug) return { external: false, to: sub ? `/s/${slug}/${sub}` : `/s/${slug}` };
    return null;
  }

  return (
    <div className="flipmart-scope min-h-screen bg-neutral-100 font-sans text-neutral-900">
      <style dangerouslySetInnerHTML={{ __html: style }} />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-3 sm:gap-5 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-md text-neutral-700 hover:bg-neutral-100 lg:hidden"
            aria-label="Open categories"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Logo */}
          {slug ? (
            <Link to="/s/$slug" params={{ slug }} className={`flex shrink-0 items-center gap-2 ${logoAlignClass(store?.shop_settings)}`}>
              {logoUrl ? (
                <img src={logoUrl} alt={`${name} logo`} style={logoStyle(store?.shop_settings)} className="shrink-0 object-contain" />
              ) : (
                <div className="grid h-10 w-10 place-items-center rounded-md acc-bg sm:h-11 sm:w-11">
                  <StoreIcon className="h-5 w-5 text-white" />
                </div>
              )}
              <span className="hidden text-xl font-black tracking-tight sm:inline">
                <span className="acc-text">{name.slice(0, 4)}</span>
                <span className="text-neutral-900">{name.slice(4) || "mart"}</span>
              </span>
            </Link>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-md acc-bg sm:h-11 sm:w-11">
                <StoreIcon className="h-5 w-5 text-white" />
              </div>
              <span className="hidden text-xl font-black tracking-tight sm:inline">
                <span className="acc-text">{name.slice(0, 4)}</span>
                <span className="text-neutral-900">{name.slice(4) || "mart"}</span>
              </span>
            </div>
          )}

          {/* Search */}
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search for Products, Brand and More"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="acc-ring w-full rounded-full border border-neutral-200 bg-neutral-50 py-2.5 pl-11 pr-28 text-sm outline-none placeholder:text-neutral-400 sm:py-3"
            />
            <button
              type="button"
              className="acc-bg absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded-full px-4 py-2 text-xs font-bold text-white sm:block"
            >
              Become a Vendor
            </button>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            <CustomerAuth />
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative grid h-10 w-10 place-items-center rounded-full text-neutral-700 hover:bg-neutral-100"
              aria-label="Cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {badgeCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[1rem] place-items-center rounded-full acc-bg px-1 text-[10px] font-black text-white">
                  {badgeCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Category rail */}
        <div className="border-t border-neutral-100 bg-white">
          <div className="mx-auto max-w-7xl overflow-x-auto px-3 py-3 sm:px-6">
            <ul className="flex items-start gap-4 sm:gap-6">
              <li>
                <button
                  onClick={() => setActiveCat("All")}
                  className="flex w-16 shrink-0 flex-col items-center gap-1"
                >
                  <div className={`grid h-14 w-14 place-items-center rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 ring-1 ${activeCat === "All" ? "ring-2" : "ring-neutral-200"}`}
                    style={activeCat === "All" ? { borderColor: accent, boxShadow: `0 0 0 2px ${accent}` } : undefined}>
                    <StoreIcon className="h-6 w-6 acc-text" />
                  </div>
                  <span className="text-[11px] font-semibold text-neutral-700">All</span>
                </button>
              </li>
              {railCats.map((c, i) => {
                const active = activeCat === c.name;
                return (
                  <li key={(c as any).id ?? i}>
                    <button
                      onClick={() => setActiveCat(c.name)}
                      className="flex w-16 shrink-0 flex-col items-center gap-1"
                    >
                      <div className={`grid h-14 w-14 place-items-center rounded-lg bg-gradient-to-br ${c.tint} ring-1 ring-neutral-200`}
                        style={active ? { boxShadow: `0 0 0 2px ${accent}` } : undefined}>
                        <c.Icon className="h-6 w-6 text-neutral-700" />
                      </div>
                      <span className="line-clamp-1 max-w-[64px] text-center text-[11px] font-semibold text-neutral-700">{c.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </header>

      {/* Hero banner */}
      <section className="mx-auto max-w-7xl px-3 pt-4 sm:px-6 sm:pt-6">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.2fr]">
            <div className="flex flex-col justify-center gap-3 bg-white p-6 sm:p-10">
              <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Exclusive</p>
              <h2 className="font-display text-3xl font-black leading-tight text-neutral-900 sm:text-5xl">
                COLLECTION
              </h2>
              <div className="flex items-center gap-1">
                {[0,1,2,3].map((i) => (
                  <span key={i} className="h-2 w-2 rounded-sm bg-neutral-900" />
                ))}
              </div>
            </div>
            <div className="relative flex items-center justify-center bg-gradient-to-br from-yellow-300 to-yellow-500 p-6 sm:p-10">
              <div className="text-white">
                <div className="font-display text-4xl font-black sm:text-6xl">70% <span className="text-3xl sm:text-4xl">OFF</span></div>
                <button className="mt-4 rounded-md bg-white px-6 py-2 text-xs font-black uppercase tracking-widest acc-text shadow">
                  Order Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Premium Products row */}
      <section className="mx-auto max-w-7xl px-3 pt-4 sm:px-6 sm:pt-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
          <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className="font-display text-lg font-black sm:text-xl">Premium Products</h3>
              <span className="text-xs font-semibold acc-text hover:underline">View all</span>
            </div>
            {premium.length === 0 ? (
              <p className="rounded-xl border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
                No products yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {premium.map((p, i) => (
                  <FlipCard
                    key={p.id ?? i}
                    {...p}
                    storeSlug={slug ?? undefined}
                    onAdd={p.id ? () => handleAdd(p) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
          <aside className="hidden overflow-hidden rounded-2xl bg-gradient-to-br from-blue-800 to-blue-600 p-6 text-white shadow-sm lg:block">
            <div className="text-xs font-bold uppercase tracking-widest opacity-80">Flight</div>
            <div className="mt-1 font-display text-3xl font-black leading-none">TICKET</div>
            <div className="mt-6 inline-block rounded bg-yellow-400 px-3 py-1 text-xs font-black text-neutral-900">
              40% OFF
            </div>
            <button className="mt-6 block w-full rounded-md bg-white/95 py-2 text-xs font-black text-neutral-900">
              BOOK NOW
            </button>
          </aside>
        </div>
      </section>

      {/* Collection grid */}
      <section className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="font-display text-lg font-black sm:text-xl">
              {activeCat === "All" ? "Top Selling Products" : activeCat}
            </h3>
            <span className="text-xs font-semibold acc-text hover:underline">View all</span>
          </div>
          {collection.length === 0 ? (
            <p className="rounded-xl border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
              No products match{search ? ` "${search}"` : ""}{activeCat !== "All" ? ` in ${activeCat}` : ""}.
            </p>
          ) : (
            <div className={productGridClass(store?.shop_settings)}>
              {collection.map((p, i) => (
                <FlipCard
                  key={p.id ?? i}
                  {...p}
                  storeSlug={slug ?? undefined}
                  onAdd={p.id ? () => handleAdd(p) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Mobile category drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNavOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="font-display text-lg font-black">Categories</h2>
              <button onClick={() => setMobileNavOpen(false)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-neutral-100" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto p-2">
              <li>
                <button
                  onClick={() => { setActiveCat("All"); setMobileNavOpen(false); }}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium ${activeCat === "All" ? "acc-bg text-white" : "text-neutral-700 hover:bg-neutral-100"}`}
                >
                  All <ChevronRight className="h-4 w-4" />
                </button>
              </li>
              {railCats.map((c, i) => {
                const active = activeCat === c.name;
                return (
                  <li key={(c as any).id ?? i}>
                    <button
                      onClick={() => { setActiveCat(c.name); setMobileNavOpen(false); }}
                      className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium ${active ? "acc-bg text-white" : "text-neutral-700 hover:bg-neutral-100"}`}
                    >
                      {c.name} <ChevronRight className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-10 border-t border-neutral-200 bg-white pb-24 sm:pb-0">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
          {f.showNav && enabledLinks.length > 0 && (
            <nav className="grid grid-cols-2 gap-x-4 gap-y-2 text-center sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-10 sm:gap-y-3">
              {enabledLinks.map((l) => {
                const displayLabel = l.label === "Company" ? "Home" : l.label;
                const resolved = footerLinkFor(l.label, l.href);
                const cls = "text-sm font-bold text-neutral-800 hover:acc-text";
                if (!resolved) return <span key={l.label} className={cls}>{displayLabel}</span>;
                if (resolved.external) {
                  return <a key={l.label} href={resolved.to} className={cls} target="_blank" rel="noreferrer">{displayLabel}</a>;
                }
                return <Link key={l.label} to={resolved.to} className={cls}>{displayLabel}</Link>;
              })}
            </nav>
          )}
          {f.showSocials && enabledSocials.length > 0 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              {enabledSocials.map((s) => {
                const Icon = socialIconMap[s.key];
                return (
                  <a key={s.key} href={s.url || "#"} target={s.url ? "_blank" : undefined} rel={s.url ? "noreferrer" : undefined}
                     aria-label={s.key}
                     className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100 text-neutral-700 hover:text-white hover:acc-bg">
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          )}
          {f.showCopyright && (
            <p className="mt-6 text-center text-sm font-medium text-neutral-700">
              Copyright © {new Date().getFullYear()} {name}
            </p>
          )}
          {showDevBadge && <DevelopedByBadge className={f.showCopyright ? "mt-1" : "mt-6"} />}
        </div>
      </footer>

      {storeId && (
        <CartDrawer storeId={storeId} storeName={name} open={cartOpen} onOpenChange={setCartOpen} />
      )}
    </div>
  );
}

function FlipCard({
  id, name, price, old, hue, imageUrl, onAdd, storeSlug,
}: {
  id?: string | null;
  name: string;
  price: number;
  old: number | null;
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
    <article className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white transition hover:shadow-md">
      <Wrapper {...wrapperProps} className={linkable ? "block cursor-pointer" : "block"}>
        <div className={`relative aspect-square bg-gradient-to-br ${hue}`}>
          {imageUrl ? (
            <img src={imageUrl} alt={name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 grid place-items-center opacity-30">
              <div className="h-16 w-16 rounded-lg bg-white/70" />
            </div>
          )}
        </div>
        <div className="p-3 text-center">
          <h4 className="line-clamp-1 text-sm font-medium text-neutral-800">{name}</h4>
          <div className="mt-1 flex items-baseline justify-center gap-1.5">
            {old != null && (
              <span className="text-xs text-neutral-400 line-through">${old}.00</span>
            )}
            <span className="text-sm font-black text-neutral-900">${price}.00</span>
          </div>
        </div>
      </Wrapper>
      {onAdd && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(); }}
          className="acc-bg mt-auto flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100"
        >
          <ShoppingCart className="h-3.5 w-3.5" /> Add
        </button>
      )}
    </article>
  );
}
