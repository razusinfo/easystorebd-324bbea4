import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { updateResellerOrderStatus } from "@/lib/reseller-orders.functions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
  created_at: string;
  reseller?: { full_name: string | null; email: string } | null;
};

function AdminResellerOrdersPage() {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["admin-reseller-orders"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("reseller_orders")
        .select("id, reseller_id, product_name, customer_name, customer_phone, customer_email, shipping_address, quantity, original_price, reseller_price, profit_margin, status, shipping_requested, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as Row[];
      // Fetch reseller names via admin_list_users (super_admin only).
      const { data: users } = await supabase.rpc("admin_list_users");
      const map = new Map<string, { full_name: string | null; email: string }>();
      for (const u of users ?? []) map.set(u.user_id, { full_name: u.full_name, email: u.email });
      return rows.map((r) => ({ ...r, reseller: map.get(r.reseller_id) ?? null }));
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

  const totalProfit = (q.data ?? []).reduce((s, r) => s + Number(r.profit_margin || 0), 0);
  const pendingShip = (q.data ?? []).filter((r) => r.shipping_requested && r.status !== "delivered" && r.status !== "cancelled").length;

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

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reseller</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Ship to</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Profit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Placed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data?.length ? q.data.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.reseller?.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.reseller?.email ?? r.reseller_id.slice(0, 8)}</div>
                </TableCell>
                <TableCell>{r.product_name}</TableCell>
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
