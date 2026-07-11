/**
 * Step 5 hostname sanitizer — Playwright behavior test.
 *
 * The admin Platform Domain Setup route is auth-gated, so we can't hit its
 * live DOM from an anonymous session. Instead, this spec renders the pure
 * sanitizer logic in a real browser via a data-URL page and exercises the
 * exact behavior the UI relies on:
 *
 *   - `*.easystorebd.com` → auto-strips to `easystorebd.com`, Continue-equiv
 *     button becomes enabled, stripped notice is announced (role="status").
 *   - `foo.*.easystorebd.com` → stray `*` mid-hostname keeps the button
 *     disabled and shows an inline `role="alert"` in Bangla.
 *   - Clean apex passes through with no notice, button enabled.
 *
 * Run:
 *   node tests/e2e/hostname-sanitizer.spec.mjs
 *
 * Requires Playwright's bundled Chromium (pre-installed in the sandbox).
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Read the pure logic file and inline it into the harness so we test the
// same code path the React component imports.
const logicSrc = readFileSync(
  resolve(__dirname, "../../src/lib/platform-domain-setup-logic.ts"),
  "utf8",
);

// Strip TS `type`/`export type`/type annotations for browser eval.
const jsLogic = logicSrc
  .replace(/export type [\s\S]*?};?\n/g, "")
  .replace(/: [A-Za-z<>\[\]|"'.\s,{}?]+(?= =| \)|,|\))/g, "")
  .replace(/\bas const\b/g, "")
  .replace(/export /g, "");

const html = `<!doctype html>
<html lang="bn"><body>
<input id="host" aria-label="Lovable-এর জন্য hostname লিখুন" />
<div id="live" aria-live="polite" aria-atomic="true"></div>
<button id="continue" disabled>Continue</button>
<script>
${jsLogic}
const inp = document.getElementById('host');
const live = document.getElementById('live');
const btn = document.getElementById('continue');
inp.addEventListener('input', () => {
  const r = sanitizeLovableHostname(inp.value);
  btn.disabled = !r.isValid;
  live.innerHTML = '';
  if (r.hasInvalidWildcard) {
    const p = document.createElement('p');
    p.setAttribute('role', 'alert');
    p.id = 'hostname-error';
    p.textContent = 'ত্রুটি: ' + r.message + ' — Continue বাটন নিষ্ক্রিয় থাকবে।';
    live.appendChild(p);
  } else if (r.stripped) {
    const p = document.createElement('p');
    p.setAttribute('role', 'status');
    p.id = 'hostname-stripped';
    p.textContent = r.message + ' এখন Continue বাটন আবার সক্রিয় হবে।';
    live.appendChild(p);
  }
  window.__sanitized = r.sanitized;
});
</script>
</body></html>`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.setContent(html);

  // 1. Wildcard paste auto-strips and re-enables Continue.
  await page.fill("#host", "*.easystorebd.com");
  const sanitized1 = await page.evaluate(() => window.__sanitized);
  assert.equal(sanitized1, "easystorebd.com", "wildcard should be stripped");
  assert.equal(await page.locator("#continue").isDisabled(), false, "Continue should re-enable after auto-strip");
  const status = await page.locator('[role="status"]').textContent();
  assert.ok(status && /Continue বাটন আবার সক্রিয়/.test(status), "stripped notice should be in Bangla");
  console.log("✓ *.easystorebd.com → auto-strip, Continue enabled, Bangla status");

  // 2. Stray * mid-hostname stays invalid, Bangla alert shown.
  await page.fill("#host", "foo.*.easystorebd.com");
  assert.equal(await page.locator("#continue").isDisabled(), true, "Continue must stay disabled");
  const alert = await page.locator('[role="alert"]').textContent();
  assert.ok(alert && /Continue disable/.test(alert), "alert should mention Continue disable in Bangla");
  console.log("✓ foo.*.easystorebd.com → Continue disabled, Bangla alert");

  // 3. Clean apex passes without any live-region message.
  await page.fill("#host", "easystorebd.com");
  assert.equal(await page.locator("#continue").isDisabled(), false);
  assert.equal(await page.locator("#live").innerHTML(), "", "clean apex should not announce");
  console.log("✓ easystorebd.com → Continue enabled, no announcement");

  await browser.close();
  console.log("\nAll hostname sanitizer e2e tests passed.");
}

main().catch((err) => {
  console.error("Hostname sanitizer test failed:", err);
  process.exit(1);
});
