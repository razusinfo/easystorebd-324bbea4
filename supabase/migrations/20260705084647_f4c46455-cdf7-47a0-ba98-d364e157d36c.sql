DROP POLICY IF EXISTS "Store owners and admins can view reseller products" ON public.reseller_products;

CREATE POLICY "Authenticated users can view reseller products"
ON public.reseller_products
FOR SELECT
TO authenticated
USING (true);

-- Backfill missing default role so existing users behave like new signups.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'store_owner'::app_role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;