import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MarketplaceAdminShell } from "@/components/marketplace-admin/shell";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  useMarketplaceOrders,
  useUpdateOrderStatus,
  type MarketplaceOrderStatus,
} from "@/lib/marketplace-admin";

export const Route = createFileRoute("/_authenticated/admin-marketplace/orders")({
  head: () => ({ meta: [{ title: "Marketplace Orders — EasyStore365 Control" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (!(r ?? []).some((x) => x.role === "super_admin")) throw redirect({ to: "/dashboard" });
  },
  component: OrdersPage,
});

const STATUSES: MarketplaceOrderStatus[] = ["pending", "shipped", "delivered", "cancelled"];
const statusTone: Record<MarketplaceOrderStatus, string> = {
  pending: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  shipped: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  delivered: "bg-green-500/15 text-green-700 dark:text-green-400",
  cancelled: "bg-red-500/15 text-red-700 dark:text-red-400",
};

function OrdersPage() {
  const [search, setSearch] = useState("");
  const list = useMarketplaceOrders(search);
  const update = useUpdateOrderStatus();

  return (
    <MarketplaceAdminShell
      currentPath="/admin-marketplace/orders"
      title="Marketplace Orders"
      description="Centralized order tracking across EasyStore365.com. Update status inline — changes propagate in realtime."
      actions={
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order, customer, store…"
            className="h-9 w-[260px] pl-8"
          />
        </div>
      }
    >
      <div className="rounded-xl border border-border bg-card">
        {list.isLoading ? (
          <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (list.data ?? []).length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No marketplace orders yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Reseller Store</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data!.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.order_code}</TableCell>
                  <TableCell>
                    <div className="font-medium">{o.customer_name}</div>
                    {o.customer_phone && <div className="text-xs text-muted-foreground">{o.customer_phone}</div>}
                  </TableCell>
                  <TableCell className="text-sm">{o.reseller_store_name || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-right font-semibold">৳{Number(o.total_amount).toLocaleString()}</TableCell>
                  <TableCell>
                    <Select
                      value={o.status}
                      onValueChange={(v) => {
                        update.mutate(
                          { id: o.id, status: v as MarketplaceOrderStatus },
                          { onSuccess: () => toast.success("Status updated"), onError: (e: any) => toast.error(e.message || "Failed") },
                        );
                      }}
                    >
                      <SelectTrigger className="h-8 w-[140px]">
                        <SelectValue>
                          <Badge className={statusTone[o.status] + " font-semibold capitalize"} variant="secondary">
                            {o.status}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </MarketplaceAdminShell>
  );
}
