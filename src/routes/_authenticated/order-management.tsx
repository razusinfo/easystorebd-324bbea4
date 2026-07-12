import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  ChevronLeft, ChevronRight, Eye, ShoppingBag, Phone, Mail, User,
  Download, Printer, History, RefreshCw,
} from "lucide-react";
import { listManagedOrders, type ManagedOrderRow } from "@/lib/order-management.functions";
import {
  updateManagedOrderStatus,
  bulkUpdateManagedOrders,
  getOrderTimeline,
} from "@/lib/order-management-actions.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  from: fallback(z.string(), "").default(""),
  to: fallback(z.string(), "").default(""),
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

const PAGE_SIZE = 20;
const STATUS_OPTIONS_SUPPLIER = ["confirmed", "shipped", "delivered"] as const;

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows: ManagedOrderRow[]) {
  const headers = [
    "Order ID", "Date", "Status", "Customer", "Phone", "Email",
    "Address", "Reseller", "Store", "Product", "Qty",
    "Customer Price", "Total", "Tracking", "Tracking URL", "Notes",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      r.order_id_short, new Date(r.created_at).toISOString(), r.status,
      r.customer_name, r.customer_phone ?? "", r.customer_email ?? "",
      r.shipping_address, r.reseller_name, r.reseller_store ?? "",
      r.product_name, r.quantity, r.customer_price, r.total_amount,
      r.tracking_id ?? "", r.tracking_url ?? "", r.notes ?? "",
    ].map(csvEscape).join(","));
  }
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function printInvoice(r: ManagedOrderRow) {
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) { toast.error("Popup blocked — allow popups to print"); return; }
  const html = `<!doctype html><html><head><title>Invoice #${r.order_id_short}</title>
<style>
body{font-family:system-ui,sans-serif;padding:28px;color:#111}
h1{margin:0 0 4px;font-size:22px}
.muted{color:#666;font-size:12px}
.row{display:flex;gap:24px;margin:16px 0}
.box{flex:1;border:1px solid #ddd;border-radius:8px;padding:12px}
h3{margin:0 0 8px;font-size:13px;text-transform:uppercase;color:#666}
table{width:100%;border-collapse:collapse;margin-top:12px}
th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px}
th{background:#f8f8f8}
.tot{text-align:right;font-size:16px;font-weight:700;margin-top:12px}
.badge{display:inline-block;padding:2px 8px;border:1px solid #ccc;border-radius:99px;font-size:11px;text-transform:capitalize}
@media print { .noprint{display:none} }
</style></head><body>
<button class="noprint" onclick="window.print()" style="float:right">Print</button>
<h1>EasyStore Invoice</h1>
<div class="muted">Order #${r.order_id_short} · ${new Date(r.created_at).toLocaleString("en-BD")}</div>
<div class="row">
  <div class="box"><h3>Customer</h3>
    <div><strong>${r.customer_name}</strong></div>
    <div>${r.customer_phone ?? ""}</div>
    <div>${r.customer_email ?? ""}</div>
    <div style="white-space:pre-wrap;margin-top:6px">${r.shipping_address}</div>
  </div>
  <div class="box"><h3>Fulfillment</h3>
    <div>Status: <span class="badge">${r.status}</span></div>
    <div>Reseller: ${r.reseller_name}</div>
    ${r.reseller_store ? `<div>Store: ${r.reseller_store}</div>` : ""}
    ${r.tracking_id ? `<div>Tracking: ${r.tracking_id}</div>` : ""}
    ${r.tracking_url ? `<div>URL: ${r.tracking_url}</div>` : ""}
  </div>
</div>
<table><thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
<tbody><tr><td>${r.product_name}</td><td>${r.quantity}</td>
<td>৳${r.customer_price.toLocaleString()}</td>
<td>৳${r.total_amount.toLocaleString()}</td></tr></tbody></table>
<div class="tot">Grand total: ৳${r.total_amount.toLocaleString()}</div>
${r.notes ? `<div style="margin-top:14px" class="box"><h3>Notes</h3><div style="white-space:pre-wrap">${r.notes}</div></div>` : ""}
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body></html>`;
  w.document.write(html);
  w.document.close();
}

function OrderManagementPage() {
  const qc = useQueryClient();
  const listOrders = useServerFn(listManagedOrders);
  const updateStatusFn = useServerFn(updateManagedOrderStatus);
  const bulkFn = useServerFn(bulkUpdateManagedOrders);
  const timelineFn = useServerFn(getOrderTimeline);
  const navigate = Route.useNavigate();
  const { q: qParam, status: fStatus, supplier: fSupplier, reseller: fReseller, from: fFrom, to: fTo, page } = Route.useSearch();

  const query = useQuery({
    queryKey: ["order-management"],
    queryFn: () => listOrders(),
  });

  const [detail, setDetail] = useState<ManagedOrderRow | null>(null);
  const [draftStatus, setDraftStatus] = useState<string>("");
  const [draftTracking, setDraftTracking] = useState<string>("");
  const [draftTrackUrl, setDraftTrackUrl] = useState<string>("");
  const [draftNotes, setDraftNotes] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("");

  const role = query.data?.role;
  const rows = query.data?.rows ?? [];

  // Realtime auto-refresh: refetch list on any reseller_orders change.
  useEffect(() => {
    const ch = supabase
      .channel("order-management-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "reseller_orders" }, () => {
        qc.invalidateQueries({ queryKey: ["order-management"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const setSearch = (patch: Partial<{ q: string; status: string; supplier: string; reseller: string; from: string; to: string; page: number }>) => {
    navigate({ search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, ...patch, page: patch.page ?? 1 }) });
  };

  const filtered = useMemo(() => {
    const s = qParam.trim().toLowerCase();
    const fromMs = fFrom ? new Date(fFrom + "T00:00:00").getTime() : null;
    const toMs = fTo ? new Date(fTo + "T23:59:59").getTime() : null;
    return rows.filter((r) => {
      if (fStatus !== "all" && r.status !== fStatus) return false;
      if (role === "super_admin" && fSupplier !== "all" && r.source !== fSupplier) return false;
      if (role === "super_admin" && fReseller !== "all" && r.reseller_id !== fReseller) return false;
      const t = new Date(r.created_at).getTime();
      if (fromMs && t < fromMs) return false;
      if (toMs && t > toMs) return false;
      if (!s) return true;
      const hay =
        `${r.order_id_short} ${r.id} ${r.customer_name} ${r.customer_phone ?? ""} ${r.product_name}`.toLowerCase();
      return hay.includes(s);
    });
  }, [rows, qParam, fStatus, fSupplier, fReseller, fFrom, fTo, role]);

  const totals = useMemo(() => {
    const revenue = filtered.reduce((s, r) => s + r.total_amount, 0);
    const pending = filtered.filter((r) => r.status === "pending").length;
    return { revenue, pending, count: filtered.length };
  }, [filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const openDetail = (r: ManagedOrderRow) => {
    setDetail(r);
    setDraftStatus(r.status);
    setDraftTracking(r.tracking_id ?? "");
    setDraftTrackUrl(r.tracking_url ?? "");
    setDraftNotes(r.notes ?? "");
  };

  const upd = useMutation({
    mutationFn: async (payload: { id: string; status?: string; tracking_id?: string | null; tracking_url?: string | null; notes?: string | null }) => {
      const clean: Record<string, unknown> = { id: payload.id };
      if (payload.status !== undefined) clean.status = payload.status;
      if (payload.tracking_id !== undefined) clean.tracking_id = payload.tracking_id;
      if (payload.tracking_url !== undefined) clean.tracking_url = payload.tracking_url;
      if (payload.notes !== undefined) clean.notes = payload.notes;
      return updateStatusFn({ data: clean });
    },
    onSuccess: () => {
      toast.success("Order updated — reseller notified");
      qc.invalidateQueries({ queryKey: ["order-management"] });
      setDetail(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulk = useMutation({
    mutationFn: async (payload: { ids: string[]; status: string }) =>
      bulkFn({ data: { ids: payload.ids, status: payload.status as (typeof STATUSES)[number] } }),
    onSuccess: (res) => {
      toast.success(`Updated ${res.updated} order${res.updated === 1 ? "" : "s"}`);
      setSelected(new Set());
      setBulkStatus("");
      qc.invalidateQueries({ queryKey: ["order-management"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const timelineQ = useQuery({
    queryKey: ["order-timeline", detail?.id],
    queryFn: () => timelineFn({ data: { id: detail!.id } }),
    enabled: !!detail,
  });

  const allowedStatuses = role === "super_admin" ? STATUSES : STATUS_OPTIONS_SUPPLIER;

  const toggleOne = (id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  };
  const toggleAllOnPage = (on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of pageRows) { if (on) next.add(r.id); else next.delete(r.id); }
      return next;
    });
  };
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

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
        <div className="flex flex-wrap gap-2 items-center">
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
          <Button size="sm" variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["order-management"] })}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadCsv(filtered)} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </div>
      </header>

      <Card className="p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Label className="text-xs">Search (Order ID / Customer)</Label>
            <Input
              value={qParam}
              onChange={(e) => setSearch({ q: e.target.value })}
              placeholder="#A1B2C3D4, phone, or customer name…"
            />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={fStatus} onValueChange={(v) => setSearch({ status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={fFrom} onChange={(e) => setSearch({ from: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={fTo} onChange={(e) => setSearch({ to: e.target.value })} />
          </div>
          {role === "super_admin" && (
            <>
              <div>
                <Label className="text-xs">Supplier</Label>
                <Select value={fSupplier} onValueChange={(v) => setSearch({ supplier: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All suppliers</SelectItem>
                    {(query.data?.suppliers ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Reseller</Label>
                <Select value={fReseller} onValueChange={(v) => setSearch({ reseller: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All resellers</SelectItem>
                    {(query.data?.resellers ?? []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name || "—"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      </Card>

      {selected.size > 0 && (
        <Card className="p-3 flex flex-wrap items-center gap-3 border-primary/40 bg-primary/5">
          <div className="text-sm font-medium">{selected.size} selected</div>
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Set status…" /></SelectTrigger>
            <SelectContent>
              {allowedStatuses.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!bulkStatus || bulk.isPending}
            onClick={() => bulk.mutate({ ids: Array.from(selected), status: bulkStatus })}
          >
            {bulk.isPending ? "Applying…" : "Apply to selected"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox
                    checked={allOnPageSelected}
                    onCheckedChange={(v) => toggleAllOnPage(!!v)}
                    aria-label="Select all on page"
                  />
                </TableHead>
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
              {query.isLoading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                    Loading orders…
                  </TableCell>
                </TableRow>
              )}
              {!query.isLoading && pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                    No orders found.
                  </TableCell>
                </TableRow>
              )}
              {pageRows.map((r) => (
                <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(r.id)}
                      onCheckedChange={(v) => toggleOne(r.id, !!v)}
                      aria-label={`Select order ${r.order_id_short}`}
                    />
                  </TableCell>
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
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => printInvoice(r)} title="Print invoice">
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openDetail(r)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between p-3 border-t text-sm">
          <div className="text-muted-foreground">
            Page {safePage} of {pageCount} · {filtered.length} order{filtered.length === 1 ? "" : "s"}
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setSearch({ page: safePage - 1 })}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button size="sm" variant="outline" disabled={safePage >= pageCount} onClick={() => setSearch({ page: safePage + 1 })}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order #{detail?.order_id_short}</DialogTitle>
            <DialogDescription>
              Placed {detail ? new Date(detail.created_at).toLocaleString("en-BD") : ""}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`capitalize ${statusClasses(detail.status)}`}>
                  {detail.status}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => printInvoice(detail)}>
                  <Printer className="h-3.5 w-3.5 mr-1" /> Print invoice
                </Button>
              </div>
              <section>
                <h3 className="font-semibold mb-1">Customer</h3>
                <div>{detail.customer_name}</div>
                <div className="text-muted-foreground">{detail.customer_phone ?? "—"}</div>
                <div className="text-muted-foreground">{detail.customer_email ?? "—"}</div>
                <div className="text-muted-foreground whitespace-pre-wrap">{detail.shipping_address}</div>
              </section>
              <section className="border rounded-md p-3 space-y-3 bg-muted/30">
                <h3 className="font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" /> Reseller Info & Fulfillment
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Name</div>
                    <div className="font-medium">
                      {detail.storefront_owner_name || detail.reseller_name || "—"}
                    </div>
                    {detail.reseller_store && (
                      <div className="text-xs text-muted-foreground">{detail.reseller_store}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Phone
                    </div>
                    {detail.storefront_owner_phone ? (
                      <a href={`tel:${detail.storefront_owner_phone}`} className="text-primary underline font-medium">
                        {detail.storefront_owner_phone}
                      </a>
                    ) : <div className="text-muted-foreground">—</div>}
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" /> Email
                    </div>
                    {detail.storefront_owner_email ? (
                      <a href={`mailto:${detail.storefront_owner_email}`} className="text-primary underline font-medium break-all">
                        {detail.storefront_owner_email}
                      </a>
                    ) : <div className="text-muted-foreground">—</div>}
                  </div>
                </div>

                <div className="border-t pt-3 space-y-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Update {role === "supplier" ? "(fulfillment only)" : ""}
                  </div>
                  <div>
                    <Label className="text-xs">Order status</Label>
                    <Select value={draftStatus} onValueChange={setDraftStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {allowedStatuses.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Courier tracking number</Label>
                    <Input value={draftTracking} onChange={(e) => setDraftTracking(e.target.value)} placeholder="e.g. Pathao-12345" />
                  </div>
                  <div>
                    <Label className="text-xs">Tracking URL (optional)</Label>
                    <Input value={draftTrackUrl} onChange={(e) => setDraftTrackUrl(e.target.value)} placeholder="https://…" />
                  </div>
                  <div>
                    <Label className="text-xs">Notes for reseller</Label>
                    <Textarea value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)} rows={3} maxLength={2000}
                      placeholder="Address issue, stock delay, courier note…" />
                    <div className="text-[10px] text-muted-foreground mt-1">
                      Saved notes and tracking are visible to the reseller instantly.
                    </div>
                  </div>
                </div>
              </section>

              <section className="border rounded-md p-3 space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <History className="h-4 w-4" /> Timeline
                </h3>
                {timelineQ.isLoading && <div className="text-xs text-muted-foreground">Loading history…</div>}
                {!timelineQ.isLoading && (timelineQ.data?.entries.length ?? 0) === 0 && (
                  <div className="text-xs text-muted-foreground">No changes recorded yet.</div>
                )}
                <ol className="space-y-2">
                  {(timelineQ.data?.entries ?? []).map((e) => (
                    <li key={e.id} className="border-l-2 border-primary/40 pl-3">
                      <div className="text-xs text-muted-foreground">
                        {new Date(e.at).toLocaleString("en-BD")} · {e.actor_name || "System"}
                      </div>
                      <div className="text-xs">
                        {e.before_status !== e.after_status && e.after_status && (
                          <div>Status: <span className="line-through text-muted-foreground">{e.before_status ?? "—"}</span> → <span className="font-medium capitalize">{e.after_status}</span></div>
                        )}
                        {e.after_tracking && e.after_tracking !== e.before_tracking && (
                          <div>Tracking → <span className="font-mono">{e.after_tracking}</span></div>
                        )}
                        {e.after_notes && e.after_notes !== e.before_notes && (
                          <div className="text-muted-foreground">Note: {e.after_notes}</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
            <Button
              disabled={!detail || upd.isPending}
              onClick={() => detail && upd.mutate({
                id: detail.id,
                status: draftStatus !== detail.status ? draftStatus : undefined,
                tracking_id: draftTracking !== (detail.tracking_id ?? "") ? draftTracking : undefined,
                tracking_url: draftTrackUrl !== (detail.tracking_url ?? "") ? draftTrackUrl : undefined,
                notes: draftNotes !== (detail.notes ?? "") ? draftNotes : undefined,
              })}
            >
              {upd.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
