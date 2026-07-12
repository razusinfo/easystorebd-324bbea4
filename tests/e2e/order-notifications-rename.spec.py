"""E2E: sidebar shows 'Order Notifications' (not bare 'Notifications')
on desktop and mobile, and the link highlights active on its route."""
import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright

SHOTS = Path(__file__).parent / "screenshots" / "order-notifications-rename"
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


async def assert_label(page, tag):
    result = await page.evaluate(
        """() => {
            const links = Array.from(document.querySelectorAll('a[href="/my-notifications"]'));
            const texts = links.map(a => a.textContent.trim());
            const orderLink = links.find(a => a.textContent.trim().includes('Order Notifications'));
            const suppliersLink = document.querySelector('a[href="/order-management"]');
            let orderBelow = null;
            if (orderLink && suppliersLink) {
                const pos = suppliersLink.compareDocumentPosition(orderLink);
                orderBelow = !!(pos & Node.DOCUMENT_POSITION_FOLLOWING);
            }
            return {
                hasOrder: texts.some(t => t.includes('Order Notifications')),
                hasBare: texts.some(t => t === 'Notifications'),
                orderBelow,
                hasSuppliers: !!suppliersLink,
            };
        }"""
    )
    assert result["hasOrder"], f"[{tag}] expected 'Order Notifications' link: {result}"
    assert not result["hasBare"], f"[{tag}] bare 'Notifications' label still present: {result}"
    if result["hasSuppliers"]:
        assert result["orderBelow"], f"[{tag}] 'Order Notifications' must render below 'Order For Suppliers': {result}"
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
        await assert_label(page, "desktop")

        await page.set_viewport_size({"width": 390, "height": 900})
        await page.goto("http://localhost:8080/dashboard", wait_until="domcontentloaded")
        trigger = page.get_by_role("button", name="Toggle Sidebar").first
        if await trigger.count():
            await trigger.click()
        await assert_label(page, "mobile")

        await page.set_viewport_size({"width": 1280, "height": 1800})
        await page.goto("http://localhost:8080/my-notifications", wait_until="domcontentloaded")
        link = page.get_by_role("link", name="Order Notifications").first
        await link.wait_for(state="visible", timeout=10_000)
        active = await link.get_attribute("data-active")
        assert active == "true", f"link not active: data-active={active!r}"

        await browser.close()

asyncio.run(main())
