import { useMemo, useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search, Mic, Bell, Plus, Home as HomeIcon, Heart, User as UserIcon,
  Sparkles, Shirt, Smartphone, Package, Store as StoreIcon,
} from "lucide-react";
import type { StoreRow, ProductRow } from "@/lib/eazystore-data";
import { useCartStore, useStoreCart, cartCount, type CartItem } from "@/lib/cart-store";
import { CartDrawer } from "@/components/storefront/cart-drawer";

type Props = {
  store?: Partial<StoreRow> & { name: string };
  products?: ProductRow[];
  logoUrl?: string | null;
  categories?: { id: string; name: string }[];
  demo?: boolean;
};

const CAT_ICONS = [Sparkles, Shirt, Smartphone, Package];

const DEMO_PRODUCTS: Array<{ name: string; price: number; hue: string }> = [
  { name: "Emerald Silk Gown", price: 12450, hue: "from-emerald-50 to-amber-50" },
  { name: "Velvet Cushion", price: 2100, hue: "from-rose-50 to-amber-50" },
  { name: "Aroma Diffuser", price: 3850, hue: "from-emerald-50 to-teal-50" },
  { name: "Heritage Leather Belt", price: 1890, hue: "from-amber-50 to-orange-50" },
];

function useCountdown(fromMs = 5 * 60 * 60 * 1000) {
  const [remaining, setRemaining] = useState(fromMs);
  useEffect(() => {
    const t = setInterval(() => setRemaining((r) => (r > 1000 ? r - 1000 : fromMs)), 1000);
    return () => clearInterval(t);
  }, [fromMs]);
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1000);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return { h: pad(h), m: pad(m), s: pad(s) };
}

export function PrestigeTemplate({ store, products, logoUrl, categories, demo = false }: Props) {
  const name = (store?.name ?? "EazyStore").toUpperCase();
  const slug = store?.slug;
  const storeId = store?.id;
  const useDemo = demo || !products || products.length === 0;

  const [activeCat, setActiveCat] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);

  const cartItems: CartItem[] = useStoreCart(storeId);
  const addToCart = useCartStore((s) => s.add);
  const badgeCount = cartCount(cartItems);
  const countdown = useCountdown();

  const catList = useMemo(
    () => [{ id: "all", name: "All" }, ...(categories ?? [])],
    [categories],
  );

  const filtered = useMemo(() => {
    if (useDemo) return [] as ProductRow[];
    const q = search.trim().toLowerCase();
    return (products ?? []).filter((p) => {
      if (activeCat !== "all" && p.category_id !== activeCat) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, activeCat, search, useDemo]);

  const featured = useDemo ? DEMO_PRODUCTS[0] : filtered[0];
  const tiles = useDemo ? DEMO_PRODUCTS.slice(1, 3) : filtered.slice(1, 3);
  const grid = useDemo ? [] : filtered.slice(3, 15);

  function handleAdd(p: { id: string | null; name: string; price: number; imageUrl?: string | null }) {
    if (!storeId || !p.id) return;
    addToCart(storeId, {
      productId: p.id,
      name: p.name,
      price: p.price,
      imageUrl: p.imageUrl ?? null,
    });
    setCartOpen(true);
  }

  return (
    <div className="prestige-scope min-h-screen bg-[#f5f0e0] text-[#064e3b]">
      <style>{`
        .prestige-scope { font-family: 'Manrope', system-ui, sans-serif; }
        .prestige-scope .font-display { font-family: 'Sora', 'Manrope', sans-serif; }
        .prestige-scope .no-scrollbar::-webkit-scrollbar { display: none; }
        .prestige-scope .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-[#064e3b] px-5 pt-5 pb-4 shadow-lg">
        <div className="mx-auto flex max-w-md flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {logoUrl ? (
                <img src={logoUrl} alt={name} className="h-9 w-9 rounded-full object-cover ring-2 ring-[#c9a84c]/40" />
              ) : (
                <div className="grid h-9 w-9 place-items-center rounded-full bg-[#0d7a5f] text-[#c9a84c]">
                  <StoreIcon className="h-4 w-4" />
                </div>
              )}
              <h1 className="font-display truncate text-lg font-bold tracking-tight text-[#c9a84c]">{name}</h1>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="Notifications"
                className="grid h-10 w-10 place-items-center rounded-full bg-[#0d7a5f] text-[#f5f0e0] transition hover:scale-105"
              >
                <Bell className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Cart"
                onClick={() => setCartOpen(true)}
                className="relative grid h-10 w-10 place-items-center rounded-full bg-[#c9a84c] text-[#064e3b] transition hover:scale-105"
              >
                <Package className="h-5 w-5" />
                {badgeCount > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-[#064e3b] px-1 text-[10px] font-black text-[#c9a84c] ring-2 ring-[#064e3b]">
                    {badgeCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-4 h-5 w-5 text-[#c9a84c]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search the collection..."
              className="w-full rounded-full border border-[#c9a84c]/20 bg-[#0d7a5f] px-12 py-3 text-sm text-[#f5f0e0] placeholder-[#f5f0e0]/60 outline-none focus:ring-2 focus:ring-[#c9a84c]/50"
            />
            <button
              type="button"
              aria-label="Voice search"
              className="absolute right-3 grid h-8 w-8 place-items-center rounded-full text-[#c9a84c] hover:bg-[#064e3b]/40"
            >
              <Mic className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-8 px-5 py-6 pb-28">
        {/* Categories rail */}
        <section aria-label="Categories" className="-mx-5 overflow-x-auto px-5 no-scrollbar">
          <ul className="flex gap-4 pb-2">
            {catList.slice(0, 12).map((c, i) => {
              const Icon = CAT_ICONS[i % CAT_ICONS.length];
              const active = c.id === activeCat;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setActiveCat(c.id)}
                    className="flex flex-col items-center gap-2"
                  >
                    <span
                      className={`grid h-14 w-14 place-items-center rounded-2xl transition ${
                        active
                          ? "bg-[#064e3b] text-[#c9a84c] shadow-lg shadow-[#064e3b]/20 ring-1 ring-[#c9a84c]/30"
                          : "bg-white text-[#064e3b] shadow-sm ring-1 ring-[#064e3b]/5"
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        active ? "text-[#064e3b]" : "text-[#064e3b]/60"
                      }`}
                    >
                      {c.name.length > 8 ? c.name.slice(0, 8) + "…" : c.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Flash Sale banner */}
        <section
          aria-label="Flash Sale"
          className="relative overflow-hidden rounded-3xl bg-[#0d7a5f] p-6 shadow-md"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-[#c9a84c]/15" />
          <div className="relative flex items-end justify-between">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-[#c9a84c]">
                Flash Sale
              </p>
              <h2 className="font-display text-2xl font-bold text-[#f5f0e0]">40% Off</h2>
            </div>
            <div className="flex items-center gap-1" aria-live="polite">
              {[countdown.h, countdown.m, countdown.s].map((v, i, arr) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="rounded bg-[#064e3b] px-2 py-1 text-xs font-bold tabular-nums text-[#c9a84c]">
                    {v}
                  </span>
                  {i < arr.length - 1 && <span className="font-bold text-[#f5f0e0]">:</span>}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Bento product grid */}
        <section aria-label="Featured" className="grid grid-cols-2 gap-4">
          {/* Hero card */}
          <FeatureCard
            product={featured}
            onAdd={featured && "id" in featured ? () => handleAdd({ id: (featured as ProductRow).id, name: featured.name, price: featured.price, imageUrl: (featured as ProductRow).image_url }) : undefined}
            demo={useDemo}
          />

          {/* Two small tiles */}
          {tiles.map((p, i) => (
            <SmallTile
              key={"id" in p ? p.id : `demo-${i}`}
              name={p.name}
              price={p.price}
              imageUrl={"image_url" in p ? p.image_url : null}
              onAdd={"id" in p && (p as ProductRow).id ? () => handleAdd({ id: (p as ProductRow).id, name: p.name, price: p.price, imageUrl: (p as ProductRow).image_url }) : undefined}
            />
          ))}
        </section>

        {/* Remaining products */}
        {grid.length > 0 && (
          <section aria-label="More" className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-lg font-bold">New Curations</h2>
              {slug && (
                <Link to="/s/$slug/products" params={{ slug }} className="text-xs font-bold text-[#0d7a5f]">
                  View all
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {grid.map((p) => (
                <SmallTile
                  key={p.id}
                  name={p.name}
                  price={p.price}
                  imageUrl={p.image_url}
                  onAdd={() => handleAdd({ id: p.id, name: p.name, price: p.price, imageUrl: p.image_url })}
                />
              ))}
            </div>
          </section>
        )}

        {/* Loading skeleton row for perceived speed */}
        {useDemo && (
          <section aria-label="Loading" className="space-y-3">
            <div className="h-4 w-1/3 animate-pulse rounded-full bg-[#064e3b]/10" />
            <div className="flex gap-4">
              <div className="h-32 flex-1 animate-pulse rounded-3xl bg-[#064e3b]/10" />
              <div className="h-32 flex-1 animate-pulse rounded-3xl bg-[#064e3b]/10" />
            </div>
          </section>
        )}
      </main>

      {/* Bottom tab bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-4 z-40 mx-auto flex h-16 max-w-[22rem] items-center justify-around rounded-full bg-[#064e3b] px-8 shadow-2xl shadow-[#064e3b]/30"
      >
        <TabIcon active label="Home" icon={HomeIcon} />
        <TabIcon label="Wishlist" icon={Heart} />
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="grid h-12 w-12 -translate-y-4 place-items-center rounded-full bg-[#c9a84c] text-[#064e3b] shadow-lg ring-4 ring-[#f5f0e0]"
          aria-label="Cart"
        >
          <Package className="h-5 w-5" />
        </button>
        <TabIcon label="Search" icon={Search} />
        <TabIcon label="Account" icon={UserIcon} />
      </nav>

      {storeId && (
        <CartDrawer storeId={storeId} storeName={name} open={cartOpen} onOpenChange={setCartOpen} />
      )}
    </div>
  );
}

function TabIcon({
  icon: Icon, label, active = false,
}: { icon: typeof HomeIcon; label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={active ? "text-[#c9a84c]" : "text-[#f5f0e0]/40"}
    >
      <Icon className="h-6 w-6" />
    </button>
  );
}

function FeatureCard({
  product, onAdd, demo,
}: {
  product: ProductRow | { name: string; price: number; hue: string } | undefined;
  onAdd?: () => void;
  demo: boolean;
}) {
  if (!product) {
    return (
      <div className="col-span-2 h-56 animate-pulse rounded-3xl bg-white/60" />
    );
  }
  const img = "image_url" in product ? product.image_url : null;
  const hue = "hue" in product ? product.hue : "from-emerald-50 to-amber-50";

  return (
    <article className="col-span-2 flex flex-col rounded-3xl border border-[#064e3b]/5 bg-white p-1 shadow-sm">
      <div className={`relative h-48 w-full overflow-hidden rounded-[1.4rem] bg-gradient-to-br ${hue}`}>
        {img ? (
          <img src={img} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <Sparkles className="h-16 w-16 text-[#0d7a5f]/20" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#064e3b]/20 to-transparent" />
        <span className="absolute left-4 top-4 rounded-full bg-[#064e3b] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#c9a84c]">
          Editor's Choice
        </span>
      </div>
      <div className="flex items-center justify-between p-4">
        <div className="min-w-0">
          <h3 className="font-display truncate text-lg font-bold text-[#064e3b]">{product.name}</h3>
          <p className="text-sm font-medium text-[#064e3b]/60">৳ {product.price.toLocaleString()}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={!onAdd || demo}
          aria-label={`Add ${product.name} to cart`}
          className="grid h-12 w-12 place-items-center rounded-full bg-[#c9a84c] text-[#064e3b] shadow-md shadow-[#c9a84c]/30 transition hover:scale-105 disabled:opacity-60"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
    </article>
  );
}

function SmallTile({
  name, price, imageUrl, onAdd,
}: {
  name: string;
  price: number;
  imageUrl?: string | null;
  onAdd?: () => void;
}) {
  return (
    <article className="rounded-3xl border border-[#064e3b]/5 bg-white p-3 shadow-sm">
      <div className="mb-3 grid h-28 w-full place-items-center overflow-hidden rounded-2xl bg-[#f5f0e0]">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-white" />
        )}
      </div>
      <h4 className="font-display truncate text-sm font-bold text-[#064e3b]">{name}</h4>
      <div className="mt-1 flex items-center justify-between">
        <p className="text-xs font-semibold text-[#0d7a5f]">৳ {price.toLocaleString()}</p>
        <button
          type="button"
          onClick={onAdd}
          disabled={!onAdd}
          aria-label={`Add ${name} to cart`}
          className="grid h-7 w-7 place-items-center rounded-full bg-[#064e3b] text-[#c9a84c] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}
