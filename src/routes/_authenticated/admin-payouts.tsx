import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/lib/eazystore-data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin-payouts")({
  component: AdminPayoutsPage,
});

type Status = "pending" | "approved" | "paid" | "rejected";
type Method = "bkash" | "nagad" | "bank";

type Row = {
  id: string;
  user_id: string;
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
  pending: "secondary", approved: "outline", paid: "default", rejected: "destructive",
};

function fmt(n: number) {
  return `৳${Number(n ?? 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

function AdminPayoutsPage() {
  const isAdmin = useIsSuperAdmin();
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status | "all">("pending");
  const [q, setQ] = useState("");

  const listQ = useQuery({
    enabled: !!isAdmin.data,
    queryKey: ["admin-payouts"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            order: (c: string, o: { ascending: boolean }) => Promise<{ data: Row[] | null; error: { message: string } | null }>;
          };
        };
      })
        .from("payout_requests")
        .select("id, user_id, amount, method, account_name, account_number, bank_name, status, admin_note, reference, processed_at, created_at")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Row> }) => {
      const { error } = await (supabase as unknown as {
        from: (t: string) => { update: (r: unknown) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> } };
      }).from("payout_requests").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const all = listQ.data ?? [];
  const rows = useMemo(() => all.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      return (r.account_name + " " + r.account_number + " " + (r.bank_name ?? "") + " " + r.user_id).toLowerCase().includes(s);
    }
    return true;
  }), [all, status, q]);

  const pending = all.filter((r) => r.status === "pending").length;
  const totalPaid = all.filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.amount), 0);
  const totalPending = all.filter((r) => r.status === "pending").reduce((s, r) => s + Number(r.amount), 0);

  if (isAdmin.isLoading) return <div className="p-6">Loading…</div>;
  if (!isAdmin.data) return <div className="p-6 text-muted-foreground">Super admin only.</div>;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Payout requests</h1>
        <p className="text-sm text-muted-foreground">Approve, reject, or mark payouts as paid.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Pending requests</div>
          <div className="text-2xl font-bold">{pending}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Pending amount</div>
          <div className="text-2xl font-bold text-destructive">{fmt(totalPending)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total paid out</div>
          <div className="text-2xl font-bold text-primary">{fmt(totalPaid)}</div>
        </Card>
      </div>

      <Card className="p-4 grid gap-3 sm:grid-cols-3">
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as Status | "all")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Search</Label>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Account name / number / user id" />
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requested</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method / Account</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? rows.map((r) => (
              <PayoutRow key={r.id} r={r} onUpdate={(patch) => update.mutate({ id: r.id, patch })} />
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {listQ.isLoading ? "Loading…" : "No requests match."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function PayoutRow({ r, onUpdate }: { r: Row; onUpdate: (patch: Partial<Row>) => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(r.admin_note ?? "");
  const [ref, setRef] = useState(r.reference ?? "");
  return (
    <TableRow>
      <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</TableCell>
      <TableCell className="font-mono text-[10px]">{r.user_id.slice(0, 8)}</TableCell>
      <TableCell className="font-medium">{fmt(r.amount)}</TableCell>
      <TableCell className="text-xs">
        <div className="capitalize font-medium">{r.method}</div>
        <div>{r.account_name} — {r.account_number}</div>
        {r.bank_name && <div className="text-muted-foreground">{r.bank_name}</div>}
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_STYLE[r.status]}>{r.status}</Badge>
        {r.processed_at && <div className="text-[10px] text-muted-foreground mt-1">{new Date(r.processed_at).toLocaleDateString()}</div>}
      </TableCell>
      <TableCell className="text-right">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">Manage</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Update payout {fmt(r.amount)}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="text-sm">
                <div><strong>{r.account_name}</strong> — {r.account_number}</div>
                <div className="capitalize text-muted-foreground">{r.method}{r.bank_name ? ` · ${r.bank_name}` : ""}</div>
              </div>
              <div>
                <Label>Payment reference (bKash TrxID / bank ref)</Label>
                <Input value={ref} onChange={(e) => setRef(e.target.value)} maxLength={120} />
              </div>
              <div>
                <Label>Admin note</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} />
              </div>
            </div>
            <DialogFooter className="flex-wrap gap-2">
              <Button variant="outline" onClick={() => { onUpdate({ status: "approved", admin_note: note, reference: ref }); setOpen(false); }}>
                Mark approved
              </Button>
              <Button variant="destructive" onClick={() => { onUpdate({ status: "rejected", admin_note: note }); setOpen(false); }}>
                Reject
              </Button>
              <Button onClick={() => { onUpdate({ status: "paid", admin_note: note, reference: ref }); setOpen(false); }}>
                Mark PAID (debit wallet)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  );
}
