
-- Tighten guest ORDER insert policy
DROP POLICY IF EXISTS "Guests can place orders on published stores" ON public.orders;

CREATE POLICY "Guests can place orders on published stores"
ON public.orders
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = orders.store_id AND s.published = true
  )
  AND status = 'pending'::order_status
  AND payment_status IN ('unpaid'::payment_status, 'paid'::payment_status)
  AND btrim(customer_name) <> ''
  AND btrim(customer_phone) <> ''
  AND length(customer_name) <= 200
  AND length(customer_phone) <= 40
  AND length(coalesce(customer_address, '')) <= 1000
  AND length(coalesce(notes, '')) <= 2000
  AND subtotal >= 0
  AND delivery_charge >= 0
  AND discount >= 0
  AND total >= 0
  AND (
    -- Anonymous placers must not claim an account
    (auth.uid() IS NULL AND customer_user_id IS NULL)
    OR
    -- Signed-in customers can only attribute the order to themselves (or leave null)
    (auth.uid() IS NOT NULL AND (customer_user_id IS NULL OR customer_user_id = auth.uid()))
  )
);

-- Tighten guest ORDER ITEMS insert policy
DROP POLICY IF EXISTS "Guests can add items to their new order" ON public.order_items;

CREATE POLICY "Guests can add items to their new order"
ON public.order_items
FOR INSERT
TO anon, authenticated
WITH CHECK (
  price >= 0
  AND quantity > 0
  AND quantity <= 10000
  AND subtotal >= 0
  AND length(name) <= 300
  AND length(coalesce(variant_label, '')) <= 200
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.stores s ON s.id = o.store_id
    WHERE o.id = order_items.order_id
      AND s.published = true
      AND o.status = 'pending'::order_status
      AND o.created_at > (now() - interval '15 minutes')
      AND (
        -- Anonymous inserts only into orders with no user attributed
        (auth.uid() IS NULL AND o.customer_user_id IS NULL)
        OR
        -- Signed-in customers can only add items to their own order or to a guest cart
        (auth.uid() IS NOT NULL AND (o.customer_user_id IS NULL OR o.customer_user_id = auth.uid()))
      )
  )
);
