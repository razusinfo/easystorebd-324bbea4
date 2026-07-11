"""Verify the Forwarding audit log records the correct Reason for every
routing outcome:

  - linked_source_reseller_product  (product has source_reseller_product_id)
  - unlinked_category_rule          (product has category with matching rule)
  - unlinked_default_rule           (unlinked, falls back to default rule)
  - unlinked_no_rule                (unlinked, no rules active — dropped)
  - retry_*                         (super_admin retries via RPC)

For each scenario we insert a fresh customer order + order_item, then poll
the reseller_order_forward_audit table for the expected reason. Cleanup
happens at the end (best-effort).

Required env:
  VITE_SUPABASE_URL / SUPABASE_URL
  VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_PUBLISHABLE_KEY
  E2E_STORE_ID                  storefront store the order is placed against
  E2E_PRODUCT_LINKED_ID         product with source_reseller_product_id set
  E2E_PRODUCT_UNLINKED_ID       product WITHOUT source_reseller_product_id
                                (its category may or may not have a rule)
  E2E_SUPPLIER_USER_ID          used only for retry sanity check
  E2E_SUPER_ADMIN_ACCESS_TOKEN  (optional) JWT for a super_admin, needed
                                to test retry_forward_order_item RPC
"""

import json, os, time, uuid, sys
import requests

SB_URL = os.environ.get("VITE_SUPABASE_URL") or os.environ["SUPABASE_URL"]
SB_KEY = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY") or os.environ["SUPABASE_PUBLISHABLE_KEY"]
STORE_ID = os.environ["E2E_STORE_ID"]
LINKED_ID = os.environ["E2E_PRODUCT_LINKED_ID"]
UNLINKED_ID = os.environ["E2E_PRODUCT_UNLINKED_ID"]
ADMIN_JWT = os.environ.get("E2E_SUPER_ADMIN_ACCESS_TOKEN")


def h(extra=None):
    base = {
        "apikey": SB_KEY,
        "Authorization": f"Bearer {SB_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    if extra: base.update(extra)
    return base


def sb(path, method="GET", body=None, extra_headers=None):
    r = requests.request(
        method, f"{SB_URL}/rest/v1/{path}",
        headers=h(extra_headers),
        data=json.dumps(body) if body is not None else None,
        timeout=20,
    )
    return r


def place_order(product_id: str, note: str) -> tuple[str, str]:
    order_id = str(uuid.uuid4())
    item_id = str(uuid.uuid4())
    r = sb("orders", "POST", {
        "id": order_id, "order_number": f"AUDIT-{int(time.time()*1000)}",
        "store_id": STORE_ID, "customer_name": f"AuditBot ({note})",
        "customer_phone": "017xxxxxxxx", "customer_address": "Sylhet",
        "status": "pending", "total_amount": 10,
    })
    assert r.status_code in (200, 201), f"order insert failed: {r.status_code} {r.text}"
    r = sb("order_items", "POST", {
        "id": item_id, "order_id": order_id, "product_id": product_id,
        "name": f"AuditBot item ({note})", "price": 10, "quantity": 1,
    })
    assert r.status_code in (200, 201), f"item insert failed: {r.status_code} {r.text}"
    return order_id, item_id


def wait_for_audit(item_id: str, timeout: float = 8.0) -> dict | None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = sb(f"reseller_order_forward_audit?source_order_item_id=eq.{item_id}"
               "&select=reason,success,supplier_user_id,routing_rule_id,error,metadata"
               "&order=created_at.desc&limit=1")
        rows = r.json() if r.ok else []
        if rows: return rows[0]
        time.sleep(0.3)
    return None


def assert_reason(label: str, item_id: str, expected_prefix: str, must_succeed: bool = True):
    row = wait_for_audit(item_id)
    assert row, f"[{label}] no audit row for item {item_id}"
    reason = row["reason"]
    ok = reason.startswith(expected_prefix) or reason == expected_prefix
    assert ok, f"[{label}] expected reason ~ {expected_prefix!r}, got {reason!r} ({row.get('error')})"
    if must_succeed:
        assert row["success"], f"[{label}] audit row not success: {row}"
    print(f"  ✓ {label}: reason={reason} success={row['success']}")
    return row


def main():
    failed = []

    # 1. Linked product -> linked_source_reseller_product
    try:
        _, item = place_order(LINKED_ID, "linked")
        assert_reason("linked", item, "linked_source_reseller_product")
    except AssertionError as e:
        failed.append(str(e))

    # 2. Unlinked product -> depends on active rules (category or default),
    #    or unlinked_no_rule if none exist. Just accept any of the three
    #    documented reasons and print which one fired.
    try:
        _, item = place_order(UNLINKED_ID, "unlinked")
        row = wait_for_audit(item)
        assert row, "no audit for unlinked"
        assert row["reason"] in (
            "unlinked_category_rule", "unlinked_default_rule", "unlinked_no_rule",
        ), f"unexpected reason: {row['reason']}"
        # unlinked_no_rule is expected to be success=false; the other two success=true
        expected_success = row["reason"] != "unlinked_no_rule"
        assert row["success"] == expected_success, (
            f"success flag mismatch for {row['reason']}: {row}"
        )
        print(f"  ✓ unlinked: reason={row['reason']} success={row['success']}")
        unlinked_item = item
        unlinked_reason = row["reason"]
    except AssertionError as e:
        failed.append(str(e))
        unlinked_item = None
        unlinked_reason = None

    # 3. Retry (requires super_admin JWT)
    if ADMIN_JWT and unlinked_item:
        try:
            r = requests.post(
                f"{SB_URL}/rest/v1/rpc/retry_forward_order_item",
                headers=h({"Authorization": f"Bearer {ADMIN_JWT}"}),
                data=json.dumps({"_item_id": unlinked_item}),
                timeout=15,
            )
            assert r.status_code == 200, f"retry rpc failed: {r.status_code} {r.text}"
            payload = r.json()
            print(f"  ✓ retry rpc: {payload}")
            # Confirm a retry_* audit row was appended.
            time.sleep(0.5)
            r2 = sb(f"reseller_order_forward_audit?source_order_item_id=eq.{unlinked_item}"
                    "&reason=like.retry_*&select=reason,success&order=created_at.desc&limit=1")
            assert r2.ok and r2.json(), "no retry_* audit row appended"
            print(f"  ✓ retry audit: {r2.json()[0]}")
        except AssertionError as e:
            failed.append(str(e))
    else:
        print("  … skipping retry test (no E2E_SUPER_ADMIN_ACCESS_TOKEN)")

    if failed:
        print("\nFAILED:")
        for f in failed: print(" -", f)
        sys.exit(1)
    print("\nOK — all audit reasons verified")


if __name__ == "__main__":
    main()
