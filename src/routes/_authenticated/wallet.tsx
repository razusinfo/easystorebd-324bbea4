import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Download, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/wallet")({
  component: WalletPage,
});

function fmt(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return `৳${v.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

type Entry = {
  id: string;
  amount: number;
  entry_type: string;
  description: string | null;
  balance_after: number;
  related_order_id: string | null;
  created_at: string;
};

function toCsv(rows: Entry[]) {
  const header = ["When", "Type", "Description", "Amount", "Balance after", "Related order"];
  const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const body = rows.map((e) => [
    new Date(e.created_at).toISOString(),
    e.entry_type,
    e.description ?? "",
    String(e.amount),
    String(e.balance_after),
    e.related_order_id ?? "",
  ].map(escape).join(","));
  return [header.map(escape).join(","), ...body].join("\n");
}

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function WalletPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState<string>("all");
  const [direction, setDirection] = useState<"all" | "credit" | "debit">("all");

  const balanceQ = useQuery({
    queryKey: ["wallet-balance"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return 0;
      const { data } = await supabase
        .from("reseller_wallets").select("balance").eq("user_id", u.user.id).maybeSingle();
      return Number(data?.balance ?? 0);
    },
  });

  const ledgerQ = useQuery({
    queryKey: ["wallet-ledger"],
    queryFn: async (): Promise<Entry[]> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              order: (c: string, o: { ascending: boolean }) => {
                limit: (n: number) => Promise<{ data: Entry[] | null; error: { message: string } | null }>;
              };
            };
          };
        };
      })
        .from("wallet_ledger")
        .select("id, amount, entry_type, description, balance_after, related_order_id, created_at")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const all = ledgerQ.data ?? [];
  const types = useMemo(
    () => Array.from(new Set(all.map((e) => e.entry_type))).sort(),
    [all],
  );

  const entries = useMemo(() => {
    const fromT = from ? new Date(from).getTime() : null;
    const toT = to ? new Date(to).getTime() + 86_400_000 : null;
    return all.filter((e) => {
      const t = new Date(e.created_at).getTime();
      if (fromT !== null && t < fromT) return false;
      if (toT !== null && t > toT) return false;
      if (type !== "all" && e.entry_type !== type) return false;
      if (direction === "credit" && e.amount <= 0) return false;
      if (direction === "debit" && e.amount >= 0) return false;
      return true;
    });
  }, [all, from, to, type, direction]);

  const balance = balanceQ.data ?? 0;
  const credits = entries.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const debits = entries.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Wallet</h1>
          <p className="text-sm text-muted-foreground">
            Every credit and debit on your account. Balance reflects outstanding platform charges.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => download(`wallet-ledger-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(entries))}
          disabled={!entries.length}
        >
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Current balance</div>
          <div className={`mt-1 text-2xl font-bold ${balance < 0 ? "text-destructive" : "text-primary"}`}>
            {fmt(balance)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total credits (filtered)</div>
          <div className="mt-1 text-2xl font-bold text-primary">{fmt(credits)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total debits (filtered)</div>
          <div className="mt-1 text-2xl font-bold text-destructive">{fmt(debits)}</div>
        </Card>
      </div>

      <Card className="p-4 grid gap-3 sm:grid-cols-4">
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
        <div>
          <Label className="text-xs">Direction</Label>
          <Select value={direction} onValueChange={(v) => setDirection(v as "all" | "credit" | "debit")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="credit">Credits only</SelectItem>
              <SelectItem value="debit">Debits only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Balance after</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length ? entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant={e.amount < 0 ? "destructive" : "secondary"} className="text-[10px]">
                    {e.entry_type}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{e.description ?? "—"}</TableCell>
                <TableCell className={`text-right font-medium ${e.amount < 0 ? "text-destructive" : "text-primary"}`}>
                  {e.amount > 0 ? "+" : ""}{fmt(e.amount)}
                </TableCell>
                <TableCell className="text-right text-sm">{fmt(e.balance_after)}</TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  {ledgerQ.isLoading ? "Loading…" : "No wallet activity matches these filters."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
