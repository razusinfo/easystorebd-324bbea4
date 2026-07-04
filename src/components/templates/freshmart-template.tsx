import { useMemo, useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search, ShoppingCart, Menu, X, Store as StoreIcon,
  Apple, Milk, Beef, Croissant, Coffee, Fish, Cherry, HeartPulse, Baby, Cat,
  Facebook, Instagram, Twitter, Youtube, ChevronRight, Leaf, Award,
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
  { name: "Fruit & Vegetables", Icon: Apple, tint: "from-lime-100 to-lime-50" },
  { name: "Dairy", Icon: Milk, tint: "from-blue-100 to-blue-50" },
  { name: "Meat & Fish", Icon: Beef, tint: "from-rose-100 to-rose-50" },
  { name: "Bakery", Icon: Croissant, tint: "from-amber-100 to-amber-50" },
  { name: "Beverages", Icon: Coffee, tint: "from-orange-100 to-orange-50" },
  { name: "Pantry Staples", Icon: Cherry, tint: "from-red-100 to-red-50" },
  { name: "Meat & Poultry", Icon: Fish, tint: "from-sky-100 to-sky-50" },
  { name: "Fish & Seafood", Icon: Fish, tint: "from-cyan-100 to-cyan-50" },
  { name: "Fresh Fruit", Icon: Apple, tint: "from-green-100 to-green-50" },
  { name: "Health Supplement", Icon: HeartPulse, tint: "from-emerald-100 to-emerald-50" },
  { name: "Baby", Icon: Baby, tint: "from-pink-100 to-pink-50" },
  { name: "Pet", Icon: Cat, tint: "from-yellow-100 to-yellow-50" },
];

const DEMO_PRODUCTS = [
  { name: "Whey Protein Isolate", price: 39, old: null, hue: "from-neutral-50 to-white" },
  { name: "Nutrition Shake", price: 24, old: null, hue: "from-rose-50 to-red-50" },
  { name: "Grainy Bunts Cat Food", price: 21, old: null, hue: "from-amber-50 to-yellow-50" },
  { name: "Live Hard Shell Clam", price: 9, old: null, hue: "from-sky-50 to-blue-50" },
  { name: "Grain Free Cat Food", price: 21, old: null, hue: "from-orange-50 to-red-50" },
  { name: "Organic Kale Bunch", price: 4, old: 6, hue: "from-lime-50 to-green-50" },
  { name: "Cold Pressed Juice", price: 8, old: 10, hue: "from-emerald-50 to-teal-50" },
  { name: "Farm Fresh Eggs", price: 5, old: null, hue: "from-yellow-50 to-amber-50" },
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

function useCountdown(targetHours = 12) {
  const [end] = useState(() => Date.now() + targetHours * 3600 * 1000);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, end - now);
  const d = Math.floor(diff / (24 * 3600 * 1000));
  const h = Math.floor((diff / 3600 / 1000) % 24);
  const m = Math.floor((diff / 60 / 1000) % 60);
  const s = Math.floor((diff / 1000) % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { d: pad(d), h: pad(h), m: pad(m), s: pad(s) };
}

export function FreshmartTemplate({
  store, products, logoUrl, demo = false, accentColor, defaultCategoryName, footer, categories,
}: Props) {
  const accent = accentColor || "#166534";
  const yellow = "#fbbf24";
  const rgb = hexToRgb(accent) ?? "22, 101, 52";
  const name = (store?.name ?? "FRESHMART").toUpperCase();
  const slug = store?.slug;
  const storeId = store?.id;

  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<string>(defaultCategoryName || "All");
  const timer = useCountdown(24 + 13);

  const cartItems: CartItem[] = useStoreCart(storeId);
  const addToCart = useCartStore((s) => s.add);
  const badgeCount = cartCount(cartItems);

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

  const hotDeals = demo
    ? DEMO_PRODUCTS.slice(0, 5).map((p) => ({ id: null as string | null, ...p, imageUrl: null as string | null }))
    : filtered.slice(0, 5).map((p, i) => ({
        id: p.id, name: p.name, price: p.price,
        old: i % 2 === 0 ? Math.round(p.price * 1.25) : null,
        hue: DEMO_PRODUCTS[i % DEMO_PRODUCTS.length].hue,
        imageUrl: p.image_url ?? null,
      }));
  const collection = demo
    ? DEMO_PRODUCTS.slice(0, 8).map((p) => ({ id: null as string | null, ...p, imageUrl: null as string | null }))
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
    .freshmart-scope { --acc: ${accent}; --acc-rgb: ${rgb}; --yl: ${yellow}; }
    .freshmart-scope .acc-bg { background-color: var(--acc); }
    .freshmart-scope .acc-text { color: var(--acc); }
    .freshmart-scope .acc-ring:focus { border-color: var(--acc); box-shadow: 0 0 0 3px rgba(var(--acc-rgb), 0.15); }
    .freshmart-scope .yl-bg { background-color: var(--yl); }
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
    <div className="freshmart-scope min-h-screen bg-neutral-50 font-sans text-neutral-900">
      <style dangerouslySetInnerHTML={{ __html: style }} />

      {/* Top nav strip */}
      <div className="hidden bg-neutral-900 text-white sm:block">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-8 px-6 py-2 text-xs font-semibold">
          <span className="hover:text-yellow-300 cursor-pointer">Combos & Deals</span>
          <span className="hover:text-yellow-300 cursor-pointer">Bundle Save</span>
          <span className="hover:text-yellow-300 cursor-pointer">Shop by Category</span>
          <span className="hover:text-yellow-300 cursor-pointer">Fruit & Vegetables</span>
          <span className="hover:text-yellow-300 cursor-pointer">Meat & Fish</span>
          <span className="hover:text-yellow-300 cursor-pointer">Flowers</span>
          <span className="hover:text-yellow-300 cursor-pointer">Templates</span>
        </div>
      </div>

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

          {slug ? (
            <Link to="/s/$slug" params={{ slug }} className={`flex shrink-0 items-center gap-2 ${logoAlignClass(store?.shop_settings)}`}>
              {logoUrl ? (
                <img src={logoUrl} alt={`${name} logo`} style={logoStyle(store?.shop_settings)} className="shrink-0 object-contain" />
              ) : (
                <div className="grid h-10 w-10 place-items-center rounded-md acc-bg sm:h-11 sm:w-11">
                  <Leaf className="h-5 w-5 text-white" />
                </div>
              )}
              <span className="hidden text-xl font-black tracking-tight sm:inline">
                <span className="acc-text">{name}</span>
              </span>
            </Link>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-md acc-bg sm:h-11 sm:w-11">
                <Leaf className="h-5 w-5 text-white" />
              </div>
              <span className="hidden text-xl font-black tracking-tight sm:inline acc-text">{name}</span>
            </div>
          )}

          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search fresh groceries, brands & more"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="acc-ring w-full rounded-full border border-neutral-200 bg-neutral-50 py-2.5 pl-11 pr-4 text-sm outline-none placeholder:text-neutral-400 sm:py-3"
            />
          </div>

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
      </header>

      {/* Hero banner */}
      <section className="mx-auto max-w-7xl px-3 pt-4 sm:px-6 sm:pt-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-yellow-100 via-yellow-50 to-green-800">
          <div className="grid grid-cols-1 sm:grid-cols-2">
            <div className="flex flex-col justify-center gap-3 p-6 sm:p-10">
              <p className="text-sm font-semibold italic text-neutral-700">Healthy choices every day</p>
              <h2 className="font-display text-4xl font-black leading-tight text-yellow-600 sm:text-6xl">
                Premium Foods
              </h2>
              <p className="text-sm font-medium text-neutral-700">Fresh ingredients loved by thousands of families</p>
              <div>
                <button className="mt-2 rounded-md acc-bg px-6 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow">
                  Shop Groceries
                </button>
              </div>
            </div>
            <div className="relative hidden items-center justify-center bg-gradient-to-br from-green-700 to-green-900 p-6 sm:flex">
              <div className="grid grid-cols-3 gap-2">
                {["🥬","🍅","🥕","🍞","🥛","🍎","🥑","🥦","🍇"].map((e, i) => (
                  <div key={i} className="grid h-16 w-16 place-items-center rounded-xl bg-white/95 text-3xl shadow-sm">{e}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Certification strip */}
      <section className="mx-auto max-w-7xl px-3 py-4 sm:px-6">
        <div className="flex items-center justify-around gap-4 overflow-x-auto rounded-xl bg-white px-4 py-4 shadow-sm">
          {["USDA","ORGANIC","NON-GMO","BPA FREE","CERTIFIED","HUMANE","VEGAN","NATURAL"].map((b) => (
            <div key={b} className="flex shrink-0 flex-col items-center gap-1 text-neutral-500">
              <div className="grid h-12 w-12 place-items-center rounded-full border-2 border-green-700/70 acc-text">
                <Award className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-black tracking-wide">{b}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Shop Categories */}
      <section className="mx-auto max-w-7xl px-3 pb-4 sm:px-6">
        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="font-display text-xl font-black">Shop Categories</h3>
            <span className="text-xs font-semibold acc-text hover:underline cursor-pointer">All Collections</span>
          </div>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-10">
            <button
              onClick={() => setActiveCat("All")}
              className="flex flex-col items-center gap-1.5"
            >
              <div className={`grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-green-100 to-green-50`}
                style={activeCat === "All" ? { boxShadow: `0 0 0 2px ${accent}` } : undefined}>
                <StoreIcon className="h-7 w-7 acc-text" />
              </div>
              <span className="text-[11px] font-semibold text-neutral-700">All</span>
            </button>
            {railCats.map((c, i) => {
              const active = activeCat === c.name;
              return (
                <button
                  key={(c as any).id ?? i}
                  onClick={() => setActiveCat(c.name)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div className={`grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br ${c.tint}`}
                    style={active ? { boxShadow: `0 0 0 2px ${accent}` } : undefined}>
                    <c.Icon className="h-7 w-7 text-neutral-700" />
                  </div>
                  <span className="line-clamp-1 max-w-[72px] text-center text-[11px] font-semibold text-neutral-700">{c.name}</span>
                  <span className="text-[10px] text-neutral-400">{Math.floor(Math.random() * 40) + 10} Items</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Hot Deals with countdown */}
      <section className="mx-auto max-w-7xl px-3 pb-4 sm:px-6">
        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-xl font-black">Hot Deals</h3>
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
              <span>Sale ends in:</span>
              {[timer.d, timer.h, timer.m, timer.s].map((v, i) => (
                <span key={i} className="rounded-md acc-bg px-2 py-1 font-mono text-sm font-black text-white">{v}</span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {hotDeals.length === 0 ? (
              <p className="col-span-full rounded-xl border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
                No hot deals yet.
              </p>
            ) : hotDeals.map((p, i) => (
              <FreshCard
                key={p.id ?? i}
                {...p}
                storeSlug={slug ?? undefined}
                onAdd={p.id ? () => handleAdd(p) : undefined}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Kitchen Essentials banner */}
      <section className="mx-auto max-w-7xl px-3 pb-4 sm:px-6">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-red-900 to-red-700 text-white shadow-sm">
          <div className="grid grid-cols-1 items-center sm:grid-cols-[1fr_2fr]">
            <div className="p-6 sm:p-8">
              <p className="text-xs font-black uppercase tracking-widest text-yellow-300">Fresh Market Specials</p>
              <h3 className="mt-2 font-display text-2xl font-black leading-tight sm:text-3xl">
                Save More on Kitchen Essentials
              </h3>
              <button className="mt-4 rounded-md bg-white px-5 py-2 text-xs font-black uppercase tracking-widest text-red-800 shadow">
                Shop Deals
              </button>
            </div>
            <div className="hidden grid-cols-3 gap-2 p-4 sm:grid">
              {["🥕","🥩","🐟"].map((e, i) => (
                <div key={i} className="grid h-28 place-items-center rounded-xl bg-white/10 text-6xl">{e}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Collection grid */}
      <section className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="font-display text-lg font-black sm:text-xl">
              {activeCat === "All" ? "Top Selling Products" : activeCat}
            </h3>
            <span className="text-xs font-semibold acc-text hover:underline cursor-pointer">View all</span>
          </div>
          {collection.length === 0 ? (
            <p className="rounded-xl border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
              No products match{search ? ` "${search}"` : ""}{activeCat !== "All" ? ` in ${activeCat}` : ""}.
            </p>
          ) : (
            <div className={productGridClass(store?.shop_settings)}>
              {collection.map((p, i) => (
                <FreshCard
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

function FreshCard({
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
          {old != null && (
            <span className="absolute left-2 top-2 rounded bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">Deal</span>
          )}
          {imageUrl ? (
            <img src={imageUrl} alt={name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 grid place-items-center opacity-30">
              <Apple className="h-14 w-14 text-neutral-400" />
            </div>
          )}
        </div>
        <div className="p-3">
          <h4 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-neutral-800">{name}</h4>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-sm font-black text-neutral-900">${price}.00</span>
            {old != null && (
              <span className="text-xs text-neutral-400 line-through">${old}.00</span>
            )}
          </div>
        </div>
      </Wrapper>
      {onAdd && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(); }}
          className="acc-bg mt-auto flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-white"
        >
          <ShoppingCart className="h-3.5 w-3.5" /> Add
        </button>
      )}
    </article>
  );
}
