import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft, ChevronRight, ChevronLeft, ChevronUp, ChevronDown,
  Loader2, Minus, Plus, ShoppingCart, Store as StoreIcon,
  Package, ShieldCheck, Truck, RotateCcw, MapPin, Heart, Share2, Star,
  MessageCircle, Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { usePublicProductDetail } from "@/lib/eazystore-data";
import { useCartStore } from "@/lib/cart-store";
import { Button } from "@/components/ui/button";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import { descriptionToHtml } from "@/lib/description-html";

export const Route = createFileRoute("/s/$slug/p/$productId")({
  head: ({ params }) => ({
    meta: [
      { title: `Product — ${params.slug}` },
      { name: "description", content: `View product details on ${params.slug}.` },
      { property: "og:type", content: "product" },
    ],
  }),
  component: PublicProductDetailPage,
});

function PublicProductDetailPage() {
  const { slug, productId } = Route.useParams();
  const q = usePublicProductDetail(slug, productId);
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const addToCart = useCartStore((s) => s.add);

  if (q.isLoading) {
    return (
      <main className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }
  if (!q.data) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div className="max-w-md space-y-3">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-foreground/5">
            <Package className="h-7 w-7 text-foreground/40" />
          </div>
          <h1 className="font-display text-2xl font-black">Product not found</h1>
          <p className="text-sm text-foreground/60">
            This product isn't available or the store is unpublished.
          </p>
          <Button asChild variant="outline">
            <Link to="/s/$slug" params={{ slug }}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to store
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  const { store, product, imageUrls } = q.data;
  const savings = product.regular_price && product.regular_price > product.price
    ? product.regular_price - product.price : null;
  const discountPct = product.regular_price && product.regular_price > product.price
    ? Math.round(((product.regular_price - product.price) / product.regular_price) * 100)
    : null;
  const inStock = product.stock > 0;
  const lowStock = inStock && product.stock <= 5;

  function handleAddToCart() {
    if (!inStock) return;
    addToCart(store.id, {
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: imageUrls[0] ?? null,
    }, qty);
    setCartOpen(true);
    toast.success(`Added ${qty} × ${product.name} to cart`);
  }
  function handleBuyNow() {
    if (!inStock) return;
    addToCart(store.id, {
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: imageUrls[0] ?? null,
    }, qty);
    setCartOpen(true);
  }

  const descriptionHtml = descriptionToHtml(product.description);

  return (
    <main className="min-h-screen bg-neutral-100">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/s/$slug"
            params={{ slug }}
            className="flex items-center gap-2 text-sm font-medium text-neutral-700 hover:text-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="truncate">{store.name}</span>
          </Link>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative grid h-10 w-10 place-items-center rounded-full bg-neutral-100 hover:bg-neutral-200"
            aria-label="Open cart"
          >
            <ShoppingCart className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Breadcrumb */}
      <nav className="mx-auto max-w-6xl px-4 pt-3 text-xs text-neutral-500 sm:px-6">
        <ol className="flex flex-wrap items-center gap-1">
          <li><Link to="/s/$slug" params={{ slug }} className="hover:text-primary">{store.name}</Link></li>
          <li><ChevronRight className="h-3 w-3" /></li>
          {product.brand && (
            <>
              <li className="max-w-[160px] truncate">{product.brand}</li>
              <li><ChevronRight className="h-3 w-3" /></li>
            </>
          )}
          <li className="max-w-[280px] truncate text-neutral-700">{product.name}</li>
        </ol>
      </nav>

      {/* MAIN CARD */}
      <section className="mx-auto mt-3 max-w-6xl px-4 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Left + Center inside white card */}
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <div className="grid gap-6 md:grid-cols-[minmax(0,360px)_1fr]">
              {/* Gallery */}
              <div>
                <div className="relative aspect-square overflow-hidden rounded-md bg-neutral-50 ring-1 ring-neutral-200">
                  {imageUrls[activeImg] ? (
                    <img
                      src={imageUrls[activeImg]}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-neutral-300">
                      <StoreIcon className="h-16 w-16" />
                    </div>
                  )}
                  {discountPct != null && (
                    <span className="absolute left-3 top-3 rounded-sm bg-red-500 px-2 py-1 text-[11px] font-bold text-white shadow">
                      -{discountPct}%
                    </span>
                  )}
                </div>
                {imageUrls.length > 1 && (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveImg((i) => Math.max(0, i - 1))}
                      disabled={activeImg === 0}
                      className="grid h-9 w-7 shrink-0 place-items-center rounded border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-30"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="flex flex-1 gap-2 overflow-x-auto">
                      {imageUrls.map((url, i) => (
                        <button
                          key={url + i}
                          type="button"
                          onClick={() => setActiveImg(i)}
                          className={`h-14 w-14 shrink-0 overflow-hidden rounded border-2 ${
                            activeImg === i ? "border-orange-500" : "border-transparent hover:border-neutral-300"
                          }`}
                        >
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveImg((i) => Math.min(imageUrls.length - 1, i + 1))}
                      disabled={activeImg === imageUrls.length - 1}
                      className="grid h-9 w-7 shrink-0 place-items-center rounded border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-30"
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <h1 className="font-display text-lg font-bold leading-snug text-neutral-900 sm:text-xl">
                    {product.name}
                  </h1>
                  <div className="flex shrink-0 items-center gap-1">
                    <button className="grid h-8 w-8 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100" aria-label="Share">
                      <Share2 className="h-4 w-4" />
                    </button>
                    <button className="grid h-8 w-8 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100" aria-label="Wishlist">
                      <Heart className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                  <span className="flex items-center gap-0.5 text-amber-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-current" />
                    ))}
                  </span>
                  <span className="text-neutral-500">Ratings: New</span>
                </div>

                <div className="mt-2 text-xs text-neutral-600">
                  Brand:{" "}
                  <span className="font-medium text-neutral-800">
                    {product.brand || "No Brand"}
                  </span>
                  {product.brand && (
                    <span className="ml-2 text-primary/80">| More from {product.brand}</span>
                  )}
                </div>

                <hr className="my-3 border-neutral-200" />

                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="font-display text-2xl font-bold text-orange-600 sm:text-3xl">
                    ৳ {product.price.toLocaleString()}
                  </span>
                  {product.regular_price && product.regular_price > product.price && (
                    <>
                      <span className="text-sm text-neutral-400 line-through">
                        ৳ {product.regular_price.toLocaleString()}
                      </span>
                      {discountPct != null && (
                        <span className="text-sm font-semibold text-orange-600">-{discountPct}%</span>
                      )}
                    </>
                  )}
                </div>
                {savings != null && (
                  <p className="mt-1 text-xs font-semibold text-emerald-700">
                    You save ৳ {savings.toLocaleString()}
                  </p>
                )}

                {imageUrls.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs text-neutral-600">
                      Color Family: <span className="ml-1 text-neutral-400">Not Specified</span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      {imageUrls.slice(0, 4).map((url, i) => (
                        <button
                          key={url + i}
                          type="button"
                          onClick={() => setActiveImg(i)}
                          className={`h-11 w-11 overflow-hidden rounded border-2 ${
                            activeImg === i ? "border-orange-500" : "border-neutral-200"
                          }`}
                        >
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-neutral-600">Quantity</span>
                    <div className="inline-flex items-center overflow-hidden rounded border border-neutral-300 bg-white">
                      <button
                        type="button"
                        onClick={() => setQty((v) => Math.max(1, v - 1))}
                        disabled={!inStock}
                        className="grid h-8 w-8 place-items-center text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
                        aria-label="Decrease"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-10 border-x border-neutral-300 py-1 text-center text-sm font-semibold">{qty}</span>
                      <button
                        type="button"
                        onClick={() => setQty((v) => Math.min(product.stock || 99, v + 1))}
                        disabled={!inStock}
                        className="grid h-8 w-8 place-items-center text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
                        aria-label="Increase"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {lowStock && (
                      <span className="text-xs font-medium text-orange-600">
                        Almost sold out, buy now!
                      </span>
                    )}
                    {!inStock && (
                      <span className="text-xs font-semibold text-rose-600">Out of stock</span>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    onClick={handleBuyNow}
                    disabled={!inStock}
                    className="h-11 min-w-[140px] flex-1 rounded-md bg-sky-500 text-sm font-bold text-white shadow-sm hover:bg-sky-600"
                  >
                    Buy Now
                  </Button>
                  <Button
                    onClick={handleAddToCart}
                    disabled={!inStock}
                    className="h-11 min-w-[140px] flex-1 rounded-md bg-orange-500 text-sm font-bold text-white shadow-sm hover:bg-orange-600"
                  >
                    <ShoppingCart className="mr-1.5 h-4 w-4" /> Add to Cart
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <aside className="space-y-3">
            {/* Delivery */}
            <div className="rounded-lg bg-white p-4 text-xs shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-neutral-800">Delivery Options</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
                  <div className="flex-1">
                    <p className="text-neutral-800">
                      {store.address || "Enter delivery location"}
                    </p>
                  </div>
                  <button className="text-primary hover:underline">CHANGE</button>
                </div>
                <div className="flex items-start gap-2">
                  <Truck className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
                  <div className="flex-1">
                    <p className="font-medium text-neutral-800">Standard Delivery</p>
                    <p className="text-neutral-500">Guaranteed by next 3–5 days</p>
                  </div>
                  <span className="font-semibold text-neutral-800">৳ 70</span>
                </div>
                <div className="flex items-start gap-2">
                  <Package className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
                  <p className="flex-1 text-neutral-800">Cash on Delivery Available</p>
                </div>
              </div>
            </div>

            {/* Return & Warranty */}
            <div className="rounded-lg bg-white p-4 text-xs shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-neutral-800">Return &amp; Warranty</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
                  <p className="flex-1 text-neutral-800">14 days easy return</p>
                </div>
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
                  <p className="flex-1 text-neutral-800">
                    {product.warranty ? product.warranty : "Warranty not available"}
                  </p>
                </div>
              </div>
            </div>

            {/* Seller */}
            <div className="rounded-lg bg-white p-4 text-xs shadow-sm">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <StoreIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-neutral-500">Sold by</p>
                  <p className="truncate text-sm font-semibold text-neutral-900">{store.name}</p>
                </div>
                <button className="inline-flex items-center gap-1 text-primary hover:underline">
                  <MessageCircle className="h-3.5 w-3.5" /> Chat Now
                </button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-neutral-500">Positive Ratings</p>
                  <p className="mt-1 text-sm font-bold text-neutral-900">—</p>
                </div>
                <div>
                  <p className="text-neutral-500">Ship on Time</p>
                  <p className="mt-1 text-sm font-bold text-neutral-900">—</p>
                </div>
                <div>
                  <p className="text-neutral-500">Response</p>
                  <p className="mt-1 text-sm font-bold text-neutral-900">—</p>
                </div>
              </div>

              <Link
                to="/s/$slug"
                params={{ slug }}
                className="mt-4 flex items-center justify-center gap-1 rounded border border-neutral-200 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                <Smartphone className="h-3.5 w-3.5" /> GO TO STORE
              </Link>
            </div>
          </aside>
        </div>

        {/* Product details */}
        <div className="mt-4 rounded-lg bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-neutral-800">Product details of {product.name}</h2>
          {descriptionBullets.length > 0 ? (
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-700">
              {descriptionBullets.map((b, i) => (
                <li key={i}>{b.replace(/^[-*•]\s*/, "")}</li>
              ))}
            </ul>
          ) : product.short_description ? (
            <p className="text-sm leading-relaxed text-neutral-700">{product.short_description}</p>
          ) : (
            <p className="text-sm text-neutral-500">No description provided.</p>
          )}

          {(product.sku || product.brand) && (
            <div className="mt-4 grid gap-2 border-t border-neutral-200 pt-4 text-xs text-neutral-600 sm:grid-cols-2">
              {product.brand && <div><span className="text-neutral-500">Brand:</span> <span className="font-medium text-neutral-800">{product.brand}</span></div>}
              {product.sku && <div><span className="text-neutral-500">SKU:</span> <span className="font-medium text-neutral-800">{product.sku}</span></div>}
            </div>
          )}
        </div>

        {/* Ratings & Reviews */}
        <ReviewsSection productId={product.id} productName={product.name} />

        <div className="h-6" />

      </section>

      {/* Mobile sticky action bar */}
      <div className="sticky bottom-0 z-10 border-t border-neutral-200 bg-white p-3 shadow-lg lg:hidden">
        <div className="mx-auto flex max-w-6xl gap-2">
          <Button onClick={handleAddToCart} disabled={!inStock} className="h-11 flex-1 rounded-md bg-orange-500 text-sm font-bold hover:bg-orange-600">
            <ShoppingCart className="mr-1.5 h-4 w-4" /> Add to Cart
          </Button>
          <Button onClick={handleBuyNow} disabled={!inStock} className="h-11 flex-1 rounded-md bg-sky-500 text-sm font-bold hover:bg-sky-600">
            Buy Now
          </Button>
        </div>
      </div>

      <CartDrawer
        storeId={store.id}
        storeName={store.name}
        open={cartOpen}
        onOpenChange={setCartOpen}
      />
    </main>
  );
}

type Review = {
  id: string;
  name: string;
  rating: number;
  date: string;
  title: string;
  body: string;
  verified?: boolean;
};

const SAMPLE_REVIEWS: Review[] = [
  { id: "1", name: "Rahim U.", rating: 5, date: "2 weeks ago", title: "Excellent quality!", body: "Product arrived quickly and matches the description perfectly. Highly recommended.", verified: true },
  { id: "2", name: "Ayesha K.", rating: 4, date: "1 month ago", title: "Good value", body: "Overall happy with the purchase. Packaging could be better but the product itself is great.", verified: true },
  { id: "3", name: "Sadia R.", rating: 5, date: "1 month ago", title: "Loved it", body: "Exactly as shown in the pictures. Fast delivery and friendly seller.", verified: true },
  { id: "4", name: "Tanvir H.", rating: 3, date: "2 months ago", title: "Decent", body: "It's okay for the price. Nothing extraordinary but does the job." },
];

function StarRow({ value, size = "h-4 w-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`${size} ${i < Math.round(value) ? "fill-amber-400 text-amber-400" : "fill-neutral-200 text-neutral-200"}`}
        />
      ))}
    </span>
  );
}

function ReviewsSection({ productId, productName }: { productId: string; productName: string }) {
  const storageKey = `reviews:${productId}`;
  const [reviews, setReviews] = useState<Review[]>(() => {
    if (typeof window === "undefined") return SAMPLE_REVIEWS;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw) as Review[];
    } catch {}
    return SAMPLE_REVIEWS;
  });
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [showForm, setShowForm] = useState(false);

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const dist = [5, 4, 3, 2, 1].map((s) => ({
    stars: s,
    count: reviews.filter((r) => r.rating === s).length,
  }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !body.trim()) {
      toast.error("Please add your name and review");
      return;
    }
    const next: Review = {
      id: Date.now().toString(),
      name: name.trim(),
      rating,
      date: "Just now",
      title: title.trim() || "Review",
      body: body.trim(),
    };
    const updated = [next, ...reviews];
    setReviews(updated);
    try { window.localStorage.setItem(storageKey, JSON.stringify(updated)); } catch {}
    setName(""); setTitle(""); setBody(""); setRating(5); setShowForm(false);
    toast.success("Thanks for your review!");
  }

  return (
    <div className="mt-4 rounded-lg bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-800">Ratings &amp; Reviews of {productName}</h2>
        <Button
          onClick={() => setShowForm((v) => !v)}
          variant="outline"
          className="h-9 rounded-md text-xs font-semibold"
        >
          {showForm ? "Cancel" : "Write a review"}
        </Button>
      </div>

      <div className="mt-4 grid gap-6 border-b border-neutral-200 pb-5 sm:grid-cols-[auto_1fr]">
        <div className="text-center sm:border-r sm:border-neutral-200 sm:pr-6">
          <div className="font-display text-4xl font-bold text-neutral-900">{avg.toFixed(1)}</div>
          <StarRow value={avg} />
          <p className="mt-1 text-xs text-neutral-500">{reviews.length} rating{reviews.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="space-y-1.5">
          {dist.map((d) => {
            const pct = reviews.length ? (d.count / reviews.length) * 100 : 0;
            return (
              <div key={d.stars} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-neutral-600">{d.stars}</span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right text-neutral-500">{d.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mt-4 space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-4">
          <div>
            <label className="text-xs font-medium text-neutral-700">Your rating</label>
            <div className="mt-1 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => {
                const n = i + 1;
                const active = (hover || rating) >= n;
                return (
                  <button
                    key={n}
                    type="button"
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => setRating(n)}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  >
                    <Star className={`h-6 w-6 ${active ? "fill-amber-400 text-amber-400" : "fill-neutral-200 text-neutral-300"}`} />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-primary"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Review title (optional)"
              className="h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your experience with this product…"
            rows={3}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="flex justify-end">
            <Button type="submit" className="h-9 rounded-md bg-orange-500 text-xs font-bold text-white hover:bg-orange-600">
              Submit review
            </Button>
          </div>
        </form>
      )}

      <ul className="mt-4 divide-y divide-neutral-200">
        {reviews.map((r) => (
          <li key={r.id} className="py-4">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {r.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-neutral-900">{r.name}</span>
                  {r.verified && (
                    <span className="rounded-sm bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Verified
                    </span>
                  )}
                  <span className="text-xs text-neutral-400">· {r.date}</span>
                </div>
                <div className="mt-1"><StarRow value={r.rating} size="h-3.5 w-3.5" /></div>
                {r.title && <p className="mt-1 text-sm font-semibold text-neutral-800">{r.title}</p>}
                <p className="mt-1 text-sm leading-relaxed text-neutral-700">{r.body}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

