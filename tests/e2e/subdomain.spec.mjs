/**
 * Subdomain tenant routing — E2E tests via HTTP with spoofed Host header.
 *
 * Node's fetch (undici) overrides the Host header, and browsers strip it
 * for security. This test uses the raw http module, which honors it.
 *
 * Run:
 *   bun run dev &                            # start on http://localhost:8080
 *   node tests/e2e/subdomain.spec.mjs
 *
 * Env:
 *   E2E_HOST           default localhost
 *   E2E_PORT           default 8080
 *   E2E_STORE_SLUG     a published store slug (default sylhetionlineshop)
 */
import assert from "node:assert/strict";
import http from "node:http";

const HOST = process.env.E2E_HOST ?? "localhost";
const PORT = Number(process.env.E2E_PORT ?? "8080");
const STORE_SLUG = process.env.E2E_STORE_SLUG ?? "sylhetionlineshop";

/** Raw GET with a spoofed Host header. */
function get(hostHeader) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: HOST, port: PORT, path: "/", method: "GET", headers: { host: hostHeader } },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  // 1. Apex host → homepage.
  {
    const res = await get("easystorebd.com");
    assert.equal(res.status, 200, `apex should be 200, got ${res.status}`);
    assert.ok(/EasyStore/i.test(res.body), "apex HTML should contain EasyStore branding");
    console.log("✓ easystorebd.com → landing (200)");
  }

  // 2. Known subdomain → storefront.
  {
    const res = await get(`${STORE_SLUG}.easystorebd.com`);
    assert.equal(res.status, 200, `known subdomain should be 200, got ${res.status}`);
    assert.ok(
      !/Build your online store in minutes/i.test(res.body),
      "known subdomain must not render the marketing hero",
    );
    console.log(`✓ ${STORE_SLUG}.easystorebd.com → storefront (200)`);
  }

  // 3. Unknown subdomain → 404 fallback (or 3xx redirect if env toggle enabled).
  {
    const res = await get("definitely-no-such-store-xyz.easystorebd.com");
    assert.ok(
      [404, 301, 302, 307, 308].includes(res.status),
      `unknown sub should be 404 or a redirect, got ${res.status}`,
    );
    if (res.status === 404) {
      assert.ok(/not found|খুঁজে পাওয়া/i.test(res.body), "fallback should show helpful copy");
      assert.ok(
        /definitely-no-such-store-xyz/i.test(res.body),
        "fallback should echo the detected hostname",
      );
    }
    console.log(`✓ unknown subdomain → ${res.status}`);
  }

  console.log("\nAll subdomain routing tests passed.");
}

main().catch((err) => {
  console.error("Subdomain test failed:", err);
  process.exit(1);
});
