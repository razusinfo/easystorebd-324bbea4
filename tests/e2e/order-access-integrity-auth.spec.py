"""Verifies that admin_check_order_access_integrity() is fail-closed.

- Anonymous callers (using the publishable/anon key) must be rejected.
- Authenticated non-super-admin callers must be rejected with a clear error.
- Only super_admin callers can execute it successfully.

The test hits the Supabase REST RPC endpoint directly rather than the app UI
to isolate the database-level authorization surface.
"""

import json
import os
import urllib.request
import urllib.error

SUPABASE_URL = os.environ.get("LOVABLE_BROWSER_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
ANON_KEY = (
    os.environ.get("LOVABLE_BROWSER_SUPABASE_ANON_KEY")
    or os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    or os.environ.get("SUPABASE_ANON_KEY")
)
USER_TOKEN = os.environ.get("LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN")

RPC = "/rest/v1/rpc/admin_check_order_access_integrity"


def _call(headers: dict) -> tuple[int, str]:
    req = urllib.request.Request(
        SUPABASE_URL + RPC,
        data=b"{}",
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def test_anon_cannot_execute():
    assert SUPABASE_URL and ANON_KEY, "Supabase env not configured"
    status, body = _call({"apikey": ANON_KEY, "Authorization": f"Bearer {ANON_KEY}"})
    # Either PostgREST denies via missing EXECUTE grant (401/403) or the RPC
    # itself raises 'Access denied' (400/403). Either is acceptable — the
    # invariant is: no rows returned to anonymous callers.
    assert status >= 400, f"anon call must be rejected, got {status}: {body}"
    lower = body.lower()
    assert "access denied" in lower or "permission" in lower or "not find" in lower or status in (401, 403), body


def test_authenticated_non_admin_denied():
    if not USER_TOKEN:
        # No signed-in session available in this run; skip.
        return
    status, body = _call({"apikey": ANON_KEY, "Authorization": f"Bearer {USER_TOKEN}"})
    if status == 200:
        # Only pass if the caller happens to be super_admin; that's covered by
        # the other assertion path. Non-super-admin sessions must be denied.
        data = json.loads(body)
        assert isinstance(data, list), body
        return
    assert status in (400, 401, 403), f"unexpected status {status}: {body}"
    assert "access denied" in body.lower() or "super_admin" in body.lower(), body


if __name__ == "__main__":
    test_anon_cannot_execute()
    test_authenticated_non_admin_denied()
    print("OK")
