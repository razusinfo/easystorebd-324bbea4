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

  it("only checked media URLs are copied, and audit metadata records the selection", async () => {
    const ORIGINAL_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const IMG_A = "https://cdn.example.com/a.jpg";
    const IMG_B = "https://cdn.example.com/b.jpg";
    const IMG_C = "https://cdn.example.com/c.jpg";
    const VIDEO = "https://cdn.example.com/demo.mp4";

    const sourceWithOriginal = { ...sourceRow, original_product_id: ORIGINAL_ID };
    const originalProduct = {
      category_id: null,
      warranty: null,
      product_serial: null,
      sku: null,
      brand: null,
      condition: "new",
      short_description: null,
      image_url: IMG_A,
      video_url: VIDEO,
      gallery_urls: [IMG_B, IMG_C],
    };

    const { client: admin, audits, inserts } = createSupabaseHarness({
      reseller_products: { maybeSingle: { data: sourceWithOriginal, error: null } },
      stores: { maybeSingle: { data: { id: "store-1" }, error: null } },
      product_categories: { maybeSingle: { data: { id: INPUT.category_id }, error: null } },
      products: [
        { maybeSingle: { data: originalProduct, error: null } }, // fetch original media
        { maybeSingle: { data: null, error: null } }, // dedup lookup
        { single: { data: { id: "new-product-id" }, error: null } }, // insert
      ],
      reseller_marketplace_audit_logs: {},
    });

    // Reseller unchecks IMG_B and the VIDEO; keeps IMG_A + IMG_C.
    const selected = [IMG_A, IMG_C];

    const res = await runCopyResellerProduct(
      { ...INPUT, selected_media: selected },
      {
        userSupabase: userClientWithRole("reseller") as never,
        adminSupabase: admin as never,
        userId: "reseller-user",
      },
    );

    expect(res).toEqual({ ok: true, product_id: "new-product-id", skipped: false });

    // The products insert must only contain the checked URLs.
    const productInsert = inserts.find((i) => i.table === "products")!;
    expect(productInsert.payload.image_url).toBe(IMG_A);
    expect(productInsert.payload.gallery_urls).toEqual([IMG_C]);
    expect(productInsert.payload.video_url).toBeNull();

    // Unchecked URLs must NOT appear anywhere in the payload's media fields.
    const mediaBlob = JSON.stringify([
      productInsert.payload.image_url,
      productInsert.payload.gallery_urls,
      productInsert.payload.video_url,
    ]);
    expect(mediaBlob).not.toContain(IMG_B);
    expect(mediaBlob).not.toContain(VIDEO);

    // Audit metadata records exactly what the reseller requested and what got imported.
    const successAudit = audits.at(-1)!;
    expect(successAudit).toMatchObject({
      success: true,
      metadata: {
        requested_media: selected,
        imported_media: [IMG_A, IMG_C],
      },
    });
  });

  it("re-adding an existing reseller product short-circuits with skipped=true and audits a duplicate_add_attempt", async () => {
    const EXISTING_PRODUCT_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
    const { client: admin, audits, inserts } = createSupabaseHarness({
      reseller_products: { maybeSingle: { data: sourceRow, error: null } },
      stores: { maybeSingle: { data: { id: "store-1" }, error: null } },
      product_categories: { maybeSingle: { data: { id: INPUT.category_id }, error: null } },
      products: [
        { maybeSingle: { data: { id: EXISTING_PRODUCT_ID }, error: null } }, // dedup hit
      ],
      reseller_marketplace_audit_logs: {},
    });

    const res = await runCopyResellerProduct(INPUT, {
      userSupabase: userClientWithRole("reseller") as never,
      adminSupabase: admin as never,
      userId: "reseller-user",
    });

    // Mutation short-circuits — returns skipped=true, existing product id.
    expect(res).toEqual({ ok: true, product_id: EXISTING_PRODUCT_ID, skipped: true });

    // No products insert was performed.
    expect(inserts.find((i) => i.table === "products")).toBeUndefined();

    // Audit records a dedicated duplicate_add_attempt row.
    expect(audits.at(-1)).toMatchObject({
      success: true,
      action: "duplicate_add_attempt",
      error: "already_added_on_website",
      actor_role: "reseller",
    });
  });
});


