-- 1. profiles.kyc_status
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_status text NOT NULL DEFAULT 'unverified';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_kyc_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_kyc_status_check CHECK (kyc_status IN ('unverified','pending','approved','rejected'));

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    NEW.kyc_tier := OLD.kyc_tier;
    NEW.is_verified := OLD.is_verified;
    NEW.kyc_status := OLD.kyc_status;
    NEW.xp_points := OLD.xp_points;
    NEW.level := OLD.level;
    NEW.rating := OLD.rating;
    NEW.completed_orders := OLD.completed_orders;
    NEW.referral_code := OLD.referral_code;
    NEW.referred_by := OLD.referred_by;
    NEW.account_tier := OLD.account_tier;
    NEW.is_frozen := OLD.is_frozen;
    NEW.frozen_reason := OLD.frozen_reason;
    NEW.frozen_at := OLD.frozen_at;
  END IF;
  RETURN NEW;
END; $$;

-- 2. KYC submissions
CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  doc_type text NOT NULL DEFAULT 'id',
  front_path text NOT NULL,
  back_path text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.kyc_submissions TO authenticated;
GRANT UPDATE ON public.kyc_submissions TO authenticated;
GRANT ALL ON public.kyc_submissions TO service_role;

ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kyc own select" ON public.kyc_submissions;
CREATE POLICY "kyc own select" ON public.kyc_submissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "kyc own insert" ON public.kyc_submissions;
CREATE POLICY "kyc own insert" ON public.kyc_submissions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "kyc admin update" ON public.kyc_submissions;
CREATE POLICY "kyc admin update" ON public.kyc_submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS kyc_submissions_updated_at ON public.kyc_submissions;
CREATE TRIGGER kyc_submissions_updated_at BEFORE UPDATE ON public.kyc_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS kyc_submissions_status_idx ON public.kyc_submissions (status, created_at DESC);

-- 3. storefront filter columns
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS delivery_days integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'both';

ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_language_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_language_check CHECK (language IN ('ar','en','both'));

-- 4. KYC RPCs
CREATE OR REPLACE FUNCTION public.submit_kyc(_doc_type text, _front_path text, _back_path text DEFAULT NULL)
RETURNS public.kyc_submissions
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid(); row_out public.kyc_submissions;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF coalesce(btrim(_front_path),'') = '' THEN RAISE EXCEPTION 'FRONT_REQUIRED'; END IF;
  PERFORM public.check_rate_limit('kyc_submit', 5, interval '1 hour');

  INSERT INTO public.kyc_submissions (user_id, doc_type, front_path, back_path, status)
  VALUES (uid, coalesce(nullif(btrim(_doc_type),''),'id'), _front_path, nullif(btrim(_back_path),''), 'pending')
  RETURNING * INTO row_out;

  UPDATE public.profiles SET kyc_status = 'pending' WHERE id = uid;
  RETURN row_out;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_review_kyc(_submission_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS public.kyc_submissions
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE row_out public.kyc_submissions;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  UPDATE public.kyc_submissions
    SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
        admin_note = _note, reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = _submission_id
    RETURNING * INTO row_out;
  IF row_out.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  UPDATE public.profiles
    SET kyc_status = row_out.status,
        is_verified = _approve,
        kyc_tier = CASE WHEN _approve THEN 'tier2'::public.kyc_tier ELSE kyc_tier END
    WHERE id = row_out.user_id;

  RETURN row_out;
END; $$;

-- 5. deposits
CREATE OR REPLACE FUNCTION public.create_deposit(_amount numeric, _network usdt_network, _address text DEFAULT NULL)
RETURNS public.wallet_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid(); amt numeric(18,6); row_out public.wallet_transactions;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  amt := round(_amount::numeric, 6);
  IF amt IS NULL OR amt <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  PERFORM public.check_rate_limit('deposit', 20, interval '1 hour');

  INSERT INTO public.wallet_transactions (user_id, type, status, amount, fee, network, address, note)
  VALUES (uid, 'deposit', 'pending', amt, 0, _network, nullif(btrim(_address),''), 'Incoming USDT deposit')
  RETURNING * INTO row_out;
  RETURN row_out;
END; $$;

CREATE OR REPLACE FUNCTION public.confirm_deposit(_tx_id uuid, _tx_hash text DEFAULT NULL)
RETURNS public.wallet_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE tx public.wallet_transactions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO tx FROM public.wallet_transactions WHERE id = _tx_id FOR UPDATE;
  IF tx.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF tx.user_id <> auth.uid() AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF tx.type <> 'deposit' THEN RAISE EXCEPTION 'NOT_A_DEPOSIT'; END IF;
  IF tx.status = 'confirmed' THEN RETURN tx; END IF;

  PERFORM set_config('munjaz.escrow','on', true);
  UPDATE public.wallets SET available_usdt = available_usdt + tx.amount WHERE user_id = tx.user_id;
  UPDATE public.wallet_transactions SET status = 'confirmed', tx_hash = coalesce(_tx_hash, tx_hash)
    WHERE id = tx.id RETURNING * INTO tx;
  PERFORM set_config('munjaz.escrow','off', true);

  RETURN tx;
END; $$;

-- 6. admin dispute settlement
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(_case_id uuid, _action text, _ruling text DEFAULT NULL)
RETURNS public.dispute_cases
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE c public.dispute_cases;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO c FROM public.dispute_cases WHERE id = _case_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  IF c.order_id IS NOT NULL THEN
    IF _action = 'release' THEN
      UPDATE public.orders SET status = 'completed' WHERE id = c.order_id AND status <> 'completed';
    ELSIF _action = 'refund' THEN
      UPDATE public.orders SET status = 'refunded' WHERE id = c.order_id AND status NOT IN ('refunded','cancelled');
    ELSE
      RAISE EXCEPTION 'INVALID_ACTION';
    END IF;
  END IF;

  UPDATE public.dispute_cases
    SET status = 'resolved',
        admin_ruling = coalesce(_ruling, CASE WHEN _action = 'release' THEN 'Escrow released to seller' ELSE 'Escrow refunded to buyer' END),
        resolved_by = auth.uid(), resolved_at = now()
    WHERE id = _case_id RETURNING * INTO c;

  INSERT INTO public.security_incidents (user_id, kind, severity, detail, meta)
    VALUES (auth.uid(), 'admin_access_attempt', 'medium',
            'Dispute resolved by admin: ' || _action,
            jsonb_build_object('case_id', _case_id, 'order_id', c.order_id, 'action', _action));
  RETURN c;
END; $$;

-- 7. storage policies for kyc-documents
DROP POLICY IF EXISTS "kyc docs own upload" ON storage.objects;
CREATE POLICY "kyc docs own upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "kyc docs own read" ON storage.objects;
CREATE POLICY "kyc docs own read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));

-- 8. realtime
ALTER TABLE public.wallets REPLICA IDENTITY FULL;
ALTER TABLE public.wallet_transactions REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;