import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Eye, Loader2, Package, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/account/orders")({
  component: MyOrdersPage,
});

type OrderRow = {
  id: string;
  order_number: string;
  total: number;
  status: string;
  payment_status: string;
  created_at: string;
};

type TabKey = "all" | "to_pay" | "to_ship" | "to_receive" | "to_review";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "to_pay", label: "To Pay" },
  { key: "to_ship", label: "To Ship" },
  { key: "to_receive", label: "To Receive" },
  { key: "to_review", label: "To Review" },
];

function matchTab(o: OrderRow, tab: TabKey): boolean {
  const s = (o.status || "").toLowerCase();
  const p = (o.payment_status || "").toLowerCase();
  switch (tab) {
    case "all": return true;
    case "to_pay": return p === "unpaid" || p === "pending";
    case "to_ship": return s === "pending" || s === "processing" || s === "confirmed";
    case "to_receive": return s === "shipped" || s === "out_for_delivery" || s === "in_transit";
    case "to_review": return s === "delivered" || s === "completed";
  }
}

function MyOrdersPage() {
  const [tab, setTab] = useState<TabKey>("all");
  const [query, setQuery] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["account", "orders"],
    queryFn: async (): Promise<OrderRow[]> => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return [];
      const { data: rows, error } = await supabase
        .from("orders")
        .select("id, order_number, total, status, payment_status, created_at")
        .eq("customer_user_id", uid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (rows ?? []) as OrderRow[];
    },
  });

  const rows = data ?? [];
  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { all: 0, to_pay: 0, to_ship: 0, to_receive: 0, to_review: 0 };
    for (const o of rows) for (const t of TABS) if (matchTab(o, t.key)) c[t.key] += 1;
    return c;
  }, [rows]);

  const filtered = rows
    .filter((o) => matchTab(o, tab))
    .filter((o) => {
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return o.order_number.toLowerCase().includes(q);
    });

  return (
    <div>
      {/* Grey header band */}
      <div className="-mx-4 border-y bg-muted/60 px-4 py-4 sm:-mx-6 sm:px-6">
        <h1 className="text-xl font-semibold">My Orders</h1>
      </div>

      {/* Tabs */}
      <div className="mt-4 border-b">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {TABS.map((t) => {
            const active = t.key === tab;
            const count = counts[t.key];
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`-mb-px border-b-2 pb-2 pt-1 transition ${
                  active
                    ? "border-primary font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
                {t.key !== "all" && count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search */}
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by seller name, order ID or product name"
          className="h-11 bg-muted/50 pl-9"
        />
      </div>

      {isLoading ? (
        <div className="mt-8 grid place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="mt-6 rounded-lg bg-destructive/10 px-3 py-3 text-sm text-destructive">
          Could not load your orders.
        </p>
      ) : filtered.length === 0 ? (
        <div className="mt-10 grid place-items-center gap-2 text-center text-muted-foreground">
          <Package className="h-10 w-10" />
          <p>No orders found.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.order_number}</TableCell>
                  <TableCell>{new Date(o.created_at).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant="secondary">{o.status}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{o.payment_status}</Badge></TableCell>
                  <TableCell className="text-right font-bold">
                    {Number(o.total).toLocaleString()} ৳
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/account/orders/$id" params={{ id: o.id }}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
