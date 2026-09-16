
-- Video call fields on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS video_call_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS video_call_caller_id uuid,
  ADD COLUMN IF NOT EXISTS video_call_room_id text,
  ADD COLUMN IF NOT EXISTS video_call_updated_at timestamptz;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_video_call_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_video_call_status_check
  CHECK (video_call_status IN ('idle','pending','accepted','declined','active','ended'));

-- Notification preferences on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL
  DEFAULT '{"orders":true,"escrow":true,"disputes":true,"deliveries":true,"referrals":true}'::jsonb;

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users mark own notifications" ON public.notifications;
CREATE POLICY "Users mark own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

-- Realtime: add tables to supabase_realtime publication if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.orders';
  END IF;
END $$;

-- Helper: unspent crypto deposit balance (for anti-mixing fee)
-- Deposits credit the wallet; any escrow_lock reduces "unspent" first.
CREATE OR REPLACE FUNCTION public.unspent_deposit_balance(_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH totals AS (
    SELECT
      COALESCE(SUM(CASE WHEN type = 'deposit' AND status = 'confirmed' THEN amount ELSE 0 END), 0) AS deposited,
      COALESCE(SUM(CASE WHEN type = 'escrow_lock' AND status = 'confirmed' THEN amount ELSE 0 END), 0) AS locked
    FROM public.wallet_transactions
    WHERE user_id = _user_id
  )
  SELECT GREATEST(totals.deposited - totals.locked, 0) FROM totals;
$$;

GRANT EXECUTE ON FUNCTION public.unspent_deposit_balance(uuid) TO authenticated;
