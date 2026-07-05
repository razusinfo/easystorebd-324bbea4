import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Wallet } from "lucide-react";

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

function fmt(n: number | null | undefined) {
  if (n == null) return "৳0";
  return `৳${Number(n).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

function MyOrdersPage() {
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
        .select("id, product_name, customer_name, customer_phone, shipping_address, quantity, reseller_price, status, source, source_order_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const balance = Number(wallet.data ?? 0);
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Orders</h1>
          <p className="text-sm text-muted-foreground">Orders you placed via the reseller API.</p>
        </div>
        <Card className="flex items-center gap-3 px-4 py-3">
          <Wallet className="h-5 w-5 text-primary" />
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Wallet</p>
            <p className={`text-lg font-bold ${balance < 0 ? "text-destructive" : "text-primary"}`}>
              {fmt(balance)}
            </p>
          </div>
        </Card>
      </header>

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
                const forwarded = o.source === "storefront" || !!o.source_order_id;
                return (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">
                    {o.product_name}
                    {forwarded && (
                      <div className="mt-1">
                        <Badge variant="secondary" className="text-[10px]">Forwarded to Super Admin</Badge>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>{o.customer_name}</div>
                    {o.customer_phone && <div className="text-xs text-muted-foreground">{o.customer_phone}</div>}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{o.shipping_address}</TableCell>
                  <TableCell className="text-right">{o.quantity}</TableCell>
                  <TableCell className="text-right">{fmt(Number(o.reseller_price) * o.quantity)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_COLORS[o.status] ?? "outline"}>
                      {forwarded ? `${o.status} · admin fulfilling` : o.status}
                    </Badge>
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
