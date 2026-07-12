"""E2E: 'Reseller Products' appears directly above 'Reseller Requests'
in the sidebar on both desktop and mobile viewports, and both routes
highlight the correct active link."""
import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright

SHOTS = Path(__file__).parent / "screenshots" / "reseller-products-above-requests"
SHOTS.mkdir(parents=True, exist_ok=True)


async def restore_session(context, page):
    if os.environ.get("LOVABLE_BROWSER_AUTH_STATUS") != "injected":
        return False
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
    if cookies_json:
        cookies = json.loads(cookies_json)
        for c in cookies:
            c["url"] = "http://localhost:8080"
        await context.add_cookies(cookies)
    await page.goto("http://localhost:8080")
    key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    sess = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    if key and sess:
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(key)}, {json.dumps(sess)})"
        )
    return True


async def assert_order(page, tag):
    rp = page.get_by_role("link", name="Reseller Products").first
    rr = page.get_by_role("link", name="Reseller Requests").first
    await rp.wait_for(state="visible", timeout=10_000)
    await rr.wait_for(state="visible", timeout=10_000)
    result = await page.evaluate(
        """() => {
            const links = Array.from(document.querySelectorAll('a[href]'));
            const rp = links.find(a => a.textContent.trim().includes('Reseller Products'));
            const rr = links.find(a => a.textContent.trim().includes('Reseller Requests'));
            if (!rp || !rr) return { ok: false, reason: 'missing link' };
            const pos = rp.compareDocumentPosition(rr);
            return { ok: !!(pos & Node.DOCUMENT_POSITION_FOLLOWING) };
        }"""
    )
    assert result.get("ok"), f"[{tag}] Reseller Products must precede Reseller Requests: {result}"
    await page.screenshot(path=str(SHOTS / f"{tag}.png"))


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        if not await restore_session(context, page):
            print("SKIP: no injected Supabase session")
            await browser.close()
            return

        await page.goto("http://localhost:8080/dashboard", wait_until="domcontentloaded")
        await assert_order(page, "desktop")

        await page.set_viewport_size({"width": 390, "height": 900})
        await page.goto("http://localhost:8080/dashboard", wait_until="domcontentloaded")
        trigger = page.get_by_role("button", name="Toggle Sidebar").first
        if await trigger.count():
            await trigger.click()
        await assert_order(page, "mobile")

        await page.set_viewport_size({"width": 1280, "height": 1800})
        for path, label in (("/reseller-products", "Reseller Products"),
                            ("/reseller-requests", "Reseller Requests")):
            await page.goto(f"http://localhost:8080{path}", wait_until="domcontentloaded")
            link = page.get_by_role("link", name=label).first
            await link.wait_for(state="visible", timeout=10_000)
            active = await link.get_attribute("data-active")
            assert active == "true", f"{label} not active on {path}: data-active={active!r}"

        await browser.close()

asyncio.run(main())
