import { describe, it, expect } from "vitest";
import { runCopyResellerProduct } from "./reseller-copy-core";
import { createSupabaseHarness, userClientWithRole } from "@/test/supabase-harness";

const INPUT = {
  reseller_product_id: "11111111-1111-1111-1111-111111111111",
  category_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  custom_price: 150,
};

const sourceRow = {
  id: INPUT.reseller_product_id,
  name: "Test Phone",
  description: "d",
  image: null,
  image_url: null,
  price: 100,
  reseller_price: 120,
  category: "Phones",
  original_product_id: null,
};

describe("runCopyResellerProduct (role-based)", () => {
  it("reseller with a store: successfully adds product to their shop", async () => {
    const { client: admin, audits } = createSupabaseHarness({
      reseller_products: { maybeSingle: { data: sourceRow, error: null } },
      stores: { maybeSingle: { data: { id: "store-1" }, error: null } },
      product_categories: { maybeSingle: { data: { id: INPUT.category_id }, error: null } },
      products: [
        { maybeSingle: { data: null, error: null } }, // dedup lookup
        { single: { data: { id: "new-product-id" }, error: null } }, // insert
      ],
      reseller_marketplace_audit_logs: {},
    });

    const res = await runCopyResellerProduct(INPUT, {
      userSupabase: userClientWithRole("reseller") as never,
      adminSupabase: admin as never,
      userId: "reseller-user",
    });

    expect(res).toEqual({ ok: true, product_id: "new-product-id", skipped: false });
    expect(audits.at(-1)).toMatchObject({ success: true, actor_role: "reseller" });
  });

  it("user without a store: forbidden mutation returns 403", async () => {
    const { client: admin, audits } = createSupabaseHarness({
      reseller_products: { maybeSingle: { data: sourceRow, error: null } },
      stores: { maybeSingle: { data: null, error: null } },
      reseller_marketplace_audit_logs: {},
    });

    await expect(
      runCopyResellerProduct(INPUT, {
        userSupabase: userClientWithRole("customer") as never,
        adminSupabase: admin as never,
        userId: "no-store-user",
      }),
    ).rejects.toMatchObject({ status: 403 });

    expect(audits.at(-1)).toMatchObject({ success: false, error: "no_store_forbidden" });
  });

  it("rejects a category_id that doesn't belong to the caller's store", async () => {
    const { client: admin } = createSupabaseHarness({
      reseller_products: { maybeSingle: { data: sourceRow, error: null } },
      stores: { maybeSingle: { data: { id: "store-1" }, error: null } },
      product_categories: { maybeSingle: { data: null, error: null } },
      reseller_marketplace_audit_logs: {},
    });

    await expect(
      runCopyResellerProduct(INPUT, {
        userSupabase: userClientWithRole("reseller") as never,
        adminSupabase: admin as never,
        userId: "reseller-user",
      }),
    ).rejects.toThrow(/does not belong to your store/);
  });
});
