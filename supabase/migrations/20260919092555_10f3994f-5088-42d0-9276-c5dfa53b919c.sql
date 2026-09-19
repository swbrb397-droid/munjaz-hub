
ALTER TABLE public.governance_settings
  ADD COLUMN IF NOT EXISTS fee_free_pct numeric(6,3) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS fee_pro_pct numeric(6,3) NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS fee_corporate_pct numeric(6,3) NOT NULL DEFAULT 2.5;

INSERT INTO public.governance_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fee_rates()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'free', COALESCE(g.fee_free_pct, 10),
    'pro', COALESCE(g.fee_pro_pct, 5),
    'corporate', COALESCE(g.fee_corporate_pct, 2.5),
    'auto_release_hours', COALESCE(g.auto_release_hours, 48),
    'sla_pro_hours', COALESCE(g.sla_pro_hours, 24)
  )
  FROM public.governance_settings g WHERE g.id = 1
$$;

GRANT EXECUTE ON FUNCTION public.fee_rates() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_metrics()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result json;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  SELECT json_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'pending_kyc', (SELECT count(*) FROM public.kyc_submissions WHERE status = 'pending'),
    'locked_escrow', (SELECT COALESCE(sum(amount_usdt),0) FROM public.orders WHERE status IN ('in_progress','delivered','disputed') AND escrow_locked),
    'deposits_total', (SELECT COALESCE(sum(amount),0) FROM public.wallet_transactions WHERE type = 'deposit' AND status = 'confirmed'),
    'completed_deposits', (SELECT count(*) FROM public.wallet_transactions WHERE type = 'deposit' AND status = 'confirmed'),
    'open_disputes', (SELECT count(*) FROM public.dispute_cases WHERE status IN ('open','ai_reviewed')),
    'pending_withdrawals', (SELECT count(*) FROM public.withdrawal_requests WHERE status IN ('queued','auto_approved','manual_review','processing')),
    'frozen_accounts', (SELECT count(*) FROM public.profiles WHERE is_frozen)
  ) INTO result;
  RETURN result;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_metrics() TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_order_escrow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  net_amount NUMERIC(18,6);
  fee NUMERIC(18,6);
  fee_pct NUMERIC(6,4);
  seller_tier account_tier;
  ref RECORD;
  comm NUMERIC(18,6);
  buyer_balance NUMERIC(18,6);
  g RECORD;
  hold_hours INTEGER;
BEGIN
  PERFORM set_config('munjaz.escrow', 'on', true);
  SELECT * INTO g FROM public.governance_settings WHERE id = 1;

  IF NEW.status = 'in_progress' AND NOT NEW.escrow_locked THEN
    SELECT available_usdt INTO buyer_balance FROM public.wallets WHERE user_id = NEW.buyer_id FOR UPDATE;
    IF buyer_balance IS NULL OR buyer_balance < NEW.amount_usdt THEN
      RAISE EXCEPTION 'INSUFFICIENT_FUNDS';
    END IF;
    UPDATE public.wallets
      SET available_usdt = available_usdt - NEW.amount_usdt,
          locked_usdt = locked_usdt + NEW.amount_usdt
      WHERE user_id = NEW.buyer_id;
    NEW.escrow_locked := true;
    NEW.due_at := COALESCE(NEW.due_at, now() + make_interval(days => NEW.delivery_days));
    INSERT INTO public.wallet_transactions (user_id, type, status, amount, order_id, note)
      VALUES (NEW.buyer_id, 'escrow_lock', 'confirmed', -NEW.amount_usdt, NEW.id, 'Escrow lock');
  END IF;

  IF NEW.status = 'delivered' AND OLD.status <> 'delivered' THEN
    SELECT account_tier INTO seller_tier FROM public.profiles WHERE id = NEW.seller_id;
    hold_hours := CASE
      WHEN seller_tier IN ('pro','corporate') THEN COALESCE(g.sla_pro_hours, 24)
      ELSE COALESCE(g.auto_release_hours, 48)
    END;
    NEW.auto_release_hours := hold_hours;
    NEW.delivered_at := COALESCE(NEW.delivered_at, now());
    NEW.auto_release_at := NEW.delivered_at + make_interval(hours => hold_hours);
  END IF;

  IF NEW.status = 'completed' AND OLD.status <> 'completed' AND NEW.escrow_locked THEN
    SELECT account_tier INTO seller_tier FROM public.profiles WHERE id = NEW.seller_id;
    fee_pct := CASE seller_tier
      WHEN 'pro' THEN COALESCE(g.fee_pro_pct, 5) / 100.0
      WHEN 'corporate' THEN COALESCE(g.fee_corporate_pct, 2.5) / 100.0
      ELSE COALESCE(g.fee_free_pct, 10) / 100.0
    END;
    fee := ROUND(COALESCE(NULLIF(NEW.platform_fee_usdt,0), NEW.amount_usdt * fee_pct), 6);
    net_amount := NEW.amount_usdt - fee;
    NEW.platform_fee_usdt := fee;
    NEW.completed_at := now();
    NEW.escrow_locked := false;

    UPDATE public.wallets SET locked_usdt = locked_usdt - NEW.amount_usdt WHERE user_id = NEW.buyer_id;
    UPDATE public.wallets SET available_usdt = available_usdt + net_amount,
                              lifetime_earned = lifetime_earned + net_amount
      WHERE user_id = NEW.seller_id;

    INSERT INTO public.wallet_transactions (user_id, type, status, amount, fee, order_id, note)
      VALUES (NEW.seller_id, 'escrow_release', 'confirmed', net_amount, fee, NEW.id, 'Escrow release');

    UPDATE public.profiles
      SET completed_orders = completed_orders + 1,
          xp_points = xp_points + GREATEST(10, FLOOR(NEW.amount_usdt / 10)::int),
          level = GREATEST(1, FLOOR((xp_points + GREATEST(10, FLOOR(NEW.amount_usdt / 10)::int)) / 500) + 1)
      WHERE id = NEW.seller_id;

    IF NEW.listing_id IS NOT NULL THEN
      UPDATE public.listings SET orders_count = orders_count + 1 WHERE id = NEW.listing_id;
    END IF;

    SELECT * INTO ref FROM public.referrals r
      WHERE r.referred_id = NEW.seller_id AND r.is_active AND r.expires_at > now();
    IF ref.id IS NOT NULL THEN
      comm := ROUND(fee * ref.commission_rate, 6);
      INSERT INTO public.referral_commissions (referral_id, referrer_id, order_id, platform_fee_usdt, commission_usdt)
        VALUES (ref.id, ref.referrer_id, NEW.id, fee, comm);
      UPDATE public.referrals SET total_earned_usdt = total_earned_usdt + comm WHERE id = ref.id;
      UPDATE public.wallets SET available_usdt = available_usdt + comm WHERE user_id = ref.referrer_id;
      INSERT INTO public.wallet_transactions (user_id, type, status, amount, order_id, note)
        VALUES (ref.referrer_id, 'referral_payout', 'confirmed', comm, NEW.id, 'Referral commission');
    END IF;
  END IF;

  IF NEW.status IN ('refunded','cancelled') AND OLD.status NOT IN ('refunded','cancelled') AND NEW.escrow_locked THEN
    UPDATE public.wallets
      SET locked_usdt = locked_usdt - NEW.amount_usdt,
          available_usdt = available_usdt + NEW.amount_usdt
      WHERE user_id = NEW.buyer_id;
    NEW.escrow_locked := false;
    INSERT INTO public.wallet_transactions (user_id, type, status, amount, order_id, note)
      VALUES (NEW.buyer_id, 'escrow_refund', 'confirmed', NEW.amount_usdt, NEW.id, 'Escrow refund');
  END IF;

  PERFORM set_config('munjaz.escrow', 'off', true);
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(_case_id uuid, _action text, _ruling text DEFAULT NULL::text)
RETURNS dispute_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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

  -- Dispute rulings belong in the admin audit trail, not the security sentinel.
  INSERT INTO public.audit_logs (admin_id, action_type, target_table, target_id, meta)
    VALUES (auth.uid(), 'dispute_resolution', 'dispute_cases', _case_id,
            jsonb_build_object('severity', 'info', 'order_id', c.order_id, 'action', _action));
  RETURN c;
END; $function$;
