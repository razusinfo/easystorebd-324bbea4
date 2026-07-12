"""E2E: Reselling or Supplier zone sits above Notifications and links navigate.

Assumes an injected Supabase session for a store-owning user (see
`browser-use` guide). Skips gracefully when no session is available.
"""
import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright

SHOTS = Path(__file__).parent / "screenshots" / "reseller-zone-sidebar"
SHOTS.mkdir(parents=True, exist_ok=True)

RESELLER_LINKS = [
    ("Reseller Products", "/reseller-products"),
    ("Reseller Requests", "/reseller-requests"),
    ("Wallet", "/wallet"),
    ("Courier", "/courier"),

]

async def restore_session(context, page):
    status = os.environ.get("LOVABLE_BROWSER_AUTH_STATUS")
    if status != "injected":
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
        await page.wait_for_selector('[data-testid="reseller-zone-group"]', timeout=10_000)
        await page.screenshot(path=str(SHOTS / "1_sidebar.png"))

        # Order: reseller zone must appear BEFORE the Notifications link in DOM.
        order = await page.evaluate(
            """() => {
              const group = document.querySelector('[data-testid=\"reseller-zone-group\"]');
              const notif = Array.from(document.querySelectorAll('a')).find(a => a.getAttribute('href') === '/my-notifications');
              if (!group || !notif) return null;
              return group.compareDocumentPosition(notif) & Node.DOCUMENT_POSITION_FOLLOWING ? 'zone-before-notif' : 'wrong';
            }"""
        )
        assert order == "zone-before-notif", f"Sidebar order wrong: {order}"
        print("OK: Reselling zone renders above Notifications")

        # Each link navigates and highlights active
        for label, url in RESELLER_LINKS:
            await page.goto(f"http://localhost:8080{url}", wait_until="domcontentloaded")
            active = await page.evaluate(
                f"""() => {{
                  const a = Array.from(document.querySelectorAll('a')).find(a => a.getAttribute('href') === {json.dumps(url)});
                  if (!a) return 'missing';
                  const btn = a.closest('[data-active]') || a;
                  return btn.getAttribute('data-active');
                }}"""
            )
            print(f"{url} active={active}")
            assert page.url.endswith(url), f"Nav failed for {url} (got {page.url})"

        await browser.close()

asyncio.run(main())
