import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft, Loader2, Minus, Plus, ShoppingCart, Store as StoreIcon,
  Package, ShieldCheck, Truck,
} from "lucide-react";
import { toast } from "sonner";
import { usePublicProductDetail } from "@/lib/eazystore-data";
import { useCartStore } from "@/lib/cart-store";
import { Button } from "@/components/ui/button";
import { CartDrawer } from "@/components/storefront/cart-drawer";

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
  const inStock = product.stock > 0;

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

  return (
    <main className="min-h-screen bg-neutral-50">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur">
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

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-6 sm:px-6 md:grid-cols-[1.1fr_1fr] md:py-10">
        {/* Gallery */}
        <div className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-200">
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
            {savings != null && (
              <span className="absolute left-3 top-3 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white shadow">
                Save {savings.toLocaleString()} ৳
              </span>
            )}
          </div>
          {imageUrls.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {imageUrls.map((url, i) => (
                <button
                  key={url + i}
                  type="button"
                  onClick={() => setActiveImg(i)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-2 ${
                    activeImg === i ? "ring-primary" : "ring-neutral-200"
                  }`}
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-5">
          <div>
            {product.brand && (
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {product.brand}
              </p>
            )}
            <h1 className="mt-1 font-display text-2xl font-black text-neutral-900 sm:text-3xl">
              {product.name}
            </h1>
            {product.short_description && (
              <p className="mt-2 text-sm text-neutral-600">{product.short_description}</p>
            )}
          </div>

          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-display text-3xl font-black text-primary">
              {product.price.toLocaleString()} ৳
            </span>
            {product.regular_price && product.regular_price > product.price && (
              <span className="text-lg text-neutral-400 line-through">
                {product.regular_price.toLocaleString()} ৳
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span
              className={`rounded-full px-2.5 py-1 font-semibold ${
                inStock
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-rose-100 text-rose-700"
              }`}
            >
              {inStock ? `In stock (${product.stock})` : "Out of stock"}
            </span>
            {product.sku && (
              <span className="text-neutral-500">SKU: {product.sku}</span>
            )}
            {product.warranty && (
              <span className="text-neutral-500">Warranty: {product.warranty}</span>
            )}
          </div>

          {/* Qty + add to cart */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white p-1">
              <Button
                type="button" size="icon" variant="ghost" className="h-9 w-9 rounded-full"
                onClick={() => setQty((v) => Math.max(1, v - 1))}
                disabled={!inStock}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center text-sm font-bold">{qty}</span>
              <Button
                type="button" size="icon" variant="ghost" className="h-9 w-9 rounded-full"
                onClick={() => setQty((v) => Math.min(product.stock || 99, v + 1))}
                disabled={!inStock}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Button
              size="lg"
              className="flex-1 min-w-[180px]"
              onClick={handleAddToCart}
              disabled={!inStock}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              {inStock ? "Add to cart" : "Out of stock"}
            </Button>
          </div>

          {/* Perks */}
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-neutral-200 bg-white p-3 text-xs text-neutral-600">
            <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> Cash on delivery</div>
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Verified seller</div>
          </div>

          {product.description && (
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <h2 className="font-display text-lg font-black">Description</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                {product.description}
              </p>
            </div>
          )}
        </div>
      </section>

      <CartDrawer
        storeId={store.id}
        storeName={store.name}
        open={cartOpen}
        onOpenChange={setCartOpen}
      />
    </main>
  );
}
