
-- 1. Grant column-level read access matching existing product columns.
GRANT SELECT (supplier_id) ON public.products TO authenticated;
GRANT SELECT (supplier_id) ON public.products TO service_role;
-- NOTE: not granted to anon — supplier identity is not part of the public
-- product listing.

-- 2. Strict trigger: normalize/enforce supplier_id on every insert & update.
-- Replaces the previous set_product_supplier_id (which only filled NULLs)
-- so bad values sent from the app are corrected rather than accepted.
CREATE OR REPLACE FUNCTION public.set_product_supplier_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _expected uuid;
BEGIN
  IF NEW.source_reseller_product_id IS NOT NULL THEN
    SELECT s.owner_user_id INTO _expected
      FROM public.reseller_products rp
      JOIN public.products op ON op.id = rp.original_product_id
      JOIN public.stores s ON s.id = op.store_id
     WHERE rp.id = NEW.source_reseller_product_id
     LIMIT 1;
  END IF;

  IF _expected IS NULL THEN
    SELECT owner_user_id INTO _expected
      FROM public.stores WHERE id = NEW.store_id;
  END IF;

  -- Enforce: value coming in from the client is ignored if it disagrees.
  NEW.supplier_id := _expected;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_product_supplier_id() FROM PUBLIC, anon, authenticated;

-- Recreate trigger to also fire when source_reseller_product_id changes.
DROP TRIGGER IF EXISTS trg_set_product_supplier_id ON public.products;
CREATE TRIGGER trg_set_product_supplier_id
  BEFORE INSERT OR UPDATE OF store_id, source_reseller_product_id, supplier_id
  ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_product_supplier_id();

-- 3. Admin report function: returns products whose supplier_id is null or
-- does not equal the expected supplier owner.
CREATE OR REPLACE FUNCTION public.admin_check_product_supplier_integrity()
RETURNS TABLE (
  product_id uuid,
  product_name text,
  store_id uuid,
  source_reseller_product_id uuid,
  actual_supplier_id uuid,
  expected_supplier_id uuid,
  issue text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin only';
  END IF;

  RETURN QUERY
  WITH expected AS (
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.store_id,
      p.source_reseller_product_id,
      p.supplier_id AS actual_supplier_id,
      COALESCE(
        (
          SELECT s.owner_user_id
            FROM public.reseller_products rp
            JOIN public.products op ON op.id = rp.original_product_id
            JOIN public.stores s ON s.id = op.store_id
           WHERE rp.id = p.source_reseller_product_id
           LIMIT 1
        ),
        (SELECT owner_user_id FROM public.stores WHERE id = p.store_id)
      ) AS expected_supplier_id
    FROM public.products p
  )
  SELECT
    e.product_id,
    e.product_name,
    e.store_id,
    e.source_reseller_product_id,
    e.actual_supplier_id,
    e.expected_supplier_id,
    CASE
      WHEN e.actual_supplier_id IS NULL AND e.expected_supplier_id IS NULL THEN 'no_owner'
      WHEN e.actual_supplier_id IS NULL THEN 'null'
      WHEN e.expected_supplier_id IS NULL THEN 'orphaned'
      WHEN e.actual_supplier_id <> e.expected_supplier_id THEN 'mismatch'
      ELSE 'ok'
    END AS issue
  FROM expected e
  WHERE
    e.actual_supplier_id IS NULL
    OR e.expected_supplier_id IS NULL
    OR e.actual_supplier_id <> e.expected_supplier_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_check_product_supplier_integrity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_check_product_supplier_integrity() TO authenticated;
