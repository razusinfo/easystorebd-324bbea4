/**
 * Subdomain tenant routing — E2E tests via HTTP with spoofed Host header.
 *
 * Chromium and other browsers strip the Host header for security, so
 * subdomain resolution must be exercised at the HTTP layer. This script
 * uses Node's built-in fetch, which permits an explicit Host header.
 *
 * Run:
 *   bun run dev &        # start the app on http://localhost:8080
 *   node tests/e2e/subdomain.spec.mjs
 *
 * Env:
 *   E2E_BASE_URL       default http://localhost:8080
 *   E2E_STORE_SLUG     a published store slug (default: sylhetionlineshop)
 */
import assert from "node:assert/strict";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:8080";
const STORE_SLUG = process.env.E2E_STORE_SLUG ?? "sylhetionlineshop";

async function req(host) {
  return fetch(BASE + "/", { headers: { host }, redirect: "manual" });
}

async function main() {
  // 1. Apex host → homepage (landing).
  {
    const res = await req("easystorebd.com");
    assert.equal(res.status, 200, `apex should be 200, got ${res.status}`);
    const html = await res.text();
    assert.ok(/EasyStore/i.test(html), "apex HTML should contain EasyStore branding");
    console.log("✓ easystorebd.com → landing (200)");
  }

  // 2. Known subdomain → storefront.
  {
    const res = await req(`${STORE_SLUG}.easystorebd.com`);
    assert.equal(res.status, 200, `known subdomain should be 200, got ${res.status}`);
    const html = await res.text();
    assert.ok(!/Build your online store in minutes/i.test(html), "known subdomain must not render the marketing hero");
    console.log(`✓ ${STORE_SLUG}.easystorebd.com → storefront (200)`);
  }

  // 3. Unknown subdomain → 404 fallback or 301/302 redirect.
  {
    const res = await req("definitely-no-such-store-xyz.easystorebd.com");
    assert.ok(
      [404, 301, 302, 307, 308].includes(res.status),
      `unknown sub should be 404 or a redirect, got ${res.status}`,
    );
    if (res.status === 404) {
      const html = await res.text();
      assert.ok(/not found|খুঁজে পাওয়া/i.test(html), "unknown fallback should show helpful text");
      assert.ok(
        /definitely-no-such-store-xyz/i.test(html),
        "unknown fallback should echo the detected hostname",
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
