
-- 1. Stock on reseller_products
ALTER TABLE public.reseller_products
  ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0;

-- 2. Track which reseller_products a reseller's own products row was copied from
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS source_reseller_product_id uuid
  REFERENCES public.reseller_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS products_source_reseller_product_idx
  ON public.products(source_reseller_product_id)
  WHERE source_reseller_product_id IS NOT NULL;

-- 3. Backfill stock from the supplier product
UPDATE public.reseller_products rp
SET stock = p.stock
FROM public.products p
WHERE rp.original_product_id = p.id
  AND rp.stock IS DISTINCT FROM p.stock;

-- 4. Update sync trigger to keep stock in sync going forward
CREATE OR REPLACE FUNCTION public.sync_reseller_product()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cat_name text;
  existing public.reseller_products%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.reseller_products WHERE external_id = OLD.id::text;
    RETURN OLD;
  END IF;

  IF COALESCE(NEW.add_to_reseller, false) THEN
    SELECT pc.name INTO cat_name
    FROM public.product_category_assignments pca
    JOIN public.product_categories pc ON pc.id = pca.category_id
    WHERE pca.product_id = NEW.id
    LIMIT 1;

    IF cat_name IS NULL AND NEW.category_id IS NOT NULL THEN
      SELECT name INTO cat_name FROM public.product_categories WHERE id = NEW.category_id;
    END IF;

    SELECT * INTO existing FROM public.reseller_products WHERE external_id = NEW.id::text;

    INSERT INTO public.reseller_products (
      external_id, original_product_id, name, description, image, image_url,
      price, reseller_price, category, source, stock, updated_at
    ) VALUES (
      NEW.id::text, NEW.id, NEW.name, NEW.description, NEW.image_url, NEW.image_url,
      NEW.price, NEW.reseller_price, cat_name, 'trigger', NEW.stock, now()
    )
    ON CONFLICT (external_id) DO UPDATE SET
      original_product_id = EXCLUDED.original_product_id,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      image = CASE WHEN COALESCE(existing.image_overridden, false) THEN existing.image ELSE EXCLUDED.image END,
      image_url = CASE WHEN COALESCE(existing.image_overridden, false) THEN existing.image_url ELSE EXCLUDED.image_url END,
      price = EXCLUDED.price,
      reseller_price = CASE WHEN COALESCE(existing.price_overridden, false) THEN existing.reseller_price ELSE EXCLUDED.reseller_price END,
      category = EXCLUDED.category,
      stock = EXCLUDED.stock,
      updated_at = now();
  ELSE
    DELETE FROM public.reseller_products WHERE external_id = NEW.id::text;
  END IF;

  RETURN NEW;
END;
$function$;

-- 5. Per-user notifications table
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  related_id text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.user_notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark their own notifications read"
  ON public.user_notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_notifications_user_created_idx
  ON public.user_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_notifications_unread_idx
  ON public.user_notifications(user_id) WHERE read_at IS NULL;

-- 6. Trigger: propagate reseller_products.stock into resellers' products +
-- notify each affected store owner when the item goes out of stock.
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

    IF NEW.stock = 0 AND COALESCE(OLD.stock, 0) <> 0 THEN
      INSERT INTO public.user_notifications (user_id, type, title, body, link, related_id)
      SELECT DISTINCT s.owner_user_id,
             'supplier_out_of_stock',
             'Item out of stock from supplier',
             format('"%s" is currently unavailable from the supplier.', NEW.name),
             '/reseller-products',
             NEW.id::text
      FROM public.products p
      JOIN public.stores s ON s.id = p.store_id
      WHERE p.source_reseller_product_id = NEW.id
        AND s.owner_user_id IS NOT NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_reseller_stock_to_shops_trg ON public.reseller_products;
CREATE TRIGGER sync_reseller_stock_to_shops_trg
  AFTER UPDATE OF stock ON public.reseller_products
  FOR EACH ROW EXECUTE FUNCTION public.sync_reseller_stock_to_shops();
