CREATE OR REPLACE FUNCTION public.admin_platform_overview()
RETURNS TABLE(
  total_users bigint,
  pending_kyc bigint,
  escrow_locked numeric,
  deposits_total numeric,
  deposits_count bigint,
  open_disputes bigint,
  pending_withdrawals bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.profiles),
    (SELECT count(*) FROM public.kyc_submissions WHERE status = 'pending'),
    (SELECT COALESCE(sum(amount_usdt),0) FROM public.orders WHERE status IN ('in_progress','delivered','disputed') AND escrow_locked),
    (SELECT COALESCE(sum(amount),0) FROM public.wallet_transactions WHERE type = 'deposit' AND status = 'confirmed'),
    (SELECT count(*) FROM public.wallet_transactions WHERE type = 'deposit' AND status = 'confirmed'),
    (SELECT count(*) FROM public.dispute_cases WHERE status IN ('open','ai_reviewed')),
    (SELECT count(*) FROM public.withdrawal_requests WHERE status IN ('queued','auto_approved','manual_review','processing'));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_sandbox_action(_kind text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  seller uuid;
  new_order public.orders;
  case_id uuid;
  sub_id uuid;
BEGIN
  IF uid IS NULL OR NOT public.has_role(uid,'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  IF _kind = 'deposit' THEN
    PERFORM set_config('munjaz.escrow','on', true);
    UPDATE public.wallets SET available_usdt = available_usdt + 10 WHERE user_id = uid;
    INSERT INTO public.wallet_transactions (user_id, type, status, amount, fee, network, note)
      VALUES (uid, 'deposit', 'confirmed', 10, 0, 'trc20', 'Sandbox simulated NOWPayments IPN (10 USDT)');
    PERFORM set_config('munjaz.escrow','off', true);
    RETURN jsonb_build_object('kind','deposit','amount',10);

  ELSIF _kind = 'kyc' THEN
    INSERT INTO public.kyc_submissions (user_id, doc_type, front_path, status, full_name, admin_note)
      VALUES (uid, 'id', 'sandbox/test-front.jpg', 'pending', 'Sandbox Test User', 'SANDBOX')
      RETURNING id INTO sub_id;
    UPDATE public.profiles SET kyc_status = 'pending' WHERE id = uid;
    RETURN jsonb_build_object('kind','kyc','submission_id',sub_id);

  ELSIF _kind = 'dispute' THEN
    SELECT id INTO seller FROM public.profiles WHERE id <> uid ORDER BY created_at LIMIT 1;
    seller := COALESCE(seller, uid);

    PERFORM set_config('munjaz.escrow','on', true);
    UPDATE public.wallets SET available_usdt = available_usdt + 25 WHERE user_id = uid;
    PERFORM set_config('munjaz.escrow','off', true);

    INSERT INTO public.orders (buyer_id, seller_id, title, sow_terms, amount_usdt, delivery_days, status)
      VALUES (uid, seller, '[SANDBOX] طلب اختباري للتحكيم', 'طلب تجريبي أُنشئ من صندوق اختبار الإدارة.', 25, 3, 'pending')
      RETURNING * INTO new_order;

    UPDATE public.orders SET status = 'in_progress' WHERE id = new_order.id;
    UPDATE public.orders SET status = 'disputed' WHERE id = new_order.id;

    INSERT INTO public.dispute_cases (order_id, kind, raised_by, against_user, reason, evidence, status)
      VALUES (new_order.id, 'dispute', uid, seller, '[SANDBOX] نزاع اختباري لاختبار قرارات التحكيم.', '[]'::jsonb, 'open')
      RETURNING id INTO case_id;

    RETURN jsonb_build_object('kind','dispute','order_id',new_order.id,'case_id',case_id);
  END IF;

  RAISE EXCEPTION 'INVALID_KIND';
END; $$;

REVOKE ALL ON FUNCTION public.admin_platform_overview() FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_sandbox_action(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_platform_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_sandbox_action(text) TO authenticated;