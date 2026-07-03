import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Home, ShoppingBag, Package, Settings as SettingsIcon,
  Plus, TrendingUp, TrendingDown, Users, Eye, DollarSign,
  Search, Filter, ChevronRight, Bell, Truck, CheckCircle2,
  Clock, XCircle, Loader2, ExternalLink, Store as StoreIcon,
  Zap, ArrowUpRight, MoreVertical, Wifi, WifiOff,
} from "lucide-react";
import { useMyStore, useMyProducts, buildStorefrontUrl } from "@/lib/eazystore-data";
import {
  useOrders, useUpdateOrderStatus, ORDER_STATUSES,
  statusBadgeClass, type OrderStatus, type OrderRow,
} from "@/lib/orders-data";

export const Route = createFileRoute("/_authenticated/mobile-app")({
  head: () => ({
    meta: [
      { title: "Mobile App — EazyStore" },
      { name: "description", content: "Manage your EazyStore shop from your phone — sales, orders, products, and settings on the go." },
      { name: "theme-color", content: "#7C3AED" },
    ],
  }),
  component: MobileAppShell,
});

type Tab = "home" | "orders" | "products" | "settings";

function MobileAppShell() {
  const [tab, setTab] = useState<Tab>("home");
  const store = useMyStore();
  const products = useMyProducts(store.data?.id);
  const orders = useOrders(store.data?.id);

  if (store.isLoading) {
    return (
      <main className="grid min-h-[70vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-gradient-to-b from-violet-50 via-white to-violet-50/50 pb-24">
      <StatusBar storeName={store.data?.name ?? "My Store"} />

      <div className="flex-1">
        {tab === "home" && <HomeTab orders={orders.data ?? []} products={products.data ?? []} store={store.data} />}
        {tab === "orders" && <OrdersTab storeId={store.data?.id} orders={orders.data ?? []} loading={orders.isLoading} />}
        {tab === "products" && <ProductsTab products={products.data ?? []} loading={products.isLoading} />}
        {tab === "settings" && <SettingsTab store={store.data} />}
      </div>

      {/* Floating action button */}
      {(tab === "products" || tab === "home") && (
        <Link
          to="/products/new"
          className="fixed bottom-24 right-1/2 z-30 translate-x-[calc(50%+140px)] grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-[0_10px_30px_-5px_rgba(124,58,237,0.6)] ring-4 ring-white transition-transform active:scale-95"
          aria-label="Add product"
        >
          <Plus className="h-6 w-6" strokeWidth={3} />
        </Link>
      )}

      <BottomNav tab={tab} onChange={setTab} />
    </div>
  );
}

/* --------------------------- Chrome --------------------------- */

function StatusBar({ storeName }: { storeName: string }) {
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-violet-100/70 bg-white/80 px-4 py-3 backdrop-blur-xl">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md">
        <span className="text-sm font-black">{storeName.slice(0, 2).toUpperCase()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-600">
          {online ? <><Wifi className="mr-1 inline h-3 w-3" />Online</> : <><WifiOff className="mr-1 inline h-3 w-3" />Offline</>}
        </p>
        <p className="truncate text-sm font-black text-slate-900">{storeName}</p>
      </div>
      <button className="relative grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-700 active:scale-95">
        <Bell className="h-5 w-5" />
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
      </button>
    </header>
  );
}

function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const items: { id: Tab; icon: any; label: string }[] = [
    { id: "home", icon: Home, label: "Dashboard" },
    { id: "orders", icon: ShoppingBag, label: "Orders" },
    { id: "products", icon: Package, label: "Products" },
    { id: "settings", icon: SettingsIcon, label: "Settings" },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md px-3 pb-3">
      <div className="grid grid-cols-4 items-center rounded-3xl border border-violet-100 bg-white/95 px-2 py-2 shadow-[0_-4px_30px_-10px_rgba(124,58,237,0.35)] backdrop-blur-xl">
        {items.map(({ id, icon: Icon, label }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="group relative flex flex-col items-center gap-0.5 py-1.5 transition-all active:scale-95"
            >
              <span
                className={`grid h-9 w-9 place-items-center rounded-xl transition-all ${
                  active
                    ? "bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md"
                    : "text-slate-500 group-hover:text-violet-600"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.5 : 2} />
              </span>
              <span className={`text-[10px] font-bold ${active ? "text-violet-700" : "text-slate-500"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* --------------------------- Home Tab --------------------------- */

function HomeTab({ orders, products, store }: { orders: OrderRow[]; products: any[]; store: any }) {
  const today = new Date().toDateString();
  const stats = useMemo(() => {
    const todaysOrders = orders.filter((o) => new Date(o.created_at).toDateString() === today);
    const revenueToday = todaysOrders.reduce((s, o) => s + Number(o.total || 0), 0);
    const revenueMonth = orders
      .filter((o) => new Date(o.created_at).getMonth() === new Date().getMonth())
      .reduce((s, o) => s + Number(o.total || 0), 0);
    const active = orders.filter((o) => ["pending", "confirmed", "processing", "shipped"].includes(o.status)).length;
    const delivered = orders.filter((o) => o.status === "delivered").length;
    return { todaysOrders: todaysOrders.length, revenueToday, revenueMonth, active, delivered, total: orders.length };
  }, [orders, today]);

  // Fake 7-day sparkline from orders
  const spark = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const label = d.toDateString();
      const sum = orders
        .filter((o) => new Date(o.created_at).toDateString() === label)
        .reduce((s, o) => s + Number(o.total || 0), 0);
      return sum;
    });
    const max = Math.max(...days, 1);
    return { days, max };
  }, [orders]);

  return (
    <div className="space-y-4 px-4 pt-4">
      {/* Hero revenue card */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-purple-700 p-5 text-white shadow-xl">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-fuchsia-400/20 blur-2xl" />
        <div className="relative flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider backdrop-blur">
            <Zap className="h-3 w-3" /> Today
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/90 px-2 py-0.5 text-[10px] font-black text-emerald-950">
            <TrendingUp className="h-3 w-3" /> Live
          </span>
        </div>
        <p className="relative mt-3 text-xs font-medium text-white/80">Revenue today</p>
        <p className="relative font-display text-4xl font-black tabular-nums">
          ৳ {stats.revenueToday.toLocaleString()}
        </p>
        <p className="relative mt-1 text-xs text-white/70">
          ৳ {stats.revenueMonth.toLocaleString()} this month
        </p>

        {/* Sparkline */}
        <div className="relative mt-4 flex h-14 items-end gap-1.5">
          {spark.days.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-md bg-white/60"
              style={{ height: `${Math.max(6, (v / spark.max) * 100)}%` }}
            />
          ))}
        </div>
        <div className="relative mt-1 flex justify-between text-[9px] font-semibold text-white/60">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}
        </div>
      </section>

      {/* Stat grid */}
      <section className="grid grid-cols-2 gap-3">
        <StatCard icon={<ShoppingBag className="h-4 w-4" />} label="Active orders" value={stats.active} tone="violet" trend="+12%" up />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Delivered" value={stats.delivered} tone="emerald" trend="+8%" up />
        <StatCard icon={<Package className="h-4 w-4" />} label="Products" value={products.filter((p) => p.status === "approved").length} tone="sky" trend="live" />
        <StatCard icon={<Users className="h-4 w-4" />} label="Customers" value={new Set(orders.map((o) => o.customer_phone)).size} tone="amber" trend="+3%" up />
      </section>

      {/* Recent orders */}
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-black text-slate-900">Recent orders</h2>
          <Link to="/orders" className="inline-flex items-center gap-0.5 text-xs font-bold text-violet-600">
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="space-y-2">
          {orders.slice(0, 4).map((o) => (
            <MiniOrderRow key={o.id} order={o} />
          ))}
          {orders.length === 0 && (
            <p className="py-6 text-center text-xs text-slate-500">No orders yet.</p>
          )}
        </div>
      </section>

      {/* Store link */}
      {store?.slug && store?.published && (
        <a
          href={buildStorefrontUrl(store.slug)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-white p-3 shadow-sm active:scale-[0.98]"
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-700">
            <StoreIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-black text-slate-900">Visit your store</span>
            <span className="block truncate text-[11px] text-slate-500">{store.slug}.eazystorebd.lovable.app</span>
          </span>
          <ExternalLink className="h-4 w-4 text-violet-600" />
        </a>
      )}
    </div>
  );
}

function StatCard({
  icon, label, value, tone, trend, up,
}: { icon: React.ReactNode; label: string; value: number | string; tone: "violet" | "emerald" | "sky" | "amber"; trend?: string; up?: boolean }) {
  const tones = {
    violet: "from-violet-500 to-fuchsia-500",
    emerald: "from-emerald-500 to-teal-500",
    sky: "from-sky-500 to-cyan-500",
    amber: "from-amber-500 to-orange-500",
  }[tone];
  return (
    <div className="rounded-2xl bg-white p-3.5 shadow-sm">
      <div className="flex items-start justify-between">
        <span className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br ${tones} text-white`}>
          {icon}
        </span>
        {trend && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-black ${up ? "text-emerald-600" : "text-slate-500"}`}>
            {up && <ArrowUpRight className="h-3 w-3" />}
            {trend}
          </span>
        )}
      </div>
      <p className="mt-2 font-display text-2xl font-black tabular-nums text-slate-900">{value}</p>
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
    </div>
  );
}

/* --------------------------- Orders Tab --------------------------- */

function OrdersTab({ storeId, orders, loading }: { storeId?: string; orders: OrderRow[]; loading: boolean }) {
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const updateStatus = useUpdateOrderStatus(storeId);

  const filtered = orders.filter((o) => {
    if (filter !== "all" && o.status !== filter) return false;
    if (search && !`${o.order_number} ${o.customer_name} ${o.customer_phone}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-3 px-4 pt-4">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orders"
            className="flex-1 border-0 bg-transparent text-sm placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <button className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600">
          <Filter className="h-4 w-4" />
        </button>
      </div>

      {/* Status pills */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(["all", ...ORDER_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold capitalize transition-all ${
              filter === s
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md"
                : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {s === "all" ? `All (${orders.length})` : s}
          </button>
        ))}
      </div>

      {loading && (
        <div className="grid place-items-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
        </div>
      )}

      <div className="space-y-2.5">
        {filtered.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            onStatus={(status) => updateStatus.mutate({ id: o.id, status })}
          />
        ))}
        {!loading && filtered.length === 0 && (
          <div className="grid place-items-center rounded-3xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
            <ShoppingBag className="h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-bold text-slate-700">No orders match</p>
            <p className="text-xs text-slate-500">Try a different filter</p>
          </div>
        )}
      </div>
    </div>
  );
}

function OrderCard({ order, onStatus }: { order: OrderRow; onStatus: (s: OrderStatus) => void }) {
  const nextStatus: Record<OrderStatus, OrderStatus | null> = {
    pending: "confirmed",
    confirmed: "processing",
    processing: "shipped",
    shipped: "delivered",
    delivered: null,
    cancelled: null,
  };
  const next = nextStatus[order.status];
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-900">{order.customer_name}</p>
          <p className="truncate text-[11px] text-slate-500">{order.order_number} · {order.customer_phone}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black capitalize ${statusBadgeClass(order.status)}`}>
          {order.status}
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <p className="font-display text-xl font-black text-slate-900">৳ {Number(order.total).toLocaleString()}</p>
        {next && (
          <button
            onClick={() => onStatus(next)}
            className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 text-[11px] font-black text-white shadow-sm active:scale-95"
          >
            <Truck className="h-3 w-3" /> Mark {next}
          </button>
        )}
      </div>
    </div>
  );
}

function MiniOrderRow({ order }: { order: OrderRow }) {
  const Icon =
    order.status === "delivered" ? CheckCircle2 :
    order.status === "cancelled" ? XCircle :
    order.status === "shipped" ? Truck : Clock;
  return (
    <Link
      to="/orders"
      className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5 active:scale-[0.98]"
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${statusBadgeClass(order.status)}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-black text-slate-900">{order.customer_name}</p>
        <p className="truncate text-[10px] text-slate-500">{order.order_number}</p>
      </div>
      <p className="shrink-0 text-xs font-black text-slate-900">৳{Number(order.total).toLocaleString()}</p>
    </Link>
  );
}

/* --------------------------- Products Tab --------------------------- */

function ProductsTab({ products, loading }: { products: any[]; loading: boolean }) {
  const [search, setSearch] = useState("");
  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-3 px-4 pt-4">
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products"
          className="flex-1 border-0 bg-transparent text-sm placeholder:text-slate-400 focus:outline-none"
        />
      </div>

      {loading && (
        <div className="grid place-items-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {filtered.map((p) => (
          <Link
            key={p.id}
            to="/products/$productId/edit"
            params={{ productId: p.id }}
            className="group overflow-hidden rounded-2xl bg-white shadow-sm active:scale-[0.98]"
          >
            <div className="aspect-square overflow-hidden bg-slate-100">
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-slate-300">
                  <Package className="h-10 w-10" />
                </div>
              )}
            </div>
            <div className="p-2.5">
              <p className="truncate text-xs font-black text-slate-900">{p.name}</p>
              <div className="mt-1 flex items-center justify-between">
                <p className="text-sm font-black text-violet-700">৳{Number(p.price).toLocaleString()}</p>
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                  p.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                  p.status === "pending" ? "bg-amber-100 text-amber-700" :
                  "bg-rose-100 text-rose-700"
                }`}>{p.status}</span>
              </div>
              <p className="mt-0.5 text-[10px] text-slate-500">Stock: {p.stock}</p>
            </div>
          </Link>
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="grid place-items-center rounded-3xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
          <Package className="h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-bold text-slate-700">No products</p>
          <Link to="/products/new" className="mt-2 inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-black text-white">
            <Plus className="h-3 w-3" /> Add product
          </Link>
        </div>
      )}
    </div>
  );
}

/* --------------------------- Settings Tab --------------------------- */

function SettingsTab({ store }: { store: any }) {
  const items = [
    { to: "/manage-shop", icon: StoreIcon, label: "Store profile", sub: "Name, logo, contacts" },
    { to: "/themes", icon: Eye, label: "Themes", sub: "Look & feel" },
    { to: "/categories", icon: Package, label: "Categories", sub: "Product taxonomy" },
    { to: "/promo-codes", icon: DollarSign, label: "Promo codes", sub: "Discounts & offers" },
    { to: "/courier", icon: Truck, label: "Courier", sub: "Delivery partners" },
    { to: "/sms-settings", icon: Bell, label: "SMS settings", sub: "Notifications" },
    { to: "/analytics", icon: TrendingUp, label: "Analytics", sub: "Detailed reports" },
  ] as const;

  return (
    <div className="space-y-4 px-4 pt-4">
      <section className="rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-600 p-5 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20 backdrop-blur">
            <span className="text-lg font-black">{(store?.name ?? "S").slice(0, 2).toUpperCase()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-black">{store?.name ?? "My Store"}</p>
            <p className="truncate text-xs text-white/80">{store?.published ? "Live · Published" : "Draft"}</p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
        {items.map((it, i) => (
          <Link
            key={it.to}
            to={it.to}
            className={`flex items-center gap-3 p-4 active:bg-slate-50 ${i !== 0 ? "border-t border-slate-100" : ""}`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700">
              <it.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-slate-900">{it.label}</p>
              <p className="truncate text-[11px] text-slate-500">{it.sub}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </Link>
        ))}
      </section>

      <p className="pt-2 text-center text-[11px] text-slate-400">EazyStore Mobile · v1.0</p>
    </div>
  );
}
