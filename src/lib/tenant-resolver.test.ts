import { describe, it, expect, vi, beforeEach } from "vitest";
import { getStorefrontSlugFromHost } from "@/lib/storefront-host";

// Mock supabase client used inside tenant-resolver.server
const stores = new Map<string, { id: string; slug: string; name: string; logo_url: null; tagline: null; published: boolean }>();
const customDomains = new Map<
  string,
  { domain: string; status: string; stores: { id: string; slug: string; name: string; logo_url: null; tagline: null; published: boolean } | null }
>();

vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: () => ({
      from(table: string) {
        const chain: any = {
          _filters: {} as Record<string, any>,
          select() { return chain; },
          eq(col: string, val: any) { chain._filters[col] = val; return chain; },
          async maybeSingle() {
            if (table === "stores") {
              const row = stores.get(chain._filters.slug);
              if (!row || !row.published) return { data: null, error: null };
              return { data: row, error: null };
            }
            if (table === "custom_domains") {
              const row = customDomains.get(chain._filters.domain);
              if (!row || row.status !== "active") return { data: null, error: null };
              return { data: row, error: null };
            }
            return { data: null, error: null };
          },
        };
        return chain;
      },
    }),
  };
});

// Set env before importing SUT
process.env.SUPABASE_URL = "http://localhost";
process.env.SUPABASE_PUBLISHABLE_KEY = "test-key";

// Import after mocks / env setup
const { resolveTenantServer } = await import("@/lib/tenant-resolver.server");

beforeEach(() => {
  stores.clear();
  customDomains.clear();
  stores.set("sylhetionlineshop", {
    id: "s1", slug: "sylhetionlineshop", name: "Sylheti Online Shop",
    logo_url: null, tagline: null, published: true,
  });
  stores.set("draft", {
    id: "s2", slug: "draft", name: "Draft", logo_url: null, tagline: null, published: false,
  });
  customDomains.set("shop.example.com", {
    domain: "shop.example.com",
    status: "active",
    stores: { id: "s1", slug: "sylhetionlineshop", name: "Sylheti Online Shop", logo_url: null, tagline: null, published: true },
  });
});

describe("getStorefrontSlugFromHost", () => {
  it("returns null for apex", () => {
    expect(getStorefrontSlugFromHost("easystorebd.com")).toBeNull();
  });
  it("returns null for www", () => {
    expect(getStorefrontSlugFromHost("www.easystorebd.com")).toBeNull();
  });
  it("parses a subdomain slug", () => {
    expect(getStorefrontSlugFromHost("sylhetionlineshop.easystorebd.com")).toBe("sylhetionlineshop");
  });
  it("ignores reserved subdomains", () => {
    expect(getStorefrontSlugFromHost("admin.easystorebd.com")).toBeNull();
  });
  it("ignores nested subdomains", () => {
    expect(getStorefrontSlugFromHost("a.b.easystorebd.com")).toBeNull();
  });
  it("strips port", () => {
    expect(getStorefrontSlugFromHost("shop.easystorebd.com:8080")).toBe("shop");
  });
  it("returns null for unrelated host", () => {
    expect(getStorefrontSlugFromHost("example.com")).toBeNull();
  });
});

describe("resolveTenantServer", () => {
  it("returns apex for main domain", async () => {
    const r = await resolveTenantServer("easystorebd.com");
    expect(r.kind).toBe("apex");
  });

  it("returns apex for www", async () => {
    const r = await resolveTenantServer("www.easystorebd.com");
    expect(r.kind).toBe("apex");
  });

  it("returns apex when host is missing", async () => {
    const r = await resolveTenantServer(null);
    expect(r.kind).toBe("apex");
  });

  it("resolves a known subdomain to a store", async () => {
    const r = await resolveTenantServer("sylhetionlineshop.easystorebd.com");
    expect(r.kind).toBe("subdomain");
    if (r.kind === "subdomain") {
      expect(r.slug).toBe("sylhetionlineshop");
      expect(r.store.name).toBe("Sylheti Online Shop");
    }
  });

  it("falls back to unknown-sub for missing store", async () => {
    const r = await resolveTenantServer("nope.easystorebd.com");
    expect(r.kind).toBe("unknown-sub");
    if (r.kind === "unknown-sub") expect(r.attempted).toBe("nope");
  });

  it("treats unpublished stores as unknown-sub", async () => {
    const r = await resolveTenantServer("draft.easystorebd.com");
    expect(r.kind).toBe("unknown-sub");
  });

  it("returns apex for reserved subdomains", async () => {
    const r = await resolveTenantServer("admin.easystorebd.com");
    expect(r.kind).toBe("apex");
  });

  it("resolves an active custom domain", async () => {
    const r = await resolveTenantServer("shop.example.com");
    expect(r.kind).toBe("custom");
    if (r.kind === "custom") {
      expect(r.domain).toBe("shop.example.com");
      expect(r.slug).toBe("sylhetionlineshop");
    }
  });

  it("returns unknown-custom for unmapped host", async () => {
    const r = await resolveTenantServer("random.example.org");
    expect(r.kind).toBe("unknown-custom");
    if (r.kind === "unknown-custom") expect(r.host).toBe("random.example.org");
  });

  it("normalizes uppercase + port", async () => {
    const r = await resolveTenantServer("SylhetiOnlineShop.easystorebd.com:443");
    expect(r.kind).toBe("subdomain");
  });

  it("caches repeated lookups", async () => {
    const r1 = await resolveTenantServer("sylhetionlineshop.easystorebd.com");
    // Mutate underlying store; cached result should still be returned.
    stores.delete("sylhetionlineshop");
    const r2 = await resolveTenantServer("sylhetionlineshop.easystorebd.com");
    expect(r2).toEqual(r1);
  });
});
