import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellOff, History } from "lucide-react";
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
  settled_at: string | null;
  delivered_at: string | null;
  courier_provider: string | null;
  courier_status: string | null;
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
        .select("id, reseller_id, reseller_product_id, product_name, customer_name, customer_phone, customer_email, shipping_address, quantity, original_price, reseller_price, profit_margin, status, shipping_requested, notes, source, source_order_id, source_store_id, tracking_id, tracking_url, created_at, settled_at, delivered_at, courier_provider, courier_status")
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
    mutationFn: async (v: { id: string; status?: Status; tracking_id?: string | null; tracking_url?: string | null }) => {
      await updateStatus({ data: v });
    },
    onSuccess: () => {
      toast.success("Saved & customer notified");
      qc.invalidateQueries({ queryKey: ["admin-reseller-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [fReseller, setFReseller] = useState("");
  const [fProduct, setFProduct] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fStatus, setFStatus] = useState<"all" | Status>("all");
  const [fTracking, setFTracking] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  // Live supplier alerts: play a beep + browser notification + toast whenever
  // a customer order forwards a new reseller_orders row from any storefront.
  const [alertsOn, setAlertsOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("admin-reseller-orders:alerts") !== "off";
  });
  const audioCtxRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    localStorage.setItem("admin-reseller-orders:alerts", alertsOn ? "on" : "off");
  }, [alertsOn]);
  useEffect(() => {
    if (!alertsOn) return;
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [alertsOn]);
  useEffect(() => {
    const ch = supabase
      .channel("reseller-orders-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reseller_orders" },
        (payload) => {
          const row = payload.new as { id: string; product_name: string; customer_name: string; quantity: number };
          qc.invalidateQueries({ queryKey: ["admin-reseller-orders"] });
          if (!alertsOn) return;
          toast.success(`New order: ${row.product_name} × ${row.quantity} (${row.customer_name})`);
          // Short beep via WebAudio — works without any bundled asset.
          try {
            const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
            audioCtxRef.current ??= new AC();
            const ctx = audioCtxRef.current!;
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "sine";
            o.frequency.value = 880;
            g.gain.value = 0.15;
            o.connect(g).connect(ctx.destination);
            o.start();
            o.stop(ctx.currentTime + 0.22);
          } catch { /* audio blocked */ }
          try {
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("New reseller order", {
                body: `${row.product_name} × ${row.quantity} — ${row.customer_name}`,
                tag: `reseller-order-${row.id}`,
                icon: "/favicon.ico",
              });
            }
          } catch { /* no-op */ }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [alertsOn, qc]);


  const filtered = useMemo(() => {
    const rows = q.data ?? [];
    const rq = fReseller.trim().toLowerCase();
    const pq = fProduct.trim().toLowerCase();
    const phq = fPhone.trim().toLowerCase();
    const tq = fTracking.trim().toLowerCase();
    const from = fFrom ? new Date(fFrom).getTime() : null;
    const to = fTo ? new Date(fTo).getTime() + 86_400_000 : null;
    return rows.filter((r) => {
      if (rq) {
        const hay = `${r.reseller?.full_name ?? ""} ${r.reseller?.email ?? ""} ${r.store_name ?? ""}`.toLowerCase();
        if (!hay.includes(rq)) return false;
      }
      if (pq && !r.product_name.toLowerCase().includes(pq)) return false;
      if (phq && !(r.customer_phone ?? "").toLowerCase().includes(phq)) return false;
      if (fStatus !== "all" && r.status !== fStatus) return false;
      if (tq && !(r.tracking_id ?? "").toLowerCase().includes(tq)) return false;
      const t = new Date(r.created_at).getTime();
      if (from != null && t < from) return false;
      if (to != null && t >= to) return false;
      return true;
    });
  }, [q.data, fReseller, fProduct, fPhone, fStatus, fTracking, fFrom, fTo]);


  const totalProfit = filtered.reduce((s, r) => s + Number(r.profit_margin || 0), 0);
  const pendingShip = filtered.filter((r) => r.shipping_requested && r.status !== "delivered" && r.status !== "cancelled").length;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reseller Orders</h1>
          <p className="text-sm text-muted-foreground">All orders placed by resellers via the API.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={alertsOn ? "default" : "outline"}
            size="sm"
            onClick={() => setAlertsOn((v) => !v)}
            title={alertsOn ? "Live alerts on" : "Live alerts off"}
          >
            {alertsOn ? <Bell className="h-4 w-4 mr-1" /> : <BellOff className="h-4 w-4 mr-1" />}
            {alertsOn ? "Alerts on" : "Alerts off"}
          </Button>
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

      <Card className="p-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <div>
          <Label className="text-xs">Sold By (reseller / store)</Label>
          <Input value={fReseller} onChange={(e) => setFReseller(e.target.value)} placeholder="name, email or store" />
        </div>
        <div>
          <Label className="text-xs">Source Product</Label>
          <Input value={fProduct} onChange={(e) => setFProduct(e.target.value)} placeholder="product name" />
        </div>
        <div>
          <Label className="text-xs">Customer phone</Label>
          <Input value={fPhone} onChange={(e) => setFPhone(e.target.value)} placeholder="e.g. 017…" />
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={fStatus} onValueChange={(v) => setFStatus(v as "all" | Status)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Tracking ID</Label>
          <Input value={fTracking} onChange={(e) => setFTracking(e.target.value)} placeholder="tracking #" />
        </div>
        <div>
          <Label className="text-xs">Forwarded from</Label>
          <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Forwarded to</Label>
          <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
        </div>
        <div className="flex items-end xl:col-span-7">
          <Button variant="outline" size="sm" onClick={() => { setFReseller(""); setFProduct(""); setFPhone(""); setFStatus("all"); setFTracking(""); setFFrom(""); setFTo(""); }}>
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
                  <TrackingEditor
                    row={r}
                    onSave={(tracking_id, tracking_url) => upd.mutate({ id: r.id, tracking_id, tracking_url })}
                  />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                  <div className="mt-1"><TimelineToggle orderId={r.id} row={r} /></div>
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

function TrackingEditor({
  row,
  onSave,
}: {
  row: { tracking_id: string | null; tracking_url: string | null };
  onSave: (tracking_id: string | null, tracking_url: string | null) => void;
}) {
  const [tid, setTid] = useState(row.tracking_id ?? "");
  const [turl, setTurl] = useState(row.tracking_url ?? "");
  const dirty = (tid || "") !== (row.tracking_id ?? "") || (turl || "") !== (row.tracking_url ?? "");
  return (
    <div className="mt-2 flex flex-col gap-1">
      <Input
        value={tid}
        onChange={(e) => setTid(e.target.value)}
        placeholder="Tracking ID"
        className="h-7 text-xs"
      />
      <Input
        value={turl}
        onChange={(e) => setTurl(e.target.value)}
        placeholder="Tracking URL (optional)"
        className="h-7 text-xs"
      />
      {dirty && (
        <Button
          size="sm"
          variant="secondary"
          className="h-6 self-start px-2 text-[11px]"
          onClick={() => onSave(tid.trim() || null, turl.trim() || null)}
        >
          Save tracking
        </Button>
      )}
    </div>
  );
}

type OrderEvent = {
  id: string;
  event_type: string;
  old_status: string | null;
  new_status: string | null;
  tracking_id: string | null;
  tracking_url: string | null;
  created_at: string;
};

function TimelineToggle({ orderId, row }: { orderId: string; row: Row }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["reseller-order-events", orderId],
    enabled: open,
    queryFn: async (): Promise<OrderEvent[]> => {
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              order: (c: string, o: { ascending: boolean }) => Promise<{ data: OrderEvent[] | null; error: { message: string } | null }>;
            };
          };
        };
      })
        .from("reseller_order_events")
        .select("id, event_type, old_status, new_status, tracking_id, tracking_url, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  // Financial breakdown — Platform = 15% × sale; Supplier = cost; Reseller = sale − cost − platform.
  const sale = Number(row.reseller_price ?? 0) * row.quantity;
  const cost = Number(row.original_price ?? 0) * row.quantity;
  const platform = +(sale * 0.15).toFixed(2);
  const supplier = cost;
  const reseller = +(sale - cost - platform).toFixed(2);

  return (
    <div>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
        onClick={() => setOpen((v) => !v)}
      >
        <History className="h-3 w-3" />
        {open ? "Hide timeline" : "View timeline"}
      </button>
      {open && (
        <div className="mt-1 space-y-2 rounded border bg-muted/30 p-2 text-[11px]">
          <div className="space-y-1 rounded bg-background/60 p-2">
            <div className="font-semibold uppercase tracking-wide text-foreground">Settlement</div>
            <TimelineStep label="Escrow hold" amount={sale} at={row.created_at} done />
            <TimelineStep label={`Courier delivered${row.courier_provider ? ` (${row.courier_provider})` : ""}`} at={row.delivered_at} done={!!row.delivered_at} />
            <TimelineStep label={`Platform commission (15%)`} amount={platform} at={row.settled_at} done={!!row.settled_at} />
            <TimelineStep label="Supplier credit" amount={supplier} at={row.settled_at} done={!!row.settled_at} />
            <TimelineStep label="Reseller profit credit" amount={reseller} at={row.settled_at} done={!!row.settled_at} />
          </div>
          <div className="space-y-1">
            <div className="font-semibold uppercase tracking-wide text-foreground">Status history</div>
            {q.isLoading && <div>Loading…</div>}
            {q.data?.length === 0 && <div className="text-muted-foreground">No changes yet.</div>}
            {q.data?.map((e) => (
              <div key={e.id} className="border-l-2 border-primary/40 pl-2">
                <div className="font-medium text-foreground">
                  {e.event_type === "status_change" && `Status: ${e.old_status ?? "—"} → ${e.new_status}`}
                  {e.event_type === "tracking_update" && `Tracking updated`}
                  {e.event_type === "status_and_tracking" && `Status: ${e.old_status ?? "—"} → ${e.new_status} + tracking`}
                </div>
                {e.tracking_id && (
                  <div className="text-muted-foreground">
                    {e.tracking_id}
                    {e.tracking_url ? ` · ${e.tracking_url}` : ""}
                  </div>
                )}
                <div className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineStep({ label, amount, at, done }: { label: string; amount?: number; at: string | null; done: boolean }) {
  return (
    <div className="flex items-start gap-2 border-l-2 pl-2" style={{ borderColor: done ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.3)" }}>
      <span className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${done ? "bg-primary" : "bg-muted-foreground/30"}`} />
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
          {amount != null && <span className="tabular-nums font-medium">{fmt(amount)}</span>}
        </div>
        <div className="text-muted-foreground">{at ? new Date(at).toLocaleString() : "pending"}</div>
      </div>
    </div>
  );
}
