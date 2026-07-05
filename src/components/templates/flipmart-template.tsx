import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search, ShoppingCart, Menu, X, Store as StoreIcon, Heart,
  Shirt, Laptop, Headphones, Home, Watch, Sparkles, Camera, Gamepad2, Sofa, Baby,
  Facebook, Instagram, Twitter, Youtube, ChevronRight,
} from "lucide-react";
import type { StoreRow, ProductRow, FooterSettings } from "@/lib/eazystore-data";
import { DEFAULT_FOOTER, productGridClass, logoStyle, logoAlignClass } from "@/lib/eazystore-data";
import { sanitizeHexColor } from "@/lib/hex-color";
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
  /** When true, product rows render as horizontal sliders instead of grids. */
  sliderRows?: boolean;
  /** Optional override for the first two section titles (Suggested/Trending). */
  sectionTitles?: { suggested?: string; trending?: string };
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

const HERO_BANNERS = [
  {
    label: "NEW SMARTPHONE",
    sub: "20% OFF",
    grad: "from-slate-900 via-slate-800 to-blue-900",
    accent: "text-blue-300",
  },
  {
    label: "PURE SOUND",
    sub: "ZERO CLUTTER",
    grad: "from-neutral-100 via-white to-neutral-200",
    accent: "text-neutral-900",
    dark: true,
  },
  {
    label: "GYM EQUIPMENT",
    sub: "SHOP NOW",
    grad: "from-neutral-900 via-neutral-800 to-black",
    accent: "text-yellow-300",
  },
];

const BRAND_STRIPES = [
  { label: "NEW STYLE", grad: "from-neutral-900 to-neutral-700" },
  { label: "WINTER SALE", grad: "from-amber-900 to-orange-700" },
  { label: "FASHION", grad: "from-rose-700 to-red-500" },
  { label: "LAPTOP PROMO", grad: "from-violet-700 to-fuchsia-600" },
  { label: "SUMMER OFFER", grad: "from-cyan-600 to-sky-500" },
];

const SECTION_BARS = [
  { title: "Suggested for You", bar: "bg-rose-500" },
  { title: "Trending Now", bar: "bg-lime-400 text-neutral-900" },
  { title: "Recently Viewed Products", bar: "bg-red-500" },
  { title: "On Sale Items", bar: "bg-neutral-900" },
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
  sliderRows = false, sectionTitles,
}: Props) {
  const accent = sanitizeHexColor(accentColor, "#2563eb");
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

  // Slice product list into distinct sections. If not enough products,
  // sections gracefully reuse from the top.
  function slice(from: number, size: number) {
    if (demo) {
      return DEMO_PRODUCTS.slice(0, size).map((p) => ({
        id: null as string | null, ...p, imageUrl: null as string | null,
      }));
    }
    const arr = filtered;
    if (arr.length === 0) return [];
    const out: {
      id: string | null; name: string; price: number; old: number | null;
      hue: string; imageUrl: string | null;
    }[] = [];
    for (let i = 0; i < size; i++) {
      const p = arr[(from + i) % arr.length];
      if (!p) break;
      out.push({
        id: p.id, name: p.name, price: p.price,
        old: (from + i) % 2 === 0 ? Math.round(p.price * 1.2) : null,
        hue: DEMO_PRODUCTS[(from + i) % DEMO_PRODUCTS.length].hue,
        imageUrl: p.image_url ?? null,
      });
    }
    return out;
  }

  const suggested = slice(0, 5);
  const trending = slice(5, 5);
  const premium = slice(0, 5);
  const soundMusic = slice(2, 4);
  const interior = slice(6, 4);
  const fitness = slice(0, 4);
  const beauty = slice(4, 4);
  const accessories = slice(8, 4);
  const bestDeals = slice(3, 5);
  const winter = slice(1, 4);
  const dontMiss = slice(5, 4);
  const mostPicked = slice(2, 5);
  const onSale = slice(4, 6);
  const recently = slice(0, 5);

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
            <button
              type="button"
              className="hidden h-10 w-10 place-items-center rounded-full text-neutral-700 hover:bg-neutral-100 sm:grid"
              aria-label="Wishlist"
            >
              <Heart className="h-5 w-5" />
            </button>
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

      {/* Hero: three banner strip */}
      <section className="mx-auto max-w-7xl px-3 pt-4 sm:px-6 sm:pt-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {HERO_BANNERS.map((b) => (
            <div
              key={b.label}
              className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${b.grad} p-5 shadow-sm sm:p-6`}
            >
              <p className={`text-[11px] font-black uppercase tracking-[0.2em] ${b.dark ? "text-neutral-500" : "text-white/70"}`}>
                Exclusive
              </p>
              <h3 className={`mt-1 font-display text-xl font-black sm:text-2xl ${b.dark ? "text-neutral-900" : "text-white"}`}>
                {b.label}
              </h3>
              <p className={`mt-1 text-sm font-bold ${b.accent}`}>{b.sub}</p>
              <button className={`mt-4 rounded-full px-4 py-1.5 text-[11px] font-black uppercase tracking-wider shadow ${b.dark ? "bg-neutral-900 text-white" : "bg-white text-neutral-900"}`}>
                Shop Now
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Suggested for You (colored bar) */}
      <SectionBar bar={SECTION_BARS[0].bar} title={sectionTitles?.suggested ?? SECTION_BARS[0].title} />
      <ProductRow items={suggested} onAdd={handleAdd} slug={slug} search={search} activeCat={activeCat} slider={sliderRows} />

      {/* Featured Brands strip */}
      <section className="mx-auto max-w-7xl px-3 pt-4 sm:px-6">
        <h3 className="mb-3 font-display text-sm font-black uppercase tracking-wider text-neutral-700">
          Featured Brands
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {BRAND_STRIPES.map((b) => (
            <div
              key={b.label}
              className={`grid h-20 place-items-center rounded-xl bg-gradient-to-r ${b.grad} px-3 text-center shadow-sm`}
            >
              <span className="font-display text-sm font-black uppercase tracking-widest text-white">
                {b.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Trending Now (lime bar) */}
      <SectionBar bar={SECTION_BARS[1].bar} title={sectionTitles?.trending ?? SECTION_BARS[1].title} />
      <ProductRow items={trending} onAdd={handleAdd} slug={slug} search={search} activeCat={activeCat} slider={sliderRows} />

      {/* Premium Products + Flight ticket */}
      <section className="mx-auto max-w-7xl px-3 pt-6 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
          <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className="font-display text-lg font-black sm:text-xl">Premium Products</h3>
              <span className="text-xs font-semibold acc-text hover:underline">View all</span>
            </div>
            {premium.length === 0 ? (
              <EmptyGrid search={search} cat={activeCat} />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {premium.map((p, i) => (
                  <FlipCard key={p.id ?? i} {...p} storeSlug={slug ?? undefined} onAdd={p.id ? () => handleAdd(p) : undefined} />
                ))}
              </div>
            )}
          </div>
          <aside className="hidden overflow-hidden rounded-2xl bg-gradient-to-br from-blue-800 to-blue-600 p-6 text-white shadow-sm lg:block">
            <div className="text-xs font-bold uppercase tracking-widest opacity-80">Flight</div>
            <div className="mt-1 font-display text-3xl font-black leading-none">TICKET</div>
            <div className="mt-6 inline-block rounded bg-yellow-400 px-3 py-1 text-xs font-black text-neutral-900">40% OFF</div>
            <button className="mt-6 block w-full rounded-md bg-white/95 py-2 text-xs font-black text-neutral-900">
              BOOK NOW
            </button>
          </aside>
        </div>
      </section>

      {/* Sound & Music + Interior + Fashion promo */}
      <section className="mx-auto max-w-7xl px-3 pt-6 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_260px]">
          <MiniGroup title="Sound & Music" items={soundMusic} onAdd={handleAdd} slug={slug} />
          <MiniGroup title="Interior" items={interior} onAdd={handleAdd} slug={slug} />
          <aside className="hidden overflow-hidden rounded-2xl bg-gradient-to-br from-pink-200 to-rose-100 p-6 shadow-sm lg:block">
            <p className="text-xs font-black uppercase tracking-widest text-rose-700">Trending Now</p>
            <h4 className="mt-1 font-display text-xl font-black text-neutral-900 leading-tight">
              Shop your<br />Fashion Needs
            </h4>
            <button className="mt-6 rounded-full bg-rose-500 px-5 py-2 text-xs font-black uppercase tracking-wider text-white shadow">
              Shop Now
            </button>
          </aside>
        </div>
      </section>

      {/* Fitness + Beauty + Accessories */}
      <section className="mx-auto max-w-7xl px-3 pt-6 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <MiniGroup title="Fitness Equipment's" items={fitness} onAdd={handleAdd} slug={slug} />
          <MiniGroup title="Beauty Products" items={beauty} onAdd={handleAdd} slug={slug} />
          <MiniGroup title="Accessories" items={accessories} onAdd={handleAdd} slug={slug} />
        </div>
      </section>

      {/* Main "Top Selling" grid (kept for filter/search users) */}
      <section className="mx-auto max-w-7xl px-3 py-6 sm:px-6">
        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="font-display text-lg font-black sm:text-xl">
              {activeCat === "All" ? "Top Selling Products" : activeCat}
            </h3>
            <span className="text-xs font-semibold acc-text hover:underline">View all</span>
          </div>
          {filtered.length === 0 && !demo ? (
            <EmptyGrid search={search} cat={activeCat} />
          ) : (
            <div className={productGridClass(store?.shop_settings)}>
              {(demo ? DEMO_PRODUCTS.slice(0, 8).map((p) => ({ id: null, ...p, imageUrl: null as string | null })) : filtered.slice(0, 12).map((p, i) => ({
                id: p.id, name: p.name, price: p.price,
                old: i % 3 === 0 ? Math.round(p.price * 1.15) : null,
                hue: DEMO_PRODUCTS[i % DEMO_PRODUCTS.length].hue,
                imageUrl: p.image_url ?? null,
              }))).map((p, i) => (
                <FlipCard
                  key={(p as any).id ?? i}
                  {...(p as any)}
                  storeSlug={slug ?? undefined}
                  onAdd={(p as any).id ? () => handleAdd(p as any) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Best Deals bar */}
      <SectionBar bar="bg-neutral-800" title="Best Deals" />
      <ProductRow items={bestDeals} onAdd={handleAdd} slug={slug} search={search} activeCat={activeCat} slider={sliderRows} />

      {/* Winter + Don't Miss */}
      <section className="mx-auto max-w-7xl px-3 pt-6 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <MiniGroup title="Winter's Collection" items={winter} onAdd={handleAdd} slug={slug} />
          <MiniGroup title="Don't Miss Out" items={dontMiss} onAdd={handleAdd} slug={slug} />
        </div>
      </section>

      {/* Most Picked bar */}
      <SectionBar bar="bg-amber-500 text-neutral-900" title="Most Picked" />
      <ProductRow items={mostPicked} onAdd={handleAdd} slug={slug} search={search} activeCat={activeCat} slider={sliderRows} />

      {/* Recently Viewed (red bar) */}
      <SectionBar bar={SECTION_BARS[2].bar} title={SECTION_BARS[2].title} />
      <ProductRow items={recently} onAdd={handleAdd} slug={slug} search={search} activeCat={activeCat} slider={sliderRows} />

      {/* On Sale (dark bar) */}
      <SectionBar bar={SECTION_BARS[3].bar} title={SECTION_BARS[3].title} />
      <ProductRow items={onSale} onAdd={handleAdd} slug={slug} search={search} activeCat={activeCat} slider={sliderRows} />

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

/* ---------- Section pieces ---------- */

function SectionBar({ bar, title }: { bar: string; title: string }) {
  return (
    <section className="mx-auto max-w-7xl px-3 pt-6 sm:px-6">
      <div className={`flex items-center rounded-t-xl px-4 py-2 text-white ${bar}`}>
        <h3 className="font-display text-sm font-black uppercase tracking-widest">{title}</h3>
      </div>
    </section>
  );
}

type Item = {
  id: string | null; name: string; price: number; old: number | null;
  hue: string; imageUrl: string | null;
};

function ProductRow({
  items, onAdd, slug, search, activeCat, slider = false,
}: {
  items: Item[];
  onAdd: (p: Item) => void;
  slug?: string | null;
  search: string;
  activeCat: string;
  slider?: boolean;
}) {
  return (
    <section className="mx-auto max-w-7xl px-3 sm:px-6">
      <div className="rounded-b-xl bg-white p-4 shadow-sm sm:p-6">
        {items.length === 0 ? (
          <EmptyGrid search={search} cat={activeCat} />
        ) : slider ? (
          <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-1 pb-2 [scrollbar-width:thin]">
            {items.map((p, i) => (
              <div
                key={p.id ?? i}
                className="w-[46%] shrink-0 snap-start sm:w-[32%] md:w-[24%] lg:w-[19%]"
              >
                <FlipCard
                  {...p}
                  storeSlug={slug ?? undefined}
                  onAdd={p.id ? () => onAdd(p) : undefined}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {items.map((p, i) => (
              <FlipCard
                key={p.id ?? i}
                {...p}
                storeSlug={slug ?? undefined}
                onAdd={p.id ? () => onAdd(p) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MiniGroup({
  title, items, onAdd, slug,
}: {
  title: string;
  items: Item[];
  onAdd: (p: Item) => void;
  slug?: string | null;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-display text-base font-black">{title}</h3>
        <span className="text-[11px] font-semibold acc-text hover:underline">View all</span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 p-6 text-center text-xs text-neutral-500">
          No products yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((p, i) => (
            <FlipCard
              key={p.id ?? i}
              {...p}
              storeSlug={slug ?? undefined}
              onAdd={p.id ? () => onAdd(p) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyGrid({ search, cat }: { search: string; cat: string }) {
  return (
    <p className="rounded-xl border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
      No products match{search ? ` "${search}"` : ""}{cat !== "All" ? ` in ${cat}` : ""}.
    </p>
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
