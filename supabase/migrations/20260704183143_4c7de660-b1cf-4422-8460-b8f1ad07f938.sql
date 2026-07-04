
ALTER TABLE public.reseller_products
  ADD COLUMN IF NOT EXISTS price_overridden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS image_overridden boolean NOT NULL DEFAULT false;

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
      price, reseller_price, category, source, updated_at
    ) VALUES (
      NEW.id::text, NEW.id, NEW.name, NEW.description, NEW.image_url, NEW.image_url,
      NEW.price, NEW.reseller_price, cat_name, 'trigger', now()
    )
    ON CONFLICT (external_id) DO UPDATE SET
      original_product_id = EXCLUDED.original_product_id,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      -- respect manual image override
      image = CASE WHEN COALESCE(existing.image_overridden, false) THEN existing.image ELSE EXCLUDED.image END,
      image_url = CASE WHEN COALESCE(existing.image_overridden, false) THEN existing.image_url ELSE EXCLUDED.image_url END,
      price = EXCLUDED.price,
      -- respect manual reseller_price override
      reseller_price = CASE WHEN COALESCE(existing.price_overridden, false) THEN existing.reseller_price ELSE EXCLUDED.reseller_price END,
      category = EXCLUDED.category,
      updated_at = now();
  ELSE
    DELETE FROM public.reseller_products WHERE external_id = NEW.id::text;
  END IF;

  RETURN NEW;
END;
$function$;
