import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Loader2, Search, Users, Phone, MapPin, ShoppingBag, Eye, Download, RefreshCw,
} from "lucide-react";

import { useMyStore } from "@/lib/eazystore-data";
import { useOrders, type OrderRow } from "@/lib/orders-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Customers — EasyStore" },
      { name: "description", content: "View all customers, their contact details and order history." },
    ],
  }),
  component: CustomersPage,
});

type Customer = {
  key: string;
  name: string;
  phone: string;
  address: string | null;
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: string;
  firstOrderAt: string;
  deliveredCount: number;
  cancelledCount: number;
  pendingCount: number;
  orders: OrderRow[];
};

type SortKey = "recent" | "spent" | "orders" | "name";

function normalizePhone(p: string) {
  return (p || "").replace(/\D+/g, "");
}

function CustomersPage() {
  const storeQ = useMyStore();
  const store = storeQ.data;
  const ordersQ = useOrders(store?.id);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [viewing, setViewing] = useState<Customer | null>(null);

  const customers = useMemo<Customer[]>(() => {
    const orders = ordersQ.data ?? [];
    const map = new Map<string, Customer>();
    for (const o of orders) {
      const key = normalizePhone(o.customer_phone) || `name:${o.customer_name.toLowerCase()}`;
      const existing = map.get(key);
      if (existing) {
        existing.ordersCount += 1;
        existing.totalSpent += Number(o.total || 0);
        existing.orders.push(o);
        if (o.created_at > existing.lastOrderAt) existing.lastOrderAt = o.created_at;
        if (o.created_at < existing.firstOrderAt) existing.firstOrderAt = o.created_at;
        if (o.status === "delivered") existing.deliveredCount += 1;
        if (o.status === "cancelled") existing.cancelledCount += 1;
        if (o.status === "pending") existing.pendingCount += 1;
        if (!existing.address && o.customer_address) existing.address = o.customer_address;
      } else {
        map.set(key, {
          key,
          name: o.customer_name,
          phone: o.customer_phone,
          address: o.customer_address,
          ordersCount: 1,
          totalSpent: Number(o.total || 0),
          lastOrderAt: o.created_at,
          firstOrderAt: o.created_at,
          deliveredCount: o.status === "delivered" ? 1 : 0,
          cancelledCount: o.status === "cancelled" ? 1 : 0,
          pendingCount: o.status === "pending" ? 1 : 0,
          orders: [o],
        });
      }
    }
    return Array.from(map.values());
  }, [ordersQ.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = customers;
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          (c.address ?? "").toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sort === "spent") return b.totalSpent - a.totalSpent;
      if (sort === "orders") return b.ordersCount - a.ordersCount;
      if (sort === "name") return a.name.localeCompare(b.name);
      return b.lastOrderAt.localeCompare(a.lastOrderAt);
    });
    return sorted;
  }, [customers, search, sort]);

  const stats = useMemo(() => {
    const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0);
    const totalOrders = customers.reduce((s, c) => s + c.ordersCount, 0);
    const repeat = customers.filter((c) => c.ordersCount > 1).length;
    return {
      count: customers.length,
      totalRevenue,
      totalOrders,
      repeat,
      avg: customers.length ? totalRevenue / customers.length : 0,
    };
  }, [customers]);

  const exportCsv = () => {
    const rows = [
      ["Name", "Phone", "Address", "Orders", "Total Spent (BDT)", "Last Order"],
      ...filtered.map((c) => [
        c.name,
        c.phone,
        (c.address ?? "").replace(/\n/g, " "),
        String(c.ordersCount),
        c.totalSpent.toFixed(2),
        new Date(c.lastOrderAt).toISOString(),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (storeQ.isLoading || ordersQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6" /> Customers
          </h1>
          <p className="text-sm text-muted-foreground">
            গ্রাহকদের তথ্য, অর্ডার সংখ্যা ও মোট খরচের সারাংশ।
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => ordersQ.refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Customers" value={stats.count.toString()} />
        <StatCard label="Repeat Buyers" value={stats.repeat.toString()} />
        <StatCard label="Total Orders" value={stats.totalOrders.toString()} />
        <StatCard label="Total Revenue" value={`৳ ${stats.totalRevenue.toFixed(0)}`} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="নাম, ফোন বা ঠিকানা দিয়ে খুঁজুন..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recent order</SelectItem>
            <SelectItem value="spent">Highest spent</SelectItem>
            <SelectItem value="orders">Most orders</SelectItem>
            <SelectItem value="name">Name (A-Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>কোনো গ্রাহক পাওয়া যায়নি।</p>
            <p className="text-xs">নতুন অর্ডার আসলে গ্রাহকরা এখানে দেখাবে।</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Customer</th>
                  <th className="text-left px-4 py-3">Contact</th>
                  <th className="text-right px-4 py-3">Orders</th>
                  <th className="text-right px-4 py-3">Spent</th>
                  <th className="text-left px-4 py-3">Last order</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.key} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.name}</div>
                      {c.address ? (
                        <div className="text-xs text-muted-foreground flex items-start gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                          <span className="line-clamp-1">{c.address}</span>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`tel:${c.phone}`}
                        className="text-xs flex items-center gap-1 hover:text-primary"
                      >
                        <Phone className="h-3 w-3" /> {c.phone}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{c.ordersCount}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      ৳ {c.totalSpent.toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(c.lastOrderAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => setViewing(c)}>
                        <Eye className="h-4 w-4 mr-1" /> View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.name}</DialogTitle>
            <DialogDescription>Customer profile & order history</DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={viewing.phone} />
                <InfoRow
                  icon={<ShoppingBag className="h-3.5 w-3.5" />}
                  label="Total Orders"
                  value={viewing.ordersCount.toString()}
                />
                <InfoRow
                  icon={<MapPin className="h-3.5 w-3.5" />}
                  label="Address"
                  value={viewing.address ?? "—"}
                />
                <InfoRow
                  icon={<ShoppingBag className="h-3.5 w-3.5" />}
                  label="Total Spent"
                  value={`৳ ${viewing.totalSpent.toFixed(0)}`}
                />
              </div>

              <div className="flex gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-green-500/10 text-green-700 dark:text-green-400">
                  Delivered: {viewing.deliveredCount}
                </span>
                <span className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
                  Pending: {viewing.pendingCount}
                </span>
                <span className="px-2 py-1 rounded bg-red-500/10 text-red-700 dark:text-red-400">
                  Cancelled: {viewing.cancelledCount}
                </span>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Order History
                </div>
                <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
                  {viewing.orders
                    .slice()
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .map((o) => (
                      <div key={o.id} className="flex items-center justify-between p-3 text-sm">
                        <div>
                          <div className="font-medium">#{o.order_number}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(o.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">৳ {Number(o.total).toFixed(0)}</div>
                          <div className="text-xs text-muted-foreground capitalize">{o.status}</div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        {icon} {label}
      </div>
      <div className="font-medium mt-0.5 break-words">{value}</div>
    </div>
  );
}
