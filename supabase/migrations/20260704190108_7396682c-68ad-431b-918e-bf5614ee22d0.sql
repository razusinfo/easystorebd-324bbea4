CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (length(btrim(message)) > 0 AND length(message) <= 4000),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX support_messages_sender_idx ON public.support_messages(sender_id, created_at DESC);
CREATE INDEX support_messages_receiver_idx ON public.support_messages(receiver_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Users can read messages they sent or received; super_admin can read all
CREATE POLICY "Read own or admin"
ON public.support_messages FOR SELECT
TO authenticated
USING (
  sender_id = auth.uid()
  OR receiver_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin')
);

-- Users can insert as themselves (receiver_id NULL means "to admins");
-- super_admin can also insert (replies) with sender_id = self.
CREATE POLICY "Send as self"
ON public.support_messages FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid());

-- Only recipient (or admins) may mark messages as read
CREATE POLICY "Mark received as read"
ON public.support_messages FOR UPDATE
TO authenticated
USING (
  receiver_id = auth.uid()
  OR (receiver_id IS NULL AND public.has_role(auth.uid(), 'super_admin'))
  OR public.has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  receiver_id = auth.uid()
  OR (receiver_id IS NULL AND public.has_role(auth.uid(), 'super_admin'))
  OR public.has_role(auth.uid(), 'super_admin')
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;