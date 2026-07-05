import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payouts")({
  component: PayoutsPage,
});

type Method = "bkash" | "nagad" | "bank";
type Status = "pending" | "approved" | "paid" | "rejected";

type PayoutRow = {
  id: string;
  amount: number;
  method: Method;
  account_name: string;
  account_number: string;
  bank_name: string | null;
  status: Status;
  admin_note: string | null;
  reference: string | null;
  processed_at: string | null;
  created_at: string;
};

const STATUS_STYLE: Record<Status, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "outline",
  paid: "default",
  rejected: "destructive",
};

function fmt(n: number) {
  return `৳${Number(n ?? 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

function PayoutsPage() {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("bkash");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");

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

  const listQ = useQuery({
    queryKey: ["my-payouts"],
    queryFn: async (): Promise<PayoutRow[]> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              order: (c: string, o: { ascending: boolean }) => Promise<{ data: PayoutRow[] | null; error: { message: string } | null }>;
            };
          };
        };
      })
        .from("payout_requests")
        .select("id, amount, method, account_name, account_number, bank_name, status, admin_note, reference, processed_at, created_at")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Enter a valid amount");
      if (!accountName.trim() || !accountNumber.trim()) throw new Error("Account name and number are required");
      if (method === "bank" && !bankName.trim()) throw new Error("Bank name is required");

      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");

      const { error } = await (supabase as unknown as {
        from: (t: string) => { insert: (r: unknown) => Promise<{ error: { message: string } | null }> };
      }).from("payout_requests").insert({
        user_id: u.user.id,
        amount: amt,
        method,
        account_name: accountName.trim(),
        account_number: accountNumber.trim(),
        bank_name: method === "bank" ? bankName.trim() : null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Withdrawal request submitted");
      setAmount(""); setAccountName(""); setAccountNumber(""); setBankName("");
      qc.invalidateQueries({ queryKey: ["my-payouts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const balance = balanceQ.data ?? 0;
  const rows = listQ.data ?? [];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold">Payouts</h1>
        <p className="text-sm text-muted-foreground">
          Request a withdrawal from your wallet. Payouts are processed manually by the admin.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Current balance</div>
          <div className={`text-2xl font-bold ${balance < 0 ? "text-destructive" : "text-primary"}`}>{fmt(balance)}</div>
          <p className="text-[11px] text-muted-foreground mt-1">
            A negative balance means you owe the platform and cannot withdraw yet.
          </p>
        </Card>
      </div>

      <Card className="p-4 space-y-4">
        <h2 className="font-semibold">New withdrawal request</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Amount (৳)</Label>
            <Input
              type="number" min="1" step="1" value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5000"
            />
          </div>
          <div>
            <Label>Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bkash">bKash</SelectItem>
                <SelectItem value="nagad">Nagad</SelectItem>
                <SelectItem value="bank">Bank transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Account name</Label>
            <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} maxLength={100} />
          </div>
          <div>
            <Label>{method === "bank" ? "Account number" : "Mobile number"}</Label>
            <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} maxLength={40} />
          </div>
          {method === "bank" && (
            <div className="sm:col-span-2">
              <Label>Bank name & branch</Label>
              <Input value={bankName} onChange={(e) => setBankName(e.target.value)} maxLength={120} />
            </div>
          )}
        </div>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? "Submitting…" : "Submit request"}
        </Button>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requested</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Admin note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell className="font-medium">{fmt(r.amount)}</TableCell>
                <TableCell className="capitalize">{r.method}</TableCell>
                <TableCell className="text-xs">
                  <div>{r.account_name}</div>
                  <div className="text-muted-foreground">{r.account_number}{r.bank_name ? ` · ${r.bank_name}` : ""}</div>
                </TableCell>
                <TableCell><Badge variant={STATUS_STYLE[r.status]}>{r.status}</Badge></TableCell>
                <TableCell className="text-xs">{r.admin_note ?? "—"}</TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                {listQ.isLoading ? "Loading…" : "No withdrawal requests yet."}
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
