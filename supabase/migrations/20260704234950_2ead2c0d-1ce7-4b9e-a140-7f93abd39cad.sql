
-- 1. Widen the "out of stock" derived flag to the new low-stock threshold (<= 3).
ALTER TABLE public.products      DROP COLUMN IF EXISTS is_out_of_stock;
ALTER TABLE public.products
  ADD COLUMN  is_out_of_stock boolean
  GENERATED ALWAYS AS (COALESCE(stock, 0) <= 3) STORED;

ALTER TABLE public.reseller_products DROP COLUMN IF EXISTS is_out_of_stock;
ALTER TABLE public.reseller_products
  ADD COLUMN  is_out_of_stock boolean
  GENERATED ALWAYS AS (COALESCE(stock, 0) <= 3) STORED;

CREATE INDEX IF NOT EXISTS products_oos_created_idx
  ON public.products(store_id, is_out_of_stock, created_at DESC);
CREATE INDEX IF NOT EXISTS reseller_products_oos_updated_idx
  ON public.reseller_products(is_out_of_stock, updated_at DESC);

-- 2. Update the propagation trigger:
--    fire notifications on the low-stock crossing (>3 -> <=3), to BOTH
--    the affected reseller store owners and every super admin.
CREATE OR REPLACE FUNCTION public.sync_reseller_stock_to_shops()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.stock IS DISTINCT FROM OLD.stock THEN
    UPDATE public.products
      SET stock = NEW.stock, updated_at = now()
      WHERE source_reseller_product_id = NEW.id
        AND stock IS DISTINCT FROM NEW.stock;

    IF COALESCE(NEW.stock, 0) <= 3 AND COALESCE(OLD.stock, 0) > 3 THEN
      -- Reseller alerts (one per affected store owner).
      INSERT INTO public.user_notifications (user_id, type, title, body, link, related_id)
      SELECT DISTINCT s.owner_user_id,
             'supplier_low_stock',
             'Low stock from supplier',
             format('"%s" has only %s left from the supplier.', NEW.name, COALESCE(NEW.stock,0)),
             '/reseller-products',
             NEW.id::text
      FROM public.products p
      JOIN public.stores s ON s.id = p.store_id
      WHERE p.source_reseller_product_id = NEW.id
        AND s.owner_user_id IS NOT NULL;

      -- Super admin alerts (one per super_admin).
      INSERT INTO public.admin_notifications (type, title, body, link, related_id)
      SELECT 'supplier_low_stock',
             'Marketplace item is low on stock',
             format('"%s" has only %s left (threshold 3).', NEW.name, COALESCE(NEW.stock,0)),
             '/admin',
             NEW.id::text;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
