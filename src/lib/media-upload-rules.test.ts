import { describe, it, expect } from "vitest";
import {
  validateMediaFile,
  partitionMediaFiles,
  dedupeAgainstExisting,
  MAX_MEDIA_FILE_BYTES,
} from "./media-upload-rules";

describe("validateMediaFile", () => {
  it("accepts a normal JPG under 5MB", () => {
    expect(validateMediaFile({ name: "a.jpg", type: "image/jpeg", size: 100_000 })).toEqual({ ok: true });
  });
  it("accepts by extension when browser omits mime", () => {
    expect(validateMediaFile({ name: "a.PNG", type: "", size: 100 })).toEqual({ ok: true });
  });
  it("rejects unsupported type (pdf)", () => {
    const r = validateMediaFile({ name: "doc.pdf", type: "application/pdf", size: 100 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("type");
  });
  it("rejects oversize files", () => {
    const r = validateMediaFile({ name: "big.jpg", type: "image/jpeg", size: MAX_MEDIA_FILE_BYTES + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("size");
  });
  it("rejects empty files", () => {
    const r = validateMediaFile({ name: "a.jpg", type: "image/jpeg", size: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("empty");
  });
});

describe("partitionMediaFiles", () => {
  it("splits accepted and rejected files preserving reasons", () => {
    const { accepted, rejected } = partitionMediaFiles([
      { name: "ok.jpg", type: "image/jpeg", size: 1000 },
      { name: "bad.pdf", type: "application/pdf", size: 1000 },
      { name: "huge.png", type: "image/png", size: MAX_MEDIA_FILE_BYTES + 10 },
    ]);
    expect(accepted.map((f) => f.name)).toEqual(["ok.jpg"]);
    expect(rejected.map((r) => r.file.name)).toEqual(["bad.pdf", "huge.png"]);
  });
});

describe("dedupeAgainstExisting", () => {
  it("filters URLs already present and collapses duplicates in the incoming batch", () => {
    const { toAdd, duplicates } = dedupeAgainstExisting(
      ["https://x/a.jpg"],
      [
        { url: "https://x/a.jpg", name: "a.jpg" }, // already present
        { url: "https://x/b.jpg", name: "b.jpg" }, // new
        { url: "https://x/b.jpg", name: "b-copy.jpg" }, // dup within batch
      ],
    );
    expect(toAdd.map((i) => i.url)).toEqual(["https://x/b.jpg"]);
    expect(duplicates).toEqual(["a.jpg", "b-copy.jpg"]);
  });
});

// End-to-end order-preservation check for the "remove + add + reorder" flow.
// Uses the same core the server calls, so a green test here proves the
// storefront (which reads products.image_url + gallery_urls) will render in
// exactly the order the reseller arranged in the dialog.
describe("add-my-site media flow → storefront order", () => {
  it("remove one, add a new upload, reorder → server insert matches dialog order", async () => {
    const { runCopyResellerProduct } = await import("./reseller-copy-core");
    const { createSupabaseHarness, userClientWithRole } = await import("@/test/supabase-harness");

    const SUPPLIER_A = "https://cdn.example.com/supplier-a.jpg";
    const SUPPLIER_B = "https://cdn.example.com/supplier-b.jpg";
    const SUPPLIER_C = "https://cdn.example.com/supplier-c.jpg";
    const NEW_UPLOAD = "https://cdn.mystore.com/uploaded.jpg";

    const source = {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Phone",
      description: null,
      image: null,
      image_url: SUPPLIER_A,
      gallery_urls: [SUPPLIER_B, SUPPLIER_C],
      price: 100,
      reseller_price: 120,
      category: "Phones",
      original_product_id: "22222222-2222-2222-2222-222222222222",
    };
    const original = {
      category_id: null,
      warranty: null, product_serial: null, sku: null, brand: null,
      condition: "new", short_description: null,
      image_url: SUPPLIER_A, video_url: null,
      gallery_urls: [SUPPLIER_B, SUPPLIER_C],
    };

    const { client: admin, inserts } = createSupabaseHarness({
      reseller_products: { maybeSingle: { data: source, error: null } },
      stores: { maybeSingle: { data: { id: "store-1" }, error: null } },
      product_categories: { maybeSingle: { data: { id: "cccccccc-cccc-cccc-cccc-cccccccccccc" }, error: null } },
      products: [
        { maybeSingle: { data: original, error: null } },
        { maybeSingle: { data: null, error: null } },
        { maybeSingle: { data: null, error: null } },
        { single: { data: { id: "new-product-id" }, error: null } },
      ],
      reseller_marketplace_audit_logs: {},
    });

    // Dialog state after the reseller: removed SUPPLIER_B, added NEW_UPLOAD,
    // dragged NEW_UPLOAD to the top so it becomes the primary image.
    const dialogOrder = [NEW_UPLOAD, SUPPLIER_A, SUPPLIER_C];

    await runCopyResellerProduct(
      {
        reseller_product_id: source.id,
        category_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        custom_price: 150,
        selected_media: dialogOrder,
      },
      {
        userSupabase: userClientWithRole("reseller") as never,
        adminSupabase: admin as never,
        userId: "reseller-user",
      },
    );

    const insert = inserts.find((i) => i.table === "products")!;
    // Primary image is what the storefront renders on the product card / PDP hero.
    expect(insert.payload.image_url).toBe(NEW_UPLOAD);
    // Gallery preserves dialog order for the remaining images.
    expect(insert.payload.gallery_urls).toEqual([SUPPLIER_A, SUPPLIER_C]);
    // Removed image is fully absent from the persisted product.
    expect(JSON.stringify(insert.payload)).not.toContain(SUPPLIER_B);
  });
});
