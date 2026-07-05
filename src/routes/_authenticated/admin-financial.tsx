import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/lib/eazystore-data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin-financial")({
  component: AdminFinancialPage,
});

const PLATFORM_COMMISSION_PCT = 15; // matches migration

function fmt(n: number | null | undefined) {
  return `৳${Number(n ?? 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

type LedgerRow = {
  id: string;
  user_id: string;
  amount: number;
  entry_type: string;
  description: string | null;
  balance_after: number;
  related_order_id: string | null;
  created_at: string;
};

type OrderRow = {
  id: string;
  status: string;
  reseller_id: string;
  reseller_price: number | null;
  original_price: number | null;
  customer_price: number | null;
  quantity: number;
  tracking_id: string | null;
  updated_at: string;
  product_name: string | null;
};

function toCsv<T extends Record<string, unknown>>(rows: T[], headers: (keyof T)[]) {
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = headers.map((h) => escape(String(h))).join(",");
  const body = rows.map((r) => headers.map((h) => escape(r[h])).join(","));
  return [head, ...body].join("\n");
}

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function AdminFinancialPage() {
  const isAdmin = useIsSuperAdmin();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("all");

  const ledgerQ = useQuery({
    enabled: !!isAdmin.data,
    queryKey: ["admin-ledger"],
    queryFn: async (): Promise<LedgerRow[]> => {
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            order: (c: string, o: { ascending: boolean }) => {
              limit: (n: number) => Promise<{ data: LedgerRow[] | null; error: { message: string } | null }>;
            };
          };
        };
      })
        .from("wallet_ledger")
        .select("id, user_id, amount, entry_type, description, balance_after, related_order_id, created_at")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const ordersQ = useQuery({
    enabled: !!isAdmin.data,
    queryKey: ["admin-ledger-orders"],
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await supabase
        .from("reseller_orders")
        .select("id, status, reseller_id, reseller_price, original_price, customer_price, quantity, tracking_id, updated_at, product_name")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as OrderRow[];
    },
  });

  const all = ledgerQ.data ?? [];
  const types = useMemo(() => Array.from(new Set(all.map((e) => e.entry_type))).sort(), [all]);

  const rows = useMemo(() => {
    const fromT = from ? new Date(from).getTime() : null;
    const toT = to ? new Date(to).getTime() + 86_400_000 : null;
    return all.filter((e) => {
      const t = new Date(e.created_at).getTime();
      if (fromT !== null && t < fromT) return false;
      if (toT !== null && t > toT) return false;
      if (type !== "all" && e.entry_type !== type) return false;
      return true;
    });
  }, [all, from, to, type]);

  const orders = ordersQ.data ?? [];
  const totals = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "delivered");
    const inTransit = orders.filter((o) => ["shipped", "processing", "confirmed"].includes(o.status));
    const escrow = inTransit.reduce((s, o) => s + Number(o.customer_price ?? o.reseller_price ?? 0) * o.quantity, 0);
    const gross = delivered.reduce((s, o) => s + Number(o.customer_price ?? o.reseller_price ?? 0) * o.quantity, 0);
    const cost = delivered.reduce((s, o) => s + Number(o.original_price ?? 0) * o.quantity, 0);
    const commission = gross * (PLATFORM_COMMISSION_PCT / 100);
    const resellerProfit = gross - cost - commission;
    return { escrow, gross, cost, commission, resellerProfit, deliveredCount: delivered.length, escrowCount: inTransit.length };
  }, [orders]);

  if (isAdmin.isLoading) return <div className="p-6">Loading…</div>;
  if (!isAdmin.data) return <div className="p-6 text-muted-foreground">Super admin only.</div>;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Master Financial Overview</h1>
          <p className="text-sm text-muted-foreground">
            Escrow holds, settlement entries, and courier-delivered releases across all resellers.
            Commission: <strong>{PLATFORM_COMMISSION_PCT}%</strong> of sale price on Delivered.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => download(
            `financial-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
            toCsv(rows, ["created_at", "user_id", "entry_type", "description", "amount", "balance_after", "related_order_id"]),
          )}
          disabled={!rows.length}
        >
          <Download className="h-4 w-4 mr-2" /> Export ledger CSV
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Held in escrow</div>
          <div className="text-xl font-bold">{fmt(totals.escrow)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">{totals.escrowCount} orders in transit</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Delivered gross</div>
          <div className="text-xl font-bold text-primary">{fmt(totals.gross)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">{totals.deliveredCount} delivered</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Supplier cost</div>
          <div className="text-xl font-bold">{fmt(totals.cost)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Platform commission</div>
          <div className="text-xl font-bold text-primary">{fmt(totals.commission)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Reseller profit</div>
          <div className="text-xl font-bold">{fmt(totals.resellerProfit)}</div>
        </Card>
      </div>

      <Card className="p-4 grid gap-3 sm:grid-cols-3">
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Entry type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Balance after</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? rows.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()}
                </TableCell>
                <TableCell className="font-mono text-[10px]">{e.user_id.slice(0, 8)}</TableCell>
                <TableCell>
                  <Badge variant={e.amount < 0 ? "destructive" : "secondary"} className="text-[10px]">
                    {e.entry_type}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm max-w-[280px] truncate">{e.description ?? "—"}</TableCell>
                <TableCell className={`text-right font-medium ${e.amount < 0 ? "text-destructive" : "text-primary"}`}>
                  {e.amount > 0 ? "+" : ""}{fmt(e.amount)}
                </TableCell>
                <TableCell className="text-right text-sm">{fmt(e.balance_after)}</TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {ledgerQ.isLoading ? "Loading…" : "No ledger entries match these filters."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
