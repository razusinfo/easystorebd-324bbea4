# Order Access Integrity RPC

`public.admin_check_order_access_integrity()` scans `reseller_orders` for rows
that would be routed to the wrong supplier under current RLS. Callable only by
`super_admin` (fail-closed: `RAISE EXCEPTION 'Access denied: super_admin only'`).
`EXECUTE` is granted only to `authenticated` and `service_role`; revoked from
`PUBLIC` and `anon`.

## Response schema

Returns `SETOF` rows (may be empty when clean):

| Column                 | Type          | Description                                                              |
| ---------------------- | ------------- | ------------------------------------------------------------------------ |
| `order_id`             | `uuid`        | `reseller_orders.id`                                                     |
| `reseller_id`          | `uuid \| null`| Supplier the order is assigned to                                        |
| `storefront_owner_id`  | `uuid \| null`| Owner of `source_store_id`                                               |
| `source_order_item_id` | `uuid \| null`| Originating `order_items.id`                                             |
| `created_at`           | `timestamptz` | Row creation time                                                        |
| `issue`                | `text`        | Machine-readable error code (see below)                                  |
| `detail`               | `text`        | Human-readable description                                               |

## Error / issue codes

| Code                       | Meaning                                                                          | Typical remediation                                        |
| -------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `null_reseller_id`         | `reseller_id IS NULL` — invisible to every supplier under RLS.                   | Reassign via `retry_forward_order_item` or manual update.  |
| `unknown_reseller_profile` | `reseller_id` not present in `public.profiles`.                                  | Reassign to a valid supplier user.                         |
| `duplicate_forward`        | Multiple `reseller_orders` rows reference the same `source_order_item_id`.       | Delete duplicates, keep the canonical row.                 |
| `reseller_owner_mismatch`  | `reseller_id` differs from `source_store_id.owner_user_id`.                      | Re-run routing or correct `reseller_id`.                   |

Access-control errors surface as PostgREST errors, not rows:

| HTTP / Postgres              | Meaning                                                    |
| ---------------------------- | ---------------------------------------------------------- |
| `42501` / `permission denied`| Caller lacks `EXECUTE` (anon).                             |
| `P0001` `Access denied: …`   | Authenticated caller is not `super_admin`.                 |

## Audit logging

Every successful super-admin run inserts one `public.order_access_audit` row:

```jsonc
{
  "actor_id": "<super_admin uuid>",
  "actor_role": "super_admin",
  "action": "run_integrity_check",
  "row_count": 3,
  "filters": {
    "total": 3,
    "by_issue": {
      "null_reseller_id":       { "count": 2, "sample_order_ids": ["…"] },
      "reseller_owner_mismatch":{ "count": 1, "sample_order_ids": ["…"] }
    }
  },
  "notes": "integrity_scan: null_reseller_id:2, reseller_owner_mismatch:1"
}
```

RLS: super-admins see all `order_access_audit` rows; other authenticated users
see only rows where `actor_id = auth.uid()`.

## CI coverage

`.github/workflows/e2e.yml` runs `tests/e2e/order-access-integrity-auth.spec.py`
on every push/PR to `main`, verifying:

- Anonymous RPC call is rejected (permission denied).
- Non-admin authenticated call raises `Access denied: super_admin only`.
- Super-admin call succeeds and returns the documented row shape.
