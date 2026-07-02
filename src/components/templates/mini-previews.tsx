import { Search, ShoppingCart, Menu, Star, Zap } from "lucide-react";

/**
 * Full-fidelity 1280x1000 mini storefront previews used as scaled thumbnails
 * on the Themes page. Each variant matches its template's tagline and accent.
 */

type Props = { accent: string };

const DEMO_ITEMS = [
  { name: "Classic Cotton Shirt", price: 1250 },
  { name: "Vintage Leather Bag", price: 3400 },
  { name: "Minimal Wall Clock", price: 890 },
  { name: "Ceramic Coffee Mug", price: 420 },
  { name: "Wooden Desk Organizer", price: 1580 },
  { name: "Linen Throw Pillow", price: 760 },
  { name: "Brass Table Lamp", price: 2450 },
  { name: "Woven Storage Basket", price: 980 },
];

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

export function MinimalMonoPreview({ accent }: Props) {
  return (
    <div className="min-h-[1000px] w-[1280px] bg-white font-sans text-neutral-900">
      <header className="border-b border-neutral-200 px-16 py-8">
        <div className="flex items-center justify-between">
          <div className="font-serif text-3xl font-bold tracking-tight">MONO.</div>
          <nav className="flex gap-10 text-sm uppercase tracking-widest">
            <span>Shop</span><span>Journal</span><span>About</span><span>Contact</span>
          </nav>
          <div className="flex items-center gap-6">
            <Search className="h-5 w-5" />
            <ShoppingCart className="h-5 w-5" />
          </div>
        </div>
      </header>
      <section className="px-16 py-20">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">New collection</p>
        <h1 className="mt-4 max-w-3xl font-serif text-7xl font-bold leading-[1.05] tracking-tight">
          Considered objects for everyday rituals.
        </h1>
        <button
          className="mt-10 rounded-none border-b-2 pb-1 text-sm font-semibold uppercase tracking-widest"
          style={{ borderColor: accent, color: accent }}
        >
          Browse the edit →
        </button>
      </section>
      <section className="grid grid-cols-4 gap-8 px-16 pb-20">
        {DEMO_ITEMS.slice(0, 4).map((p, i) => (
          <div key={i}>
            <div className="aspect-[3/4] bg-neutral-100" />
            <div className="mt-4 flex items-baseline justify-between">
              <div className="text-sm">{p.name}</div>
              <div className="font-serif text-sm">৳{p.price.toLocaleString()}</div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

export function BoutiqueBlushPreview({ accent }: Props) {
  return (
    <div className="min-h-[1000px] w-[1280px] bg-rose-50/50 font-sans text-neutral-900">
      <header className="px-14 py-6">
        <div className="flex items-center justify-between rounded-full bg-white/80 px-8 py-4 shadow-sm">
          <div className="font-serif text-2xl italic" style={{ color: accent }}>Boutique</div>
          <nav className="flex gap-8 text-sm">
            <span>New</span><span>Dresses</span><span>Accessories</span><span>Sale</span>
          </nav>
          <div className="flex items-center gap-4">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-rose-100"><Search className="h-4 w-4" /></div>
            <div className="grid h-9 w-9 place-items-center rounded-full" style={{ backgroundColor: accent }}>
              <ShoppingCart className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>
      </header>
      <section className="px-14 py-10">
        <div className="grid grid-cols-2 gap-8 rounded-3xl bg-gradient-to-br from-pink-200 to-rose-300 p-14">
          <div className="flex flex-col justify-center">
            <span className="w-fit rounded-full bg-white/70 px-4 py-1 text-xs font-bold uppercase tracking-widest">
              Spring '26
            </span>
            <h1 className="mt-6 font-serif text-6xl font-bold italic text-white">
              Blooming softly.
            </h1>
            <p className="mt-4 text-white/90">A romantic capsule of blush pastels and airy silhouettes.</p>
            <button className="mt-8 w-fit rounded-full bg-white px-8 py-3 text-sm font-bold" style={{ color: accent }}>
              Shop the look
            </button>
          </div>
          <div className="rounded-2xl bg-white/40 backdrop-blur-sm" />
        </div>
      </section>
      <section className="grid grid-cols-4 gap-6 px-14 pb-16">
        {DEMO_ITEMS.slice(0, 4).map((p, i) => (
          <div key={i} className="overflow-hidden rounded-3xl bg-white p-4 shadow-sm">
            <div className="aspect-square rounded-2xl bg-rose-100" />
            <div className="mt-3 text-sm font-medium">{p.name}</div>
            <div className="mt-1 font-serif text-lg italic" style={{ color: accent }}>
              ৳{p.price.toLocaleString()}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

export function TechGridPreview({ accent }: Props) {
  const rgb = hexToRgb(accent);
  return (
    <div className="min-h-[1000px] w-[1280px] bg-neutral-950 font-mono text-neutral-100">
      <header className="border-b border-neutral-800 px-14 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: accent }} />
            <span className="text-lg font-bold tracking-tight">TECHGRID</span>
          </div>
          <div className="flex flex-1 justify-center px-16">
            <div className="flex w-full max-w-xl items-center gap-3 rounded-md border border-neutral-800 bg-neutral-900 px-4 py-2.5">
              <Search className="h-4 w-4 text-neutral-500" />
              <span className="text-xs text-neutral-500">search 12,480 skus…</span>
            </div>
          </div>
          <div className="flex gap-3 text-xs">
            <span className="rounded-md border border-neutral-800 px-3 py-2">Compare</span>
            <span className="rounded-md px-3 py-2 text-neutral-950" style={{ backgroundColor: accent }}>Cart · 3</span>
          </div>
        </div>
      </header>
      <section className="grid grid-cols-[220px_1fr] gap-6 px-14 py-8">
        <aside className="space-y-2 text-xs">
          <div className="mb-3 text-[10px] uppercase tracking-widest text-neutral-500">Categories</div>
          {["CPUs", "GPUs", "SSDs", "Motherboards", "Cooling", "PSUs", "Peripherals"].map((c, i) => (
            <div key={c} className={`rounded-md px-3 py-2 ${i === 1 ? "text-neutral-950" : "border border-neutral-800"}`}
                 style={i === 1 ? { backgroundColor: accent } : undefined}>
              {c}
            </div>
          ))}
        </aside>
        <div>
          <div className="mb-6 rounded-lg border border-neutral-800 p-6"
               style={{ background: `linear-gradient(135deg, rgba(${rgb},0.18), transparent)` }}>
            <div className="text-[10px] uppercase tracking-widest" style={{ color: accent }}>Featured</div>
            <div className="mt-2 text-3xl font-bold">RTX 5090 · 32GB GDDR7</div>
            <div className="mt-1 text-sm text-neutral-400">In stock · Ships in 24h</div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {DEMO_ITEMS.slice(0, 6).map((p, i) => (
              <div key={i} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
                <div className="aspect-video rounded-md bg-neutral-950" />
                <div className="mt-3 text-[10px] uppercase tracking-widest text-neutral-500">SKU-{2000 + i}</div>
                <div className="mt-1 text-sm font-bold">{p.name}</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-lg font-bold" style={{ color: accent }}>৳{p.price.toLocaleString()}</span>
                  <span className="rounded border border-neutral-700 px-2 py-1 text-[10px]">+ ADD</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function SportyPulsePreview({ accent }: Props) {
  return (
    <div className="min-h-[1000px] w-[1280px] bg-white font-sans text-neutral-900">
      <header className="px-14 py-5" style={{ backgroundColor: accent }}>
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-2 text-2xl font-black italic tracking-tight">
            <Zap className="h-6 w-6" /> PULSE
          </div>
          <nav className="flex gap-8 text-sm font-bold uppercase">
            <span>Run</span><span>Train</span><span>Cycle</span><span>Team</span>
          </nav>
          <div className="flex items-center gap-3">
            <Search className="h-5 w-5" />
            <ShoppingCart className="h-5 w-5" />
          </div>
        </div>
      </header>
      <section className="relative overflow-hidden bg-neutral-100 px-14 py-16">
        <div className="grid grid-cols-2 items-center gap-8">
          <div>
            <span className="rounded-sm px-3 py-1 text-xs font-black uppercase text-white" style={{ backgroundColor: accent }}>
              Drop 03
            </span>
            <h1 className="mt-4 text-7xl font-black italic uppercase leading-none tracking-tighter">
              Move<br/>faster.
            </h1>
            <p className="mt-4 max-w-md text-neutral-600">Engineered kit for peak days. Built to outlast the miles.</p>
            <button className="mt-6 skew-x-[-8deg] px-8 py-4 text-sm font-black uppercase tracking-wider text-white"
                    style={{ backgroundColor: accent }}>
              Shop the drop
            </button>
          </div>
          <div className="aspect-square rounded-3xl bg-gradient-to-br from-orange-200 to-red-300" />
        </div>
      </section>
      <section className="px-14 py-10">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-3xl font-black italic uppercase">Trending gear</h2>
          <span className="text-sm font-bold" style={{ color: accent }}>View all →</span>
        </div>
        <div className="grid grid-cols-4 gap-5">
          {DEMO_ITEMS.slice(0, 4).map((p, i) => (
            <div key={i} className="group overflow-hidden rounded-2xl bg-neutral-50">
              <div className="aspect-square bg-gradient-to-br from-neutral-200 to-neutral-300" />
              <div className="p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">Performance</div>
                <div className="mt-1 text-base font-black">{p.name}</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xl font-black italic">৳{p.price.toLocaleString()}</span>
                  <span className="skew-x-[-8deg] px-3 py-1.5 text-[10px] font-black uppercase text-white"
                        style={{ backgroundColor: accent }}>Add</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function LuxeNoirPreview({ accent }: Props) {
  return (
    <div className="min-h-[1000px] w-[1280px] bg-neutral-950 font-serif text-neutral-100">
      <header className="border-b border-neutral-800 px-16 py-8">
        <div className="flex items-center justify-between">
          <nav className="flex gap-10 text-xs uppercase tracking-[0.3em] text-neutral-400">
            <span>Maison</span><span>Collections</span><span>Bespoke</span>
          </nav>
          <div className="text-3xl font-bold italic tracking-wider" style={{ color: accent }}>Luxe</div>
          <div className="flex gap-6 text-xs uppercase tracking-[0.3em] text-neutral-400">
            <span>Search</span><span>Bag (2)</span>
          </div>
        </div>
      </header>
      <section className="relative px-16 py-24 text-center">
        <p className="text-xs uppercase tracking-[0.4em]" style={{ color: accent }}>Winter Atelier · MMXXVI</p>
        <h1 className="mx-auto mt-6 max-w-4xl text-6xl font-bold italic leading-tight tracking-tight">
          A quiet dialogue between craft, gold, and shadow.
        </h1>
        <div className="mx-auto mt-8 h-px w-20" style={{ backgroundColor: accent }} />
        <button className="mt-8 border px-10 py-3 text-xs uppercase tracking-[0.3em]"
                style={{ borderColor: accent, color: accent }}>
          Discover the collection
        </button>
      </section>
      <section className="grid grid-cols-3 gap-10 px-16 pb-24">
        {DEMO_ITEMS.slice(0, 3).map((p, i) => (
          <div key={i} className="text-center">
            <div className="aspect-[3/4] bg-neutral-900" />
            <div className="mt-6 flex items-center justify-center gap-1" style={{ color: accent }}>
              {[...Array(5)].map((_, s) => <Star key={s} className="h-3 w-3 fill-current" />)}
            </div>
            <div className="mt-3 text-lg italic">{p.name}</div>
            <div className="mt-1 text-xs uppercase tracking-widest text-neutral-500">
              ৳{(p.price * 8).toLocaleString()}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
