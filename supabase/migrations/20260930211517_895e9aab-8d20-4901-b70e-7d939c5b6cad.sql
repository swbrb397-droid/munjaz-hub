CREATE OR REPLACE FUNCTION public.pay_referral_commission(_referred uuid, _order_id uuid, _fee numeric)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE ref RECORD; joined timestamptz; rate numeric; comm numeric(18,6);
  o RECORD; a_addr text; b_addr text; a_name text; b_name text; circ int; reason text;
BEGIN
  IF _fee IS NULL OR _fee <= 0 THEN RETURN; END IF;
  SELECT * INTO ref FROM public.referrals r
    WHERE r.referred_id = _referred AND r.is_active AND now() <= r.expires_at;
  IF ref.id IS NULL THEN RETURN; END IF;
  IF ref.referrer_id = _referred THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.referral_commissions WHERE referral_id = ref.id AND order_id = _order_id) THEN RETURN; END IF;

  -- Anti-sybil checks
  SELECT buyer_id, seller_id INTO o FROM public.orders WHERE id = _order_id;
  IF o.buyer_id = ref.referrer_id OR o.seller_id = ref.referrer_id THEN
    reason := 'referrer_is_order_party';
  END IF;
  IF reason IS NULL THEN
    SELECT lower(trim(payout_address)) INTO a_addr FROM public.wallets WHERE user_id = ref.referrer_id;
    SELECT lower(trim(payout_address)) INTO b_addr FROM public.wallets WHERE user_id = _referred;
    IF coalesce(a_addr,'') <> '' AND a_addr = b_addr THEN reason := 'shared_payout_address'; END IF;
  END IF;
  IF reason IS NULL AND EXISTS (
    SELECT 1 FROM public.wallet_transactions x JOIN public.wallet_transactions y
      ON lower(trim(x.address)) = lower(trim(y.address))
    WHERE x.user_id = ref.referrer_id AND y.user_id = _referred
      AND x.type = 'withdrawal' AND y.type = 'withdrawal' AND coalesce(x.address,'') <> '') THEN
    reason := 'shared_withdrawal_address';
  END IF;
  IF reason IS NULL THEN
    SELECT lower(trim(full_name)) INTO a_name FROM public.kyc_submissions
      WHERE user_id = ref.referrer_id AND status = 'approved' ORDER BY created_at DESC LIMIT 1;
    SELECT lower(trim(full_name)) INTO b_name FROM public.kyc_submissions
      WHERE user_id = _referred AND status = 'approved' ORDER BY created_at DESC LIMIT 1;
    IF coalesce(a_name,'') <> '' AND a_name = b_name THEN reason := 'shared_verified_identity'; END IF;
  END IF;

  IF reason IS NOT NULL THEN
    INSERT INTO public.audit_logs (admin_id, action_type, target_table, target_id, meta)
    VALUES (_referred, 'REFERRAL_COMMISSION_BLOCKED', 'referrals', ref.id,
      jsonb_build_object('reason', reason, 'referrer_id', ref.referrer_id, 'referred_id', _referred, 'order_id', _order_id));
    RETURN;
  END IF;

  -- Circular order detection (flag only)
  IF o.buyer_id IS NOT NULL THEN
    SELECT count(*) INTO circ FROM public.orders
     WHERE created_at > now() - interval '7 days'
       AND ((buyer_id = o.buyer_id AND seller_id = o.seller_id) OR (buyer_id = o.seller_id AND seller_id = o.buyer_id));
    IF circ >= 3 AND EXISTS (SELECT 1 FROM public.orders WHERE buyer_id = o.seller_id AND seller_id = o.buyer_id
         AND created_at > now() - interval '7 days') THEN
      INSERT INTO public.audit_logs (admin_id, action_type, target_table, target_id, meta)
      VALUES (_referred, 'REFERRAL_COLLUSION_FLAG', 'orders', _order_id,
        jsonb_build_object('buyer_id', o.buyer_id, 'seller_id', o.seller_id, 'referrer_id', ref.referrer_id, 'orders_7d', circ));
    END IF;
  END IF;

  SELECT created_at INTO joined FROM public.profiles WHERE id = _referred;
  rate := CASE WHEN now() <= coalesce(joined, ref.starts_at) + interval '30 days' THEN 0.20 ELSE 0.10 END;
  comm := ROUND(_fee * rate, 6);
  IF comm <= 0 THEN RETURN; END IF;
  INSERT INTO public.referral_commissions (referral_id, referrer_id, order_id, platform_fee_usdt, commission_usdt)
    VALUES (ref.id, ref.referrer_id, _order_id, _fee, comm);
  UPDATE public.referrals SET total_earned_usdt = total_earned_usdt + comm WHERE id = ref.id;
  UPDATE public.wallets SET available_usdt = available_usdt + comm, lifetime_earned = lifetime_earned + comm WHERE user_id = ref.referrer_id;
  INSERT INTO public.wallet_transactions (user_id, type, status, amount, order_id, note)
    VALUES (ref.referrer_id, 'referral_payout', 'confirmed', comm, _order_id, 'Referral commission ' || (rate*100)::int || '%');
END; $function$;
REVOKE EXECUTE ON FUNCTION public.pay_referral_commission(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;