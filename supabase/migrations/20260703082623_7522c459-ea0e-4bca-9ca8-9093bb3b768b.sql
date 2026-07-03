
CREATE TYPE public.order_request_type AS ENUM ('cancellation', 'return');
CREATE TYPE public.order_request_status AS ENUM ('pending', 'approved', 'rejected', 'completed');

CREATE TABLE public.order_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type public.order_request_type NOT NULL,
  reason TEXT NOT NULL,
  status public.order_request_status NOT NULL DEFAULT 'pending',
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_requests TO authenticated;
GRANT ALL ON public.order_requests TO service_role;

ALTER TABLE public.order_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own order requests"
ON public.order_requests FOR SELECT TO authenticated
USING (customer_user_id = auth.uid());

CREATE POLICY "Customers create own order requests"
ON public.order_requests FOR INSERT TO authenticated
WITH CHECK (
  customer_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id AND o.customer_user_id = auth.uid()
  )
);

CREATE POLICY "Store owners view store order requests"
ON public.order_requests FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.stores s
  WHERE s.id = store_id AND s.owner_user_id = auth.uid()
));

CREATE POLICY "Store owners update store order requests"
ON public.order_requests FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.stores s
  WHERE s.id = store_id AND s.owner_user_id = auth.uid()
));

CREATE TRIGGER update_order_requests_updated_at
BEFORE UPDATE ON public.order_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_order_requests_order ON public.order_requests(order_id);
CREATE INDEX idx_order_requests_user ON public.order_requests(customer_user_id);
CREATE INDEX idx_order_requests_store ON public.order_requests(store_id);
