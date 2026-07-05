import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Access denied: super_admin only");
}

export type Adopter = {
  product_id: string;
  product_name: string;
  selling_price: number | null;
  stock: number | null;
  status: string | null;
  created_at: string;
  store_id: string | null;
  store_name: string | null;
  owner_user_id: string | null;
  owner_email: string | null;
  owner_name: string | null;
};

export type AdopterGroup = {
  reseller_product: {
    id: string;
    name: string;
    image_url: string | null;
    price: number | null;
    reseller_price: number | null;
    stock: number | null;
    updated_at: string;
  };
  adopters: Adopter[];
};

const listInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional().nullable(),
  status: z.string().trim().optional().nullable(),
  dateFrom: z.string().optional().nullable(),
  dateTo: z.string().optional().nullable(),
  resellerEmail: z.string().trim().optional().nullable(),
  onlyAdopted: z.boolean().default(true),
});

// Super-admin view: for every reseller marketplace product, list which
// reseller stores have added it to their own website. Supports server-side
// filtering + pagination over reseller products.
export const adminListResellerAdopters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listInput.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Filtered adoptions first (so we can constrain reseller products list).
    let adoptQuery = supabaseAdmin
      .from("products")
      .select("id, name, price, stock, status, store_id, created_at, source_reseller_product_id")
      .not("source_reseller_product_id", "is", null);

    if (data.status) adoptQuery = adoptQuery.eq("status", data.status as never);
    if (data.dateFrom) adoptQuery = adoptQuery.gte("created_at", data.dateFrom);
    if (data.dateTo) adoptQuery = adoptQuery.lte("created_at", data.dateTo);

    const { data: adoptions, error: adErr } = await adoptQuery;
    if (adErr) throw new Error(adErr.message);

    const storeIds = Array.from(
      new Set((adoptions ?? []).map((a) => a.store_id).filter(Boolean)),
    ) as string[];

    let storeMap = new Map<string, { name: string | null; owner_user_id: string | null }>();
    let ownerMap = new Map<string, { email: string | null; full_name: string | null }>();

    if (storeIds.length) {
      const { data: stores } = await supabaseAdmin
        .from("stores")
        .select("id, name, owner_user_id")
        .in("id", storeIds);
      storeMap = new Map(
        (stores ?? []).map((s) => [s.id, { name: s.name, owner_user_id: s.owner_user_id }]),
      );
      const { data: users } = await supabaseAdmin.rpc("admin_list_users");
      ownerMap = new Map(
        (users ?? []).map(
          (u: { user_id: string; email: string | null; full_name: string | null }) => [
            u.user_id,
            { email: u.email, full_name: u.full_name },
          ],
        ),
      );
    }

    // Apply reseller-email filter to adoptions.
    const emailFilter = (data.resellerEmail ?? "").trim().toLowerCase();
    const passesEmail = (a: { store_id: string | null }) => {
      if (!emailFilter) return true;
      const store = storeMap.get(a.store_id ?? "");
      const owner = store?.owner_user_id ? ownerMap.get(store.owner_user_id) : null;
      return (owner?.email ?? "").toLowerCase().includes(emailFilter);
    };
    const filteredAdoptions = (adoptions ?? []).filter(passesEmail);

    const adoptedRpIds = new Set(
      filteredAdoptions.map((a) => a.source_reseller_product_id).filter(Boolean) as string[],
    );

    // 2. Reseller products, with optional search + onlyAdopted + pagination.
    let rpQuery = supabaseAdmin
      .from("reseller_products")
      .select("id, name, image_url, price, reseller_price, stock, updated_at", { count: "exact" })
      .order("updated_at", { ascending: false });

    if (data.search) rpQuery = rpQuery.ilike("name", `%${data.search}%`);
    if (data.onlyAdopted) {
      if (adoptedRpIds.size === 0) {
        return { groups: [], total: 0, page: data.page, pageSize: data.pageSize };
      }
      rpQuery = rpQuery.in("id", Array.from(adoptedRpIds));
    }

    const from = (data.page - 1) * data.pageSize;
    rpQuery = rpQuery.range(from, from + data.pageSize - 1);

    const { data: resellerProducts, error: rpErr, count } = await rpQuery;
    if (rpErr) throw new Error(rpErr.message);

    const groups: AdopterGroup[] = (resellerProducts ?? []).map((rp) => {
      const rows = filteredAdoptions.filter((a) => a.source_reseller_product_id === rp.id);
      return {
        reseller_product: rp,
        adopters: rows.map((a) => {
          const store = storeMap.get(a.store_id!);
          const owner = store?.owner_user_id ? ownerMap.get(store.owner_user_id) : null;
          return {
            product_id: a.id,
            product_name: a.name,
            selling_price: a.price,
            stock: a.stock,
            status: a.status,
            created_at: a.created_at,
            store_id: a.store_id,
            store_name: store?.name ?? null,
            owner_user_id: store?.owner_user_id ?? null,
            owner_email: owner?.email ?? null,
            owner_name: owner?.full_name ?? null,
          };
        }),
      };
    });

    return { groups, total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

// Audit trail for a single (reseller_product, store owner) pair: shows the
// first successful adoption plus any duplicate-add attempts.
export const adminGetAdopterAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        reseller_product_id: z.string().uuid(),
        owner_user_id: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("reseller_marketplace_audit_logs")
      .select("id, actor_id, actor_role, action, success, error, created_at, metadata")
      .eq("product_id", data.reseller_product_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.owner_user_id) q = q.eq("actor_id", data.owner_user_id);

    const { data: logs, error } = await q;
    if (error) throw new Error(error.message);
    return logs ?? [];
  });

// Audit trail for a single adopted product row (product status history +
// pricing changes captured by the product audit log).
export const adminGetProductHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ product_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: logs, error } = await supabaseAdmin
      .from("product_audit_logs")
      .select("id, actor_id, action, old_status, new_status, created_at")
      .eq("product_id", data.product_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return logs ?? [];
  });
