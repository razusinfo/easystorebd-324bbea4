import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Truck, Search, Copy, Phone, MapPin, Package, CheckCircle2, Send, ExternalLink, Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { useMyStore } from "@/lib/eazystore-data";
import {
  useOrders, useUpdateOrderStatus, statusBadgeClass,
  type OrderRow, type OrderStatus,
} from "@/lib/orders-data";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/courier")({
  head: () => ({
    meta: [
      { title: "Courier — EazyStore" },
      { name: "description", content: "Ship orders, update delivery status, and connect with courier partners." },
    ],
  }),
  component: CourierPage,
});

type Filter = "to_ship" | "in_transit" | "delivered" | "all";

const PARTNERS = [
  { name: "Pathao", url: "https://merchant.pathao.com/", color: "bg-rose-500" },
  { name: "Steadfast", url: "https://steadfast.com.bd/", color: "bg-emerald-500" },
  { name: "RedX", url: "https://redx.com.bd/", color: "bg-red-600" },
  { name: "Paperfly", url: "https://go.paperfly.com.bd/", color: "bg-sky-600" },
  { name: "SA Paribahan", url: "https://www.saparibahan.com/", color: "bg-amber-600" },
];

function fmt(n: number) {
  return `৳${Number(n || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

function CourierPage() {
  const { data: store } = useMyStore();
  const { data: orders, isLoading } = useOrders(store?.id);
  const upd = useUpdateOrderStatus(store?.id);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("to_ship");

  const rows = useMemo(() => {
    const all = (orders ?? []) as OrderRow[];
    const matchFilter = (o: OrderRow) => {
      switch (filter) {
        case "to_ship": return o.status === "confirmed" || o.status === "processing";
        case "in_transit": return o.status === "shipped";
        case "delivered": return o.status === "delivered";
        case "all": return o.status !== "cancelled";
      }
    };
    const needle = q.trim().toLowerCase();
    return all.filter(matchFilter).filter((o) => {
      if (!needle) return true;
      return (
        o.order_number.toLowerCase().includes(needle) ||
        o.customer_name.toLowerCase().includes(needle) ||
        o.customer_phone.toLowerCase().includes(needle) ||
        (o.customer_address ?? "").toLowerCase().includes(needle)
      );
    });
  }, [orders, filter, q]);

  const stats = useMemo(() => {
    const all = (orders ?? []) as OrderRow[];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return {
      toShip: all.filter((o) => o.status === "confirmed" || o.status === "processing").length,
      inTransit: all.filter((o) => o.status === "shipped").length,
      deliveredToday: all.filter((o) => o.status === "delivered" && new Date(o.updated_at).getTime() >= today.getTime()).length,
    };
  }, [orders]);

  const setStatus = (id: string, status: OrderStatus) => {
    upd.mutate({ id, status }, {
      onSuccess: () => toast.success(`Order marked ${status}`),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const copyAddress = async (o: OrderRow) => {
    const text = [o.customer_name, o.customer_phone, o.customer_address ?? ""].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Shipping address copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <main className="p-4 sm:p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Courier</h1>
            <p className="text-sm text-muted-foreground">Ship orders and track deliveries.</p>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="To ship" value={stats.toShip} icon={Package} tone="text-amber-600" />
        <StatCard label="In transit" value={stats.inTransit} icon={Send} tone="text-violet-600" />
        <StatCard label="Delivered today" value={stats.deliveredToday} icon={CheckCircle2} tone="text-emerald-600" />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Courier partners</h2>
        <div className="flex flex-wrap gap-2">
          {PARTNERS.map((p) => (
            <a key={p.name} href={p.url} target="_blank" rel="noreferrer"
              className="group inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm hover:bg-accent">
              <span className={`h-2 w-2 rounded-full ${p.color}`} />
              {p.name}
              <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
            </a>
          ))}
        </div>
      </section>

      <Card className="p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order #, name, phone or address" className="pl-8" />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="to_ship">To ship</SelectItem>
            <SelectItem value="in_transit">In transit</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="all">All active</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Ship to</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : rows.length ? rows.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <div className="font-medium">#{o.order_number}</div>
                  <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{o.customer_name}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />{o.customer_phone}
                  </div>
                </TableCell>
                <TableCell className="max-w-xs">
                  <div className="flex items-start gap-1 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="whitespace-pre-wrap">{o.customer_address || "—"}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">{fmt(o.total)}</TableCell>
                <TableCell>
                  <Badge className={statusBadgeClass(o.status)}>{o.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => copyAddress(o)} title="Copy address">
                      <Copy className="h-4 w-4" />
                    </Button>
                    {(o.status === "confirmed" || o.status === "processing") && (
                      <Button size="sm" variant="secondary" onClick={() => setStatus(o.id, "shipped")}>
                        <Send className="h-3 w-3 mr-1" />Mark shipped
                      </Button>
                    )}
                    {o.status === "shipped" && (
                      <Button size="sm" onClick={() => setStatus(o.id, "delivered")}>
                        <CheckCircle2 className="h-3 w-3 mr-1" />Delivered
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No orders in this view.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </main>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Package; tone: string }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={`grid h-10 w-10 place-items-center rounded-lg bg-muted ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
      </div>
    </Card>
  );
}
