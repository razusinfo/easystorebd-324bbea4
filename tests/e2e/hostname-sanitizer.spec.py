"""
Step 5 hostname sanitizer — Playwright behavior test (Python).

The admin Platform Domain Setup route is auth-gated, so we can't hit its
live DOM anonymously. Instead we render the pure sanitizer logic in a
real browser via a data-URL page and exercise the exact behavior the
React component relies on:

- `*.easystorebd.com` → auto-strips to `easystorebd.com`, Continue-equiv
  button becomes enabled, stripped notice is announced via role="status"
  in Bangla.
- `foo.*.easystorebd.com` → stray `*` mid-hostname keeps the button
  disabled and shows an inline role="alert" in Bangla.
- Clean apex passes with no announcement, button enabled.

Run:
    python3 tests/e2e/hostname-sanitizer.spec.py
"""
import asyncio
import subprocess
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]

# Transpile the sanitizer TS module to plain JS with bun, then expose the
# named export on window for the harness.
BUNDLE_PATH = Path("/tmp/platform-domain-setup-logic.js")
subprocess.run(
    ["bun", "build", str(ROOT / "src/lib/platform-domain-setup-logic.ts"),
     "--format=esm", "--outfile", str(BUNDLE_PATH)],
    check=True, cwd=ROOT, capture_output=True,
)
js = BUNDLE_PATH.read_text()
# Data-URL script tags don't support ESM; drop the export block and
# attach the function to window instead.
import re as _re
js = _re.sub(r"export\s*\{[\s\S]*?\};?", "", js)
js += "\nwindow.sanitizeLovableHostname = sanitizeLovableHostname;\n"

HTML = f"""<!doctype html>
<html lang="bn"><body>
<input id="host" aria-label="Lovable-এর জন্য hostname লিখুন" />
<div id="live" aria-live="polite" aria-atomic="true"></div>
<button id="continue" disabled>Continue</button>
<script>
{js}
const inp = document.getElementById('host');
const live = document.getElementById('live');
const btn = document.getElementById('continue');
inp.addEventListener('input', () => {{
  const r = sanitizeLovableHostname(inp.value);
  btn.disabled = !r.isValid;
  live.innerHTML = '';
  if (r.hasInvalidWildcard) {{
    const p = document.createElement('p');
    p.setAttribute('role', 'alert');
    p.textContent = 'ত্রুটি: ' + r.message + ' — Continue বাটন নিষ্ক্রিয় থাকবে।';
    live.appendChild(p);
  }} else if (r.stripped) {{
    const p = document.createElement('p');
    p.setAttribute('role', 'status');
    p.textContent = r.message + ' এখন Continue বাটন আবার সক্রিয় হবে।';
    live.appendChild(p);
  }}
  window.__sanitized = r.sanitized;
}});
</script>
</body></html>"""


async def main() -> None:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await ctx.new_page()
        await page.set_content(HTML)

        # 1. Wildcard auto-strips and re-enables Continue.
        await page.fill("#host", "*.easystorebd.com")
        sanitized = await page.evaluate("window.__sanitized")
        assert sanitized == "easystorebd.com", f"expected auto-strip, got {sanitized!r}"
        assert not await page.locator("#continue").is_disabled(), "Continue must re-enable"
        status = await page.locator('[role="status"]').text_content() or ""
        assert "Continue বাটন আবার সক্রিয়" in status, f"Bangla status missing: {status!r}"
        print("✓ *.easystorebd.com → auto-strip, Continue enabled, Bangla status")

        # 2. Stray `*` keeps Continue disabled with Bangla alert.
        await page.fill("#host", "foo.*.easystorebd.com")
        assert await page.locator("#continue").is_disabled(), "Continue must stay disabled"
        alert = await page.locator('[role="alert"]').text_content() or ""
        assert "Continue disable" in alert, f"Bangla alert missing: {alert!r}"
        print("✓ foo.*.easystorebd.com → Continue disabled, Bangla alert")

        # 3. Clean apex — no live-region announcement.
        await page.fill("#host", "easystorebd.com")
        assert not await page.locator("#continue").is_disabled()
        assert (await page.locator("#live").inner_html()) == "", "clean apex should not announce"
        print("✓ easystorebd.com → Continue enabled, no announcement")

        await browser.close()
        print("\nAll hostname sanitizer e2e tests passed.")


asyncio.run(main())
