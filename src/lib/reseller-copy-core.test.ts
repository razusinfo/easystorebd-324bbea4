import { describe, it, expect, vi } from "vitest";
import { runCopyResellerProduct } from "./reseller-copy-core";

// ---------- Mock helpers ----------
// Minimal Supabase query builder that resolves to a fixed value.
function resolved(value: any) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    limit: () => chain,
    maybeSingle: async () => value,
    single: async () => value,
    insert: () => chain,
    then: undefined,
  };
  // await chain (used for user_roles select().eq())
  chain.then = (res: any) => Promise.resolve(value).then(res);
  return chain;
}

function makeAdmin(overrides: Record<string, any>) {
  const insert = vi.fn().mockReturnValue(resolved({ data: { id: "new-product-id" }, error: null }));
  const auditInsert = vi.fn().mockResolvedValue({ data: null, error: null });

  const admin = {
    from: vi.fn((table: string) => {
      if (table === "reseller_marketplace_audit_logs") {
        return { insert: auditInsert };
      }
      if (table === "products" && overrides.productsInsert) {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }),
          insert: () => ({ select: () => ({ single: async () => overrides.productsInsert }) }),
        };
      }
      const impl = overrides[table];
      if (!impl) throw new Error(`unmocked table: ${table}`);
      return impl;
    }),
    _auditInsert: auditInsert,
    _productsInsert: insert,
  };
  return admin;
}

function userWithRole(role: string | null) {
  return {
    from: (table: string) => {
      if (table === "user_roles") return resolved({ data: role ? [{ role }] : [] });
      throw new Error("unexpected user table: " + table);
    },
  };
}

// ---------- Tests ----------
describe("runCopyResellerProduct", () => {
  const baseInput = {
    reseller_product_id: "11111111-1111-1111-1111-111111111111",
    category_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    custom_price: 150,
  };

  it("reseller with a store can add a product to their shop", async () => {
    const admin = makeAdmin({
      reseller_products: {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: baseInput.reseller_product_id,
                name: "Test Phone",
                description: "d",
                image: null,
                image_url: null,
                price: 100,
                reseller_price: 120,
                category: "Phones",
                original_product_id: null,
              },
              error: null,
            }),
          }),
        }),
      },
      stores: {
        select: () => ({
          eq: () => ({
            limit: () => ({
              maybeSingle: async () => ({ data: { id: "store-1" }, error: null }),
            }),
          }),
        }),
      },
      product_categories: {
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: baseInput.category_id }, error: null }) }) }),
        }),
      },
      productsInsert: { data: { id: "new-product-id" }, error: null },
    });

    const res = await runCopyResellerProduct(baseInput, {
      userSupabase: userWithRole("reseller") as never,
      adminSupabase: admin as never,
      userId: "reseller-user",
    });

    expect(res).toEqual({ ok: true, product_id: "new-product-id", skipped: false });
    expect(admin._auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, actor_role: "reseller" }),
    );
  });

  it("returns 403 Response for a user without a store (forbidden mutation)", async () => {
    const admin = makeAdmin({
      reseller_products: {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: baseInput.reseller_product_id,
                name: "Test",
                price: 100,
                reseller_price: 120,
                category: "X",
                original_product_id: null,
              },
              error: null,
            }),
          }),
        }),
      },
      stores: {
        select: () => ({
          eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        }),
      },
    });

    await expect(
      runCopyResellerProduct(baseInput, {
        userSupabase: userWithRole("customer") as never,
        adminSupabase: admin as never,
        userId: "no-store-user",
      }),
    ).rejects.toMatchObject({ status: 403 });

    expect(admin._auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "no_store_forbidden" }),
    );
  });

  it("rejects a category_id that doesn't belong to the caller's store", async () => {
    const admin = makeAdmin({
      reseller_products: {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: baseInput.reseller_product_id,
                name: "Test",
                price: 100,
                reseller_price: 120,
                category: "X",
                original_product_id: null,
              },
              error: null,
            }),
          }),
        }),
      },
      stores: {
        select: () => ({
          eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { id: "store-1" }, error: null }) }) }),
        }),
      },
      product_categories: {
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        }),
      },
    });

    await expect(
      runCopyResellerProduct(baseInput, {
        userSupabase: userWithRole("reseller") as never,
        adminSupabase: admin as never,
        userId: "reseller-user",
      }),
    ).rejects.toThrow(/does not belong to your store/);
  });
});
