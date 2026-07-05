-- Drop the broad table-level SELECT so column-level grants take effect.
REVOKE SELECT ON public.products FROM anon;
REVOKE SELECT ON public.products FROM authenticated;

-- Grant SELECT on every column EXCEPT buying_price and reseller_price.
GRANT SELECT (
  id, store_id, name, price, stock, status, created_at, updated_at,
  image_url, short_description, description, category_id, brand, condition,
  weight_kg, length_cm, width_cm, height_cm, regular_price, sku, unit_name,
  product_serial, warranty, initial_sold_count, use_default_delivery,
  video_url, gallery_urls, default_delivery_charge, specific_delivery_charges,
  add_to_reseller, is_resellable, source_reseller_product_id, is_out_of_stock
) ON public.products TO anon, authenticated;

-- Keep write privileges for authenticated (RLS still gates who may write).
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;