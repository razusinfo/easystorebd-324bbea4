import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Wallet, Bell, BellOff, PackageCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-orders")({
  component: MyOrdersPage,
});

const STATUS_COLORS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  confirmed: "secondary",
  shipped: "secondary",
  delivered: "default",
  cancelled: "destructive",
};

const ALERTS_KEY = "supplier.orders.alerts";

function fmt(n: number | null | undefined) {
  if (n == null) return "৳0";
  return `৳${Number(n).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

function playBeep() {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    setTimeout(() => ctx.close(), 500);
  } catch {}
}

function MyOrdersPage() {
  const qc = useQueryClient();
  const [alerts, setAlerts] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(ALERTS_KEY) !== "0";
  });
  const [uid, setUid] = useState<string | null>(null);
  const [newSince, setNewSince] = useState<number>(0);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    localStorage.setItem(ALERTS_KEY, alerts ? "1" : "0");
    if (alerts && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [alerts]);

  const wallet = useQuery({
    queryKey: ["reseller-wallet"],
    queryFn: async () => {
      const { data } = await supabase.from("reseller_wallets").select("balance").maybeSingle();
      return data?.balance ?? 0;
    },
  });

  const orders = useQuery({
    queryKey: ["my-reseller-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reseller_orders")
        .select("id, product_name, customer_name, customer_phone, shipping_address, quantity, reseller_price, status, source, source_order_id, tracking_id, tracking_url, created_at, reseller_product_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Seed "seen" set once we have data — everything on first load is not "new".
  useEffect(() => {
    if (!orders.data) return;
    if (seenIds.current.size === 0) {
      for (const o of orders.data) seenIds.current.add(o.id);
    }
  }, [orders.data]);

  // Realtime: new reseller_orders rows for THIS user.
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`my-orders-${uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reseller_orders", filter: `reseller_id=eq.${uid}` },
        (payload) => {
          const row = payload.new as any;
          if (!row?.id || seenIds.current.has(row.id)) return;
          seenIds.current.add(row.id);
          setNewSince((n) => n + 1);
          qc.invalidateQueries({ queryKey: ["my-reseller-orders"] });
          if (alerts) {
            const title = `নতুন অর্ডার — ${row.product_name ?? ""}`;
            const body = `${row.customer_name ?? ""} · ${row.quantity ?? 1}× · ${row.shipping_address ?? ""}`.slice(0, 160);
            toast.success(title, { description: body });
            playBeep();
            try {
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification(title, { body, tag: `ro-${row.id}` });
              }
            } catch {}
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, alerts, qc]);

  const balance = Number(wallet.data ?? 0);
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            My Orders
            {newSince > 0 && (
              <Badge variant="destructive" className="animate-pulse" data-testid="new-orders-badge">
                {newSince} new
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            Orders forwarded to you as a supplier — plus your own reseller API orders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={alerts ? "default" : "outline"}
            size="sm"
            onClick={() => setAlerts((v) => !v)}
            aria-pressed={alerts}
            data-testid="alerts-toggle"
          >
            {alerts ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            <span className="ml-1 hidden sm:inline">{alerts ? "Alerts on" : "Alerts off"}</span>
          </Button>
          {newSince > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setNewSince(0)}>
              <PackageCheck className="h-4 w-4 mr-1" /> Mark seen
            </Button>
          )}
          <Card className="flex items-center gap-3 px-4 py-3">
            <Wallet className="h-5 w-5 text-primary" />
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Wallet</p>
              <p className={`text-lg font-bold ${balance < 0 ? "text-destructive" : "text-primary"}`}>
                {fmt(balance)}
              </p>
            </div>
          </Card>
        </div>
      </header>

      <span className="sr-only" role="status" aria-live="polite" data-testid="new-orders-status">
        {newSince > 0 ? `${newSince} new order${newSince > 1 ? "s" : ""}` : ""}
      </span>

      {orders.data?.some((o) => o.source === "storefront" || o.source === "storefront_unlinked" || !!o.source_order_id) && (
        <Card className="border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <strong>Forwarded orders are managed by the Super Admin.</strong> Status and tracking
          updates are synced automatically — you'll also receive email/SMS when they change.
        </Card>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Ship to</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Placed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.data?.length ? (
              orders.data.map((o) => {
                const forwarded = o.source === "storefront" || o.source === "storefront_unlinked" || !!o.source_order_id;
                const unlinked = o.source === "storefront_unlinked" || (!o.reseller_product_id && forwarded);
                return (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">
                    {o.product_name}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {forwarded && (
                        <Badge variant="secondary" className="text-[10px]">Forwarded</Badge>
                      )}
                      {unlinked && (
                        <Badge variant="outline" className="text-[10px]">Unlinked · routing rule</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{o.customer_name}</div>
                    {o.customer_phone && <div className="text-xs text-muted-foreground">{o.customer_phone}</div>}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{o.shipping_address}</TableCell>
                  <TableCell className="text-right">{o.quantity}</TableCell>
                  <TableCell className="text-right">{fmt(Number(o.reseller_price) * o.quantity)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_COLORS[o.status] ?? "outline"}>{o.status}</Badge>
                    {o.tracking_id && (
                      <div className="mt-1 text-xs">
                        <span className="text-muted-foreground">Tracking: </span>
                        {o.tracking_url ? (
                          <a href={o.tracking_url} target="_blank" rel="noreferrer" className="text-primary underline">
                            {o.tracking_id}
                          </a>
                        ) : (
                          <span className="font-medium">{o.tracking_id}</span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  {orders.isLoading ? "Loading…" : "No orders yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
