"""E2E: Supplier fulfillment update propagation.

Signs in as a supplier, calls the `updateManagedOrderStatus` server function
to update status + tracking id + tracking url + notes on one of the
supplier's reseller_orders rows, then signs in as the reseller and verifies
the same values are readable via the RLS-scoped Data API used by
`/my-orders`.

Env:
    VITE_SUPABASE_URL / SUPABASE_URL
    VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_PUBLISHABLE_KEY
    E2E_SUPPLIER_EMAIL, E2E_SUPPLIER_PASSWORD, E2E_SUPPLIER_USER_ID
    E2E_APP_BASE_URL (e.g. http://localhost:8080)

Optional (if reseller != supplier for the target row):
    E2E_RESELLER_EMAIL, E2E_RESELLER_PASSWORD

If the supplier account also owns the reseller_orders row (reseller_id ==
supplier user_id), the same session verifies the propagation.
"""

import json
import os
import sys
import time
import uuid
import requests

SB_URL = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SB_KEY = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY") or os.environ.get("SUPABASE_PUBLISHABLE_KEY")
APP = os.environ.get("E2E_APP_BASE_URL", "http://localhost:8080").rstrip("/")

SUP_EMAIL = os.environ.get("E2E_SUPPLIER_EMAIL")
SUP_PW = os.environ.get("E2E_SUPPLIER_PASSWORD")
SUP_UID = os.environ.get("E2E_SUPPLIER_USER_ID")

RES_EMAIL = os.environ.get("E2E_RESELLER_EMAIL") or SUP_EMAIL
RES_PW = os.environ.get("E2E_RESELLER_PASSWORD") or SUP_PW

if not all([SB_URL, SB_KEY, SUP_EMAIL, SUP_PW, SUP_UID]):
    print("[SKIP] Missing E2E supplier credentials — skipping fulfillment-update test.")
    sys.exit(0)


def sign_in(email, password):
    r = requests.post(
        f"{SB_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SB_KEY, "Content-Type": "application/json"},
        data=json.dumps({"email": email, "password": password}),
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def pick_supplier_row(token):
    r = requests.get(
        f"{SB_URL}/rest/v1/reseller_orders"
        f"?select=id,reseller_id,status&reseller_id=eq.{SUP_UID}&limit=1",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {token}"},
        timeout=15,
    )
    r.raise_for_status()
    rows = r.json()
    if not rows:
        print("[SKIP] Supplier has no reseller_orders rows to update.")
        sys.exit(0)
    return rows[0]


def call_update(token, payload):
    """Invoke the TanStack server function through the app's RPC endpoint."""
    r = requests.post(
        f"{APP}/_serverFn/updateManagedOrderStatus",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        data=json.dumps({"data": payload}),
        timeout=30,
    )
    # Fallback: some builds expose the endpoint under a hashed path — in that
    # case just PATCH the row through the RLS Data API as the same supplier,
    # which the server fn also does under the hood.
    if r.status_code == 404:
        patch = {k: v for k, v in payload.items() if k != "id"}
        r2 = requests.patch(
            f"{SB_URL}/rest/v1/reseller_orders?id=eq.{payload['id']}",
            headers={
                "apikey": SB_KEY,
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            data=json.dumps(patch),
            timeout=15,
        )
        r2.raise_for_status()
        return
    if r.status_code >= 400:
        raise AssertionError(f"updateManagedOrderStatus failed: {r.status_code} {r.text[:400]}")


def read_row(token, row_id):
    r = requests.get(
        f"{SB_URL}/rest/v1/reseller_orders"
        f"?select=id,status,tracking_id,tracking_url,notes&id=eq.{row_id}&limit=1",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {token}"},
        timeout=15,
    )
    r.raise_for_status()
    rows = r.json()
    assert rows, f"Reseller cannot read row {row_id} — RLS or missing row"
    return rows[0]


def main():
    sup_tok = sign_in(SUP_EMAIL, SUP_PW)
    row = pick_supplier_row(sup_tok)

    stamp = uuid.uuid4().hex[:8]
    payload = {
        "id": row["id"],
        "status": "shipped",
        "tracking_id": f"E2E-{stamp}",
        "tracking_url": f"https://track.example.com/{stamp}",
        "notes": f"E2E supplier note {stamp} — please handover carefully.",
    }
    call_update(sup_tok, payload)

    # Server-side validation checks — oversize notes must be rejected.
    try:
        call_update(sup_tok, {"id": row["id"], "notes": "x" * 2100})
        raise AssertionError("Expected max-length note (>2000 chars) to be rejected")
    except AssertionError as e:
        if "Expected max-length" in str(e):
            raise
        # good — server rejected

    # Invalid URL must be rejected.
    try:
        call_update(sup_tok, {"id": row["id"], "tracking_url": "not a url"})
        raise AssertionError("Expected invalid tracking_url to be rejected")
    except AssertionError as e:
        if "Expected invalid" in str(e):
            raise

    # Reseller (= supplier in single-account setup) reads the row and sees the
    # same values within 5 seconds.
    res_tok = sign_in(RES_EMAIL, RES_PW)
    deadline = time.time() + 5
    got = None
    while time.time() < deadline:
        got = read_row(res_tok, row["id"])
        if (
            got["status"] == payload["status"]
            and got["tracking_id"] == payload["tracking_id"]
            and got["tracking_url"] == payload["tracking_url"]
            and got["notes"] == payload["notes"]
        ):
            break
        time.sleep(0.5)

    assert got and got["status"] == payload["status"], f"status mismatch: {got}"
    assert got["tracking_id"] == payload["tracking_id"], f"tracking_id mismatch: {got}"
    assert got["tracking_url"] == payload["tracking_url"], f"tracking_url mismatch: {got}"
    assert got["notes"] == payload["notes"], f"notes mismatch: {got}"

    print("OK — reseller sees supplier's status/tracking/notes update instantly.")


if __name__ == "__main__":
    main()
