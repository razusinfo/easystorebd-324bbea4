"""E2E: sidebar 'Orders' sits directly above 'Customers' on desktop and mobile,
appears exactly once, and highlights active on /orders."""
import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright

SHOTS = Path(__file__).parent / "screenshots" / "orders-above-customers"
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
    result = await page.evaluate(
        """() => {
            const orders = Array.from(document.querySelectorAll('a[href="/orders"]'));
            const customers = document.querySelector('a[href="/customers"]');
            let adjacent = null, ordersBefore = null;
            if (orders[0] && customers) {
                const pos = orders[0].compareDocumentPosition(customers);
                ordersBefore = !!(pos & Node.DOCUMENT_POSITION_FOLLOWING);
                // Adjacent = no other sidebar link between them.
                const links = Array.from(document.querySelectorAll('[data-sidebar="menu"] a[href]'));
                const oi = links.indexOf(orders[0]);
                const ci = links.indexOf(customers);
                adjacent = oi !== -1 && ci === oi + 1;
            }
            return {
                ordersCount: orders.length,
                hasCustomers: !!customers,
                ordersBefore,
                adjacent,
            };
        }"""
    )
    assert result["ordersCount"] == 1, f"[{tag}] expected exactly one Orders item: {result}"
    assert result["hasCustomers"], f"[{tag}] Customers link missing: {result}"
    assert result["ordersBefore"], f"[{tag}] Orders must precede Customers: {result}"
    assert result["adjacent"], f"[{tag}] Orders must be directly above Customers: {result}"
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
        await page.goto("http://localhost:8080/orders", wait_until="domcontentloaded")
        link = page.get_by_role("link", name="Orders").first
        await link.wait_for(state="visible", timeout=10_000)
        active = await link.get_attribute("data-active")
        assert active == "true", f"Orders link not active: data-active={active!r}"

        await browser.close()

asyncio.run(main())
