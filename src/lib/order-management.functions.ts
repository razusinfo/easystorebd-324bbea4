import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
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
  // Storefront owner ("reseller who made the sale") — for supplier contact.
  storefront_owner_id: string | null;
  storefront_owner_name: string | null;
  storefront_owner_phone: string | null;
  storefront_owner_email: string | null;
  product_name: string;
  quantity: number;
  customer_price: number;
  reseller_price: number;
  original_price: number;
  total_amount: number;
  profit_margin: number;
  tracking_id: string | null;
  tracking_url: string | null;
  notes: string | null;
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

    if (!userId) {
      throw new Error("Forbidden: no authenticated user");
    }

    // Fail-closed role detection. If the RPC errors, treat the caller as a
    // supplier (never as admin) so we still apply the reseller_id scope.
    const { data: isAdminData, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (roleErr) {
      console.warn("[order-management] has_role failed, defaulting to supplier scope:", roleErr.message);
    }
    const role: "super_admin" | "supplier" = isAdminData === true ? "super_admin" : "supplier";

    let query = supabase
      .from("reseller_orders")
      .select(
        "id, reseller_id, product_name, customer_name, customer_phone, customer_email, shipping_address, quantity, original_price, reseller_price, customer_price, profit_margin, status, tracking_id, tracking_url, notes, created_at, source, source_store_id",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (role === "supplier") {
      // Server-side scope. RLS (`auth.uid() = reseller_id`) is the primary
      // guard; this .eq is the redundant application-layer scope.
      query = query.eq("reseller_id", userId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const raw = (data ?? []) as Array<Record<string, unknown>>;

    // Defense-in-depth: even though RLS + .eq() already scope suppliers to
    // their own rows, assert it before returning anything to the client.
    // Any leak here indicates a policy regression and must not silently ship.
    if (role === "supplier") {
      for (const r of raw) {
        if (r.reseller_id !== userId) {
          console.error("[order-management] supplier scope leak detected", { userId, rowResellerId: r.reseller_id });
          throw new Error("Forbidden: supplier scope violation");
        }
      }
    }


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
    const storeMap = new Map<string, { name: string; owner_user_id: string | null }>();
    for (const s of storesRes.data ?? []) {
      storeMap.set(s.id, { name: s.name ?? "", owner_user_id: s.owner_user_id ?? null });
    }

    // Storefront-owner ids (the "reseller who made the sale") — resolve
    // name/phone/email for supplier contact.
    const ownerIds = Array.from(
      new Set(
        Array.from(storeMap.values()).map((s) => s.owner_user_id).filter(Boolean),
      ),
    ) as string[];

    const ownerProfileRes = ownerIds.length
      ? await supabaseAdmin.from("profiles").select("id, name").in("id", ownerIds)
      : { data: [] as Array<{ id: string; name: string | null }> };
    for (const p of ownerProfileRes.data ?? []) {
      if (!nameMap.has(p.id)) nameMap.set(p.id, p.name ?? "");
    }

    // Emails via auth admin (best effort — swallow errors).
    const emailMap = new Map<string, string>();
    const phoneMap = new Map<string, string>();
    await Promise.all(
      ownerIds.map(async (uid) => {
        try {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
          if (u?.user) {
            if (u.user.email) emailMap.set(uid, u.user.email);
            if (u.user.phone) phoneMap.set(uid, u.user.phone);
            const meta = (u.user.user_metadata ?? {}) as Record<string, unknown>;
            const metaPhone = (meta.phone as string | undefined) ?? (meta.phone_number as string | undefined);
            if (!phoneMap.has(uid) && metaPhone) phoneMap.set(uid, metaPhone);
          }
        } catch {
          /* ignore */
        }
      }),
    );

    const rows: ManagedOrderRow[] = raw.map((r) => {
      const qty = Number(r.quantity ?? 0);
      const cp = Number(r.customer_price ?? r.reseller_price ?? 0);
      const storeInfo = r.source_store_id ? storeMap.get(r.source_store_id as string) : undefined;
      const ownerId = storeInfo?.owner_user_id ?? null;
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
        reseller_store: storeInfo?.name ?? null,
        storefront_owner_id: ownerId,
        storefront_owner_name: ownerId ? nameMap.get(ownerId) || null : null,
        storefront_owner_phone: ownerId ? phoneMap.get(ownerId) ?? null : null,
        storefront_owner_email: ownerId ? emailMap.get(ownerId) ?? null : null,
        product_name: (r.product_name as string) ?? "",
        quantity: qty,
        customer_price: cp,
        reseller_price: Number(r.reseller_price ?? 0),
        original_price: Number(r.original_price ?? 0),
        total_amount: cp * qty,
        profit_margin: Number(r.profit_margin ?? 0),
        tracking_id: (r.tracking_id as string) ?? null,
        tracking_url: (r.tracking_url as string) ?? null,
        notes: (r.notes as string) ?? null,
        source_store_id: (r.source_store_id as string) ?? null,
        source: (r.source as string) ?? null,
      };
    });

    const suppliers = Array.from(new Set(rows.map((r) => r.source).filter(Boolean))) as string[];
    const resellerSet = new Map<string, string>();
    for (const r of rows) resellerSet.set(r.reseller_id, r.reseller_name);

    // Audit: record who fetched the order list. Best-effort — never block the
    // read on a logging failure, but never silently drop it either.
    try {
      let ip: string | null = null;
      let ua: string | null = null;
      try {
        const req = getRequest();
        ip =
          req.headers.get("cf-connecting-ip") ??
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          req.headers.get("x-real-ip") ??
          null;
        ua = req.headers.get("user-agent");
      } catch {
        /* getRequest may be unavailable in non-request contexts */
      }
      await supabaseAdmin.from("order_access_audit").insert({
        actor_id: userId,
        actor_role: role,
        action: "list_managed_orders",
        row_count: rows.length,
        filters: null,
        ip_address: ip,
        user_agent: ua,
      });
    } catch (auditErr) {
      console.warn("[order-management] audit insert failed:", auditErr);
    }

    return {
      role,
      rows,
      suppliers: suppliers.map((s) => ({ id: s, name: s })),
      resellers: Array.from(resellerSet.entries()).map(([id, name]) => ({ id, name })),
    };
  });

// -----------------------------------------------------------------------------
// Testable pure core: authorization + scope filter, no Supabase, no I/O.
// Exported so unit tests can exercise the failure/empty cases directly.
// -----------------------------------------------------------------------------

export type ScopeDecision =
  | { role: "super_admin"; scopeToUserId: null }
  | { role: "supplier"; scopeToUserId: string };

/** Fail-closed: any error from the RPC → treat as supplier, never admin. */
export function decideOrderScope(
  userId: string | null | undefined,
  rpcResult: { data: unknown; error: unknown },
): ScopeDecision {
  if (!userId) throw new Error("Forbidden: no authenticated user");
  const isAdmin = !rpcResult.error && rpcResult.data === true;
  return isAdmin
    ? { role: "super_admin", scopeToUserId: null }
    : { role: "supplier", scopeToUserId: userId };
}

/** Asserts every row belongs to the supplier; throws on the first leak. */
export function assertSupplierScope<T extends { reseller_id: unknown }>(
  rows: T[],
  scopeUserId: string,
): void {
  for (const r of rows) {
    if (r.reseller_id !== scopeUserId) {
      throw new Error("Forbidden: supplier scope violation");
    }
  }
}

// -----------------------------------------------------------------------------
// Admin-only integrity scanner
// -----------------------------------------------------------------------------

export type OrderIntegrityRow = {
  order_id: string;
  reseller_id: string | null;
  storefront_owner_id: string | null;
  source_order_item_id: string | null;
  created_at: string;
  issue: string;
  detail: string;
};

export const runOrderAccessIntegrityCheck = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: OrderIntegrityRow[] }> => {
    const { supabase, userId } = context;
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (roleErr || isAdmin !== true) {
      throw new Error("Forbidden: super_admin only");
    }

    const { data, error } = await supabase.rpc("admin_check_order_access_integrity");
    if (error) throw new Error(error.message);

    // Detailed audit: group results by issue code and record sample order IDs.
    const rows = (data ?? []) as OrderIntegrityRow[];
    const byIssue: Record<string, { count: number; sample_order_ids: string[] }> = {};
    for (const r of rows) {
      const b = (byIssue[r.issue] ||= { count: 0, sample_order_ids: [] });
      b.count += 1;
      if (b.sample_order_ids.length < 10) b.sample_order_ids.push(r.order_id);
    }
    const summary = rows.length === 0
      ? "clean"
      : Object.entries(byIssue)
          .map(([k, v]) => `${k}:${v.count}`)
          .join(", ");
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("order_access_audit").insert({
        actor_id: userId,
        actor_role: "super_admin",
        action: "run_integrity_check",
        row_count: rows.length,
        filters: { by_issue: byIssue, total: rows.length },
        notes: `integrity_scan: ${summary}`,
      });
    } catch (e) {
      console.warn("[order-management] integrity audit insert failed:", e);
    }

    return { rows };
  });

export type OrderAccessAuditEntry = {
  id: string;
  actor_id: string | null;
  actor_role: string;
  action: string;
  row_count: number;
  ip_address: string | null;
  user_agent: string | null;
  notes: string | null;
  created_at: string;
  actor_name: string | null;
};

export const listOrderAccessAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: OrderAccessAuditEntry[] }> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (isAdmin !== true) throw new Error("Forbidden: super_admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("order_access_audit")
      .select("id, actor_id, actor_role, action, row_count, ip_address, user_agent, notes, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const actorIds = Array.from(
      new Set((data ?? []).map((r) => r.actor_id).filter((v): v is string => !!v)),
    );
    const nameMap = new Map<string, string>();
    if (actorIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, name")
        .in("id", actorIds);
      for (const p of profs ?? []) nameMap.set(p.id, p.name ?? "");
    }

    return {
      rows: (data ?? []).map((r) => ({
        ...r,
        actor_name: r.actor_id ? nameMap.get(r.actor_id) ?? null : null,
      })) as OrderAccessAuditEntry[],
    };
  });

