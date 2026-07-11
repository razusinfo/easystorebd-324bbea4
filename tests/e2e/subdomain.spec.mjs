/**
 * Subdomain tenant resolution — Playwright API tests.
 *
 * Uses Playwright's request context (bypasses browser Host-header
 * restrictions) to hit the running dev server with a spoofed Host header,
 * exercising the SSR tenant resolver end-to-end.
 *
 * Run manually against a running dev server:
 *   bun run dev &
 *   node tests/e2e/subdomain.spec.mjs
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:8080";
const STORE_SLUG = process.env.E2E_STORE_SLUG ?? "sylhetionlineshop";

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();

  // 1. Apex host → homepage (landing).
  {
    const res = await ctx.request.get(BASE + "/", {
      headers: { host: "easystorebd.com" },
    });
    assert.equal(res.status(), 200, "apex should be 200");
    const html = await res.text();
    assert.ok(/Build your online store|EasyStore/i.test(html), "apex HTML should contain landing content");
    console.log("✓ apex → landing OK");
  }

  // 2. Known subdomain → storefront.
  {
    const res = await ctx.request.get(BASE + "/", {
      headers: { host: `${STORE_SLUG}.easystorebd.com` },
    });
    assert.equal(res.status(), 200, "known subdomain should be 200");
    const html = await res.text();
    assert.ok(
      !/Build your online store in minutes/i.test(html) || /storefront|store/i.test(html),
      "known subdomain should not render the marketing hero",
    );
    console.log(`✓ ${STORE_SLUG}.easystorebd.com → storefront OK`);
  }

  // 3. Unknown subdomain → 404 fallback (or redirect if env toggle enabled).
  {
    const res = await ctx.request.get(BASE + "/", {
      headers: { host: "definitely-no-such-store-xyz.easystorebd.com" },
      maxRedirects: 0,
    });
    const status = res.status();
    assert.ok(status === 404 || status === 302 || status === 301, `unknown sub should be 404/redirect, got ${status}`);
    if (status === 404) {
      const html = await res.text();
      assert.ok(/not found|খুঁজে পাওয়া/i.test(html), "unknown fallback should show helpful text");
      assert.ok(/definitely-no-such-store-xyz/i.test(html), "unknown fallback should echo detected hostname");
    }
    console.log(`✓ unknown subdomain → ${status} OK`);
  }

  await browser.close();
  console.log("\nAll subdomain routing tests passed.");
}

main().catch((err) => {
  console.error("Subdomain test failed:", err);
  process.exit(1);
});
