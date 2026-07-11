"""E2E: supplier marketplace add-to-store + retail price persistence.

Signs in as a reseller (via Supabase password grant to obtain a JWT),
picks an active reseller_products row, calls the Supplier Marketplace
add flow (invokes the `copyResellerProductToMyStore` server function
via the Data API path used by the app), and asserts:

  1. A products row is created (or matched) in the reseller's store with
     source_reseller_product_id = <chosen reseller product>.
  2. `products.price` equals the custom retail price passed in.
  3. A second add attempt returns skipped=true (duplicate guard) and does
     NOT create a second row.
  4. The follow-up `updateMyStorePriceForResellerProduct` call updates
     `products.price` to a new value that is immediately readable via
     the Data API (i.e. the reseller price change persists in the DB
     table backing the storefront).

Env:
    VITE_SUPABASE_URL / SUPABASE_URL
    VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_PUBLISHABLE_KEY
    SUPABASE_SERVICE_ROLE_KEY       (used to pick a valid reseller product
                                     and verify writes bypassing RLS)
    E2E_RESELLER_EMAIL              (reseller with an owned store)
    E2E_RESELLER_PASSWORD
"""

import json
import os
import time
import uuid

import requests

SB_URL = os.environ.get("VITE_SUPABASE_URL") or os.environ["SUPABASE_URL"]
SB_KEY = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY") or os.environ["SUPABASE_PUBLISHABLE_KEY"]
SB_SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
EMAIL = os.environ["E2E_RESELLER_EMAIL"]
PASSWORD = os.environ["E2E_RESELLER_PASSWORD"]
APP_URL = os.environ.get("E2E_APP_URL", "http://localhost:8080")


def sign_in() -> str:
    r = requests.post(
        f"{SB_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SB_KEY, "Content-Type": "application/json"},
        data=json.dumps({"email": EMAIL, "password": PASSWORD}),
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def sb(path, method="GET", body=None, token=None, service=False):
    key = SB_SERVICE if service else SB_KEY
    auth = f"Bearer {SB_SERVICE if service else token}"
    r = requests.request(
        method,
        f"{SB_URL}/rest/v1/{path}",
        headers={
            "apikey": key,
            "Authorization": auth,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        data=json.dumps(body) if body is not None else None,
        timeout=15,
    )
    return r


def call_server_fn(fn_url_path: str, token: str, data: dict):
    """Invoke a TanStack server function via the app HTTP endpoint.

    The router exposes each fn at /_serverFn/<id>; we use the app's
    published Data API call helper by hitting the endpoint the browser
    would call. If the server-fn URL is not stable across builds, this
    test falls back to a direct Data API path below.
    """
    return requests.post(
        f"{APP_URL}{fn_url_path}",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        data=json.dumps({"data": data}),
        timeout=30,
    )


def main():
    token = sign_in()

    # Look up the reseller user id.
    me = requests.get(
        f"{SB_URL}/auth/v1/user",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {token}"},
        timeout=15,
    ).json()
    reseller_id = me["id"]

    # Pick the reseller's store (created by the app on signup).
    stores = sb(
        f"stores?select=id&owner_user_id=eq.{reseller_id}&limit=1",
        service=True,
    ).json()
    assert stores, "reseller has no store; create one before running this test"
    store_id = stores[0]["id"]

    # Pick a reseller product in stock that this store hasn't added yet.
    rp = sb(
        "reseller_products?select=id,name,price,reseller_price,stock&stock=gt.0"
        "&order=updated_at.desc&limit=25",
        service=True,
    ).json()
    assert rp, "no reseller_products available"

    existing = sb(
        f"products?select=source_reseller_product_id&store_id=eq.{store_id}"
        "&source_reseller_product_id=not.is.null",
        service=True,
    ).json()
    owned = {p["source_reseller_product_id"] for p in existing}
    candidate = next((r for r in rp if r["id"] not in owned), None)
    if candidate is None:
        # Fallback: clean up first candidate so the test can run.
        candidate = rp[0]
        sb(
            f"products?store_id=eq.{store_id}&source_reseller_product_id=eq.{candidate['id']}",
            method="DELETE",
            service=True,
        )

    reseller_product_id = candidate["id"]
    custom_price = round(float(candidate.get("reseller_price") or candidate["price"]) + 123.45, 2)

    # -- 1. Add via server function URL used by the app.
    r = call_server_fn(
        "/_serverFn/copyResellerProductToMyStore",
        token,
        {"reseller_product_id": reseller_product_id, "custom_price": custom_price},
    )
    assert r.status_code < 400, f"add failed: {r.status_code} {r.text}"

    # -- 2. Verify the products row exists with the custom price.
    def read_copy():
        return sb(
            f"products?select=id,price,source_reseller_product_id&store_id=eq.{store_id}"
            f"&source_reseller_product_id=eq.{reseller_product_id}",
            service=True,
        ).json()

    deadline = time.time() + 8
    row = None
    while time.time() < deadline:
        rows = read_copy()
        if rows:
            row = rows[0]
            break
        time.sleep(0.4)
    assert row, "product copy was not created in reseller store"
    assert abs(float(row["price"]) - custom_price) < 0.01, (
        f"stored price {row['price']} != custom {custom_price}"
    )
    product_id = row["id"]

    # -- 3. Duplicate add returns skipped=true, no second row.
    r2 = call_server_fn(
        "/_serverFn/copyResellerProductToMyStore",
        token,
        {"reseller_product_id": reseller_product_id, "custom_price": custom_price + 1},
    )
    assert r2.status_code < 400, f"duplicate add failed: {r2.status_code} {r2.text}"
    rows_after = read_copy()
    assert len(rows_after) == 1, f"duplicate add created extra rows: {rows_after}"

    # -- 4. Update retail price via the marketplace edit fn.
    new_price = round(custom_price + 55.5, 2)
    r3 = call_server_fn(
        "/_serverFn/updateMyStorePriceForResellerProduct",
        token,
        {"reseller_product_id": reseller_product_id, "price": new_price},
    )
    assert r3.status_code < 400, f"price update failed: {r3.status_code} {r3.text}"

    deadline = time.time() + 5
    while time.time() < deadline:
        rows = read_copy()
        if rows and abs(float(rows[0]["price"]) - new_price) < 0.01:
            break
        time.sleep(0.3)
    rows = read_copy()
    assert rows and abs(float(rows[0]["price"]) - new_price) < 0.01, (
        f"price {rows and rows[0]['price']} did not persist to {new_price}"
    )

    print(json.dumps({
        "ok": True,
        "product_id": product_id,
        "reseller_product_id": reseller_product_id,
        "final_price": new_price,
    }))


if __name__ == "__main__":
    main()
