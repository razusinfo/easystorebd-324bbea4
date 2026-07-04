// Pure, testable core of the "Copy reseller product into my shop" logic.
// Uses injected supabase clients so unit tests can mock without a live DB.

export type CopyInput = {
  reseller_product_id: string;
  category_id?: string | null;
  custom_price?: number | null;
  // Optional whitelist of media URLs the reseller wants to import. When
  // provided, only these URLs from the original product's media set are
  // copied. When omitted / null, all original media is copied.
  selected_media?: string[] | null;
};


export type SupabaseLike = {
  from: (table: string) => any;
};

export type CopyDeps = {
  userSupabase: SupabaseLike; // RLS as the caller (for user_roles)
  adminSupabase: SupabaseLike; // service role
  userId: string;
};

export type CopyResult =
  | { ok: true; product_id: string; skipped: boolean }
  | never;

export async function runCopyResellerProduct(
  input: CopyInput,
  deps: CopyDeps,
): Promise<CopyResult> {
  const { userSupabase, adminSupabase, userId } = deps;

  const { data: roles } = await userSupabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const heldRoles = (roles ?? []).map((r: { role: string }) => r.role);
  const actorRole = heldRoles[0] ?? "unknown";

  const logAttempt = async (success: boolean, productId: string, error?: string) => {
    await adminSupabase.from("reseller_marketplace_audit_logs").insert({
      actor_id: userId,
      actor_role: actorRole,
      action: "copy_link_to_my_products",
      product_id: productId,
      success,
      error: error ?? null,
    });
  };

  try {
    const { data: source, error: srcErr } = await adminSupabase
      .from("reseller_products")
      .select(
        "id, external_id, original_product_id, name, description, image, image_url, price, reseller_price, category",
      )
      .eq("id", input.reseller_product_id)
      .maybeSingle();
    if (srcErr) throw new Error(srcErr.message);
    if (!source) throw new Error("Source reseller product not found");

    const { data: store, error: storeErr } = await adminSupabase
      .from("stores")
      .select("id")
      .eq("owner_user_id", userId)
      .limit(1)
      .maybeSingle();
    if (storeErr) throw new Error(storeErr.message);
    if (!store) {
      await logAttempt(false, input.reseller_product_id, "no_store_forbidden");
      throw new Response("Forbidden: you must own a store to add products", { status: 403 });
    }

    const originalId = source.original_product_id as string | null;
    let original: {
      category_id: string | null;
      warranty: string | null;
      product_serial: string | null;
      sku: string | null;
      brand: string | null;
      condition: string | null;
      short_description: string | null;
    } | null = null;
    if (originalId) {
      const { data: orig } = await adminSupabase
        .from("products")
        .select(
          "category_id, warranty, product_serial, sku, brand, condition, weight_kg, short_description",
        )
        .eq("id", originalId)
        .maybeSingle();
      original = orig ?? null;
    }

    const price = source.reseller_price ?? source.price;
    const missing: string[] = [];
    if (!source.name || !String(source.name).trim()) missing.push("name");
    if (price == null || !Number.isFinite(Number(price)) || Number(price) < 0) {
      missing.push("price");
    }
    const stock = 0;
    if (!Number.isInteger(stock) || stock < 0) missing.push("quantity");
    const chosenCategoryId = input.category_id ?? original?.category_id ?? null;
    if (!chosenCategoryId && !source.category) missing.push("category");

    if (missing.length) {
      const msg = `Missing required product fields: ${missing.join(", ")}`;
      await logAttempt(false, source.id, msg);
      throw new Error(msg);
    }

    if (input.category_id) {
      const { data: cat } = await adminSupabase
        .from("product_categories")
        .select("id")
        .eq("id", input.category_id)
        .eq("store_id", store.id)
        .maybeSingle();
      if (!cat) throw new Error("Selected category does not belong to your store");
    }

    const { data: existing } = await adminSupabase
      .from("products")
      .select("id")
      .eq("store_id", store.id)
      .eq("name", source.name)
      .limit(1)
      .maybeSingle();
    if (existing) {
      await logAttempt(true, source.id, "already_exists");
      return { ok: true, product_id: existing.id, skipped: true };
    }

    const sellingPrice = input.custom_price != null ? Number(input.custom_price) : Number(price);
    const insertPayload = {
      store_id: store.id,
      name: source.name,
      description: source.description ?? null,
      short_description: original?.short_description ?? null,
      image_url: source.image_url ?? source.image ?? null,
      price: sellingPrice,
      regular_price: source.price,
      reseller_price: source.reseller_price,
      stock,
      status: "approved" as const,
      category_id: chosenCategoryId,
      warranty: original?.warranty ?? null,
      product_serial: original?.product_serial ?? null,
      sku: original?.sku ?? null,
      brand: original?.brand ?? null,
      condition: original?.condition ?? "new",
    };

    const { data: inserted, error: insErr } = await adminSupabase
      .from("products")
      .insert(insertPayload)
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    await logAttempt(true, source.id);
    return { ok: true, product_id: inserted.id, skipped: false };
  } catch (err) {
    if (err instanceof Response) throw err;
    const message = err instanceof Error ? err.message : "Unknown error";
    await logAttempt(false, input.reseller_product_id, message);
    throw err;
  }
}
