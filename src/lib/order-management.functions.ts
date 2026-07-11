import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ManagedOrderRow = {
  id: string;
  order_id_short: string;
  created_at: string;
  status: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  shipping_address: string;
  reseller_id: string;
  reseller_name: string;
  reseller_store: string | null;
  product_name: string;
  quantity: number;
  customer_price: number;
  reseller_price: number;
  original_price: number;
  total_amount: number;
  profit_margin: number;
  tracking_id: string | null;
  source_store_id: string | null;
  source: string | null;
};

export type ManagedOrdersResult = {
  role: "super_admin" | "supplier";
  rows: ManagedOrderRow[];
  suppliers: Array<{ id: string; name: string }>;
  resellers: Array<{ id: string; name: string }>;
};

export const listManagedOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedOrdersResult> => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });

    const role: "super_admin" | "supplier" = isAdmin ? "super_admin" : "supplier";

    let query = supabase
      .from("reseller_orders")
      .select(
        "id, reseller_id, product_name, customer_name, customer_phone, customer_email, shipping_address, quantity, original_price, reseller_price, customer_price, profit_margin, status, tracking_id, created_at, source, source_store_id",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (role === "supplier") {
      // Supplier scoping: rows this supplier fulfills.
      // In this system a "supplier" is the reseller who sold the item to the
      // customer (they own the storefront and fulfill via us). Non-admins are
      // scoped to their own reseller_id — they cannot see other suppliers'.
      query = query.eq("reseller_id", userId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const raw = (data ?? []) as Array<Record<string, unknown>>;

    const resellerIds = Array.from(new Set(raw.map((r) => r.reseller_id as string).filter(Boolean)));
    const storeIds = Array.from(
      new Set(raw.map((r) => r.source_store_id as string | null).filter(Boolean)),
    ) as string[];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [profilesRes, storesRes] = await Promise.all([
      resellerIds.length
        ? supabaseAdmin.from("profiles").select("id, name").in("id", resellerIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }> }),
      storeIds.length
        ? supabaseAdmin.from("stores").select("id, name, owner_user_id").in("id", storeIds)
        : Promise.resolve({
            data: [] as Array<{ id: string; name: string | null; owner_user_id: string | null }>,
          }),
    ]);

    const nameMap = new Map<string, string>();
    for (const p of profilesRes.data ?? []) nameMap.set(p.id, p.name ?? "");
    const storeMap = new Map<string, string>();
    for (const s of storesRes.data ?? []) storeMap.set(s.id, s.name ?? "");

    const rows: ManagedOrderRow[] = raw.map((r) => {
      const qty = Number(r.quantity ?? 0);
      const cp = Number(r.customer_price ?? r.reseller_price ?? 0);
      return {
        id: r.id as string,
        order_id_short: String(r.id).slice(0, 8).toUpperCase(),
        created_at: r.created_at as string,
        status: (r.status as string) ?? "pending",
        customer_name: (r.customer_name as string) ?? "",
        customer_phone: (r.customer_phone as string) ?? null,
        customer_email: (r.customer_email as string) ?? null,
        shipping_address: (r.shipping_address as string) ?? "",
        reseller_id: r.reseller_id as string,
        reseller_name: nameMap.get(r.reseller_id as string) || "—",
        reseller_store: r.source_store_id
          ? storeMap.get(r.source_store_id as string) ?? null
          : null,
        product_name: (r.product_name as string) ?? "",
        quantity: qty,
        customer_price: cp,
        reseller_price: Number(r.reseller_price ?? 0),
        original_price: Number(r.original_price ?? 0),
        total_amount: cp * qty,
        profit_margin: Number(r.profit_margin ?? 0),
        tracking_id: (r.tracking_id as string) ?? null,
        source_store_id: (r.source_store_id as string) ?? null,
        source: (r.source as string) ?? null,
      };
    });

    // Filter dropdown options (suppliers = source strings; resellers = names)
    const suppliers = Array.from(new Set(rows.map((r) => r.source).filter(Boolean))) as string[];
    const resellerSet = new Map<string, string>();
    for (const r of rows) resellerSet.set(r.reseller_id, r.reseller_name);

    return {
      role,
      rows,
      suppliers: suppliers.map((s) => ({ id: s, name: s })),
      resellers: Array.from(resellerSet.entries()).map(([id, name]) => ({ id, name })),
    };
  });
