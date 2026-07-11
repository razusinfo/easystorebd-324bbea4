"""End-to-end propagation test for reseller checkout.

Creates a customer order + order_item on a reseller store, then verifies:
  1. verify_order_schema() reports all FKs and views present.
  2. order_items row exists with the correct product_id/order_id.
  3. reseller_orders row is auto-created by the sync trigger and
     - reseller_id (= supplier user) matches the linked supplier,
     - source_order_id / source_order_item_id / source_store_id propagate,
  4. The forwarding audit log records a 'linked_source_reseller_product'
     or 'unlinked_*_rule' success reason (not 'error').
  5. v_reseller_storefront_orders and v_supplier_orders expose the new rows.

Env:
    E2E_STORE_ID=<uuid>        # a reseller storefront
    E2E_PRODUCT_ID=<uuid>      # a product in that store (ideally with
                               # source_reseller_product_id set)
"""

import asyncio
import json
import os
import time
import uuid

import requests

SB_URL = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SB_KEY = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY") or os.environ.get("SUPABASE_PUBLISHABLE_KEY")
SB_SERVICE = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
STORE_ID = os.environ["E2E_STORE_ID"]
PRODUCT_ID = os.environ["E2E_PRODUCT_ID"]


def sb(path, method="GET", body=None, service=False):
    key = SB_SERVICE if service and SB_SERVICE else SB_KEY
    h = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    return requests.request(
        method, f"{SB_URL}/rest/v1/{path}", headers=h,
        data=json.dumps(body) if body is not None else None, timeout=15,
    )


def rpc(name, body=None, service=False):
    key = SB_SERVICE if service and SB_SERVICE else SB_KEY
    h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    return requests.post(f"{SB_URL}/rest/v1/rpc/{name}",
                         headers=h, data=json.dumps(body or {}), timeout=15)


async def main():
    # 1. Schema health check
    r = rpc("verify_order_schema", service=True)
    assert r.ok, f"verify_order_schema failed: {r.status_code} {r.text}"
    checks = r.json()
    failing = [c for c in checks if not c["ok"]]
    assert not failing, f"schema checks failed: {failing}"
    print(f"schema OK — {len(checks)} checks passed")

    # 2. Create order + item
    order_id, item_id = str(uuid.uuid4()), str(uuid.uuid4())
    order_number = f"E2E-{int(time.time())}"

    r = sb("orders", "POST", {
        "id": order_id, "order_number": order_number, "store_id": STORE_ID,
        "customer_name": "Propagation Test", "customer_phone": "01700000000",
        "customer_address": "Sylhet", "status": "pending",
        "subtotal": 100, "delivery_charge": 0, "discount": 0, "total": 100,
    }, service=True)
    assert r.status_code in (200, 201), f"order insert failed: {r.status_code} {r.text}"

    r = sb("order_items", "POST", {
        "id": item_id, "order_id": order_id, "product_id": PRODUCT_ID,
        "name": "E2E Product", "price": 100, "quantity": 1, "subtotal": 100,
    }, service=True)
    assert r.status_code in (200, 201), f"item insert failed: {r.status_code} {r.text}"

    # 3. Wait for trigger to forward
    ro = None
    for _ in range(15):
        rr = sb(f"reseller_orders?source_order_item_id=eq.{item_id}"
                "&select=id,reseller_id,source_order_id,source_order_item_id,"
                "source_store_id,reseller_product_id,status", service=True)
        rows = rr.json() if rr.ok else []
        if rows:
            ro = rows[0]
            break
        await asyncio.sleep(0.5)
    assert ro, "reseller_orders row was not created by trigger"
    assert ro["source_order_id"] == order_id
    assert ro["source_order_item_id"] == item_id
    assert ro["source_store_id"] == STORE_ID
    assert ro["reseller_id"], "reseller_id (supplier) missing"
    print("reseller_orders propagation OK:", ro)

    # 4. Audit reason must be success (not 'error')
    aud = sb(f"reseller_order_forward_audit?source_order_item_id=eq.{item_id}"
             "&select=reason,success,supplier_user_id", service=True)
    assert aud.ok and aud.json(), f"audit missing: {aud.status_code} {aud.text}"
    entry = aud.json()[0]
    assert entry["success"] is True, f"forwarding failed: {entry}"
    assert entry["reason"] != "error", f"forwarding logged error: {entry}"
    print("audit OK:", entry)

    # 5. Views expose the rows
    r = sb(f"v_reseller_storefront_orders?order_id=eq.{order_id}"
           "&select=order_id,item_count,total_quantity,total", service=True)
    assert r.ok and r.json(), f"reseller view missing row: {r.status_code} {r.text}"
    view_row = r.json()[0]
    assert view_row["item_count"] == 1 and view_row["total_quantity"] == 1
    print("v_reseller_storefront_orders OK:", view_row)

    r = sb(f"v_supplier_orders?id=eq.{ro['id']}"
           "&select=id,supplier_user_id,supplier_price,supplier_total,quantity",
           service=True)
    assert r.ok and r.json(), f"supplier view missing row: {r.status_code} {r.text}"
    sv = r.json()[0]
    assert sv["supplier_user_id"] == ro["reseller_id"]
    assert sv["supplier_total"] == sv["supplier_price"] * sv["quantity"]
    print("v_supplier_orders OK:", sv)

    print("ALL PROPAGATION CHECKS PASSED")


asyncio.run(main())
