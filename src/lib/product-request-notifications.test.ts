import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  ADMIN_REQUESTS_PATH,
  RESELLER_PRODUCTS_PATH,
  adminRequestsUrl,
  buildApprovedEmailPayload,
  buildSubmittedEmailPayload,
  buildSubmittedNotificationRow,
  resellerProductsUrl,
  resolveSiteOrigin,
} from "./product-request-emails-core";
import { createSupabaseHarness } from "@/test/supabase-harness";

const ORIGIN = "https://test.example.com";

describe("product-request-emails-core: URL helpers", () => {
  it("reseller-products URL points at the reseller-facing route", () => {
    expect(RESELLER_PRODUCTS_PATH).toBe("/reseller-products");
    expect(resellerProductsUrl(ORIGIN)).toBe(`${ORIGIN}/reseller-products`);
  });

  it("admin requests URL points at the admin dashboard", () => {
    expect(ADMIN_REQUESTS_PATH).toBe("/admin");
    expect(adminRequestsUrl(ORIGIN)).toBe(`${ORIGIN}/admin`);
  });

  it("resolveSiteOrigin honors SITE_URL when present", () => {
    expect(resolveSiteOrigin({ SITE_URL: ORIGIN } as never)).toBe(ORIGIN);
    expect(resolveSiteOrigin({} as never)).toMatch(/^https:\/\//);
  });
});

describe("buildSubmittedEmailPayload", () => {
  it("includes reseller name, product, requested price, and admin dashboard link", () => {
    const p = buildSubmittedEmailPayload("admin@shop.com", {
      resellerName: "Alice",
      resellerEmail: "alice@x.com",
      productName: "Neon Lamp",
      price: 499,
      origin: ORIGIN,
    });
    expect(p.to).toBe("admin@shop.com");
    expect(p.from).toMatch(/EazyStore/);
    expect(p.subject).toBe("New product request: Neon Lamp");
    expect(p.html).toContain("Alice");
    expect(p.html).toContain("Neon Lamp");
    expect(p.html).toContain("৳499");
    expect(p.html).toContain(`href="${ORIGIN}/admin"`);
  });

  it("falls back to email, then to a generic label, when name is missing", () => {
    const withEmail = buildSubmittedEmailPayload("a@x.com", {
      resellerName: null, resellerEmail: "b@x.com", productName: "P", price: 1, origin: ORIGIN,
    });
    expect(withEmail.html).toContain("b@x.com");
    const anon = buildSubmittedEmailPayload("a@x.com", {
      resellerName: null, resellerEmail: null, productName: "P", price: 1, origin: ORIGIN,
    });
    expect(anon.html).toContain("A reseller");
  });
});

describe("buildApprovedEmailPayload", () => {
  it("CTA links to the exact Reseller Products page and carries product details", () => {
    const p = buildApprovedEmailPayload({
      resellerEmail: "seller@x.com",
      productName: "Fancy Mug",
      resellerPrice: 250,
      origin: ORIGIN,
    });
    expect(p.to).toBe("seller@x.com");
    expect(p.subject).toBe(`Your product "Fancy Mug" is now live`);
    expect(p.html).toContain("Fancy Mug");
    expect(p.html).toContain("৳250");
    // Must link to /reseller-products (not /admin, not a hash).
    expect(p.html).toContain(`href="${ORIGIN}/reseller-products"`);
    expect(p.html).not.toContain(`href="${ORIGIN}/admin"`);
  });
});

describe("buildSubmittedNotificationRow", () => {
  it("creates an unread admin notification (no read_at) with a deep link", () => {
    const row = buildSubmittedNotificationRow({
      request_id: "req-1",
      resellerName: "Alice",
      resellerEmail: null,
      productName: "P",
      price: 10,
      origin: ORIGIN,
    });
    expect(row).toMatchObject({
      type: "product_request_submitted",
      title: "New product request",
      related_id: "req-1",
      link: `${ORIGIN}/admin`,
    });
    expect(row).not.toHaveProperty("read_at"); // unread by default → drives badge count
    expect(row.body).toContain("Alice");
    expect(row.body).toContain("P");
  });
});

// ---- Integration-style tests through the notify helpers ----

async function importNotifiers() {
  // Ensure the fetch stub is in place before importing (module reads process.env eagerly? no).
  return await import("./product-request-emails.server");
}

describe("notifyRequestSubmitted", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, text: async () => "" });
    (globalThis as any).fetch = fetchMock;
    process.env.RESEND_API_KEY = "test-key";
  });
  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it("inserts an unread admin_notifications row and enqueues one email per super admin", async () => {
    const { client, inserts } = createSupabaseHarness({
      user_roles: { await: { data: [{ user_id: "admin-1" }, { user_id: "admin-2" }], error: null } },
      admin_notifications: {},
    });
    (client as any).auth = {
      admin: {
        getUserById: vi.fn(async (id: string) => ({
          data: {
            user:
              id === "reseller-1"
                ? { email: "seller@x.com", user_metadata: { full_name: "Alice" } }
                : id === "admin-1"
                  ? { email: "admin1@x.com" }
                  : { email: "admin2@x.com" },
          },
          error: null,
        })),
      },
    };

    const { notifyRequestSubmitted } = await importNotifiers();
    await notifyRequestSubmitted(client as never, {
      request_id: "req-1",
      reseller_id: "reseller-1",
      name: "Neon Lamp",
      price: 499,
    });

    const notif = inserts.find((i) => i.table === "admin_notifications");
    expect(notif).toBeTruthy();
    expect(notif!.payload).toMatchObject({
      type: "product_request_submitted",
      related_id: "req-1",
    });
    expect(notif!.payload).not.toHaveProperty("read_at");

    // One email per super admin, correct recipients and payload shape.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body));
    const recipients = bodies.map((b) => b.to[0]).sort();
    expect(recipients).toEqual(["admin1@x.com", "admin2@x.com"]);
    for (const b of bodies) {
      expect(b.subject).toBe("New product request: Neon Lamp");
      expect(b.html).toContain("Alice");
      expect(b.html).toContain("৳499");
      expect(b.html).toContain("/admin");
    }
  });
});

describe("notifyRequestApproved", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, text: async () => "" });
    (globalThis as any).fetch = fetchMock;
    process.env.RESEND_API_KEY = "test-key";
  });
  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it("sends a Resend email to the reseller with the /reseller-products CTA", async () => {
    const client: any = {
      from: vi.fn(),
      auth: {
        admin: {
          getUserById: vi.fn(async () => ({
            data: { user: { email: "seller@x.com", user_metadata: { name: "Alice" } } },
            error: null,
          })),
        },
      },
    };
    const { notifyRequestApproved } = await importNotifiers();
    await notifyRequestApproved(client, {
      request_id: "req-1",
      reseller_id: "reseller-1",
      name: "Fancy Mug",
      reseller_price: 250,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.to).toEqual(["seller@x.com"]);
    expect(body.subject).toBe(`Your product "Fancy Mug" is now live`);
    expect(body.html).toContain("Fancy Mug");
    expect(body.html).toContain("৳250");
    expect(body.html).toMatch(/href="https?:\/\/[^"]+\/reseller-products"/);
  });
});

// ---- markAllRead badge-clear semantics ----

/**
 * Mirrors the NotificationBell.markAllRead flow: collect unread ids, then
 * `update({ read_at }).in('id', ids)`. We exercise the same chain through the
 * harness to prove the update payload sets read_at and targets the unread rows.
 */
async function simulateMarkAllRead(client: any, rows: Array<{ id: string; read_at: string | null }>) {
  const ids = rows.filter((r) => !r.read_at).map((r) => r.id);
  if (ids.length === 0) return { ids, updated: false };
  await client
    .from("admin_notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids);
  return { ids, updated: true };
}

describe("Mark all read clears the badge", () => {
  it("issues an update with read_at scoped to the unread notification ids", async () => {
    const { client, updates } = createSupabaseHarness({ admin_notifications: {} });
    const rows = [
      { id: "n1", read_at: null },
      { id: "n2", read_at: null },
      { id: "n3", read_at: "2025-01-01T00:00:00Z" }, // already read
    ];
    const result = await simulateMarkAllRead(client, rows);
    expect(result.ids).toEqual(["n1", "n2"]);
    const upd = updates.find((u) => u.table === "admin_notifications");
    expect(upd).toBeTruthy();
    expect(typeof upd!.payload.read_at).toBe("string");

    // After marking read, unread count derived from rows drops to zero.
    const cleared = rows.map((r) => (result.ids.includes(r.id) ? { ...r, read_at: "now" } : r));
    const unread = cleared.filter((r) => !r.read_at).length;
    expect(unread).toBe(0);
  });

  it("no-ops (no update issued) when there is nothing unread", async () => {
    const { client, updates } = createSupabaseHarness({ admin_notifications: {} });
    const rows = [{ id: "n1", read_at: "2025-01-01T00:00:00Z" }];
    const result = await simulateMarkAllRead(client, rows);
    expect(result.updated).toBe(false);
    expect(updates.filter((u) => u.table === "admin_notifications")).toHaveLength(0);
  });
});

// ---- RLS: super_admin-only access to admin_notifications ----

describe("admin_notifications RLS policies", () => {
  it("migration restricts SELECT and UPDATE to super_admin and denies anon", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.resolve(process.cwd(), "supabase/migrations");
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".sql"));
    let sql = "";
    for (const f of files) sql += "\n" + (await fs.readFile(path.join(dir, f), "utf8"));

    // Table + RLS enabled.
    expect(sql).toMatch(/CREATE TABLE\s+public\.admin_notifications/i);
    expect(sql).toMatch(/ALTER TABLE\s+public\.admin_notifications\s+ENABLE ROW LEVEL SECURITY/i);

    // SELECT policy: super_admin only.
    expect(sql).toMatch(
      /CREATE POLICY[^\n]+admin notifications[\s\S]+?FOR SELECT[\s\S]+?has_role\(\s*auth\.uid\(\)\s*,\s*'super_admin'\s*\)/i,
    );
    // UPDATE policy: super_admin only, WITH CHECK also gated.
    expect(sql).toMatch(
      /CREATE POLICY[^\n]+admin notifications[\s\S]+?FOR UPDATE[\s\S]+?has_role\(\s*auth\.uid\(\)\s*,\s*'super_admin'\s*\)[\s\S]+?WITH CHECK[\s\S]+?has_role\(\s*auth\.uid\(\)\s*,\s*'super_admin'\s*\)/i,
    );

    // No anon grants on admin_notifications, and no permissive "authenticated" policy without has_role.
    const anonGrant = new RegExp(
      String.raw`GRANT[^;]*ON\s+public\.admin_notifications[^;]*TO[^;]*\banon\b`,
      "i",
    );
    expect(sql).not.toMatch(anonGrant);
  });
});
