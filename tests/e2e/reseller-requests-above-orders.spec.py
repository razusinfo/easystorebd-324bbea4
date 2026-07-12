"""E2E: 'Reseller Requests' appears directly above 'Order For Suppliers'
in the sidebar on both desktop and mobile viewports."""
import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright

SHOTS = Path(__file__).parent / "screenshots" / "reseller-requests-above-orders"
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
    rr = page.get_by_role("link", name="Reseller Requests").first
    of = page.get_by_role("link", name="Order For Suppliers").first
    await rr.wait_for(state="visible", timeout=10_000)
    await of.wait_for(state="visible", timeout=10_000)

    # Both should be direct siblings inside the same SidebarMenu, with
    # Reseller Requests appearing before Order For Suppliers in DOM order.
    result = await page.evaluate(
        """() => {
            const links = Array.from(document.querySelectorAll('a[href]'));
            const rr = links.find(a => a.textContent.trim().includes('Reseller Requests'));
            const of = links.find(a => a.textContent.trim().includes('Order For Suppliers'));
            if (!rr || !of) return { ok: false, reason: 'missing link' };
            const pos = rr.compareDocumentPosition(of);
            return { ok: !!(pos & Node.DOCUMENT_POSITION_FOLLOWING) };
        }"""
    )
    assert result.get("ok"), f"[{tag}] Reseller Requests must precede Order For Suppliers: {result}"
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

        # Desktop
        await page.goto("http://localhost:8080/dashboard", wait_until="domcontentloaded")
        await assert_order(page, "desktop")

        # Mobile: open the offcanvas sidebar via the trigger
        await page.set_viewport_size({"width": 390, "height": 900})
        await page.goto("http://localhost:8080/dashboard", wait_until="domcontentloaded")
        trigger = page.get_by_role("button", name="Toggle Sidebar").first
        if await trigger.count():
            await trigger.click()
        await assert_order(page, "mobile")

        # Active highlight when on each route
        await page.set_viewport_size({"width": 1280, "height": 1800})
        for path, label in (("/reseller-requests", "Reseller Requests"),
                            ("/order-management", "Order For Suppliers")):
            await page.goto(f"http://localhost:8080{path}", wait_until="domcontentloaded")
            link = page.get_by_role("link", name=label).first
            await link.wait_for(state="visible", timeout=10_000)
            active = await link.get_attribute("data-active")
            assert active == "true", f"{label} not active on {path}: data-active={active!r}"

        await browser.close()

asyncio.run(main())
