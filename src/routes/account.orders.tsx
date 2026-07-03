import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Eye, Loader2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/account/orders")({
  component: MyOrdersPage,
});

type OrderRow = {
  id: string;
  order_number: string;
  total: number;
  status: string;
  payment_status: string;
  created_at: string;
};

function MyOrdersPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["account", "orders"],
    queryFn: async (): Promise<OrderRow[]> => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return [];
      const { data: rows, error } = await supabase
        .from("orders")
        .select("id, order_number, total, status, payment_status, created_at")
        .eq("customer_user_id", uid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (rows ?? []) as OrderRow[];
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">My Orders</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Orders you placed while signed in to this account.
      </p>

      {isLoading ? (
        <div className="mt-8 grid place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="mt-6 rounded-lg bg-destructive/10 px-3 py-3 text-sm text-destructive">
          Could not load your orders.
        </p>
      ) : (data ?? []).length === 0 ? (
        <div className="mt-8 grid place-items-center gap-2 text-center text-muted-foreground">
          <Package className="h-10 w-10" />
          <p>No orders yet.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.order_number}</TableCell>
                  <TableCell>{new Date(o.created_at).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant="secondary">{o.status}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{o.payment_status}</Badge></TableCell>
                  <TableCell className="text-right font-bold">
                    {Number(o.total).toLocaleString()} ৳
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
