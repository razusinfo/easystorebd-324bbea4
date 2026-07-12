"""E2E: Order For Suppliers role-scoped visibility.

Verifies that the `reseller_orders` reads (via PostgREST + RLS with a signed-in
user token) enforce the role rules powering `/order-management`:

  - Super Admin sees ALL reseller_orders rows.
  - Supplier account sees ONLY rows where reseller_id matches their user id.

Env:
    VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
    E2E_SUPER_ADMIN_EMAIL, E2E_SUPER_ADMIN_PASSWORD
    E2E_SUPPLIER_EMAIL, E2E_SUPPLIER_PASSWORD, E2E_SUPPLIER_USER_ID
    SUPABASE_SERVICE_ROLE_KEY (optional — used only for total-row baseline)
"""

import json
import os
import sys
import requests

SB_URL = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SB_KEY = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY") or os.environ.get("SUPABASE_PUBLISHABLE_KEY")
SB_SERVICE = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

ADMIN_EMAIL = os.environ.get("E2E_SUPER_ADMIN_EMAIL")
ADMIN_PW = os.environ.get("E2E_SUPER_ADMIN_PASSWORD")
SUP_EMAIL = os.environ.get("E2E_SUPPLIER_EMAIL")
SUP_PW = os.environ.get("E2E_SUPPLIER_PASSWORD")
SUP_UID = os.environ.get("E2E_SUPPLIER_USER_ID")

if not all([SB_URL, SB_KEY, ADMIN_EMAIL, ADMIN_PW, SUP_EMAIL, SUP_PW, SUP_UID]):
    print("[SKIP] Missing E2E credentials — skipping role-visibility test.")
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


def list_orders(token, extra_filter=""):
    r = requests.get(
        f"{SB_URL}/rest/v1/reseller_orders?select=id,reseller_id{extra_filter}&limit=1000",
        headers={
            "apikey": SB_KEY,
            "Authorization": f"Bearer {token}",
            "Prefer": "count=exact",
        },
        timeout=15,
    )
    r.raise_for_status()
    return r.json()


def main():
    admin_tok = sign_in(ADMIN_EMAIL, ADMIN_PW)
    sup_tok = sign_in(SUP_EMAIL, SUP_PW)

    admin_rows = list_orders(admin_tok)
    sup_rows = list_orders(sup_tok)

    print(f"Admin sees {len(admin_rows)} rows; supplier sees {len(sup_rows)} rows.")

    # Supplier scoping — every visible row must belong to the supplier.
    leaked = [r for r in sup_rows if r["reseller_id"] != SUP_UID]
    assert not leaked, f"Supplier saw {len(leaked)} rows they should not: {leaked[:3]}"

    # Super admin baseline — must see at least as many rows as the supplier.
    assert len(admin_rows) >= len(sup_rows), (
        f"Super admin should see ≥ supplier rows but saw {len(admin_rows)} vs {len(sup_rows)}"
    )

    # Optional service-role sanity check: admin count matches full table.
    if SB_SERVICE:
        r = requests.get(
            f"{SB_URL}/rest/v1/reseller_orders?select=id&limit=1",
            headers={
                "apikey": SB_SERVICE,
                "Authorization": f"Bearer {SB_SERVICE}",
                "Prefer": "count=exact",
            },
            timeout=15,
        )
        r.raise_for_status()
        total = int(r.headers.get("Content-Range", "0/0").split("/")[-1] or 0)
        assert len(admin_rows) == total, (
            f"Super admin visibility mismatch: RLS={len(admin_rows)} vs total={total}"
        )
        print(f"[ok] Super admin sees all {total} rows.")

    print("[ok] Role-scoped visibility verified.")


if __name__ == "__main__":
    main()
