-- Remove insecure user_metadata-based policies
DROP POLICY IF EXISTS "Customers view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Customers view their own order items" ON public.order_items;

-- Add a customer user link on orders (nullable so guest checkout still works)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_customer_user_id_idx
  ON public.orders (customer_user_id);

-- Signed-in shoppers can read their own orders
CREATE POLICY "Customers view their own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (customer_user_id IS NOT NULL AND customer_user_id = auth.uid());

-- Signed-in shoppers can read line items of their own orders
CREATE POLICY "Customers view their own order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.customer_user_id = auth.uid()
  )
);
