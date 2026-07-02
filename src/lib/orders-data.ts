// Orders data layer for EazyStore
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OrderStatus =
  | "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
export type PaymentStatus = "unpaid" | "paid" | "refunded";

export const ORDER_STATUSES: OrderStatus[] = [
  "pending", "confirmed", "processing", "shipped", "delivered", "cancelled",
];
export const PAYMENT_STATUSES: PaymentStatus[] = ["unpaid", "paid", "refunded"];

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  variant_label: string | null;
  created_at: string;
};

export type OrderRow = {
  id: string;
  store_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  notes: string | null;
  subtotal: number;
  delivery_charge: number;
  discount: number;
  total: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItemInput = {
  product_id?: string | null;
  name: string;
  price: number;
  quantity: number;
  variant_label?: string | null;
};

export type OrderInput = {
  id?: string;
  customer_name: string;
  customer_phone: string;
  customer_address?: string | null;
  notes?: string | null;
  delivery_charge?: number;
  discount?: number;
  status?: OrderStatus;
  payment_status?: PaymentStatus;
  payment_method?: string | null;
  items: OrderItemInput[];
};

/** List all orders for a store. */
export function useOrders(storeId: string | undefined) {
  return useQuery({
    queryKey: ["orders", "by-store", storeId],
    enabled: !!storeId,
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });
}

/** Fetch items of a single order. */
export function useOrderItems(orderId: string | undefined) {
  return useQuery({
    queryKey: ["order-items", orderId],
    enabled: !!orderId,
    queryFn: async (): Promise<OrderItemRow[]> => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as OrderItemRow[];
    },
  });
}

function computeTotals(input: OrderInput) {
  const subtotal = input.items.reduce(
    (s, it) => s + Number(it.price) * Number(it.quantity), 0,
  );
  const total = Math.max(
    0,
    subtotal + Number(input.delivery_charge ?? 0) - Number(input.discount ?? 0),
  );
  return { subtotal, total };
}

async function nextOrderNumber(storeId: string): Promise<string> {
  // Simple, human-friendly: ORD-<yy><mm><dd>-<count+1>
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const prefix = `ORD-${yy}${mm}${dd}`;
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .like("order_number", `${prefix}%`);
  return `${prefix}-${String((count ?? 0) + 1).padStart(3, "0")}`;
}

/** Create or update an order (with items). */
export function useUpsertOrder(storeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: OrderInput) => {
      if (!storeId) throw new Error("No store");
      const { subtotal, total } = computeTotals(input);
      const base = {
        store_id: storeId,
        customer_name: input.customer_name.trim(),
        customer_phone: input.customer_phone.trim(),
        customer_address: input.customer_address?.trim() || null,
        notes: input.notes?.trim() || null,
        delivery_charge: Number(input.delivery_charge ?? 0),
        discount: Number(input.discount ?? 0),
        subtotal,
        total,
        status: input.status ?? "pending",
        payment_status: input.payment_status ?? "unpaid",
        payment_method: input.payment_method?.trim() || null,
      };

      let orderId = input.id;
      if (orderId) {
        const { error } = await supabase
          .from("orders").update(base).eq("id", orderId);
        if (error) throw error;
        // Replace items
        await supabase.from("order_items").delete().eq("order_id", orderId);
      } else {
        const order_number = await nextOrderNumber(storeId);
        const { data, error } = await supabase
          .from("orders").insert({ ...base, order_number }).select("id").single();
        if (error) throw error;
        orderId = data.id;
      }

      if (input.items.length) {
        const rows = input.items.map((it) => ({
          order_id: orderId!,
          product_id: it.product_id ?? null,
          name: it.name,
          price: Number(it.price),
          quantity: Number(it.quantity),
          subtotal: Number(it.price) * Number(it.quantity),
          variant_label: it.variant_label ?? null,
        }));
        const { error } = await supabase.from("order_items").insert(rows);
        if (error) throw error;
      }
      return orderId!;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders", "by-store", storeId] });
      qc.invalidateQueries({ queryKey: ["order-items"] });
    },
  });
}

export function useUpdateOrderStatus(storeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders", "by-store", storeId] }),
  });
}

export function useUpdatePaymentStatus(storeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payment_status }: { id: string; payment_status: PaymentStatus }) => {
      const { error } = await supabase.from("orders").update({ payment_status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders", "by-store", storeId] }),
  });
}

export function useDeleteOrder(storeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders", "by-store", storeId] }),
  });
}

export function statusBadgeClass(s: OrderStatus): string {
  switch (s) {
    case "pending":    return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "confirmed":  return "bg-sky-500/15 text-sky-700 dark:text-sky-400";
    case "processing": return "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400";
    case "shipped":    return "bg-violet-500/15 text-violet-700 dark:text-violet-400";
    case "delivered":  return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "cancelled":  return "bg-destructive/15 text-destructive";
  }
}
export function paymentBadgeClass(s: PaymentStatus): string {
  switch (s) {
    case "paid":     return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "unpaid":   return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "refunded": return "bg-slate-500/15 text-slate-700 dark:text-slate-400";
  }
}
