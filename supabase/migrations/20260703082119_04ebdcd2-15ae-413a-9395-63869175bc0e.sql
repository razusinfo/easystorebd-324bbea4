-- Allow authenticated customers to view their own orders (and items)
-- matched by the phone number stored in their auth user_metadata.

CREATE POLICY "Customers view their own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  customer_phone IS NOT NULL
  AND customer_phone = ((auth.jwt() -> 'user_metadata') ->> 'phone')
);

CREATE POLICY "Customers view their own order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.customer_phone IS NOT NULL
      AND o.customer_phone = ((auth.jwt() -> 'user_metadata') ->> 'phone')
  )
);
