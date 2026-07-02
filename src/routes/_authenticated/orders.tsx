import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Loader2, Plus, Search, ShoppingCart, Trash2, Eye, Pencil, X, Check,
  Package, AlertTriangle, RefreshCw, Phone, MapPin,
} from "lucide-react";
import { toast } from "sonner";

import { useMyStore, useMyProducts, type ProductRow } from "@/lib/eazystore-data";
import {
  useOrders, useOrderItems, useUpsertOrder, useUpdateOrderStatus,
  useUpdatePaymentStatus, useDeleteOrder,
  ORDER_STATUSES, PAYMENT_STATUSES,
  statusBadgeClass, paymentBadgeClass,
  type OrderRow, type OrderStatus, type PaymentStatus, type OrderInput, type OrderItemInput,
} from "@/lib/orders-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
      { title: "Orders — EazyStore" },
      { name: "description", content: "View and manage all customer orders — status, payments, and delivery in one place." },
    ],
  }),
  component: OrdersPage,
});

type FilterStatus = OrderStatus | "all";

function OrdersPage() {
  const storeQ = useMyStore();
  const store = storeQ.data;
  const ordersQ = useOrders(store?.id);
  const productsQ = useMyProducts(store?.id);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [viewing, setViewing] = useState<OrderRow | null>(null);
  const [editing, setEditing] = useState<OrderRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<OrderRow | null>(null);

  const del = useDeleteOrder(store?.id);

  const orders = ordersQ.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_phone.toLowerCase().includes(q)
      );
    });
  }, [orders, search, statusFilter]);

  const stats = useMemo(() => {
    const total = orders.reduce((s, o) => s + Number(o.total), 0);
    const pending = orders.filter((o) => o.status === "pending").length;
    const delivered = orders.filter((o) => o.status === "delivered").length;
    return { count: orders.length, total, pending, delivered };
  }, [orders]);

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
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black sm:text-3xl">Orders</h1>
          <p className="text-sm text-foreground/60">View and manage customer orders.</p>
        </div>
        <Button onClick={() => setCreating(true)} disabled={!store}>
          <Plus className="mr-1 h-4 w-4" /> New Order
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Orders" value={stats.count.toString()} />
        <StatCard label="Pending" value={stats.pending.toString()} tone={stats.pending ? "warn" : "muted"} />
        <StatCard label="Delivered" value={stats.delivered.toString()} />
        <StatCard label="Revenue" value={`৳ ${stats.total.toLocaleString()}`} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input
            placeholder="Search order #, customer, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1 text-xs">
          {(["all", ...ORDER_STATUSES] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={
                statusFilter === s
                  ? "rounded-md bg-primary px-3 py-1.5 font-bold text-primary-foreground capitalize"
                  : "rounded-md px-3 py-1.5 font-medium text-foreground/60 capitalize hover:bg-foreground/5"
              }
            >
              {s}
            </button>
          ))}
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
            ? <Button onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" /> New Order</Button>
            : undefined}
        />
      ) : (
        <OrdersTable
          rows={filtered}
          storeId={store.id}
          onView={setViewing}
          onEdit={setEditing}
          onDelete={setDeleting}
        />
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

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "warn" | "muted" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">{label}</p>
      <p className={
        tone === "warn"
          ? "mt-1 font-display text-2xl font-black text-amber-600 dark:text-amber-400"
          : "mt-1 font-display text-2xl font-black"
      }>{value}</p>
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
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${statusBadgeClass(status)}`}>
      {status}
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

function OrdersTable({
  rows, storeId, onView, onEdit, onDelete,
}: {
  rows: OrderRow[]; storeId: string;
  onView: (o: OrderRow) => void;
  onEdit: (o: OrderRow) => void;
  onDelete: (o: OrderRow) => void;
}) {
  const updStatus = useUpdateOrderStatus(storeId);
  const updPayment = useUpdatePaymentStatus(storeId);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-foreground/50">
            <tr>
              <th className="px-4 py-3 font-semibold">Order</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Payment</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((o) => (
              <tr key={o.id} className="hover:bg-foreground/[0.02]">
                <td className="px-4 py-3">
                  <div className="font-mono text-xs font-semibold">{o.order_number}</div>
                  <div className="text-xs text-foreground/50">
                    {new Date(o.created_at).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{o.customer_name}</div>
                  <div className="text-xs text-foreground/60">{o.customer_phone}</div>
                </td>
                <td className="px-4 py-3 font-bold text-primary">৳ {Number(o.total).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <Select
                    value={o.status}
                    onValueChange={async (v) => {
                      try {
                        await updStatus.mutateAsync({ id: o.id, status: v as OrderStatus });
                        toast.success(`Status → ${v}`);
                      } catch (e: any) { toast.error(e?.message ?? "Failed"); }
                    }}
                  >
                    <SelectTrigger className="h-8 w-[140px] border-0 bg-transparent p-0 focus:ring-0">
                      <StatusPill status={o.status} />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={o.payment_status}
                    onValueChange={async (v) => {
                      try {
                        await updPayment.mutateAsync({ id: o.id, payment_status: v as PaymentStatus });
                        toast.success(`Payment → ${v}`);
                      } catch (e: any) { toast.error(e?.message ?? "Failed"); }
                    }}
                  >
                    <SelectTrigger className="h-8 w-[120px] border-0 bg-transparent p-0 focus:ring-0">
                      <PaymentPill status={o.payment_status} />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onView(o)} aria-label="View"><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onEdit(o)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(o)} aria-label="Delete"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="divide-y divide-border sm:hidden">
        {rows.map((o) => (
          <li key={o.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold">{o.order_number}</p>
                <p className="mt-1 truncate font-semibold">{o.customer_name}</p>
                <p className="text-xs text-foreground/60">{o.customer_phone}</p>
                <p className="mt-1 font-bold text-primary">৳ {Number(o.total).toLocaleString()}</p>
                <div className="mt-2 flex gap-2"><StatusPill status={o.status} /><PaymentPill status={o.payment_status} /></div>
              </div>
              <div className="flex flex-col gap-1">
                <Button variant="ghost" size="icon" onClick={() => onView(o)}><Eye className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => onEdit(o)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(o)}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </li>
        ))}
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
            <p className="mt-1 flex items-center gap-1 text-sm"><Phone className="h-3.5 w-3.5" /> {order.customer_phone}</p>
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
