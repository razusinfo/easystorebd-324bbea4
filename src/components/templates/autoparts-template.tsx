import {
  Search, ShoppingCart, Heart, User, Phone, Mail, Menu, ChevronRight,
  Star, Plus, Zap, Wrench, Gauge, Battery, Lightbulb, Cog, Shield, Car,
} from "lucide-react";
import type { StoreRow, ProductRow } from "@/lib/eazystore-data";

type Props = {
  store?: Partial<StoreRow> & { name: string };
  products?: ProductRow[];
  logoUrl?: string | null;
  demo?: boolean;
  accentColor?: string;
  defaultCategoryName?: string | null;
};

// Convert #RRGGBB → "r, g, b" for use with rgba(...) tints.
function hexToRgb(hex?: string): string | null {
  if (!hex) return null;
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  if (Number.isNaN(n) || v.length !== 6) return null;
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}


const DEMO_CATEGORIES = [
  { name: "Headlights & Lighting", icon: Lightbulb },
  { name: "Interior Accessories", icon: Car },
  { name: "Tires & Wheels", icon: Gauge },
  { name: "Tools & Equipment", icon: Wrench },
  { name: "Auto Safety & Security", icon: Shield },
  { name: "Garage Tools", icon: Cog },
  { name: "Original Battery Tools", icon: Battery },
  { name: "Phone Displays", icon: Zap },
  { name: "Battery and adhesives", icon: Battery },
];

const DEMO_PRODUCTS = [
  { name: "Thinkware F770 Dash Cam Dual Channel Wifi", price: 249.99, old: 269.99, discount: 8, stock: 30, sold: 12 },
  { name: "Techxiaxx Car Alarm with Charging Function", price: 47.99, old: 51.99, discount: 8, stock: 45, sold: 20 },
  { name: "Right Stuff® – Drilled and Slotted Brake Rotor", price: 157.99, old: 199.37, discount: 21, stock: 25, sold: 18 },
  { name: "R1 Concepts® – eLINE Series Plain Brake Rotors", price: 187.60, old: 319.60, discount: 15, stock: 15, sold: 8 },
  { name: "Power Stop® – Evolution Drilled and Slotted", price: 154.89, old: 162.99, discount: 5, stock: 40, sold: 22 },
];

const DEMO_DEALS = [
  { name: '5" Monitor with 1080p Backup Camera for Truck', price: 83.99, old: 88.99, discount: 6, available: 39, sold: 19 },
  { name: "Lumen® – Custom Sealed Beam LED Headlights", price: 69.99, old: 89.99, discount: 23, available: 65, sold: 27 },
];

export function AutoPartsTemplate({
  store, products, logoUrl, demo = false, accentColor, defaultCategoryName,
}: Props) {
  const name = store?.name ?? "Partdo";
  const tagline = store?.tagline ?? "Auto Parts Marketplace";
  const useDemo = demo || !products || products.length === 0;
  const gridProducts = useDemo
    ? DEMO_PRODUCTS
    : products!.slice(0, 5).map((p) => ({
        name: p.name, price: p.price, old: Math.round(p.price * 1.15 * 100) / 100,
        discount: 13, stock: p.stock, sold: Math.max(0, Math.floor(p.stock / 3)),
      }));
  const dealProducts = useDemo
    ? DEMO_DEALS
    : products!.slice(5, 7).map((p) => ({
        name: p.name, price: p.price, old: Math.round(p.price * 1.20 * 100) / 100,
        discount: 20, available: p.stock, sold: Math.floor(p.stock / 2),
      }));
  const featuredHeading = defaultCategoryName || "Auto Safety & Security";
  const rgb = hexToRgb(accentColor);
  const overrideCss = accentColor && rgb ? `
    .autoparts-scope .bg-red-600 { background-color: ${accentColor} !important; }
    .autoparts-scope .hover\\:bg-red-700:hover { background-color: ${accentColor} !important; filter: brightness(0.9); }
    .autoparts-scope .text-red-600 { color: ${accentColor} !important; }
    .autoparts-scope .hover\\:text-red-600:hover { color: ${accentColor} !important; }
    .autoparts-scope .border-red-500 { border-color: ${accentColor} !important; }
    .autoparts-scope .border-red-600 { border-color: ${accentColor} !important; }
    .autoparts-scope .border-red-300 { border-color: rgba(${rgb}, 0.4) !important; }
    .autoparts-scope .border-red-200 { border-color: rgba(${rgb}, 0.3) !important; }
    .autoparts-scope .bg-red-50 { background-color: rgba(${rgb}, 0.08) !important; }
    .autoparts-scope .from-red-50 { --tw-gradient-from: rgba(${rgb}, 0.08) !important; }
    .autoparts-scope .to-rose-50 { --tw-gradient-to: rgba(${rgb}, 0.05) !important; }
    .autoparts-scope .focus\\:border-red-500:focus { border-color: ${accentColor} !important; }
  ` : "";

  return (
    <div className="autoparts-scope min-h-screen bg-neutral-50 font-sans text-neutral-900">
      {overrideCss ? <style dangerouslySetInnerHTML={{ __html: overrideCss }} /> : null}

      {/* Utility bar */}
      <div className="hidden bg-white text-[11px] text-neutral-600 lg:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-2">
          <div className="flex gap-5">
            <a href="#" className="hover:text-red-600">About Us</a>
            <a href="#" className="hover:text-red-600">My account</a>
            <a href="#" className="hover:text-red-600">Order Tracking</a>
            <a href="#" className="hover:text-red-600">Wishlist</a>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-neutral-500">Need Help? Call us:</span>
            <span className="flex items-center gap-1 font-semibold text-neutral-800"><Phone className="h-3 w-3" /> (+800) 1234 5678 90</span>
            <span className="flex items-center gap-1 text-neutral-800"><Mail className="h-3 w-3" /> info@company.com</span>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-5 sm:px-5 sm:py-4">
          <button className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-neutral-200 lg:hidden">
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex shrink-0 items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt={`${name} logo`} className="h-8 w-8 rounded object-cover" />
            ) : (
              <div className="grid h-8 w-8 place-items-center rounded bg-red-600 text-white">
                <Zap className="h-4 w-4" fill="currentColor" />
              </div>
            )}
            <span className="font-display text-xl font-black tracking-tight sm:text-2xl">{name}</span>
          </div>

          <div className="relative hidden min-w-0 flex-1 lg:block">
            <input
              type="text"
              placeholder="Search by Product Type, Part Number, or Brand..."
              className="w-full rounded-md border border-neutral-300 bg-white py-2.5 pl-4 pr-12 text-sm outline-none focus:border-red-500"
            />
            <button className="absolute right-1 top-1/2 grid h-8 w-10 -translate-y-1/2 place-items-center rounded bg-red-600 text-white">
              <Search className="h-4 w-4" />
            </button>
          </div>

          <div className="ml-auto flex items-center gap-3 sm:gap-5">
            <div className="hidden text-right sm:block">
              <div className="flex items-center gap-1 text-xs text-neutral-500">
                <User className="h-3.5 w-3.5" /> My Account
              </div>
              <div className="text-[11px] text-neutral-500">Hello, Sign In</div>
            </div>
            <button className="relative grid h-9 w-9 place-items-center text-neutral-700">
              <Heart className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[9px] font-bold text-white">0</span>
            </button>
            <div className="flex items-center gap-2">
              <button className="relative grid h-9 w-9 place-items-center rounded bg-red-50 text-red-600">
                <ShoppingCart className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[9px] font-bold text-white">0</span>
              </button>
              <div className="hidden text-left text-xs sm:block">
                <div className="text-neutral-500">0 items</div>
                <div className="font-bold text-neutral-900">$0.00</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search on mobile */}
        <div className="border-t border-neutral-100 px-4 pb-3 lg:hidden">
          <div className="relative">
            <input
              type="text"
              placeholder="Search parts..."
              className="w-full rounded-md border border-neutral-300 py-2.5 pl-4 pr-11 text-sm outline-none focus:border-red-500"
            />
            <button className="absolute right-1 top-1/2 grid h-8 w-9 -translate-y-1/2 place-items-center rounded bg-red-600 text-white">
              <Search className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Category strip */}
        <div className="hidden border-t border-neutral-100 lg:block">
          <div className="mx-auto flex max-w-7xl items-center px-5">
            <button className="flex items-center gap-2 bg-red-600 px-5 py-3 text-sm font-bold text-white">
              <Menu className="h-4 w-4" /> All Categories
            </button>
            <nav className="flex flex-1 items-center gap-6 px-6 text-sm font-semibold text-neutral-700">
              <a href="#" className="hover:text-red-600">Home</a>
              <a href="#" className="hover:text-red-600">Shop</a>
              <a href="#" className="hover:text-red-600">Tires & Wheels</a>
              <a href="#" className="hover:text-red-600">Interior Accessories</a>
              <a href="#" className="hover:text-red-600">Blog</a>
              <a href="#" className="hover:text-red-600">Contact</a>
              <a href="#" className="hover:text-red-600">Top Offers</a>
            </nav>
            <a href="#" className="flex items-center gap-2 text-sm font-semibold text-red-600">
              <div className="grid h-5 w-5 place-items-center rounded-full bg-red-600 text-[10px] text-white">?</div>
              Help Center
            </a>
          </div>
        </div>
      </header>

      {/* Hero + sidebar */}
      <section className="mx-auto max-w-7xl px-4 py-4 sm:px-5 sm:py-6">
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* Category sidebar */}
          <aside className="hidden overflow-hidden rounded-lg border border-neutral-200 bg-white lg:block">
            <div className="bg-red-600 px-4 py-3 text-sm font-bold text-white">All Categories</div>
            <ul className="divide-y divide-neutral-100">
              {DEMO_CATEGORIES.map((c) => (
                <li key={c.name}>
                  <a href="#" className="flex items-center justify-between px-4 py-2.5 text-[13px] text-neutral-700 hover:bg-neutral-50 hover:text-red-600">
                    <span className="flex items-center gap-2"><c.icon className="h-4 w-4 text-neutral-400" /> {c.name}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
                  </a>
                </li>
              ))}
              <li className="px-4 py-2.5 text-[13px] font-semibold text-neutral-700">Best Seller</li>
              <li className="px-4 py-2.5 text-[13px] font-semibold text-neutral-700">Top 100 Offers on Sale</li>
              <li className="flex items-center justify-between px-4 py-2.5 text-[13px] font-semibold text-neutral-700">
                New Arrivals <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-bold text-white">NEW</span>
              </li>
            </ul>
          </aside>

          {/* Hero banner */}
          <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-neutral-800 to-neutral-900 text-white">
            <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
              <div className="flex flex-col justify-center">
                <span className="text-xs font-semibold uppercase tracking-widest text-neutral-300">This Week Only for World Premier</span>
                <h1 className="mt-2 font-display text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">When Buying Parts With Installation</h1>
                <p className="mt-3 max-w-md text-sm text-neutral-300">
                  Installation of parts in the services of our partners. Limited time offer for new customers, also get free shipping on orders.
                </p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-sm text-neutral-400 line-through">$139.00</span>
                  <span className="font-display text-2xl font-black text-white">$109.00</span>
                </div>
                <button className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700">
                  Buy Now <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="relative hidden items-center justify-center sm:flex">
                <div className="grid h-56 w-56 place-items-center rounded-full bg-white/5 ring-1 ring-white/10">
                  <Gauge className="h-32 w-32 text-white/70" strokeWidth={1} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="mx-auto max-w-7xl px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
          <div className="flex flex-wrap items-center gap-5">
            <h2 className="font-display text-lg font-black">Featured Products</h2>
            <nav className="flex flex-wrap items-center gap-4 text-xs font-semibold text-neutral-500 sm:text-sm">
              <a href="#" className="border-b-2 border-red-600 pb-1 text-red-600">{featuredHeading}</a>
              <a href="#" className="hover:text-red-600">Interior Accessories</a>
              <a href="#" className="hover:text-red-600">Motor Oils</a>
              <a href="#" className="hover:text-red-600">Tires & Wheels</a>
            </nav>
          </div>
          <a href="#" className="flex items-center gap-1 text-xs font-semibold text-red-600 sm:text-sm">View All <ChevronRight className="h-3 w-3" /></a>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {gridProducts.map((p, i) => <ProductCard key={i} {...p} />)}
        </div>
      </section>

      {/* 3-column promo */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <PromoCard tag="On Sale This Week" title="The World's Best Engine Oils for Your Car" tint="from-amber-100 to-amber-200" />
          <PromoCard tag="On Sale This Week" title="Change Tires for Winter Ensure Your Safety" tint="from-neutral-100 to-neutral-300" />
          <PromoCard tag="On Sale This Week" title="Unleash The True Potential Of Your Vehicle" tint="from-sky-100 to-sky-200" />
        </div>
      </section>

      {/* Latest Deals */}
      <section className="mx-auto max-w-7xl px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
          <h2 className="font-display text-lg font-black">
            Latest Deals for This Week <span className="ml-2 text-xs font-normal text-neutral-500">Don't miss out on these deals</span>
          </h2>
          <a href="#" className="flex items-center gap-1 text-xs font-semibold text-red-600 sm:text-sm">View All <ChevronRight className="h-3 w-3" /></a>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {dealProducts.map((d, i) => <DealCard key={i} {...d} />)}
        </div>
      </section>

      {/* Sticky ribbon */}
      <div className="sticky bottom-0 z-10 mt-6 border-t border-red-200 bg-gradient-to-r from-red-50 to-rose-50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="rounded bg-red-600 px-3 py-1 text-lg font-black text-white">-39%</span>
            <div>
              <div className="font-display text-sm font-black sm:text-base">Super discount for your first purchase</div>
              <div className="text-[11px] text-neutral-500">Use discount code in checkout page</div>
            </div>
          </div>
          <div className="rounded border-2 border-dashed border-red-500 bg-white px-4 py-1.5 font-mono text-sm font-black text-red-600">FREE15FIRST</div>
        </div>
      </div>

      <footer className="border-t border-neutral-200 bg-white py-5 text-center text-xs text-neutral-500">
        Powered by <a href="/" className="font-bold text-red-600 hover:underline">EazyStore</a> · {tagline}
      </footer>
    </div>
  );
}

function ProductCard({ name, price, old, discount, stock }: { name: string; price: number; old: number; discount: number; stock: number }) {
  return (
    <article className="group relative overflow-hidden rounded-lg border border-neutral-200 bg-white p-3 transition hover:border-red-300 hover:shadow-md">
      <span className="absolute left-2 top-2 z-10 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">-{discount}%</span>
      <button className="absolute right-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-white/80 text-neutral-500 hover:text-red-600">
        <Heart className="h-3.5 w-3.5" />
      </button>
      <div className="grid h-24 place-items-center rounded bg-neutral-50 sm:h-28">
        <Cog className="h-14 w-14 text-neutral-300" strokeWidth={1} />
      </div>
      <h3 className="mt-2 line-clamp-2 text-xs font-semibold text-neutral-800 sm:text-[13px]">{name}</h3>
      <div className="mt-1 flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />)}
        <span className="ml-1 text-[10px] text-neutral-500">1 review</span>
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] text-neutral-400 line-through">${old.toFixed(2)}</span>
          <span className="font-black text-red-600">${price.toFixed(2)}</span>
        </div>
        <button className="grid h-7 w-7 place-items-center rounded bg-neutral-100 text-neutral-600 hover:bg-red-600 hover:text-white">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-600">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> In Stock ({stock})
      </div>
    </article>
  );
}

function PromoCard({ tag, title, tint }: { tag: string; title: string; tint: string }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-gradient-to-br ${tint} p-5 min-h-[140px]`}>
      <span className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">{tag}</span>
      <h3 className="mt-2 max-w-[70%] font-display text-lg font-black leading-tight text-neutral-900">{title}</h3>
      <a href="#" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-red-600">
        Shop Now <ChevronRight className="h-3 w-3" />
      </a>
    </div>
  );
}

function DealCard({ name, price, old, discount, available, sold }: { name: string; price: number; old: number; discount: number; available: number; sold: number }) {
  const pct = Math.round((sold / (sold + available)) * 100);
  return (
    <article className="relative flex gap-4 overflow-hidden rounded-lg border border-neutral-200 bg-white p-4">
      <span className="absolute left-2 top-2 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">-{discount}%</span>
      <div className="grid h-24 w-24 shrink-0 place-items-center rounded bg-neutral-50">
        <Lightbulb className="h-12 w-12 text-neutral-300" strokeWidth={1} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <h3 className="line-clamp-2 text-sm font-semibold text-neutral-800">{name}</h3>
        <div className="flex items-center gap-0.5">
          {[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />)}
          <span className="ml-1 text-[10px] text-neutral-500">1 review</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] text-neutral-400 line-through">${old.toFixed(2)}</span>
          <span className="font-black text-red-600">${price.toFixed(2)}</span>
        </div>
        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-red-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
            <span>Available {available}</span><span>Sold {sold}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
