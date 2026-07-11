REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (
  id, store_id, name, price, stock, status, created_at, updated_at,
  image_url, short_description, description, category_id, brand, condition,
  weight_kg, length_cm, width_cm, height_cm, regular_price,
  sku, unit_name, product_serial, warranty, initial_sold_count,
  use_default_delivery, video_url, gallery_urls,
  default_delivery_charge, specific_delivery_charges, is_out_of_stock
) ON public.products TO anon;

REVOKE EXECUTE ON FUNCTION public.retry_forward_order_item(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retry_forward_order_item(uuid) TO authenticated;