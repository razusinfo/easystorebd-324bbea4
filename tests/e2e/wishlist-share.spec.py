"""
E2E: Wishlist and Share buttons on the reseller storefront product page.

Verifies:
  1. Guest wishlist click → heart fills, aria-pressed flips, toast shown,
     localStorage entry written, no double-toggle race under rapid clicks.
  2. Reload → heart state persists from localStorage.
  3. Share with navigator.share stubbed → invoked with product URL + title,
     success toast/status announced.
  4. Share with navigator.share absent → clipboard fallback receives the URL.

Run with the dev server on http://localhost:8080:
  python3 tests/e2e/wishlist-share.spec.py

Env:
  E2E_STORE_SLUG   default sylhetionlineshop
  E2E_PRODUCT_ID   required — a real product id under that slug
"""
import asyncio
import os
import sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
SLUG = os.environ.get("E2E_STORE_SLUG", "sylhetionlineshop")
PRODUCT_ID = os.environ.get("E2E_PRODUCT_ID")

SHOTS = Path(__file__).parent / "screenshots" / "wishlist-share"
SHOTS.mkdir(parents=True, exist_ok=True)


async def open_product(page):
    if not PRODUCT_ID:
        print("skip: set E2E_PRODUCT_ID to a real product id")
        sys.exit(0)
    await page.goto(f"{BASE}/s/{SLUG}/p/{PRODUCT_ID}", wait_until="domcontentloaded")
    await page.wait_for_selector('[data-testid="wishlist-btn"]', timeout=15_000)


async def wishlist_toggle_and_persist():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()

        # Fresh: no wishlist entry
        await open_product(page)
        pressed = await page.locator('[data-testid="wishlist-btn"]').get_attribute("aria-pressed")
        assert pressed == "false", f"initial aria-pressed should be false, got {pressed}"

        # Rapid double-click — race guard should collapse to a single toggle
        btn = page.locator('[data-testid="wishlist-btn"]')
        await btn.click()
        await btn.click(no_wait_after=True)
        await page.wait_for_function(
            "document.querySelector('[data-testid=\"wishlist-btn\"]').getAttribute('aria-pressed') === 'true'"
        )
        await page.wait_for_function(
            "document.querySelector('[data-testid=\"wishlist-btn\"]').getAttribute('aria-busy') !== 'true'"
        )
        pressed = await btn.get_attribute("aria-pressed")
        assert pressed == "true", f"after click aria-pressed should be true, got {pressed}"

        # aria-live status was populated
        status = await page.locator('[data-testid="wishlist-status"]').text_content()
        assert status and "Wishlist" in status, f"status not announced: {status!r}"

        # localStorage mirrors the state
        stored = await page.evaluate(
            f"JSON.parse(localStorage.getItem('easystore_wishlist:{SLUG}') || '[]')"
        )
        assert PRODUCT_ID in stored, f"localStorage missing product: {stored}"
        await page.screenshot(path=str(SHOTS / "1_wished.png"))

        # Reload → state restored
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="wishlist-btn"]')
        pressed = await page.locator('[data-testid="wishlist-btn"]').get_attribute("aria-pressed")
        assert pressed == "true", f"after reload aria-pressed should still be true, got {pressed}"
        await page.screenshot(path=str(SHOTS / "2_reloaded.png"))

        # Toggle off, verify clears
        await page.locator('[data-testid="wishlist-btn"]').click()
        await page.wait_for_function(
            "document.querySelector('[data-testid=\"wishlist-btn\"]').getAttribute('aria-pressed') === 'false'"
        )
        stored = await page.evaluate(
            f"JSON.parse(localStorage.getItem('easystore_wishlist:{SLUG}') || '[]')"
        )
        assert PRODUCT_ID not in stored, f"localStorage still has product: {stored}"

        await browser.close()
        print("PASS: wishlist toggle + persist + race guard")


async def share_native_and_clipboard():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)

        # (a) navigator.share present → invoked
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        await ctx.add_init_script(
            """
            window.__sharedWith = null;
            navigator.share = async (data) => { window.__sharedWith = data; };
            """
        )
        page = await ctx.new_page()
        await open_product(page)
        await page.locator('[data-testid="share-btn"]').click()
        shared = await page.wait_for_function("window.__sharedWith", timeout=5_000)
        payload = await shared.json_value()
        assert payload and "url" in payload and PRODUCT_ID in payload["url"], (
            f"native share not called with product URL: {payload}"
        )
        await page.screenshot(path=str(SHOTS / "3_share_native.png"))
        await ctx.close()

        # (b) navigator.share absent → clipboard fallback
        ctx = await browser.new_context(
            viewport={"width": 1280, "height": 1800},
            permissions=["clipboard-read", "clipboard-write"],
        )
        await ctx.add_init_script("delete navigator.share;")
        page = await ctx.new_page()
        await open_product(page)
        await page.locator('[data-testid="share-btn"]').click()
        # Status region announces success
        await page.wait_for_function(
            "document.querySelector('[data-testid=\"wishlist-status\"]').textContent.includes('কপি')",
            timeout=5_000,
        )
        clip = await page.evaluate("navigator.clipboard.readText()")
        assert PRODUCT_ID in clip, f"clipboard did not receive product URL: {clip!r}"
        await page.screenshot(path=str(SHOTS / "4_share_clipboard.png"))
        await ctx.close()

        await browser.close()
        print("PASS: share native + clipboard fallback")


async def main():
    await wishlist_toggle_and_persist()
    await share_native_and_clipboard()


if __name__ == "__main__":
    asyncio.run(main())
