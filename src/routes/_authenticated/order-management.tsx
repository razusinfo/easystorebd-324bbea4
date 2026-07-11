import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ChevronLeft, ChevronRight, Eye, ShoppingBag } from "lucide-react";
import { listManagedOrders, type ManagedOrderRow } from "@/lib/order-management.functions";
import { updateManagedOrderStatus } from "@/lib/order-management-actions.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  status: fallback(z.string(), "all").default("all"),
  supplier: fallback(z.string(), "all").default("all"),
  reseller: fallback(z.string(), "all").default("all"),
  page: fallback(z.number().int(), 1).default(1),
});

export const Route = createFileRoute("/_authenticated/order-management")({
  component: OrderManagementPage,
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Order Management — EasyStore" },
      { name: "description", content: "Role-scoped order management dashboard." },
    ],
  }),
});

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;

function statusClasses(status: string): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-200";
    case "confirmed":
      return "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200";
    case "shipped":
      return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-200";
    case "delivered":
      return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200";
    case "cancelled":
      return "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function fmt(n: number | null | undefined) {
  if (n == null) return "৳0";
  return `৳${Number(n).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

function OrderManagementPage() {
  const listOrders = useServerFn(listManagedOrders);
  const q = useQuery({
    queryKey: ["order-management"],
    queryFn: () => listOrders(),
  });

  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fSupplier, setFSupplier] = useState<string>("all");
  const [fReseller, setFReseller] = useState<string>("all");
  const [detail, setDetail] = useState<ManagedOrderRow | null>(null);

  const role = q.data?.role;
  const rows = q.data?.rows ?? [];

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (fStatus !== "all" && r.status !== fStatus) return false;
      if (role === "super_admin" && fSupplier !== "all" && r.source !== fSupplier) return false;
      if (role === "super_admin" && fReseller !== "all" && r.reseller_id !== fReseller) return false;
      if (!s) return true;
      const hay =
        `${r.order_id_short} ${r.customer_name} ${r.customer_phone ?? ""} ${r.product_name} ${r.reseller_name} ${r.reseller_store ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [rows, search, fStatus, fSupplier, fReseller, role]);

  const totals = useMemo(() => {
    const revenue = filtered.reduce((s, r) => s + r.total_amount, 0);
    const pending = filtered.filter((r) => r.status === "pending").length;
    return { revenue, pending, count: filtered.length };
  }, [filtered]);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-6 w-6" /> Order Management
          </h1>
          <p className="text-sm text-muted-foreground">
            {role === "super_admin"
              ? "All orders across every supplier and reseller."
              : role === "supplier"
                ? "Your orders only — scoped to your supplier account."
                : "Loading role…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Card className="px-3 py-2 text-sm">
            <span className="text-muted-foreground">Orders: </span>
            <span className="font-bold">{totals.count}</span>
          </Card>
          <Card className="px-3 py-2 text-sm">
            <span className="text-muted-foreground">Pending: </span>
            <span className="font-bold text-yellow-700">{totals.pending}</span>
          </Card>
          <Card className="px-3 py-2 text-sm">
            <span className="text-muted-foreground">Revenue: </span>
            <span className="font-bold text-primary">{fmt(totals.revenue)}</span>
          </Card>
        </div>
      </header>

      <Card className="p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="text-xs">Search</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Order ID, customer, product…"
            />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {role === "super_admin" && (
            <>
              <div>
                <Label className="text-xs">Supplier</Label>
                <Select value={fSupplier} onValueChange={setFSupplier}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All suppliers</SelectItem>
                    {(q.data?.suppliers ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Reseller</Label>
                <Select value={fReseller} onValueChange={setFReseller}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All resellers</SelectItem>
                    {(q.data?.resellers ?? []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name || "—"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Reseller</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                    Loading orders…
                  </TableCell>
                </TableRow>
              )}
              {!q.isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                    No orders found.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">#{r.order_id_short}</TableCell>
                  <TableCell>
                    <div className="font-medium">{r.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{r.customer_phone ?? "—"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{r.reseller_name}</div>
                    {r.reseller_store && (
                      <div className="text-xs text-muted-foreground">{r.reseller_store}</div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate">{r.product_name}</TableCell>
                  <TableCell className="text-right">{r.quantity}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(r.total_amount)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize ${statusClasses(r.status)}`}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setDetail(r)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Order #{detail?.order_id_short}</DialogTitle>
            <DialogDescription>
              Placed {detail ? new Date(detail.created_at).toLocaleString("en-BD") : ""}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div>
                <Badge variant="outline" className={`capitalize ${statusClasses(detail.status)}`}>
                  {detail.status}
                </Badge>
              </div>
              <section>
                <h3 className="font-semibold mb-1">Customer</h3>
                <div>{detail.customer_name}</div>
                <div className="text-muted-foreground">{detail.customer_phone ?? "—"}</div>
                <div className="text-muted-foreground">{detail.customer_email ?? "—"}</div>
                <div className="text-muted-foreground whitespace-pre-wrap">{detail.shipping_address}</div>
              </section>
              <section>
                <h3 className="font-semibold mb-1">Reseller</h3>
                <div>{detail.reseller_name}</div>
                {detail.reseller_store && (
                  <div className="text-muted-foreground">{detail.reseller_store}</div>
                )}
              </section>
              <section>
                <h3 className="font-semibold mb-1">Product</h3>
                <div>{detail.product_name} × {detail.quantity}</div>
              </section>
              <section className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">Unit price</div>
                  <div className="font-medium">{fmt(detail.customer_price)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="font-bold text-primary">{fmt(detail.total_amount)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Reseller price</div>
                  <div>{fmt(detail.reseller_price)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Profit</div>
                  <div className="text-emerald-700 font-medium">{fmt(detail.profit_margin)}</div>
                </div>
              </section>
              {detail.tracking_id && (
                <section>
                  <h3 className="font-semibold mb-1">Tracking</h3>
                  <div className="font-mono text-xs">{detail.tracking_id}</div>
                </section>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
