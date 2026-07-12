"""E2E: sidebar link, document title, and page heading all show
'Order For Suppliers' after the rename from 'Order Management'."""
import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright

SHOTS = Path(__file__).parent / "screenshots" / "order-for-suppliers-rename"
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

        # Sidebar link uses the new label and points at the same route.
        link = page.get_by_role("link", name="Order For Suppliers").first
        await link.wait_for(state="visible", timeout=10_000)
        href = await link.get_attribute("href")
        assert href == "/order-management", f"Unexpected href: {href!r}"

        await link.click()
        await page.wait_for_url("**/order-management", timeout=10_000)
        await page.wait_for_load_state("domcontentloaded")
        await page.screenshot(path=str(SHOTS / "1_page.png"))

        # Document title reflects the new name.
        title = await page.title()
        assert "Order For Suppliers" in title, f"Bad <title>: {title!r}"
        assert "Order Management" not in title, f"Stale title: {title!r}"

        # H1/heading reflects the new name.
        heading = page.get_by_role("heading", name="Order For Suppliers").first
        await heading.wait_for(state="visible", timeout=10_000)

        # Nothing on the page still says the old label.
        body = await page.locator("body").inner_text()
        assert "Order Management" not in body, "Stale 'Order Management' text remains"

        await browser.close()

asyncio.run(main())
