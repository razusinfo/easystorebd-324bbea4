
-- Allow guests (anon) to place orders on published storefronts.
-- SELECT is NOT granted to anon; only INSERT of orders and their items.

GRANT INSERT ON public.orders TO anon;
GRANT INSERT ON public.order_items TO anon;

CREATE POLICY "Guests can place orders on published stores"
ON public.orders
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = orders.store_id AND s.published = true
  )
);

CREATE POLICY "Guests can add items to their new order"
ON public.order_items
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.stores s ON s.id = o.store_id
    WHERE o.id = order_items.order_id AND s.published = true
  )
);
