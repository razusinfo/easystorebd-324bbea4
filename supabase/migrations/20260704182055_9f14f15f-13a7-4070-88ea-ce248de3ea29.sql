
CREATE OR REPLACE FUNCTION public.sync_reseller_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cat_name text;
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

    INSERT INTO public.reseller_products (
      external_id, original_product_id, name, description, image, image_url,
      price, reseller_price, category, source, updated_at
    ) VALUES (
      NEW.id::text, NEW.id, NEW.name, NEW.description, NEW.image_url, NEW.image_url,
      NEW.price, NEW.reseller_price, cat_name, 'trigger', now()
    )
    ON CONFLICT (external_id) DO UPDATE SET
      original_product_id = EXCLUDED.original_product_id,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      image = EXCLUDED.image,
      image_url = EXCLUDED.image_url,
      price = EXCLUDED.price,
      reseller_price = EXCLUDED.reseller_price,
      category = EXCLUDED.category,
      updated_at = now();
  ELSE
    DELETE FROM public.reseller_products WHERE external_id = NEW.id::text;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_reseller_product ON public.products;
CREATE TRIGGER trg_sync_reseller_product
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.sync_reseller_product();
