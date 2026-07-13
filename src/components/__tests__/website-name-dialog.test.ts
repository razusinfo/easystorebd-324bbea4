import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ insert: (...a: any[]) => insertMock(...a) }),
    rpc: (...a: any[]) => rpcMock(...a),
  },
}));

vi.mock("@/lib/eazystore-data", () => ({
  buildStorefrontUrl: (s: string) => `https://${s}.easystorebd.com`,
  slugifyStoreName: (s: string) => s,
  usePublishStore: () => ({}),
  useChangeSlug: () => ({}),
}));

import { notifyAdmin } from "../website-name-dialog";

const store: any = { id: "store-1", name: "Test Shop", slug: "testshop" };

describe("notifyAdmin — admin Website Requests feed", () => {
  beforeEach(() => {
    insertMock.mockReset();
    rpcMock.mockReset();
  });

  it("writes via direct insert when RLS allows it", async () => {
    insertMock.mockResolvedValue({ error: null });
    const res = await notifyAdmin("created", store, "testshop");
    expect(res).toEqual({ ok: true, via: "insert" });
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("falls back to SECURITY DEFINER RPC when RLS blocks the insert", async () => {
    insertMock.mockResolvedValue({ error: { code: "42501", message: "RLS" } });
    rpcMock.mockResolvedValue({ error: null });
    const res = await notifyAdmin("changed", store, "testshop");
    expect(res).toEqual({ ok: true, via: "rpc" });
    expect(insertMock).toHaveBeenCalledTimes(1); // no retry on hard RLS
    expect(rpcMock).toHaveBeenCalledWith("record_reseller_site_event", {
      _kind: "changed", _store_id: "store-1", _slug: "testshop",
    });
  });

  it("retries transient errors then succeeds via RPC", async () => {
    insertMock.mockResolvedValue({ error: { code: "500", message: "boom" } });
    rpcMock.mockResolvedValue({ error: null });
    const res = await notifyAdmin("created", store, "testshop");
    expect(insertMock).toHaveBeenCalledTimes(3);
    expect(res.ok).toBe(true);
    expect(res.via).toBe("rpc");
  });

  it("reports failure when both paths fail", async () => {
    insertMock.mockResolvedValue({ error: { code: "42501", message: "RLS" } });
    rpcMock.mockResolvedValue({ error: { message: "nope" } });
    const res = await notifyAdmin("created", store, "testshop");
    expect(res.ok).toBe(false);
    expect(res.via).toBe("none");
  });
});
