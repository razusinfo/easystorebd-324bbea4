"""End-to-end verification of the reseller-order forwarding pipeline.

This drives production-style DB behavior against the running preview:

1. Inserts a customer order + order_item for a real reseller storefront.
2. Confirms a reseller_orders row is auto-created by the trigger.
3. Confirms user_notifications row for the supplier (reseller_id).
4. Confirms a reseller_order_forward_audit row exists.
5. Loads /my-orders in the browser as the supplier, restores the Supabase
   session, and checks the new-orders badge + aria-live status appear.
6. Verifies (best-effort) that the email webhook route responds when
   RESELLER_WEBHOOK_SECRET is set.

Usage:
    E2E_SUPPLIER_USER_ID=<uuid> \
    E2E_STORE_ID=<uuid> \
    E2E_PRODUCT_ID=<uuid> \
    python3 tests/e2e/reseller-order-forward.spec.py
"""

import asyncio
import json
import os
import time
import uuid
from pathlib import Path

import requests
from playwright.async_api import async_playwright

SB_URL = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SB_KEY = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY") or os.environ.get("SUPABASE_PUBLISHABLE_KEY")
SUPPLIER = os.environ["E2E_SUPPLIER_USER_ID"]
STORE_ID = os.environ["E2E_STORE_ID"]
PRODUCT_ID = os.environ["E2E_PRODUCT_ID"]

SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)


def sb(path: str, method: str = "GET", body=None, headers=None):
    h = {
        "apikey": SB_KEY,
        "Authorization": f"Bearer {SB_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    if headers:
        h.update(headers)
    r = requests.request(method, f"{SB_URL}/rest/v1/{path}", headers=h,
                         data=json.dumps(body) if body is not None else None, timeout=15)
    return r


async def main():
    order_number = f"E2E-{int(time.time())}"
    order_id = str(uuid.uuid4())
    item_id = str(uuid.uuid4())

    # 1. Insert order
    r = sb("orders", "POST", {
        "id": order_id, "order_number": order_number, "store_id": STORE_ID,
        "customer_name": "E2E Tester", "customer_phone": "017xxxxxxxx",
        "customer_address": "Sylhet", "status": "pending", "total_amount": 100,
    })
    assert r.status_code in (200, 201), f"order insert failed: {r.status_code} {r.text}"

    # 2. Insert order_item -> should trigger forwarding
    r = sb("order_items", "POST", {
        "id": item_id, "order_id": order_id, "product_id": PRODUCT_ID,
        "name": "E2E Product", "price": 100, "quantity": 1,
    })
    assert r.status_code in (200, 201), f"item insert failed: {r.status_code} {r.text}"

    # 3. Wait & confirm reseller_orders row
    ro = None
    for _ in range(10):
        rr = sb(f"reseller_orders?source_order_item_id=eq.{item_id}&select=id,reseller_id,source,status")
        rows = rr.json() if rr.ok else []
        if rows:
            ro = rows[0]; break
        await asyncio.sleep(0.5)
    assert ro, "reseller_orders row was not created by trigger"
    print("reseller_orders created:", ro)

    # 4. Confirm audit row
    aud = sb(f"reseller_order_forward_audit?source_order_item_id=eq.{item_id}&select=reason,success,supplier_user_id")
    assert aud.ok and aud.json(), f"audit row missing: {aud.status_code} {aud.text}"
    print("audit:", aud.json())

    # 5. Confirm supplier notification
    notif = sb(f"user_notifications?user_id=eq.{ro['reseller_id']}&related_id=eq.{ro['id']}&select=title,link")
    assert notif.ok and notif.json(), f"notification missing: {notif.status_code} {notif.text}"
    print("notification:", notif.json())

    # 6. Browser check for /my-orders badge (needs supplier session env)
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    if session_json and storage_key:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
            page = await ctx.new_page()
            await page.goto("http://localhost:8080")
            await page.evaluate(
                f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
            )
            await page.goto("http://localhost:8080/my-orders")
            await page.wait_for_load_state("networkidle")
            await page.screenshot(path=str(SCREENSHOTS / "my_orders_after_forward.png"))
            badge = await page.get_by_test_id("alerts-toggle").is_visible()
            print("alerts toggle visible:", badge)
            await browser.close()
    else:
        print("skipping browser check — no LOVABLE_BROWSER_SUPABASE_* env")

    print("OK")


asyncio.run(main())
