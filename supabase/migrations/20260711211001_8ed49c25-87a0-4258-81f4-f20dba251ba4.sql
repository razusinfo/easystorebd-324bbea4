DROP POLICY IF EXISTS "Store owners update store order requests" ON public.order_requests;
CREATE POLICY "Store owners update store order requests"
ON public.order_requests
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = order_requests.store_id AND s.owner_user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = order_requests.store_id AND s.owner_user_id = auth.uid()));