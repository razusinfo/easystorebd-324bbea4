import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2, Plus, Search, ShoppingCart, Trash2, Eye, Pencil, X, Check,
  Package, AlertTriangle, RefreshCw, Phone, MapPin,
  Calendar, Tag, Users, Download, Filter, ArrowUpDown, Columns3,
  Copy, ExternalLink, MoreHorizontal, Box, MessageCircle, Send,
} from "lucide-react";

function waNumber(phone: string) {
  let digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  // strip leading zeros for pure-local numbers like "01712..." → "1712..."
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("00880")) return digits.slice(2);
  if (digits.startsWith("0")) return "880" + digits.replace(/^0+/, "");
  if (digits.length === 10 && digits.startsWith("1")) return "880" + digits;
  return digits;
}

function prettyBDPhone(phone: string) {
  const wa = waNumber(phone);
  if (wa.startsWith("880")) return "+" + wa;
  return phone;
}

// ---- Local activity log for call / WhatsApp / copy per order ----
type ActivityKind = "call" | "wa" | "wa_msg" | "copy";
type ActivityEntry = { kind: ActivityKind; at: number };
const ACTIVITY_KEY = "order_activity_v1";
function readAllActivity(): Record<string, ActivityEntry[]> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(ACTIVITY_KEY) || "{}"); } catch { return {}; }
}
function bumpActivity(orderId: string | undefined, kind: ActivityKind) {
  if (!orderId || typeof window === "undefined") return;
  const all = readAllActivity();
  const list = all[orderId] ?? [];
  list.push({ kind, at: Date.now() });
  all[orderId] = list.slice(-50);
  window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(all));
  window.dispatchEvent(new CustomEvent("order-activity", { detail: { orderId } }));
}
function useOrderActivity(orderId: string | undefined) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const h = (e: Event) => {
      const id = (e as CustomEvent).detail?.orderId;
      if (!orderId || id === orderId) setTick((t) => t + 1);
    };
    window.addEventListener("order-activity", h);
    return () => window.removeEventListener("order-activity", h);
  }, [orderId]);
  return useMemo(() => (orderId ? (readAllActivity()[orderId] ?? []) : []), [orderId, tick]);
}

function ContactIcons({
  phone,
  orderId,
  customerName,
  storeName,
  size = "sm",
}: {
  phone: string;
  orderId?: string;
  customerName?: string | null;
  storeName?: string | null;
  size?: "sm" | "xs";
}) {
  const wa = waNumber(phone);
  const pretty = prettyBDPhone(phone);
  const cls = size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5";
  const btn = "grid place-items-center rounded-full p-1 transition-colors";
  if (!phone) return null;

  const greeting = encodeURIComponent(
    `Assalamu Alaikum${customerName ? " " + customerName : ""}, ${storeName ? storeName + " " : ""}থেকে আপনার অর্ডার সম্পর্কে যোগাযোগ করছি।`
  );

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(pretty);
      bumpActivity(orderId, "copy");
      toast.success("Number copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={copy}
        className={`${btn} bg-muted text-foreground/70 hover:bg-muted/70`}
        aria-label="Copy number"
        title={`Copy ${pretty}`}
      >
        <Copy className={cls} />
      </button>
      <a
        href={`tel:${pretty}`}
        onClick={() => bumpActivity(orderId, "call")}
        className={`${btn} bg-sky-50 text-sky-600 hover:bg-sky-100 dark:bg-sky-500/10 dark:text-sky-400`}
        aria-label="Call"
        title={`Call ${pretty} — opens dialer`}
      >
        <Phone className={cls} />
      </a>
      {wa && (
        <>
          <a
            href={`https://wa.me/${wa}`}
            onClick={() => bumpActivity(orderId, "wa")}
            target="_blank"
            rel="noreferrer noopener"
            className={`${btn} bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400`}
            aria-label="WhatsApp chat"
            title={`WhatsApp ${pretty} — open chat`}
          >
            <MessageCircle className={cls} />
          </a>
          <a
            href={`https://wa.me/${wa}?text=${greeting}`}
            onClick={() => bumpActivity(orderId, "wa_msg")}
            target="_blank"
            rel="noreferrer noopener"
            className={`${btn} bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300`}
            aria-label="WhatsApp with prefilled message"
            title={`WhatsApp ${pretty} — send prefilled greeting`}
          >
            <Send className={cls} />
          </a>
        </>
      )}
    </span>
  );
}
import { toast } from "sonner";

import { useMyStore, useMyProducts, type ProductRow } from "@/lib/eazystore-data";
import {
  useOrders, useOrderItems, useUpsertOrder, useUpdateOrderStatus,
  useUpdatePaymentStatus, useDeleteOrder, useBulkUpdateOrders, useOrderAudit,
  ORDER_STATUSES, PAYMENT_STATUSES,
  statusBadgeClass, paymentBadgeClass,
  type OrderRow, type OrderStatus, type PaymentStatus, type OrderInput, type OrderItemInput,
} from "@/lib/orders-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "Orders — EasyStore" },
      { name: "description", content: "View and manage all customer orders — status, payments, and delivery in one place." },
    ],
  }),
  component: OrdersPage,
});

type TabKey =
  | "all" | "pending" | "on_hold" | "confirmed" | "shipped"
  | "delivered" | "completed" | "cancelled" | "returned"
  | "payment_process" | "payment_failed";

const TABS: { key: TabKey; label: string; color: string }[] = [
  { key: "all",             label: "All Orders",         color: "text-foreground" },
  { key: "pending",         label: "Placed",             color: "text-fuchsia-600" },
  { key: "on_hold",         label: "On Hold",            color: "text-orange-500" },
  { key: "confirmed",       label: "Confirmed",          color: "text-sky-600" },
  { key: "shipped",         label: "Shipped",            color: "text-violet-600" },
  { key: "delivered",       label: "Delivered",          color: "text-emerald-600" },
  { key: "completed",       label: "Completed",          color: "text-green-600" },
  { key: "cancelled",       label: "Cancelled",          color: "text-rose-600" },
  { key: "returned",        label: "Returned",           color: "text-amber-600" },
  { key: "payment_process", label: "Payment OnProcess",  color: "text-indigo-600" },
  { key: "payment_failed",  label: "Payment Failed",     color: "text-red-600" },
];

function matchTab(o: OrderRow, tab: TabKey): boolean {
  const s = o.status;
  const p = o.payment_status;
  switch (tab) {
    case "all":              return true;
    case "pending":          return s === "pending";
    case "on_hold":          return s === "processing";
    case "confirmed":        return s === "confirmed";
    case "shipped":          return s === "shipped";
    case "delivered":        return s === "delivered";
    case "completed":        return s === "delivered" && p === "paid";
    case "cancelled":        return s === "cancelled";
    case "returned":         return p === "refunded";
    case "payment_process":  return p === "unpaid" && (s === "confirmed" || s === "processing");
    case "payment_failed":   return p === "unpaid" && s === "cancelled";
  }
}

function OrdersPage() {
  const storeQ = useMyStore();
  const store = storeQ.data;
  const ordersQ = useOrders(store?.id);
  const productsQ = useMyProducts(store?.id);

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [viewing, setViewing] = useState<OrderRow | null>(null);
  const [editing, setEditing] = useState<OrderRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<OrderRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const storeName = store?.name ?? null;

  const del = useDeleteOrder(store?.id);
  const orders = ordersQ.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (!matchTab(o, tab)) return false;
      if (!q) return true;
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_phone.toLowerCase().includes(q)
      );
    });
  }, [orders, search, tab]);

  const stats = useMemo(() => {
    const confirmed = orders.filter((o) => o.status === "confirmed" || o.status === "delivered");
    const total = confirmed.reduce((s, o) => s + Number(o.total), 0);
    const uniqueCustomers = new Set(orders.map((o) => o.customer_phone)).size;
    return {
      count: orders.length,
      confirmedCount: confirmed.length,
      total,
      customers: uniqueCustomers,
    };
  }, [orders]);

  const today = useMemo(() => {
    const d = new Date();
    const day = d.getDate();
    const suffix = day % 10 === 1 && day !== 11 ? "st"
      : day % 10 === 2 && day !== 12 ? "nd"
      : day % 10 === 3 && day !== 13 ? "rd" : "th";
    return `${day}${suffix} ${d.toLocaleString("en-US", { month: "long" })}`;
  }, []);

  async function handleDelete() {
    if (!deleting) return;
    try {
      await del.mutateAsync(deleting.id);
      toast.success("Order deleted");
      setDeleting(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete");
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-black sm:text-3xl">Orders</h1>
          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary">
            {stats.count}
          </span>
        </div>
        <Button onClick={() => setCreating(true)} disabled={!store}>
          <Plus className="mr-1 h-4 w-4" /> Create Order
        </Button>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Calendar className="h-5 w-5" />} label="Today's date" value={today} tint="violet" />
        <StatCard icon={<Tag className="h-5 w-5" />} label="Total Orders (Confirmed)" value={stats.confirmedCount.toLocaleString()} tint="violet" />
        <StatCard icon={<span className="text-lg font-bold">৳</span>} label="Total Amount" value={stats.total.toLocaleString()} tint="violet" />
        <StatCard icon={<Users className="h-5 w-5" />} label="Total Customer Served" value={stats.customers.toLocaleString()} tint="violet" />
      </div>

      {/* Search row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-stretch overflow-hidden rounded-lg border border-border bg-card">
          <Select defaultValue="all">
            <SelectTrigger className="h-10 w-[120px] rounded-none border-0 border-r border-border bg-transparent focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Fields</SelectItem>
              <SelectItem value="order">Order ID</SelectItem>
              <SelectItem value="phone">Phone</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
            <Input
              placeholder="Search with order ID or Phone number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 border-0 pl-9 focus-visible:ring-0"
            />
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-10">
          <Download className="mr-1 h-4 w-4" /> Export
        </Button>
      </div>

      {/* Tabs + tools row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          {TABS.map((t) => {
            const active = t.key === tab;
            const count = orders.filter((o) => matchTab(o, t.key)).length;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`-mb-px border-b-2 pb-2 pt-1 font-medium transition ${
                  active
                    ? "border-primary text-foreground"
                    : `border-transparent ${t.color} hover:opacity-80`
                }`}
              >
                {t.label}
                {t.key !== "all" && count > 0 && (
                  <span className="ml-1 text-foreground/50">({count})</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Button variant="outline" size="sm" className="h-8">
            <Filter className="mr-1 h-3.5 w-3.5" /> Filters
          </Button>
          <Button variant="outline" size="sm" className="h-8 px-2">
            <ArrowUpDown className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="h-8">
            <Columns3 className="mr-1 h-3.5 w-3.5" /> Columns
          </Button>
        </div>
      </div>

      {storeQ.isLoading || ordersQ.isLoading ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-border p-16">
          <Loader2 className="h-6 w-6 animate-spin text-foreground/40" />
        </div>
      ) : ordersQ.isError ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-destructive/40 bg-destructive/5 p-12 text-center">
          <AlertTriangle className="h-7 w-7 text-destructive" />
          <h2 className="mt-3 font-display text-lg font-black">Failed to load orders</h2>
          <Button variant="outline" onClick={() => ordersQ.refetch()} className="mt-4">
            <RefreshCw className="mr-1 h-4 w-4" /> Try again
          </Button>
        </div>
      ) : !store ? (
        <EmptyState
          title="No store yet"
          desc="Complete onboarding to create your store before managing orders."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={orders.length === 0 ? "No orders yet" : "No matching orders"}
          desc={orders.length === 0
            ? "Create your first order manually or wait for customers to place one."
            : "Try a different search or filter."}
          action={orders.length === 0
            ? <Button onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" /> Create Order</Button>
            : undefined}
        />
      ) : (
        <>
          <BulkActionsBar
            storeId={store.id}
            selected={selected}
            clear={() => setSelected(new Set())}
          />
          <OrdersTable
            rows={filtered}
            storeId={store.id}
            storeName={storeName}
            selected={selected}
            setSelected={setSelected}
            onView={setViewing}
            onEdit={setEditing}
            onDelete={setDeleting}
          />
        </>
      )}


      {/* View */}
      <OrderDetailsDialog
        order={viewing}
        onClose={() => setViewing(null)}
        onEdit={(o) => { setViewing(null); setEditing(o); }}
      />

      {/* Create / Edit */}
      {(creating || editing) && (
        <OrderFormDialog
          key={editing?.id ?? "new"}
          storeId={store?.id}
          products={productsQ.data ?? []}
          order={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}

      {/* Delete */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this order?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-foreground">{deleting?.order_number}</span> will be
              permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={del.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {del.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

// ---------- Sub-components ----------

function StatCard({
  icon, label, value, tint = "violet",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint?: "violet" | "amber" | "emerald";
}) {
  const tintClasses =
    tint === "amber"   ? "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" :
    tint === "emerald" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" :
                         "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${tintClasses}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-foreground/60">{label}</p>
        <p className="mt-0.5 font-display text-lg font-black">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ title, desc, action }: { title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-foreground/5">
        <ShoppingCart className="h-7 w-7 text-foreground/40" />
      </div>
      <h2 className="mt-4 font-display text-lg font-black">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-foreground/60">{desc}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function StatusPill({ status }: { status: OrderStatus }) {
  const label = status === "pending" ? "Placed" : status;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${statusBadgeClass(status)}`}>
      {label}
    </span>
  );
}
function PaymentPill({ status }: { status: PaymentStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${paymentBadgeClass(status)}`}>
      {status}
    </span>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (a + b).toUpperCase() || "?";
}

function shortHash(id: string): string {
  const digits = id.replace(/\D/g, "").slice(0, 7);
  if (digits.length >= 6) return digits;
  let n = 0;
  for (const ch of id) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return String(n % 9000000 + 1000000);
}

function OrdersTable({
  rows, storeId, storeName, selected, setSelected, onView, onEdit, onDelete,
}: {
  rows: OrderRow[]; storeId: string; storeName: string | null;
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  onView: (o: OrderRow) => void;
  onEdit: (o: OrderRow) => void;
  onDelete: (o: OrderRow) => void;
}) {
  const updStatus = useUpdateOrderStatus(storeId);
  const updPayment = useUpdatePaymentStatus(storeId);
  const [tappedId, setTappedId] = useState<string | null>(null);
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggleAll(v: boolean) {
    const next = new Set(selected);
    if (v) rows.forEach((r) => next.add(r.id));
    else rows.forEach((r) => next.delete(r.id));
    setSelected(next);
  }
  function toggleOne(id: string, v: boolean) {
    const next = new Set(selected);
    if (v) next.add(id); else next.delete(id);
    setSelected(next);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-left text-xs font-semibold text-foreground/60">
            <tr>
              <th className="px-3 py-3">
                <Checkbox checked={allChecked} onCheckedChange={(v) => toggleAll(!!v)} />
              </th>
              <th className="px-3 py-3">Order</th>
              <th className="px-3 py-3">Customer</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Amount</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((o) => {
              const date = new Date(o.created_at);
              return (
                <tr key={o.id} className="hover:bg-foreground/[0.02]">
                  <td className="px-3 py-3">
                    <Checkbox
                      checked={selected.has(o.id)}
                      onCheckedChange={(v) => toggleOne(o.id, !!v)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-start gap-2">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-foreground/5 text-foreground/60">
                        <Box className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold">#{shortHash(o.id)}</span>
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-600 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-400">
                            Online
                          </span>
                          <button
                            type="button"
                            onClick={() => onView(o)}
                            className="text-foreground/40 hover:text-foreground"
                            aria-label="View"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-foreground/50">
                          <span className="font-mono">{o.order_number}</span>
                          <span className="inline-flex items-center gap-0.5">
                            <ShoppingCart className="h-3 w-3" /> 1 items
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {initialsOf(o.customer_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{o.customer_name}</div>
                        <div className="flex items-center gap-1.5 text-xs text-foreground/60">
                          <span className="truncate">{prettyBDPhone(o.customer_phone)}</span>
                          <ContactIcons phone={o.customer_phone} customerName={o.customer_name} storeName={storeName} size="xs" />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <div>{date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</div>
                    <div className="text-foreground/50">{date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </td>
                  <td className="px-3 py-3">
                    <Select
                      value={o.status}
                      onValueChange={async (v) => {
                        try {
                          await updStatus.mutateAsync({ id: o.id, status: v as OrderStatus });
                          toast.success(`Status → ${v}`);
                        } catch (e: any) { toast.error(e?.message ?? "Failed"); }
                      }}
                    >
                      <SelectTrigger className="h-8 w-[110px] border-0 bg-transparent p-0 focus:ring-0">
                        <StatusPill status={o.status} />
                      </SelectTrigger>
                      <SelectContent>
                        {ORDER_STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 rounded-md bg-foreground/5 px-2 py-1 text-xs font-medium">
                      <ShoppingCart className="h-3 w-3" /> Own
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-semibold">৳{Number(o.total).toLocaleString()}</div>
                    <div className="text-xs text-foreground/50">
                      +৳{Number(o.delivery_charge).toLocaleString()} delivery
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="inline-flex items-center gap-1">
                      <Select
                        value={o.status}
                        onValueChange={async (v) => {
                          try {
                            await updStatus.mutateAsync({ id: o.id, status: v as OrderStatus });
                            toast.success(`Order status → ${v}`);
                          } catch (e: any) { toast.error(e?.message ?? "Failed"); }
                        }}
                      >
                        <SelectTrigger className="h-8 w-[120px]" aria-label="Order status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ORDER_STATUSES.map((s) => (
                            <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={o.payment_status}
                        onValueChange={async (v) => {
                          try {
                            await updPayment.mutateAsync({ id: o.id, payment_status: v as PaymentStatus });
                            toast.success(`Payment → ${v}`);
                          } catch (e: any) { toast.error(e?.message ?? "Failed"); }
                        }}
                      >
                        <SelectTrigger className="h-8 w-[110px]" aria-label="Payment status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_STATUSES.map((s) => (
                            <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => onEdit(o)} aria-label="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onDelete(o)} aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="divide-y divide-border md:hidden">
        {rows.map((o) => {
          const isTapped = tappedId === o.id;
          return (
          <li
            key={o.id}
            className={`p-4 transition-colors ${isTapped ? "bg-primary/5" : ""}`}
            onClick={() => setTappedId((cur) => (cur === o.id ? null : o.id))}
          >
            <div className="flex items-start justify-between gap-3">
              {/* LEFT: customer name + phone + call/whatsapp */}
              <div className={`min-w-0 flex-1 rounded-md px-2 py-1 -mx-2 transition-colors ${isTapped ? "bg-primary/10 ring-1 ring-primary/30" : ""}`}>
                <p className="truncate font-semibold">{o.customer_name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-foreground/60">
                  <span>{prettyBDPhone(o.customer_phone)}</span>
                  <ContactIcons phone={o.customer_phone} customerName={o.customer_name} storeName={storeName} size="xs" />
                </div>
                <p className="mt-2 font-bold text-primary">৳ {Number(o.total).toLocaleString()}</p>
              </div>

              {/* RIGHT: order info + date */}
              <div className="flex flex-col items-end gap-1 text-right">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold">#{shortHash(o.id)}</span>
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-600">
                    Online
                  </span>
                </div>
                <p className="font-mono text-xs text-foreground/50">{o.order_number}</p>
                <p className="text-[11px] text-foreground/60">
                  {new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
                  {" · "}
                  {new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
                <div className="mt-1 flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onView(o)}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(o)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(o)}
                    className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Status controls below, full width */}
            <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
              <Select
                value={o.status}
                onValueChange={async (v) => {
                  try {
                    await updStatus.mutateAsync({ id: o.id, status: v as OrderStatus });
                    toast.success(`Order status → ${v}`);
                  } catch (e: any) { toast.error(e?.message ?? "Failed"); }
                }}
              >
                <SelectTrigger className="h-8 w-[130px]" aria-label="Order status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={o.payment_status}
                onValueChange={async (v) => {
                  try {
                    await updPayment.mutateAsync({ id: o.id, payment_status: v as PaymentStatus });
                    toast.success(`Payment → ${v}`);
                  } catch (e: any) { toast.error(e?.message ?? "Failed"); }
                }}
              >
                <SelectTrigger className="h-8 w-[110px]" aria-label="Payment status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- Details dialog ----------

function OrderDetailsDialog({
  order, onClose, onEdit,
}: { order: OrderRow | null; onClose: () => void; onEdit: (o: OrderRow) => void }) {
  const itemsQ = useOrderItems(order?.id);
  const open = !!order;
  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">{order.order_number}</span>
            <StatusPill status={order.status} />
            <PaymentPill status={order.payment_status} />
          </DialogTitle>
          <DialogDescription>
            Placed {new Date(order.created_at).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Customer</p>
            <p className="mt-1 font-semibold">{order.customer_name}</p>
            <p className="mt-1 flex items-center gap-2 text-sm"><Phone className="h-3.5 w-3.5" /> {order.customer_phone} <ContactIcons phone={order.customer_phone} /></p>
            {order.customer_address && (
              <p className="mt-1 flex items-start gap-1 text-sm text-foreground/70"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {order.customer_address}</p>
            )}
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Totals</p>
            <div className="mt-1 space-y-0.5 text-sm">
              <Row label="Subtotal" value={`৳ ${Number(order.subtotal).toLocaleString()}`} />
              <Row label="Delivery" value={`৳ ${Number(order.delivery_charge).toLocaleString()}`} />
              <Row label="Discount" value={`− ৳ ${Number(order.discount).toLocaleString()}`} />
              <div className="mt-1 border-t border-border pt-1">
                <Row label="Total" value={`৳ ${Number(order.total).toLocaleString()}`} bold />
              </div>
              {order.payment_method && <p className="mt-1 text-xs text-foreground/50">Paid via {order.payment_method}</p>}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">
            <Package className="h-3.5 w-3.5" /> Items
          </div>
          <div className="max-h-60 overflow-y-auto">
            {itemsQ.isLoading ? (
              <div className="p-4 text-center text-sm text-foreground/50"><Loader2 className="inline h-4 w-4 animate-spin" /></div>
            ) : (itemsQ.data ?? []).length === 0 ? (
              <p className="p-4 text-center text-sm text-foreground/50">No items</p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {(itemsQ.data ?? []).map((it) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{it.name}</div>
                        {it.variant_label && <div className="text-xs text-foreground/50">{it.variant_label}</div>}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-foreground/60">
                        {it.quantity} × ৳ {Number(it.price).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        ৳ {Number(it.subtotal).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {order.notes && (
          <div className="rounded-lg border border-border p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-foreground/80">{order.notes}</p>
          </div>
        )}

        <div className="rounded-lg border border-border">
          <p className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">
            Status History
          </p>
          <div className="max-h-48 overflow-y-auto">
            <OrderAuditHistory orderId={order.id} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => onEdit(order)}><Pencil className="mr-1 h-4 w-4" /> Edit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-foreground/60">{label}</span>
      <span className={bold ? "font-bold text-primary" : ""}>{value}</span>
    </div>
  );
}

// ---------- Create / Edit form ----------

type FormItem = { key: string; product_id: string | null; name: string; price: string; quantity: string; variant_label: string };

function makeItem(): FormItem {
  return { key: crypto.randomUUID(), product_id: null, name: "", price: "", quantity: "1", variant_label: "" };
}

function OrderFormDialog({
  storeId, products, order, onClose,
}: {
  storeId: string | undefined;
  products: ProductRow[];
  order: OrderRow | null;
  onClose: () => void;
}) {
  const upsert = useUpsertOrder(storeId);
  const existingItemsQ = useOrderItems(order?.id);

  const [customerName, setCustomerName] = useState(order?.customer_name ?? "");
  const [customerPhone, setCustomerPhone] = useState(order?.customer_phone ?? "");
  const [customerAddress, setCustomerAddress] = useState(order?.customer_address ?? "");
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [deliveryCharge, setDeliveryCharge] = useState(String(order?.delivery_charge ?? "0"));
  const [discount, setDiscount] = useState(String(order?.discount ?? "0"));
  const [status, setStatus] = useState<OrderStatus>(order?.status ?? "pending");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(order?.payment_status ?? "unpaid");
  const [paymentMethod, setPaymentMethod] = useState(order?.payment_method ?? "");
  const [items, setItems] = useState<FormItem[]>([makeItem()]);
  const [hydrated, setHydrated] = useState(!order);

  // Load items when editing
  if (order && !hydrated && !existingItemsQ.isLoading && existingItemsQ.data) {
    const rows = existingItemsQ.data;
    setItems(rows.length ? rows.map((it) => ({
      key: it.id,
      product_id: it.product_id,
      name: it.name,
      price: String(it.price),
      quantity: String(it.quantity),
      variant_label: it.variant_label ?? "",
    })) : [makeItem()]);
    setHydrated(true);
  }

  const subtotal = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
  const total = Math.max(0, subtotal + (Number(deliveryCharge) || 0) - (Number(discount) || 0));

  function setItem(key: string, patch: Partial<FormItem>) {
    setItems((prev) => prev.map((it) => it.key === key ? { ...it, ...patch } : it));
  }
  function pickProduct(key: string, productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setItem(key, { product_id: p.id, name: p.name, price: String(p.price) });
  }

  async function handleSave() {
    if (!storeId) return toast.error("No store");
    if (!customerName.trim()) return toast.error("Customer name is required");
    if (!customerPhone.trim()) return toast.error("Customer phone is required");
    const cleanItems: OrderItemInput[] = items
      .filter((it) => it.name.trim() && Number(it.quantity) > 0)
      .map((it) => ({
        product_id: it.product_id,
        name: it.name.trim(),
        price: Number(it.price) || 0,
        quantity: Number(it.quantity) || 1,
        variant_label: it.variant_label.trim() || null,
      }));
    if (cleanItems.length === 0) return toast.error("Add at least one item");

    const input: OrderInput = {
      id: order?.id,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      notes,
      delivery_charge: Number(deliveryCharge) || 0,
      discount: Number(discount) || 0,
      status,
      payment_status: paymentStatus,
      payment_method: paymentMethod,
      items: cleanItems,
    };
    try {
      await upsert.mutateAsync(input);
      toast.success(order ? "Order updated" : "Order created");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save order");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order ? "Edit Order" : "New Order"}</DialogTitle>
          <DialogDescription>
            {order ? `Editing ${order.order_number}` : "Enter customer details and items."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Customer name *</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Phone *</Label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Address</Label>
            <Textarea value={customerAddress ?? ""} onChange={(e) => setCustomerAddress(e.target.value)} className="mt-1 min-h-[60px]" />
          </div>

          {/* Items */}
          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Items</p>
              <Button size="sm" variant="outline" onClick={() => setItems((p) => [...p, makeItem()])}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add item
              </Button>
            </div>
            <div className="divide-y divide-border">
              {items.map((it, idx) => (
                <div key={it.key} className="grid gap-2 p-3 sm:grid-cols-[1.5fr_1fr_80px_100px_36px] sm:items-end">
                  <div>
                    {idx === 0 && <Label className="text-xs">Product / Name</Label>}
                    <div className="mt-1 flex gap-1">
                      <Select value={it.product_id ?? ""} onValueChange={(v) => pickProduct(it.key, v)}>
                        <SelectTrigger className="w-[110px] shrink-0"><SelectValue placeholder="Pick" /></SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Item name"
                        value={it.name}
                        onChange={(e) => setItem(it.key, { name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    {idx === 0 && <Label className="text-xs">Variant (optional)</Label>}
                    <Input className="mt-1" placeholder="Size L, Red…" value={it.variant_label}
                      onChange={(e) => setItem(it.key, { variant_label: e.target.value })} />
                  </div>
                  <div>
                    {idx === 0 && <Label className="text-xs">Qty</Label>}
                    <Input className="mt-1" type="number" min={1} value={it.quantity}
                      onChange={(e) => setItem(it.key, { quantity: e.target.value })} />
                  </div>
                  <div>
                    {idx === 0 && <Label className="text-xs">Price</Label>}
                    <Input className="mt-1" type="number" min={0} value={it.price}
                      onChange={(e) => setItem(it.key, { price: e.target.value })} />
                  </div>
                  <Button variant="ghost" size="icon"
                    onClick={() => setItems((p) => p.length > 1 ? p.filter((x) => x.key !== it.key) : p)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Charges */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Delivery charge</Label>
              <Input type="number" min={0} value={deliveryCharge} onChange={(e) => setDeliveryCharge(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Discount</Label>
              <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Payment method</Label>
              <Input placeholder="Cash, bKash, Card…" value={paymentMethod ?? ""} onChange={(e) => setPaymentMethod(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Order status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment status</Label>
              <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as PaymentStatus)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} className="mt-1 min-h-[60px]" />
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
            <div className="flex justify-between"><span className="text-foreground/60">Subtotal</span><span>৳ {subtotal.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-foreground/60">Delivery</span><span>৳ {(Number(deliveryCharge) || 0).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-foreground/60">Discount</span><span>− ৳ {(Number(discount) || 0).toLocaleString()}</span></div>
            <div className="mt-1 flex justify-between border-t border-border pt-1 font-bold text-primary">
              <span>Total</span><span>৳ {total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={upsert.isPending}
            className="bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive">
            <X className="mr-1 h-4 w-4" /> Cancel
          </Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
            {order ? "Update Order" : "Create Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Bulk actions bar ----------

function BulkActionsBar({
  storeId, selected, clear,
}: { storeId: string; selected: Set<string>; clear: () => void }) {
  const bulk = useBulkUpdateOrders(storeId);
  const [orderStatus, setOrderStatus] = useState<OrderStatus | "">("");
  const [payStatus, setPayStatus] = useState<PaymentStatus | "">("");
  if (selected.size === 0) return null;

  async function apply() {
    if (!orderStatus && !payStatus) {
      toast.error("Pick a status to apply");
      return;
    }
    try {
      const res = await bulk.mutateAsync({
        ids: Array.from(selected),
        status: orderStatus || undefined,
        payment_status: payStatus || undefined,
      });
      if (res.updated) toast.success(`Updated ${res.updated} order(s)`);
      if (res.skipped.length) toast.warning(`${res.skipped.length} skipped (invalid transition)`);
      setOrderStatus(""); setPayStatus(""); clear();
    } catch (e: any) {
      toast.error(e?.message ?? "Bulk update failed");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <span className="text-sm font-semibold">{selected.size} selected</span>
      <Select value={orderStatus} onValueChange={(v) => setOrderStatus(v as OrderStatus)}>
        <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Order status" /></SelectTrigger>
        <SelectContent>
          {ORDER_STATUSES.map((s) => (
            <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={payStatus} onValueChange={(v) => setPayStatus(v as PaymentStatus)}>
        <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Payment status" /></SelectTrigger>
        <SelectContent>
          {PAYMENT_STATUSES.map((s) => (
            <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" onClick={apply} disabled={bulk.isPending}>
        {bulk.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
        Apply
      </Button>
      <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
    </div>
  );
}

// ---------- Audit history ----------

export function OrderAuditHistory({ orderId }: { orderId: string }) {
  const q = useOrderAudit(orderId);
  if (q.isLoading) return <p className="p-3 text-sm text-foreground/50"><Loader2 className="inline h-4 w-4 animate-spin" /></p>;
  const rows = q.data ?? [];
  if (!rows.length) return <p className="p-3 text-sm text-foreground/50">No status changes yet.</p>;
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
          <div>
            <span className="font-semibold capitalize">{r.field.replace("_", " ")}</span>
            {": "}
            <span className="text-foreground/60">{r.from_value ?? "—"}</span>
            {" → "}
            <span className="font-semibold">{r.to_value}</span>
          </div>
          <div className="text-xs text-foreground/50">
            {new Date(r.created_at).toLocaleString()}
            {r.changed_by ? ` · by ${r.changed_by.slice(0, 8)}` : ""}
          </div>
        </li>
      ))}
    </ul>
  );
}
