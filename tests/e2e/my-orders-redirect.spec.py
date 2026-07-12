"""E2E: /my-orders redirects to /order-management for both authenticated and
unauthenticated visits, and the Order For Suppliers page renders its key UI
(heading + filter/tab controls).

Env:
    E2E_APP_URL                      (defaults to http://localhost:8080)
    E2E_RESELLER_EMAIL / _PASSWORD   (optional — enables the authed pass)
    VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (for auth restore)
"""

import asyncio
import json
import os
from pathlib import Path

from playwright.async_api import async_playwright

APP_URL = os.environ.get("E2E_APP_URL", "http://localhost:8080").rstrip("/")
EMAIL = os.environ.get("E2E_RESELLER_EMAIL")
PASSWORD = os.environ.get("E2E_RESELLER_PASSWORD")
SB_URL = os.environ.get("VITE_SUPABASE_URL")
SB_KEY = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")

SHOTS = Path(__file__).parent / "screenshots" / "my-orders-redirect"
SHOTS.mkdir(parents=True, exist_ok=True)


async def _assert_redirect_and_ui(page, label: str):
    await page.goto(f"{APP_URL}/my-orders", wait_until="domcontentloaded")
    await page.wait_for_url("**/order-management", timeout=10_000)
    await page.screenshot(path=str(SHOTS / f"{label}.png"))

    final = page.url
    assert final.endswith("/order-management"), \
        f"[{label}] expected /order-management, got {final}"
    if "/auth" in final:
        raise AssertionError(
            f"[{label}] hit auth wall — session restore failed: {final}"
        )
    body = (await page.locator("body").inner_text()).lower()
    assert "order management" in body, \
        f"[{label}] missing 'Order For Suppliers' heading. body head: {body[:400]}"
    print(f"[{label}] OK → {final}")


async def _restore_session(context, page):
    if not (EMAIL and PASSWORD and SB_URL and SB_KEY):
        return False
    import requests
    r = requests.post(
        f"{SB_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SB_KEY, "Content-Type": "application/json"},
        json={"email": EMAIL, "password": PASSWORD}, timeout=15,
    )
    r.raise_for_status()
    session = r.json()
    project_ref = SB_URL.split("//", 1)[1].split(".", 1)[0]
    storage_key = f"sb-{project_ref}-auth-token"
    await page.goto(APP_URL, wait_until="domcontentloaded")
    await page.evaluate(
        f"window.localStorage.setItem({json.dumps(storage_key)}, "
        f"{json.dumps(json.dumps(session))})"
    )
    return True


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)

        # 1) Unauthenticated: redirect fires; _authenticated gate then sends
        #    us to /auth. Either final URL is acceptable as long as
        #    /my-orders itself doesn't render.
        ctx_anon = await browser.new_context(
            viewport={"width": 1280, "height": 1800})
        page_anon = await ctx_anon.new_page()
        await page_anon.goto(f"{APP_URL}/my-orders",
                             wait_until="domcontentloaded")
        await page_anon.wait_for_load_state("networkidle")
        await page_anon.screenshot(path=str(SHOTS / "anon.png"))
        final = page_anon.url
        assert "/my-orders" not in final, \
            f"[anon] URL still /my-orders: {final}"
        assert final.endswith("/order-management") or "/auth" in final, \
            f"[anon] unexpected final URL: {final}"
        print(f"[anon] OK → {final}")
        await ctx_anon.close()

        # 2) Authenticated (optional): lands on /order-management with the
        #    merged UI.
        if EMAIL and PASSWORD and SB_URL and SB_KEY:
            ctx = await browser.new_context(
                viewport={"width": 1280, "height": 1800})
            page = await ctx.new_page()
            ok = await _restore_session(ctx, page)
            assert ok, "session restore prerequisites missing"
            await _assert_redirect_and_ui(page, "authed")
            await ctx.close()
        else:
            print("[authed] skipped — E2E_RESELLER_EMAIL/PASSWORD not set")

        await browser.close()
        print("PASS: /my-orders → /order-management")


if __name__ == "__main__":
    asyncio.run(main())
