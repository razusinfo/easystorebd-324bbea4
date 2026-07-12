import { describe, it, expect } from "vitest";
import { probeHttps, buildProbeHint } from "./custom-domains.functions";

function mockFetch(
  responses: Array<{ status: number; body?: string; location?: string }>,
) {
  let i = 0;
  return (async (_url: string) => {
    const r = responses[Math.min(i++, responses.length - 1)];
    const headers = new Map<string, string>();
    if (r.location) headers.set("location", r.location);
    return {
      status: r.status,
      headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
      async text() { return r.body ?? ""; },
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

describe("probeHttps", () => {
  it("flags Cloudflare Error 1000 body and produces the DNS-only hint", async () => {
    const probe = await probeHttps("slug.easystorebd.com", {
      fetchImpl: mockFetch([
        { status: 409, body: "<html>Error 1000<br>DNS points to prohibited IP</html>" },
      ]),
    });
    expect(probe.ok).toBe(false);
    expect(probe.cloudflareError).toBe(1000);
    const hint = buildProbeHint(probe);
    expect(hint).toMatch(/Error 1000/);
    expect(hint).toMatch(/DNS only/);
    expect(hint).toMatch(/grey cloud/);
  });

  it("rejects 403 responses (Lovable host-not-attached) with the Connect-domain hint", async () => {
    const probe = await probeHttps("slug.easystorebd.com", {
      fetchImpl: mockFetch([{ status: 403, body: "forbidden" }]),
    });
    expect(probe.ok).toBe(false);
    expect(probe.status).toBe(403);
    expect(probe.cloudflareError).toBeUndefined();
    const hint = buildProbeHint(probe);
    expect(hint).toMatch(/HTTP 403/);
    expect(hint).toMatch(/Connect domain/);
  });

  it("follows redirects and validates the final body for app markers", async () => {
    const probe = await probeHttps("slug.easystorebd.com", {
      fetchImpl: mockFetch([
        { status: 301, location: "https://slug.easystorebd.com/store" },
        { status: 200, body: '<div id="root">EasyStore</div>' },
      ]),
    });
    expect(probe.ok).toBe(true);
    expect(probe.servedByApp).toBe(true);
    expect(probe.redirectChain?.length).toBe(2);
    expect(probe.finalUrl).toBe("https://slug.easystorebd.com/store");
  });

  it("returns ok:false when 200 body lacks app markers", async () => {
    const probe = await probeHttps("slug.easystorebd.com", {
      fetchImpl: mockFetch([{ status: 200, body: "<html>parked</html>" }]),
    });
    expect(probe.ok).toBe(false);
    expect(probe.servedByApp).toBe(false);
  });
});

describe("buildProbeHint", () => {
  it("returns null for successful probes", () => {
    expect(buildProbeHint({ ok: true, status: 200 })).toBeNull();
  });
  it("500s ask the user to retry later", () => {
    expect(buildProbeHint({ ok: false, status: 503 })).toMatch(/কিছুক্ষণ পর/);
  });
});
