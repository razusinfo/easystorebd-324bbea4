import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Super-admin view: for every reseller marketplace product, list which
// reseller stores have added it to their own website.
export const adminListResellerAdopters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Auth: super_admin only
    const { data: roleRow, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "super_admin")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRow) throw new Error("Access denied: super_admin only");

    const { data: resellerProducts, error: rpErr } = await supabaseAdmin
      .from("reseller_products")
      .select("id, name, image_url, price, reseller_price, stock, updated_at")
      .order("updated_at", { ascending: false });
    if (rpErr) throw new Error(rpErr.message);

    const rpIds = (resellerProducts ?? []).map((r) => r.id);
    if (rpIds.length === 0) return [];

    const { data: adoptions, error: adErr } = await supabaseAdmin
      .from("products")
      .select("id, name, price, stock, status, store_id, created_at, source_reseller_product_id")
      .in("source_reseller_product_id", rpIds);
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
      storeMap = new Map((stores ?? []).map((s) => [s.id, { name: s.name, owner_user_id: s.owner_user_id }]));

      const ownerIds = Array.from(
        new Set((stores ?? []).map((s) => s.owner_user_id).filter(Boolean)),
      ) as string[];

      if (ownerIds.length) {
        const { data: users } = await supabaseAdmin.rpc("admin_list_users");
        ownerMap = new Map(
          (users ?? [])
            .filter((u: { user_id: string }) => ownerIds.includes(u.user_id))
            .map((u: { user_id: string; email: string | null; full_name: string | null }) => [
              u.user_id,
              { email: u.email, full_name: u.full_name },
            ]),
        );
      }
    }

    return (resellerProducts ?? []).map((rp) => {
      const rows = (adoptions ?? []).filter((a) => a.source_reseller_product_id === rp.id);
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
  });
