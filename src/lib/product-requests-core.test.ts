import { describe, it, expect } from "vitest";

import { createSupabaseHarness } from "@/test/supabase-harness";
import {
  runSubmitProductRequest,
  runApproveProductRequest,
  runRejectProductRequest,
} from "./product-requests-core";
import { productRequestInputSchema } from "./product-requests.functions";

describe("productRequestInputSchema", () => {
  it("rejects empty name", () => {
    const r = productRequestInputSchema.safeParse({ name: "", price: 100, images: [] });
    expect(r.success).toBe(false);
  });
  it("rejects negative price", () => {
    const r = productRequestInputSchema.safeParse({ name: "OK", price: -1, images: [] });
    expect(r.success).toBe(false);
  });
  it("rejects too many images", () => {
    const urls = Array.from({ length: 9 }, (_, i) => `https://x.com/${i}.jpg`);
    const r = productRequestInputSchema.safeParse({ name: "OK", price: 1, images: urls });
    expect(r.success).toBe(false);
  });
  it("rejects non-URL image entries", () => {
    const r = productRequestInputSchema.safeParse({
      name: "OK", price: 1, images: ["not-a-url"],
    });
    expect(r.success).toBe(false);
  });
  it("accepts a valid request", () => {
    const r = productRequestInputSchema.safeParse({
      name: "Blender", description: "5-speed", price: 1500,
      images: ["https://x.com/1.jpg"],
    });
    expect(r.success).toBe(true);
  });
});

describe("runSubmitProductRequest", () => {
  it("inserts request and writes success audit with metadata", async () => {
    const h = createSupabaseHarness({
      product_requests: { single: { data: { id: "req-1" }, error: null } },
      reseller_marketplace_audit_logs: { insertOk: true },
    });
    const res = await runSubmitProductRequest(
      { name: "Blender", description: "5-speed", price: 1500, images: ["https://x.com/1.jpg"] },
      { admin: h.client, userId: "u-1", actorRole: "reseller", isAdmin: false },
    );
    expect(res).toEqual({ ok: true, id: "req-1" });
    expect(h.audits).toHaveLength(1);
    expect(h.audits[0]).toMatchObject({
      action: "submit_product_request",
      product_id: "req-1",
      success: true,
      metadata: { name: "Blender", price: 1500, image_count: 1 },
    });
  });
});

describe("runApproveProductRequest", () => {
  const req = {
    id: "req-1",
    requested_by: "u-reseller",
    name: "Blender",
    description: "5-speed",
    price: 1500,
    images: ["https://x.com/1.jpg"],
    status: "pending",
  };

  it("publishes to reseller_products and logs full metadata", async () => {
    const h = createSupabaseHarness({
      product_requests: [
        { maybeSingle: { data: req, error: null } },
        { await: { data: null, error: null } }, // update
      ],
      reseller_products: { single: { data: { id: "rp-9" }, error: null } },
      reseller_marketplace_audit_logs: { insertOk: true },
    });

    const res = await runApproveProductRequest(
      { request_id: "req-1", reseller_price: 1800, admin_notes: "ok" },
      { admin: h.client, userId: "u-admin", actorRole: "super_admin", isAdmin: true },
    );
    expect(res).toEqual({ ok: true, reseller_product_id: "rp-9" });

    const rpInsert = h.inserts.find((i) => i.table === "reseller_products");
    expect(rpInsert?.payload).toMatchObject({
      external_id: "req-req-1",
      name: "Blender",
      price: 1500,
      reseller_price: 1800,
      source: "request",
      image_url: "https://x.com/1.jpg",
    });

    const upd = h.updates.find((u) => u.table === "product_requests");
    expect(upd?.payload).toMatchObject({
      status: "approved",
      reseller_price: 1800,
      admin_notes: "ok",
      reviewed_by: "u-admin",
      published_reseller_product_id: "rp-9",
    });

    expect(h.audits[0]).toMatchObject({
      action: "approve_product_request",
      success: true,
      metadata: {
        approver: "u-admin",
        requested_by: "u-reseller",
        reseller_price: 1800,
        base_price: 1500,
        image_count: 1,
        published_reseller_product_id: "rp-9",
      },
    });
  });

  it("blocks non-admin with forbidden + audit", async () => {
    const h = createSupabaseHarness({
      reseller_marketplace_audit_logs: { insertOk: true },
    });
    const res = await runApproveProductRequest(
      { request_id: "req-1", reseller_price: 1800 },
      { admin: h.client, userId: "u-reseller", actorRole: "reseller", isAdmin: false },
    );
    expect(res).toEqual({ forbidden: true });
    expect(h.audits[0]).toMatchObject({
      action: "approve_product_request",
      success: false,
      error: "forbidden",
    });
  });
});

describe("runRejectProductRequest", () => {
  it("marks request rejected with admin note + audit", async () => {
    const h = createSupabaseHarness({
      product_requests: [
        { maybeSingle: { data: { id: "req-1", requested_by: "u-r", name: "X", status: "pending" }, error: null } },
        { await: { data: null, error: null } },
      ],
      reseller_marketplace_audit_logs: { insertOk: true },
    });
    const res = await runRejectProductRequest(
      { request_id: "req-1", admin_notes: "not a fit" },
      { admin: h.client, userId: "u-admin", actorRole: "super_admin", isAdmin: true },
    );
    expect(res).toEqual({ ok: true });
    const upd = h.updates.find((u) => u.table === "product_requests");
    expect(upd?.payload).toMatchObject({ status: "rejected", admin_notes: "not a fit", reviewed_by: "u-admin" });
    expect(h.audits[0]).toMatchObject({
      action: "reject_product_request",
      success: true,
      metadata: { approver: "u-admin", requested_by: "u-r", admin_notes: "not a fit" },
    });
  });

  it("blocks non-admin with forbidden", async () => {
    const h = createSupabaseHarness({
      reseller_marketplace_audit_logs: { insertOk: true },
    });
    const res = await runRejectProductRequest(
      { request_id: "req-1", admin_notes: "no" },
      { admin: h.client, userId: "u-x", actorRole: "reseller", isAdmin: false },
    );
    expect(res).toEqual({ forbidden: true });
    expect(h.audits[0]).toMatchObject({ success: false, error: "forbidden" });
  });
});
