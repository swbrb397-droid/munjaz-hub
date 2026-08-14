-- enums
DO $$ BEGIN CREATE TYPE public.account_tier AS ENUM ('free','pro','corporate'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.withdrawal_status AS ENUM ('queued','auto_approved','manual_review','processing','paid','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.incident_kind AS ENUM ('withdrawal_spike','large_withdrawal','admin_access_attempt','rate_limit','frozen_account_attempt'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_tier public.account_tier NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_reason text,
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz;

-- protect the new privileged columns
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    NEW.kyc_tier := OLD.kyc_tier;
    NEW.is_verified := OLD.is_verified;
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
END; $function$;

-- withdrawal requests
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount_usdt numeric(18,6) NOT NULL,
  fee_usdt numeric(18,6) NOT NULL DEFAULT 0,
  net_usdt numeric(18,6) NOT NULL DEFAULT 0,
  network public.usdt_network NOT NULL DEFAULT 'trc20',
  address text NOT NULL,
  status public.withdrawal_status NOT NULL DEFAULT 'queued',
  tier public.account_tier NOT NULL DEFAULT 'free',
  sla_hours integer NOT NULL DEFAULT 48,
  process_by timestamptz,
  risk_score numeric(5,2) NOT NULL DEFAULT 0,
  risk_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  transaction_id uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  admin_note text,
  tx_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own withdrawals" ON public.withdrawal_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage withdrawals" ON public.withdrawal_requests
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS withdrawal_requests_user_idx ON public.withdrawal_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS withdrawal_requests_status_idx ON public.withdrawal_requests(status, process_by);

CREATE TRIGGER withdrawal_requests_updated_at BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- security incidents
CREATE TABLE IF NOT EXISTS public.security_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  kind public.incident_kind NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  detail text NOT NULL DEFAULT '',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  froze_account boolean NOT NULL DEFAULT false,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.security_incidents TO authenticated;
GRANT ALL ON public.security_incidents TO service_role;
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read incidents" ON public.security_incidents
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rate_limit_events TO service_role;
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS rate_limit_events_idx ON public.rate_limit_events(user_id, action, created_at DESC);

CREATE OR REPLACE FUNCTION public.check_rate_limit(_action text, _max integer, _window interval)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE hits integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  DELETE FROM public.rate_limit_events WHERE created_at < now() - interval '1 day';
  SELECT count(*) INTO hits FROM public.rate_limit_events
    WHERE user_id = auth.uid() AND action = _action AND created_at > now() - _window;
  IF hits >= _max THEN
    INSERT INTO public.security_incidents (user_id, kind, severity, detail, meta)
      VALUES (auth.uid(), 'rate_limit', 'medium', 'Rate limit exceeded for ' || _action,
              jsonb_build_object('action', _action, 'hits', hits));
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;
  INSERT INTO public.rate_limit_events (user_id, action) VALUES (auth.uid(), _action);
  RETURN hits + 1;
END; $$;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, interval) FROM anon;

-- security sentinel: log an incident (admin route probing etc.)
CREATE OR REPLACE FUNCTION public.log_security_event(_kind public.incident_kind, _detail text, _meta jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE new_id uuid; recent integer; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  INSERT INTO public.security_incidents (user_id, kind, severity, detail, meta)
    VALUES (uid, _kind, CASE WHEN _kind = 'admin_access_attempt' THEN 'high' ELSE 'medium' END,
            left(coalesce(_detail,''), 500), coalesce(_meta,'{}'::jsonb))
    RETURNING id INTO new_id;

  IF _kind = 'admin_access_attempt' THEN
    SELECT count(*) INTO recent FROM public.security_incidents
      WHERE user_id = uid AND kind = 'admin_access_attempt' AND created_at > now() - interval '1 hour';
    IF recent >= 5 THEN
      UPDATE public.profiles SET is_frozen = true, frozen_reason = 'Repeated unauthorized admin access attempts', frozen_at = now()
        WHERE id = uid AND NOT is_frozen;
      UPDATE public.security_incidents SET froze_account = true, severity = 'critical' WHERE id = new_id;
    END IF;
  END IF;
  RETURN new_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.log_security_event(public.incident_kind, text, jsonb) FROM anon;

-- sentinel trigger on withdrawal requests
CREATE OR REPLACE FUNCTION public.withdrawal_sentinel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE recent_count integer; recent_sum numeric(18,6); do_freeze boolean := false; reason text;
BEGIN
  SELECT count(*), coalesce(sum(amount_usdt),0) INTO recent_count, recent_sum
    FROM public.withdrawal_requests
    WHERE user_id = NEW.user_id AND created_at > now() - interval '1 hour' AND id <> NEW.id;

  IF recent_count >= 3 THEN
    do_freeze := true; reason := 'Withdrawal spike: more than 3 requests within one hour';
  ELSIF recent_sum + NEW.amount_usdt > 10000 THEN
    do_freeze := true; reason := 'Withdrawal spike: hourly volume above 10,000 USDT';
  END IF;

  IF do_freeze THEN
    UPDATE public.profiles SET is_frozen = true, frozen_reason = reason, frozen_at = now() WHERE id = NEW.user_id;
    INSERT INTO public.security_incidents (user_id, kind, severity, detail, meta, froze_account)
      VALUES (NEW.user_id, 'withdrawal_spike', 'critical', reason,
              jsonb_build_object('recent_count', recent_count, 'recent_sum', recent_sum, 'amount', NEW.amount_usdt), true);
    NEW.status := 'manual_review';
    NEW.risk_score := 100;
    NEW.risk_flags := NEW.risk_flags || jsonb_build_array('account_frozen');
  ELSIF NEW.amount_usdt >= 5000 THEN
    INSERT INTO public.security_incidents (user_id, kind, severity, detail, meta)
      VALUES (NEW.user_id, 'large_withdrawal', 'high', 'Large withdrawal request flagged for review',
              jsonb_build_object('amount', NEW.amount_usdt));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS withdrawal_requests_sentinel ON public.withdrawal_requests;
CREATE TRIGGER withdrawal_requests_sentinel BEFORE INSERT ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.withdrawal_sentinel();

-- main withdrawal entry point
CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric, _network public.usdt_network, _address text)
RETURNS public.withdrawal_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  uid uuid := auth.uid();
  amt numeric(18,6);
  fee numeric(18,6) := 0.8;
  prof RECORD;
  bal numeric(18,6);
  score numeric(5,2) := 0;
  flags jsonb := '[]'::jsonb;
  sla integer;
  st public.withdrawal_status;
  addr text;
  tx_id uuid;
  row_out public.withdrawal_requests;
  prior integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  PERFORM public.check_rate_limit('withdrawal', 5, interval '1 hour');

  amt := round(_amount::numeric, 6);
  IF amt IS NULL OR amt <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  IF amt < 10 THEN RAISE EXCEPTION 'MIN_WITHDRAWAL_10'; END IF;

  addr := btrim(regexp_replace(coalesce(_address,''), '[^A-Za-z0-9]', '', 'g'));
  IF length(addr) < 26 OR length(addr) > 64 THEN RAISE EXCEPTION 'INVALID_ADDRESS'; END IF;

  SELECT * INTO prof FROM public.profiles WHERE id = uid;
  IF prof.is_frozen THEN
    INSERT INTO public.security_incidents (user_id, kind, severity, detail)
      VALUES (uid, 'frozen_account_attempt', 'high', 'Withdrawal attempted on frozen account');
    RAISE EXCEPTION 'ACCOUNT_FROZEN';
  END IF;

  SELECT available_usdt INTO bal FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF bal IS NULL OR bal < amt + fee THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;

  -- risk scoring
  IF NOT prof.is_verified THEN score := score + 25; flags := flags || jsonb_build_array('unverified_account'); END IF;
  IF prof.kyc_tier = 'tier0' THEN score := score + 20; flags := flags || jsonb_build_array('kyc_tier0'); END IF;
  IF prof.created_at > now() - interval '7 days' THEN score := score + 20; flags := flags || jsonb_build_array('new_account'); END IF;
  IF amt > bal * 0.9 THEN score := score + 15; flags := flags || jsonb_build_array('near_full_balance'); END IF;
  IF amt >= 5000 THEN score := score + 25; flags := flags || jsonb_build_array('large_amount'); END IF;
  SELECT count(*) INTO prior FROM public.withdrawal_requests
    WHERE user_id = uid AND created_at > now() - interval '24 hours';
  IF prior >= 2 THEN score := score + 15; flags := flags || jsonb_build_array('frequent_requests'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.withdrawal_requests WHERE user_id = uid AND address = addr AND status = 'paid') THEN
    score := score + 10; flags := flags || jsonb_build_array('new_payout_address');
  END IF;
  score := LEAST(score, 100);

  sla := CASE WHEN prof.account_tier IN ('pro','corporate') THEN 12 ELSE 48 END;
  IF score >= 50 THEN
    st := 'manual_review';
  ELSIF prof.account_tier IN ('pro','corporate') THEN
    st := 'auto_approved';
  ELSE
    st := 'queued';
  END IF;

  -- hold funds
  PERFORM set_config('munjaz.escrow','on', true);
  UPDATE public.wallets
    SET available_usdt = available_usdt - (amt + fee),
        locked_usdt = locked_usdt + (amt + fee)
    WHERE user_id = uid;

  INSERT INTO public.wallet_transactions (user_id, type, status, amount, fee, network, address, note)
    VALUES (uid, 'withdrawal', 'pending', -amt, fee, _network, addr, 'Withdrawal request')
    RETURNING id INTO tx_id;
  PERFORM set_config('munjaz.escrow','off', true);

  INSERT INTO public.withdrawal_requests
    (user_id, amount_usdt, fee_usdt, net_usdt, network, address, status, tier, sla_hours, process_by, risk_score, risk_flags, transaction_id)
  VALUES
    (uid, amt, fee, amt - fee, _network, addr, st, prof.account_tier, sla, now() + make_interval(hours => sla), score, flags, tx_id)
  RETURNING * INTO row_out;

  RETURN row_out;
END; $$;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(numeric, public.usdt_network, text) FROM anon;

-- admin resolution
CREATE OR REPLACE FUNCTION public.resolve_withdrawal(_id uuid, _action text, _note text DEFAULT NULL, _tx_hash text DEFAULT NULL)
RETURNS public.withdrawal_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w public.withdrawal_requests; total numeric(18,6);
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO w FROM public.withdrawal_requests WHERE id = _id FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF w.status IN ('paid','rejected') THEN RAISE EXCEPTION 'ALREADY_RESOLVED'; END IF;
  total := w.amount_usdt + w.fee_usdt;

  PERFORM set_config('munjaz.escrow','on', true);
  IF _action = 'approve' THEN
    UPDATE public.withdrawal_requests SET status = 'processing', reviewed_by = auth.uid(), reviewed_at = now(), admin_note = _note WHERE id = _id;
  ELSIF _action = 'pay' THEN
    UPDATE public.wallets SET locked_usdt = locked_usdt - total WHERE user_id = w.user_id;
    UPDATE public.wallet_transactions SET status = 'confirmed', tx_hash = _tx_hash WHERE id = w.transaction_id;
    UPDATE public.withdrawal_requests SET status = 'paid', reviewed_by = auth.uid(), reviewed_at = now(), admin_note = _note, tx_hash = _tx_hash WHERE id = _id;
  ELSIF _action = 'reject' THEN
    UPDATE public.wallets SET locked_usdt = locked_usdt - total, available_usdt = available_usdt + total WHERE user_id = w.user_id;
    UPDATE public.wallet_transactions SET status = 'cancelled' WHERE id = w.transaction_id;
    UPDATE public.withdrawal_requests SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), admin_note = _note WHERE id = _id;
  ELSE
    RAISE EXCEPTION 'INVALID_ACTION';
  END IF;
  PERFORM set_config('munjaz.escrow','off', true);

  SELECT * INTO w FROM public.withdrawal_requests WHERE id = _id;
  RETURN w;
END; $$;
REVOKE EXECUTE ON FUNCTION public.resolve_withdrawal(uuid, text, text, text) FROM anon;

CREATE OR REPLACE FUNCTION public.set_account_frozen(_user_id uuid, _frozen boolean, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  UPDATE public.profiles
    SET is_frozen = _frozen,
        frozen_reason = CASE WHEN _frozen THEN coalesce(_reason,'Frozen by admin') ELSE NULL END,
        frozen_at = CASE WHEN _frozen THEN now() ELSE NULL END
    WHERE id = _user_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.set_account_frozen(uuid, boolean, text) FROM anon;

-- AI agent: auto-advance queued requests whose SLA window opened
CREATE OR REPLACE FUNCTION public.process_withdrawal_queue()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE moved integer;
BEGIN
  WITH due AS (
    SELECT id FROM public.withdrawal_requests
    WHERE status IN ('queued','auto_approved') AND risk_score < 50 AND process_by <= now()
  ), upd AS (
    UPDATE public.withdrawal_requests w SET status = 'processing' FROM due WHERE w.id = due.id RETURNING w.id
  )
  SELECT count(*) INTO moved FROM upd;
  RETURN moved;
END; $$;
REVOKE EXECUTE ON FUNCTION public.process_withdrawal_queue() FROM anon, authenticated;