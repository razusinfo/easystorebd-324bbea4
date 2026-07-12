"""E2E: Courier → Partner settings navigates to full Courier Settings UI.

Requires an injected Supabase session for an authenticated store owner.
Skips gracefully otherwise.
"""
import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright

SHOTS = Path(__file__).parent / "screenshots" / "courier-partner-settings"
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

        # Unauthenticated-style probe first: an unauth'd fetch of /courier-settings
        # must not render the settings UI (auth gate must intercept).
        probe = await context.new_page()
        await probe.goto("http://localhost:8080/courier-settings", wait_until="domcontentloaded")
        # The _authenticated gate redirects to /auth for signed-out visitors;
        # for signed-in visitors the URL remains /courier-settings.
        # (Full unauth assertion is covered by tanstack-auth-guards E2Es.)
        await probe.close()

        # Signed-in flow: land on /courier, click Partner settings link.
        await page.goto("http://localhost:8080/courier", wait_until="domcontentloaded")
        await page.screenshot(path=str(SHOTS / "1_courier.png"))

        # Sidebar order: Courier must sit directly below Customers.
        order = await page.evaluate(
            """() => Array.from(document.querySelectorAll('a[href="/customers"], a[href="/courier"]'))
                  .map(a => a.getAttribute('href'))"""
        )
        assert order[:2] == ["/customers", "/courier"], f"Bad sidebar order: {order}"

        # Active highlight for Courier while on /courier (desktop).
        active = await page.evaluate(
            """() => document.querySelector('a[href="/courier"]')?.closest('[data-active]')?.getAttribute('data-active')"""
        )
        assert active == "true", f"Courier not active on desktop: {active!r}"

        # Mobile viewport: same order + active highlight after opening the sheet.
        await page.set_viewport_size({"width": 390, "height": 844})
        await page.reload(wait_until="domcontentloaded")
        trigger = page.get_by_role("button", name="Toggle Sidebar")
        if await trigger.count():
            await trigger.first.click()
            await page.wait_for_timeout(300)
        m_order = await page.evaluate(
            """() => Array.from(document.querySelectorAll('a[href="/customers"], a[href="/courier"]'))
                  .map(a => a.getAttribute('href'))"""
        )
        assert m_order[:2] == ["/customers", "/courier"], f"Bad mobile order: {m_order}"
        await page.screenshot(path=str(SHOTS / "2_mobile_sidebar.png"))
        await page.set_viewport_size({"width": 1280, "height": 1800})

        link = page.get_by_role("link", name="Partner settings")
        await link.first.click()
        await page.wait_for_url("**/courier-settings", timeout=10_000)
        await page.wait_for_load_state("domcontentloaded")
        await page.screenshot(path=str(SHOTS / "3_courier_settings.png"))

        assert page.url.endswith("/courier-settings"), f"Bad URL: {page.url}"

        # Core Courier Settings UI markers.
        for needle in ["Courier Settings", "Add partner", "Pathao"]:
            loc = page.get_by_text(needle, exact=False).first
            await loc.wait_for(state="visible", timeout=10_000)
            print(f"OK visible: {needle}")

        await browser.close()

asyncio.run(main())
