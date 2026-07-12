
-- Add supplier_id to products, referencing the supplier user (auth.users.id).
-- No FK to auth.users (managed schema); enforced via backfill + trigger.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS supplier_id uuid;

COMMENT ON COLUMN public.products.supplier_id IS
  'User id of the supplier who owns/provides this product. For reseller shop copies, this is the owner of the source product''s store. For original products, this is the store owner.';

CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON public.products(supplier_id);

-- Backfill: reseller copies -> owner of the original supplier product's store.
UPDATE public.products p
   SET supplier_id = s.owner_user_id
  FROM public.reseller_products rp
  JOIN public.products op ON op.id = rp.original_product_id
  JOIN public.stores s ON s.id = op.store_id
 WHERE p.source_reseller_product_id = rp.id
   AND p.supplier_id IS DISTINCT FROM s.owner_user_id;

-- Backfill: original products -> owner of their own store.
UPDATE public.products p
   SET supplier_id = s.owner_user_id
  FROM public.stores s
 WHERE p.store_id = s.id
   AND p.supplier_id IS NULL
   AND s.owner_user_id IS NOT NULL;

-- Trigger: auto-populate supplier_id on insert/update when not set.
CREATE OR REPLACE FUNCTION public.set_product_supplier_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supplier uuid;
BEGIN
  IF NEW.supplier_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.source_reseller_product_id IS NOT NULL THEN
    SELECT s.owner_user_id INTO _supplier
      FROM public.reseller_products rp
      JOIN public.products op ON op.id = rp.original_product_id
      JOIN public.stores s ON s.id = op.store_id
     WHERE rp.id = NEW.source_reseller_product_id
     LIMIT 1;
  END IF;

  IF _supplier IS NULL THEN
    SELECT owner_user_id INTO _supplier
      FROM public.stores WHERE id = NEW.store_id;
  END IF;

  NEW.supplier_id := _supplier;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_product_supplier_id ON public.products;
CREATE TRIGGER trg_set_product_supplier_id
  BEFORE INSERT OR UPDATE OF store_id, source_reseller_product_id, supplier_id
  ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_product_supplier_id();
