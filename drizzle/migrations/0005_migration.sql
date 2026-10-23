CREATE TABLE public.direct_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(12),'hex'),
  seller_id uuid NOT NULL,
  buyer_id uuid,
  title text NOT NULL,
  description text NOT NULL,
  amount_usdt numeric NOT NULL,
  delivery_days integer NOT NULL,
  status text NOT NULL DEFAULT 'open',
  order_id uuid REFERENCES public.orders(id),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.direct_contracts TO authenticated;
GRANT ALL ON public.direct_contracts TO service_role;
ALTER TABLE public.direct_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties read own contracts" ON public.direct_contracts FOR SELECT TO authenticated
  USING (auth.uid() = seller_id OR auth.uid() = buyer_id);

CREATE OR REPLACE FUNCTION public.create_direct_contract(_title text, _description text, _amount numeric, _days integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); tok text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  PERFORM public.assert_active_account(uid);
  _title := btrim(coalesce(_title,'')); _description := btrim(coalesce(_description,''));
  IF length(_title) < 5 OR length(_title) > 160 THEN RAISE EXCEPTION 'INVALID_TITLE'; END IF;
  IF length(_description) < 20 OR length(_description) > 3000 THEN RAISE EXCEPTION 'INVALID_DESCRIPTION'; END IF;
  IF _amount IS NULL OR _amount < 5 OR _amount > 50000 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  IF _days IS NULL OR _days < 1 OR _days > 90 THEN RAISE EXCEPTION 'INVALID_DAYS'; END IF;
  IF public.contains_contact_info(_title || ' ' || _description) THEN RAISE EXCEPTION 'CONTACT_INFO_BLOCKED'; END IF;
  IF public.contains_profanity(_title || ' ' || _description) THEN RAISE EXCEPTION 'PROFANITY_BLOCKED'; END IF;
  IF (SELECT count(*) FROM public.direct_contracts WHERE seller_id = uid AND created_at > now() - interval '24 hours') >= 10 THEN
    RAISE EXCEPTION 'DAILY_LIMIT';
  END IF;
  INSERT INTO public.direct_contracts(seller_id, title, description, amount_usdt, delivery_days)
  VALUES (uid, _title, _description, round(_amount, 2), _days) RETURNING token INTO tok;
  RETURN tok;
END; $$;

CREATE OR REPLACE FUNCTION public.get_direct_contract(_token text)
RETURNS TABLE(title text, description text, amount_usdt numeric, delivery_days integer, status text,
  expires_at timestamptz, seller_id uuid, seller_name text, seller_verified boolean, order_id uuid, is_seller boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT c.title, c.description, c.amount_usdt, c.delivery_days,
    CASE WHEN c.status = 'open' AND c.expires_at < now() THEN 'expired' ELSE c.status END,
    c.expires_at, c.seller_id, p.display_name, p.is_verified,
    CASE WHEN auth.uid() IN (c.seller_id, c.buyer_id) THEN c.order_id END,
    auth.uid() = c.seller_id
  FROM public.direct_contracts c JOIN public.profiles p ON p.id = c.seller_id
  WHERE c.token = _token;
$$;

CREATE OR REPLACE FUNCTION public.cancel_direct_contract(_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.direct_contracts SET status = 'cancelled', updated_at = now()
  WHERE token = _token AND seller_id = auth.uid() AND status = 'open';
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.accept_direct_contract(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); c public.direct_contracts; g RECORD; seller_tier account_tier;
  fee_pct numeric; new_order uuid; bal numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  PERFORM public.assert_active_account(uid);
  PERFORM public.assert_financial_open();
  SELECT * INTO c FROM public.direct_contracts WHERE token = _token FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF c.seller_id = uid THEN RAISE EXCEPTION 'OWN_CONTRACT'; END IF;
  IF c.status <> 'open' OR c.expires_at < now() THEN RAISE EXCEPTION 'CONTRACT_NOT_OPEN'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = c.seller_id AND (is_frozen OR is_deactivated)) THEN
    RAISE EXCEPTION 'FREELANCER_UNAVAILABLE';
  END IF;
  SELECT available_usdt INTO bal FROM public.wallets WHERE user_id = uid;
  IF bal IS NULL OR bal < c.amount_usdt THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;

  SELECT * INTO g FROM public.governance_settings WHERE id = 1;
  SELECT account_tier INTO seller_tier FROM public.profiles WHERE id = c.seller_id;
  fee_pct := CASE seller_tier WHEN 'pro' THEN coalesce(g.fee_pro_pct,5) WHEN 'corporate' THEN coalesce(g.fee_corporate_pct,2.5) ELSE coalesce(g.fee_free_pct,10) END / 100.0;

  INSERT INTO public.orders(buyer_id, seller_id, title, category, amount_usdt, platform_fee_usdt, delivery_days, sow_terms, status)
  VALUES (uid, c.seller_id, left(c.title,160), 'freelance', c.amount_usdt, round(c.amount_usdt * fee_pct, 6), c.delivery_days,
          left('صفقة مباشرة: ' || c.title || E'\n\n' || c.description, 4000), 'pending')
  RETURNING id INTO new_order;
  UPDATE public.orders SET status = 'in_progress' WHERE id = new_order;

  UPDATE public.direct_contracts SET status = 'accepted', buyer_id = uid, order_id = new_order, updated_at = now() WHERE id = c.id;
  INSERT INTO public.notifications(user_id, kind, title, body, link, meta)
  VALUES (c.seller_id, 'direct_contract_accepted', 'وافق العميل على صفقتك المباشرة وحُجز المبلغ', c.title, '/fulfillment/' || new_order,
          jsonb_build_object('order_id', new_order));
  RETURN new_order;
END; $$;

REVOKE ALL ON FUNCTION public.create_direct_contract(text,text,numeric,integer), public.cancel_direct_contract(text), public.accept_direct_contract(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_direct_contract(text,text,numeric,integer), public.cancel_direct_contract(text), public.accept_direct_contract(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_direct_contract(text) TO anon, authenticated;