import { Fragment, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { updateResellerOrderStatus } from "@/lib/reseller-orders.functions";
import { adminListUsers } from "@/lib/admin.functions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin-reseller-orders")({
  component: AdminResellerOrdersPage,
});

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;
type Status = typeof STATUSES[number];

const STATUS_COLORS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  confirmed: "secondary",
  shipped: "secondary",
  delivered: "default",
  cancelled: "destructive",
};

function fmt(n: number | null | undefined) {
  if (n == null) return "৳0";
  return `৳${Number(n).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

type Row = {
  id: string;
  reseller_id: string;
  reseller_product_id: string;
  product_name: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  shipping_address: string;
  quantity: number;
  original_price: number;
  reseller_price: number;
  profit_margin: number;
  status: Status;
  shipping_requested: boolean;
  notes: string | null;
  source: string | null;
  source_order_id: string | null;
  source_store_id: string | null;
  tracking_id: string | null;
  tracking_url: string | null;
  created_at: string;
  reseller?: { full_name: string | null; email: string } | null;
  store_name?: string | null;
};

function AdminResellerOrdersPage() {
  const qc = useQueryClient();
  const listUsers = useServerFn(adminListUsers);

  const q = useQuery({
    queryKey: ["admin-reseller-orders"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("reseller_orders")
        .select("id, reseller_id, reseller_product_id, product_name, customer_name, customer_phone, customer_email, shipping_address, quantity, original_price, reseller_price, profit_margin, status, shipping_requested, notes, source, source_order_id, source_store_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as unknown as Row[];
      const users = await listUsers().catch(() => [] as Array<{ user_id: string; full_name: string | null; email: string }>);
      const map = new Map<string, { full_name: string | null; email: string }>();
      for (const u of users ?? []) map.set(u.user_id, { full_name: u.full_name, email: u.email });

      const storeIds = Array.from(new Set(rows.map((r) => r.source_store_id).filter(Boolean))) as string[];
      const storeMap = new Map<string, string>();
      if (storeIds.length) {
        const { data: stores } = await supabase.from("stores").select("id, name").in("id", storeIds);
        (stores ?? []).forEach((s) => storeMap.set(s.id, s.name ?? ""));
      }
      return rows.map((r) => ({
        ...r,
        reseller: map.get(r.reseller_id) ?? null,
        store_name: r.source_store_id ? storeMap.get(r.source_store_id) ?? null : null,
      }));
    },
  });

  const updateStatus = useServerFn(updateResellerOrderStatus);
  const upd = useMutation({
    mutationFn: async (v: { id: string; status: Status }) => {
      await updateStatus({ data: v });
    },
    onSuccess: () => {
      toast.success("Status updated & customer notified");
      qc.invalidateQueries({ queryKey: ["admin-reseller-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [fReseller, setFReseller] = useState("");
  const [fProduct, setFProduct] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  const filtered = useMemo(() => {
    const rows = q.data ?? [];
    const rq = fReseller.trim().toLowerCase();
    const pq = fProduct.trim().toLowerCase();
    const from = fFrom ? new Date(fFrom).getTime() : null;
    const to = fTo ? new Date(fTo).getTime() + 86_400_000 : null;
    return rows.filter((r) => {
      if (rq) {
        const hay = `${r.reseller?.full_name ?? ""} ${r.reseller?.email ?? ""} ${r.store_name ?? ""}`.toLowerCase();
        if (!hay.includes(rq)) return false;
      }
      if (pq && !r.product_name.toLowerCase().includes(pq)) return false;
      const t = new Date(r.created_at).getTime();
      if (from != null && t < from) return false;
      if (to != null && t >= to) return false;
      return true;
    });
  }, [q.data, fReseller, fProduct, fFrom, fTo]);

  const totalProfit = filtered.reduce((s, r) => s + Number(r.profit_margin || 0), 0);
  const pendingShip = filtered.filter((r) => r.shipping_requested && r.status !== "delivered" && r.status !== "cancelled").length;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reseller Orders</h1>
          <p className="text-sm text-muted-foreground">All orders placed by resellers via the API.</p>
        </div>
        <div className="flex gap-3">
          <Card className="px-4 py-2 text-sm">
            <span className="text-muted-foreground">Total profit: </span>
            <span className="font-bold text-primary">{fmt(totalProfit)}</span>
          </Card>
          <Card className="px-4 py-2 text-sm">
            <span className="text-muted-foreground">Awaiting shipment: </span>
            <span className="font-bold">{pendingShip}</span>
          </Card>
        </div>
      </header>

      <Card className="p-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <Label className="text-xs">Sold By (reseller / store)</Label>
          <Input value={fReseller} onChange={(e) => setFReseller(e.target.value)} placeholder="name, email or store" />
        </div>
        <div>
          <Label className="text-xs">Source Product</Label>
          <Input value={fProduct} onChange={(e) => setFProduct(e.target.value)} placeholder="product name" />
        </div>
        <div>
          <Label className="text-xs">Forwarded from</Label>
          <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Forwarded to</Label>
          <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button variant="outline" size="sm" onClick={() => { setFReseller(""); setFProduct(""); setFFrom(""); setFTo(""); }}>
            Clear filters
          </Button>
        </div>
      </Card>


      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sold By</TableHead>
              <TableHead>Source Product</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Ship to</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Profit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Placed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length ? filtered.map((r) => (
              <Fragment key={r.id}>
              <TableRow>
                <TableCell>
                  <div className="font-medium">{r.reseller?.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.reseller?.email ?? r.reseller_id.slice(0, 8)}</div>
                  {r.store_name && (
                    <div className="text-[11px] text-muted-foreground">Store: {r.store_name}</div>
                  )}
                  {r.source === "storefront" && (
                    <Badge variant="secondary" className="mt-1 text-[10px]">Storefront order</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{r.product_name}</div>
                  <a
                    href={`/admin-reseller-adopters?rp=${r.reseller_product_id}`}
                    className="text-xs text-primary underline"
                  >
                    View source · deducts stock
                  </a>
                </TableCell>
                <TableCell>
                  <div>{r.customer_name}</div>
                  {r.customer_phone && <div className="text-xs text-muted-foreground">{r.customer_phone}</div>}
                  {r.customer_email && <div className="text-xs text-muted-foreground">{r.customer_email}</div>}
                </TableCell>
                <TableCell className="max-w-xs whitespace-pre-wrap text-xs text-muted-foreground">
                  {r.shipping_address}
                </TableCell>
                <TableCell className="text-right">{r.quantity}</TableCell>
                <TableCell className="text-right font-medium text-primary">{fmt(r.profit_margin)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_COLORS[r.status] ?? "outline"}>{r.status}</Badge>
                    <Select value={r.status} onValueChange={(v) => upd.mutate({ id: r.id, status: v as Status })}>
                      <SelectTrigger className="h-7 w-[120px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </TableCell>
              </TableRow>
              {r.notes && (
                <TableRow key={`${r.id}-notes`} className="bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-50 dark:hover:bg-amber-950/30">
                  <TableCell colSpan={8} className="py-2">
                    <div className="flex items-start gap-2 text-sm">
                      <span className="rounded bg-amber-200 dark:bg-amber-800 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
                        Note
                      </span>
                      <p className="whitespace-pre-wrap text-amber-900 dark:text-amber-100">{r.notes}</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              </Fragment>
            )) : (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  {q.isLoading ? "Loading…" : q.error ? (q.error as Error).message : "No reseller orders yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
