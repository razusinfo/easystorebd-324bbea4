
CREATE TABLE IF NOT EXISTS public.product_stock_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  store_id uuid,
  source_url text NOT NULL,
  http_status int,
  duration_ms int,
  attempts int NOT NULL DEFAULT 1,
  availability text,
  previous_status text,
  new_status text,
  changed boolean NOT NULL DEFAULT false,
  error_message text,
  triggered_by text NOT NULL DEFAULT 'cron',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_stock_sync_logs_product_idx
  ON public.product_stock_sync_logs (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_stock_sync_logs_store_idx
  ON public.product_stock_sync_logs (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_stock_sync_logs_created_idx
  ON public.product_stock_sync_logs (created_at DESC);

GRANT SELECT ON public.product_stock_sync_logs TO authenticated;
GRANT ALL ON public.product_stock_sync_logs TO service_role;

ALTER TABLE public.product_stock_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all stock sync logs"
  ON public.product_stock_sync_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Store owners view their product sync logs"
  ON public.product_stock_sync_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = product_stock_sync_logs.store_id
        AND s.owner_user_id = auth.uid()
    )
  );
