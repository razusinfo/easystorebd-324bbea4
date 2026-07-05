import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

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

function WalletPage() {
  const balanceQ = useQuery({
    queryKey: ["wallet-balance"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return 0;
      const { data } = await supabase
        .from("reseller_wallets")
        .select("balance")
        .eq("user_id", u.user.id)
        .maybeSingle();
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
        .limit(200);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const entries = ledgerQ.data ?? [];
  const balance = balanceQ.data ?? 0;
  const credits = entries.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const debits = entries.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Wallet</h1>
        <p className="text-sm text-muted-foreground">
          Every credit and debit on your account. Balance reflects outstanding platform charges.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Current balance</div>
          <div className={`mt-1 text-2xl font-bold ${balance < 0 ? "text-destructive" : "text-primary"}`}>
            {fmt(balance)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total credits (last 200)</div>
          <div className="mt-1 text-2xl font-bold text-primary">{fmt(credits)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total debits (last 200)</div>
          <div className="mt-1 text-2xl font-bold text-destructive">{fmt(debits)}</div>
        </Card>
      </div>

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
                  {ledgerQ.isLoading ? "Loading…" : "No wallet activity yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
