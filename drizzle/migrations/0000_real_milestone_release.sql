ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS released_usdt numeric(18,6) NOT NULL DEFAULT 0;

-- Milestones: clients may not self-mark released, nor edit/delete released ones.
CREATE OR REPLACE FUNCTION public.guard_order_milestone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF coalesce(current_setting('munjaz.escrow', true), '') = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'released' THEN RAISE EXCEPTION 'MILESTONE_RELEASED'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'released' THEN RAISE EXCEPTION 'MILESTONE_RELEASED'; END IF;
  IF NEW.status = 'released' THEN RAISE EXCEPTION 'USE_RELEASE_RPC'; END IF;
  NEW.released_at := NULL;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_order_milestone ON public.order_milestones;
CREATE TRIGGER trg_guard_order_milestone BEFORE INSERT OR UPDATE OR DELETE ON public.order_milestones
FOR EACH ROW EXECUTE FUNCTION public.guard_order_milestone();

CREATE OR REPLACE FUNCTION public.release_order_milestone(_milestone_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m public.order_milestones; o public.orders; g RECORD; tier account_tier;
  gross numeric(18,6); fee numeric(18,6); net numeric(18,6); fee_pct numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO m FROM public.order_milestones WHERE id = _milestone_id FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF m.status = 'released' THEN RAISE EXCEPTION 'MILESTONE_RELEASED'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = m.order_id FOR UPDATE;
  IF o.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF o.status NOT IN ('in_progress','delivered') OR NOT o.escrow_locked THEN RAISE EXCEPTION 'ESCROW_NOT_LOCKED'; END IF;
  IF EXISTS (SELECT 1 FROM public.dispute_cases d WHERE d.order_id = o.id AND d.status IN ('open','ai_reviewed')) THEN
    RAISE EXCEPTION 'ORDER_DISPUTED'; END IF;

  gross := LEAST(round(m.amount_usdt, 6), o.amount_usdt - o.released_usdt);
  IF gross <= 0 THEN RAISE EXCEPTION 'NOTHING_TO_RELEASE'; END IF;

  SELECT * INTO g FROM public.governance_settings WHERE id = 1;
  SELECT account_tier INTO tier FROM public.profiles WHERE id = o.seller_id;
  fee_pct := CASE tier WHEN 'pro' THEN COALESCE(g.fee_pro_pct,5) WHEN 'corporate' THEN COALESCE(g.fee_corporate_pct,2.5)
    ELSE COALESCE(g.fee_free_pct,10) END / 100.0;
  fee := round(gross * fee_pct, 6);
  net := gross - fee;

  PERFORM set_config('munjaz.escrow', 'on', true);
  UPDATE public.wallets SET locked_usdt = locked_usdt - gross WHERE user_id = o.buyer_id;
  UPDATE public.wallets SET available_usdt = available_usdt + net, lifetime_earned = lifetime_earned + net WHERE user_id = o.seller_id;
  INSERT INTO public.wallet_transactions (user_id, type, status, amount, fee, order_id, note)
    VALUES (o.seller_id, 'escrow_release', 'confirmed', net, fee, o.id, 'Milestone release: ' || left(m.title, 80));
  UPDATE public.orders SET released_usdt = released_usdt + gross,
    platform_fee_usdt = COALESCE(platform_fee_usdt,0) + fee WHERE id = o.id;
  UPDATE public.order_milestones SET status = 'released', released_at = now(), amount_usdt = gross WHERE id = m.id;
  IF fee > 0 THEN
    PERFORM public.pay_referral_commission(o.seller_id, o.id, fee);
    IF o.buyer_id <> o.seller_id THEN PERFORM public.pay_referral_commission(o.buyer_id, o.id, fee); END IF;
  END IF;
  PERFORM set_config('munjaz.escrow', 'off', true);

  INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (o.seller_id, 'milestone_released', 'تم تحرير مرحلة', m.title, '/workspace');
  RETURN jsonb_build_object('released', gross, 'net', net, 'fee', fee);
END $$;
REVOKE ALL ON FUNCTION public.release_order_milestone(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_order_milestone(uuid) TO authenticated;

-- Escrow engine: settle only the not-yet-released remainder.
CREATE OR REPLACE FUNCTION public.handle_order_escrow()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  net_amount NUMERIC(18,6); fee NUMERIC(18,6); fee_pct NUMERIC(6,4); seller_tier account_tier;
  buyer_balance NUMERIC(18,6); g RECORD; hold_hours INTEGER; remaining NUMERIC(18,6); prior_fee NUMERIC(18,6);
BEGIN
  PERFORM set_config('munjaz.escrow', 'on', true);
  SELECT * INTO g FROM public.governance_settings WHERE id = 1;
  remaining := NEW.amount_usdt - COALESCE(NEW.released_usdt, 0);

  IF NEW.status = 'in_progress' AND NOT NEW.escrow_locked THEN
    SELECT available_usdt INTO buyer_balance FROM public.wallets WHERE user_id = NEW.buyer_id FOR UPDATE;
    IF buyer_balance IS NULL OR buyer_balance < NEW.amount_usdt THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;
    UPDATE public.wallets SET available_usdt = available_usdt - NEW.amount_usdt, locked_usdt = locked_usdt + NEW.amount_usdt
      WHERE user_id = NEW.buyer_id;
    NEW.escrow_locked := true;
    NEW.due_at := COALESCE(NEW.due_at, now() + make_interval(days => NEW.delivery_days));
    INSERT INTO public.wallet_transactions (user_id, type, status, amount, order_id, note)
      VALUES (NEW.buyer_id, 'escrow_lock', 'confirmed', -NEW.amount_usdt, NEW.id, 'Escrow lock');
  END IF;

  IF NEW.status = 'delivered' AND OLD.status <> 'delivered' THEN
    SELECT account_tier INTO seller_tier FROM public.profiles WHERE id = NEW.seller_id;
    hold_hours := CASE WHEN seller_tier IN ('pro','corporate') THEN COALESCE(g.sla_pro_hours, 24) ELSE COALESCE(g.auto_release_hours, 48) END;
    NEW.auto_release_hours := hold_hours;
    NEW.delivered_at := COALESCE(NEW.delivered_at, now());
    NEW.auto_release_at := NEW.delivered_at + make_interval(hours => hold_hours);
  END IF;

  IF NEW.status = 'completed' AND OLD.status <> 'completed' AND NEW.escrow_locked THEN
    SELECT account_tier INTO seller_tier FROM public.profiles WHERE id = NEW.seller_id;
    fee_pct := CASE seller_tier
      WHEN 'pro' THEN COALESCE(g.fee_pro_pct, 5) / 100.0
      WHEN 'corporate' THEN COALESCE(g.fee_corporate_pct, 2.5) / 100.0
      ELSE COALESCE(g.fee_free_pct, 10) / 100.0 END;
    IF COALESCE(NEW.released_usdt, 0) > 0 THEN
      prior_fee := COALESCE(NEW.platform_fee_usdt, 0);
      fee := ROUND(remaining * fee_pct, 6);
      NEW.platform_fee_usdt := prior_fee + fee;
    ELSE
      fee := ROUND(COALESCE(NULLIF(NEW.platform_fee_usdt,0), NEW.amount_usdt * fee_pct), 6);
      NEW.platform_fee_usdt := fee;
    END IF;
    net_amount := remaining - fee;
    NEW.completed_at := now();
    NEW.escrow_locked := false;

    UPDATE public.wallets SET locked_usdt = locked_usdt - remaining WHERE user_id = NEW.buyer_id;
    IF remaining > 0 THEN
      UPDATE public.wallets SET available_usdt = available_usdt + net_amount, lifetime_earned = lifetime_earned + net_amount
        WHERE user_id = NEW.seller_id;
      INSERT INTO public.wallet_transactions (user_id, type, status, amount, fee, order_id, note)
        VALUES (NEW.seller_id, 'escrow_release', 'confirmed', net_amount, fee, NEW.id, 'Escrow release');
    END IF;
    NEW.released_usdt := NEW.amount_usdt;

    UPDATE public.profiles
      SET completed_orders = completed_orders + 1,
          xp_points = xp_points + GREATEST(10, FLOOR(NEW.amount_usdt / 10)::int),
          level = GREATEST(1, FLOOR((xp_points + GREATEST(10, FLOOR(NEW.amount_usdt / 10)::int)) / 500) + 1)
      WHERE id = NEW.seller_id;

    IF NEW.listing_id IS NOT NULL THEN
      UPDATE public.listings SET orders_count = orders_count + 1 WHERE id = NEW.listing_id;
    END IF;

    IF fee > 0 THEN
      PERFORM public.pay_referral_commission(NEW.seller_id, NEW.id, fee);
      IF NEW.buyer_id <> NEW.seller_id THEN
        PERFORM public.pay_referral_commission(NEW.buyer_id, NEW.id, fee);
      END IF;
    END IF;
  END IF;

  IF NEW.status IN ('refunded','cancelled') AND OLD.status NOT IN ('refunded','cancelled') AND NEW.escrow_locked THEN
    UPDATE public.wallets SET locked_usdt = locked_usdt - remaining, available_usdt = available_usdt + remaining
      WHERE user_id = NEW.buyer_id;
    NEW.escrow_locked := false;
    INSERT INTO public.wallet_transactions (user_id, type, status, amount, order_id, note)
      VALUES (NEW.buyer_id, 'escrow_refund', 'confirmed', remaining, NEW.id, 'Escrow refund');
  END IF;

  PERFORM set_config('munjaz.escrow', 'off', true);
  RETURN NEW;
END; $function$;

-- Dispute split: split only the unreleased remainder.
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(_case_id uuid, _action text, _ruling text DEFAULT NULL::text, _refund_pct numeric DEFAULT NULL::numeric)
 RETURNS dispute_cases LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE c public.dispute_cases; o public.orders; refund_amt numeric(18,6); release_gross numeric(18,6);
  fee numeric(18,6); net numeric(18,6); pct numeric; remaining numeric(18,6); fee_rate numeric;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO c FROM public.dispute_cases WHERE id = _case_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF c.status NOT IN ('open','ai_reviewed') THEN RAISE EXCEPTION 'Escrow already released or dispute resolved'; END IF;

  IF _action = 'split' THEN
    pct := _refund_pct;
    IF pct IS NULL OR pct <= 0 OR pct >= 100 THEN RAISE EXCEPTION 'INVALID_SPLIT'; END IF;
  END IF;

  IF c.order_id IS NOT NULL THEN
    SELECT * INTO o FROM public.orders WHERE id = c.order_id FOR UPDATE;
    IF o.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    IF o.status IN ('completed','refunded','cancelled') OR COALESCE(o.amount_usdt,0) <= 0 THEN
      RAISE EXCEPTION 'Escrow already released or dispute resolved';
    END IF;

    IF _action = 'release' THEN
      UPDATE public.orders SET status = 'completed' WHERE id = c.order_id;
    ELSIF _action = 'refund' THEN
      UPDATE public.orders SET status = 'refunded' WHERE id = c.order_id;
    ELSIF _action = 'split' THEN
      IF NOT o.escrow_locked THEN RAISE EXCEPTION 'ESCROW_NOT_LOCKED'; END IF;
      PERFORM set_config('munjaz.escrow', 'on', true);
      remaining := o.amount_usdt - COALESCE(o.released_usdt, 0);
      refund_amt := round(remaining * pct / 100.0, 6);
      release_gross := remaining - refund_amt;
      IF COALESCE(o.released_usdt,0) > 0 THEN
        fee_rate := COALESCE(o.platform_fee_usdt,0) / NULLIF(o.released_usdt,0);
        fee := round(COALESCE(fee_rate,0) * release_gross, 6);
      ELSE
        fee := round(COALESCE(o.platform_fee_usdt,0) * release_gross / o.amount_usdt, 6);
      END IF;
      net := release_gross - fee;
      UPDATE public.wallets SET locked_usdt = locked_usdt - remaining, available_usdt = available_usdt + refund_amt
        WHERE user_id = o.buyer_id;
      UPDATE public.wallets SET available_usdt = available_usdt + net, lifetime_earned = lifetime_earned + net
        WHERE user_id = o.seller_id;
      INSERT INTO public.wallet_transactions (user_id, type, status, amount, order_id, note)
        VALUES (o.buyer_id, 'escrow_refund', 'confirmed', refund_amt, o.id, 'Partial dispute refund ' || pct || '%');
      INSERT INTO public.wallet_transactions (user_id, type, status, amount, fee, order_id, note)
        VALUES (o.seller_id, 'escrow_release', 'confirmed', net, fee, o.id, 'Partial dispute release ' || (100 - pct) || '%');
      UPDATE public.orders SET escrow_locked = false,
        platform_fee_usdt = CASE WHEN COALESCE(o.released_usdt,0) > 0 THEN COALESCE(o.platform_fee_usdt,0) + fee ELSE fee END,
        released_usdt = COALESCE(o.released_usdt,0) + release_gross,
        status = 'completed', completed_at = now()
        WHERE id = o.id;
      IF fee > 0 THEN
        PERFORM public.pay_referral_commission(o.seller_id, o.id, fee);
        IF o.buyer_id <> o.seller_id THEN PERFORM public.pay_referral_commission(o.buyer_id, o.id, fee); END IF;
      END IF;
      PERFORM set_config('munjaz.escrow', 'off', true);
    ELSE
      RAISE EXCEPTION 'INVALID_ACTION';
    END IF;
  ELSIF _action NOT IN ('release','refund','split') THEN
    RAISE EXCEPTION 'INVALID_ACTION';
  END IF;

  UPDATE public.dispute_cases
    SET status = 'resolved',
        ai_refund_pct = CASE WHEN _action='split' THEN pct WHEN _action='refund' THEN 100 ELSE 0 END,
        admin_ruling = coalesce(_ruling, CASE _action WHEN 'release' THEN 'Escrow released to seller'
          WHEN 'refund' THEN 'Escrow refunded to buyer' ELSE 'Split: ' || pct || '% buyer / ' || (100-pct) || '% seller' END),
        resolved_by = auth.uid(), resolved_at = now()
    WHERE id = _case_id RETURNING * INTO c;

  INSERT INTO public.audit_logs (admin_id, action_type, target_table, target_id, meta)
    VALUES (auth.uid(), 'dispute_resolution', 'dispute_cases', _case_id,
      jsonb_build_object('severity','info','order_id',c.order_id,'action',_action,
        'refund_pct', CASE WHEN _action='split' THEN pct WHEN _action='refund' THEN 100 ELSE 0 END,
        'refund_usdt', refund_amt, 'seller_net_usdt', net, 'fee_usdt', fee));
  RETURN c;
END $function$;