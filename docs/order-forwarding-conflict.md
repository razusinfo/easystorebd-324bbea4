# Order forwarding — partial unique index and ON CONFLICT

## Background

When a customer places an order on a reseller's storefront for a product
sourced from a supplier, `sync_customer_order_to_admin` (a trigger on
`public.order_items`) inserts a corresponding row into
`public.reseller_orders`. The manual admin action
`retry_forward_order_item(_item_id uuid)` performs the same insert on demand
from the **Order Routing → Forwarding audit log** UI
(`/admin-order-routing`).

Both paths use `INSERT ... ON CONFLICT ... DO NOTHING` so that re-runs never
produce duplicate `reseller_orders` for the same source order item.

## The idempotency guarantee

Idempotency is enforced by a **partial unique index** on
`reseller_orders.source_order_item_id`:

```sql
CREATE UNIQUE INDEX reseller_orders_source_order_item_uidx
  ON public.reseller_orders (source_order_item_id)
  WHERE (source_order_item_id IS NOT NULL);
```

The `WHERE source_order_item_id IS NOT NULL` predicate lets legacy rows with
no source item coexist while still guaranteeing that any given
`source_order_item_id` maps to at most one `reseller_orders` row.

## ON CONFLICT clauses MUST match the predicate

Postgres will not use a partial unique index for conflict inference unless
the `ON CONFLICT` clause **repeats the same predicate**. Otherwise the
insert fails with:

```
ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

This bug surfaced in the Order Routing audit log as `reason = 'error'` with
that exact message. The fix — and the invariant every future change must
preserve — is:

```sql
INSERT INTO public.reseller_orders (...)
VALUES (...)
ON CONFLICT (source_order_item_id) WHERE source_order_item_id IS NOT NULL
DO NOTHING
RETURNING id INTO _new_ro_id;
```

Both writers use this shape:

- `public.sync_customer_order_to_admin()` — trigger on `order_items` inserts,
  runs for every new customer order item.
- `public.retry_forward_order_item(_item_id uuid)` — SECURITY DEFINER RPC,
  called from the Retry button on `/admin-order-routing`.

Any new writer that targets the same table (batch backfills, admin
utilities, edge functions) MUST use the identical `ON CONFLICT (...)
WHERE source_order_item_id IS NOT NULL` clause, or drop `ON CONFLICT`
entirely and enforce uniqueness in application code.

## If the index is ever recreated

Do not drop the `WHERE` predicate without also updating every ON CONFLICT
site above in the same migration. Removing the predicate makes the index
non-partial (`ON CONFLICT (source_order_item_id) DO NOTHING` alone would
then match), but it also means every historical row must have a
non-null `source_order_item_id`, which is not currently guaranteed.

## Where to look when this breaks again

1. `/admin-order-routing` → Forwarding audit log → **Failed only** toggle.
   Rows with `reason = 'error'` show the raw Postgres message in the
   detail dialog.
2. Reproduce with `tests/e2e/reseller-order-forward-conflict.spec.py`,
   which drives the flow end to end.
3. `pg_indexes` for `public.reseller_orders` — confirm the partial predicate
   still exists.
