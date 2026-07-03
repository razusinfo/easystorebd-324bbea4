import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const md = (u.user?.user_metadata ?? {}) as Record<string, unknown>;
      const p = ((md.phone as string) || "").trim();
      setPhone(p);
      if (!p) { setLoading(false); return; }
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, total, status, payment_status, created_at")
        .eq("customer_phone", p)
        .order("created_at", { ascending: false });
      setRows((data ?? []) as OrderRow[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">My Orders</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Orders you placed using your registered mobile number.
      </p>

      {loading ? (
        <div className="mt-8 grid place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !phone ? (
        <p className="mt-6 rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-800">
          Add your mobile number in Manage My Account to see your orders.
        </p>
      ) : rows.length === 0 ? (
        <div className="mt-8 grid place-items-center gap-2 text-center text-muted-foreground">
          <Package className="h-10 w-10" />
          <p>No orders yet.</p>
        </div>
      ) : (
        <ul className="mt-6 divide-y rounded-lg border">
          {rows.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 p-3">
              <div>
                <p className="font-semibold">{o.order_number}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleString()} · {o.status} · {o.payment_status}
                </p>
              </div>
              <p className="font-bold">{Number(o.total).toLocaleString()} ৳</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
