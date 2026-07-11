import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Loader2, Package, Download, Save, Printer, ChevronDown,
  User, Mail, Phone, MapPin, Copy, Link as LinkIcon, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/orders_/$id")({
  head: () => ({
    meta: [
      { title: "Order details — EasyStore" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminOrderDetailPage,
});

type FullOrder = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  notes: string | null;
  subtotal: number;
  delivery_charge: number;
  discount: number;
  total: number;
  created_at: string;
  items: {
    id: string;
    name: string;
    variant_label: string | null;
    price: number;
    quantity: number;
    subtotal: number;
  }[];
};

function AdminOrderDetailPage() {
  const { id } = Route.useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "order", id],
    queryFn: async (): Promise<FullOrder | null> => {
      const { data: order, error: oErr } = await supabase
        .from("orders")
        .select("id, order_number, status, payment_status, payment_method, customer_name, customer_phone, customer_address, notes, subtotal, delivery_charge, discount, total, created_at")
        .eq("id", id)
        .maybeSingle();
      if (oErr) throw oErr;
      if (!order) return null;
      const { data: items, error: iErr } = await supabase
        .from("order_items")
        .select("id, name, variant_label, price, quantity, subtotal")
        .eq("order_id", id);
      if (iErr) throw iErr;
      return { ...order, items: items ?? [] } as FullOrder;
    },
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/orders"><ArrowLeft className="mr-1 h-4 w-4" /> Back to orders</Link>
        </Button>
        <div className="grid place-items-center gap-2 py-16 text-center text-muted-foreground">
          <Package className="h-10 w-10" />
          <p>Order not found.</p>
        </div>
      </div>
    );
  }

  const shortId = data.id.replace(/\D/g, "").slice(0, 7) || data.order_number.replace(/\D/g, "").slice(-7);
  const receiptUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/receipt/${data.id}`;

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <Link to="/orders"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <span className="font-semibold">Order #{shortId}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Download className="mr-1 h-4 w-4" /> Download
          </Button>
          <Button variant="outline" size="sm">
            <Save className="mr-1 h-4 w-4" /> Save
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Print <ChevronDown className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Order header */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-black">Order #{shortId}</h1>
            <span className="rounded-full bg-fuchsia-100 px-2 py-0.5 text-[11px] font-bold text-fuchsia-600 dark:bg-fuchsia-500/15 dark:text-fuchsia-400 capitalize">
              {data.status === "pending" ? "Placed" : data.status}
            </span>
          </div>
          <span className="text-xs text-foreground/50">ID: {shortId}</span>
        </div>
        <div className="flex items-center gap-2 border-t border-border bg-muted/30 px-4 py-2">
          <LinkIcon className="h-3.5 w-3.5 text-foreground/40" />
          <a href={receiptUrl} className="flex-1 truncate text-sm text-primary hover:underline">
            {receiptUrl}
          </a>
          <button
            type="button"
            onClick={() => { navigator.clipboard?.writeText(receiptUrl); toast.success("Link copied"); }}
            className="text-foreground/40 hover:text-foreground"
            aria-label="Copy link"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body grid */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Products */}
        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-semibold">Products</h2>
            <Button variant="outline" size="sm">
              <Plus className="mr-1 h-3.5 w-3.5" /> Add More Product
            </Button>
          </header>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            {data.items.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-foreground/50">No items</p>
            )}
            {data.items.map((it) => (
              <div key={it.id} className="rounded-lg border border-border p-3">
                <div className="relative grid aspect-square place-items-center overflow-hidden rounded-md bg-muted/50">
                  <Package className="h-12 w-12 text-foreground/30" />
                  <span className="absolute left-2 top-2 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-semibold text-foreground/70">
                    Own
                  </span>
                </div>
                <p className="mt-3 font-semibold">{it.name}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-foreground/60">Unit Price</Label>
                    <Input readOnly value={`BDT ${Number(it.price).toLocaleString()}`} className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label className="text-xs text-foreground/60">Total</Label>
                    <Input readOnly value={`BDT ${Number(it.subtotal).toLocaleString()}`} className="mt-1 h-9" />
                  </div>
                </div>
                {it.variant_label && (
                  <span className="mt-2 inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                    {it.variant_label}
                  </span>
                )}
                <div className="mt-3 flex items-center justify-center gap-3 rounded-md border border-border px-3 py-1.5 text-sm">
                  <span>Qty</span>
                  <span className="font-bold">{it.quantity}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right column */}
        <aside className="space-y-4">
          <section className="rounded-xl border border-border bg-card">
            <header className="border-b border-border px-4 py-3">
              <h2 className="font-semibold">Order Information</h2>
            </header>
            <div className="space-y-3 p-4">
              <div>
                <Label className="text-xs text-foreground/60">Order Type</Label>
                <div className="mt-1 grid grid-cols-2 overflow-hidden rounded-md border border-border">
                  <button className="bg-muted/40 py-2 text-sm">In shop</button>
                  <button className="border-l border-border bg-background py-2 text-sm font-semibold">Online</button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-foreground/60">Order Status</Label>
                <Input readOnly value={data.status === "pending" ? "Order Placed" : data.status} className="mt-1 h-9 capitalize" />
              </div>
              <div>
                <Label className="text-xs text-foreground/60">Payment</Label>
                <Input readOnly value={`${data.payment_status}${data.payment_method ? ` · ${data.payment_method}` : ""}`} className="mt-1 h-9 capitalize" />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card">
            <header className="border-b border-border px-4 py-3">
              <h2 className="font-semibold">Customer Information</h2>
            </header>
            <div className="space-y-3 p-4">
              <Field icon={<User className="h-4 w-4" />} label="Customer Name" value={data.customer_name} />
              <Field icon={<Mail className="h-4 w-4" />} label="Customer Email" value="" placeholder="—" />
              <Field icon={<Phone className="h-4 w-4" />} label="Customer Phone" value={data.customer_phone} />
              <Field icon={<MapPin className="h-4 w-4" />} label="Customer Address" value={data.customer_address ?? ""} />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4 text-sm">
            <h2 className="mb-2 font-semibold">Summary</h2>
            <Row label="Subtotal" value={data.subtotal} />
            <Row label="Delivery" value={data.delivery_charge} />
            {Number(data.discount) > 0 && <Row label="Discount" value={-data.discount} />}
            <div className="mt-2 flex justify-between border-t border-border pt-2 font-bold text-primary">
              <span>Total</span>
              <span>৳ {Number(data.total).toLocaleString()}</span>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function Field({
  icon, label, value, placeholder,
}: { icon: React.ReactNode; label: string; value: string; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs text-foreground/60">{label}</Label>
      <div className="mt-1 flex items-center gap-2 rounded-md border border-border px-2.5">
        <span className="text-foreground/40">{icon}</span>
        <Input
          readOnly
          value={value}
          placeholder={placeholder}
          className="h-9 border-0 px-0 focus-visible:ring-0"
        />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-foreground/60">{label}</span>
      <span>৳ {Number(value).toLocaleString()}</span>
    </div>
  );
}
