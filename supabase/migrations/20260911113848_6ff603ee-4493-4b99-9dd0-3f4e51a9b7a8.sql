ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.purchase_subscription_plan(p_tier public.account_tier)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_price numeric;
  v_wallet public.wallets%ROWTYPE;
  v_expiry timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_price := CASE p_tier WHEN 'pro' THEN 10 WHEN 'corporate' THEN 49 ELSE 0 END;
  IF v_price <= 0 THEN
    RAISE EXCEPTION 'INVALID_PLAN';
  END IF;

  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = v_user
  FOR UPDATE;

  IF NOT FOUND OR v_wallet.available_usdt < v_price THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'INSUFFICIENT_FUNDS',
      'missing_amount', greatest(v_price - coalesce(v_wallet.available_usdt, 0), 0)
    );
  END IF;

  v_expiry := greatest(coalesce((SELECT plan_expires_at FROM public.profiles WHERE id = v_user), now()), now()) + interval '30 days';

  PERFORM set_config('munjaz.escrow', 'on', true);

  UPDATE public.wallets
  SET available_usdt = available_usdt - v_price,
      updated_at = now()
  WHERE user_id = v_user;

  UPDATE public.profiles
  SET account_tier = p_tier,
      plan_expires_at = v_expiry,
      updated_at = now()
  WHERE id = v_user;

  INSERT INTO public.wallet_transactions (user_id, type, status, amount, fee, note)
  VALUES (v_user, 'adjustment', 'confirmed', -v_price, 0, 'Subscription plan purchase: ' || p_tier::text);

  RETURN jsonb_build_object('success', true, 'message', 'PLAN_ACTIVATED', 'tier', p_tier, 'expires_at', v_expiry);
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_subscription_plan(public.account_tier) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_subscription_plan(public.account_tier) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.request_wallet_withdrawal(p_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_wallet public.wallets%ROWTYPE;
  v_request public.withdrawal_requests%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_user;
  IF NOT FOUND OR nullif(trim(v_wallet.payout_address), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'PAYOUT_ADDRESS_REQUIRED');
  END IF;

  SELECT * INTO v_request
  FROM public.request_withdrawal(p_amount, v_wallet.default_network, v_wallet.payout_address);

  RETURN jsonb_build_object('success', true, 'message', 'WITHDRAWAL_REQUESTED', 'request_id', v_request.id);
END;
$$;

REVOKE ALL ON FUNCTION public.request_wallet_withdrawal(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_wallet_withdrawal(numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.redeem_subscription_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pass public.custom_subscription_passes%ROWTYPE;
BEGIN
  SELECT * INTO v_pass FROM public.redeem_subscription_pass(p_code);
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم تفعيل الاشتراك بنجاح',
    'tier', v_pass.tier,
    'duration_days', v_pass.duration_days
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_subscription_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_subscription_code(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.release_escrow_to_seller(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_order public.orders%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_order.buyer_id <> v_user THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF v_order.status <> 'delivered' THEN RAISE EXCEPTION 'ORDER_NOT_DELIVERED'; END IF;

  UPDATE public.orders SET status = 'completed', updated_at = now() WHERE id = p_order_id;
  RETURN jsonb_build_object('success', true, 'message', 'ESCROW_RELEASED', 'order_id', p_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.release_escrow_to_seller(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_escrow_to_seller(uuid) TO authenticated, service_role;