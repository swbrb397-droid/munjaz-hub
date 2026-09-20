
-- 1) One review per reviewer per order
CREATE UNIQUE INDEX IF NOT EXISTS reviews_order_reviewer_uniq
  ON public.reviews (order_id, reviewer_id);

-- 2) Keep listing rating in sync with reviews of completed orders
CREATE OR REPLACE FUNCTION public.sync_listing_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE lid uuid;
BEGIN
  SELECT o.listing_id INTO lid FROM public.orders o WHERE o.id = NEW.order_id;
  IF lid IS NOT NULL THEN
    UPDATE public.listings l
       SET rating = COALESCE((
             SELECT ROUND(AVG(r.rating)::numeric, 2)
               FROM public.reviews r
               JOIN public.orders o2 ON o2.id = r.order_id
              WHERE o2.listing_id = lid
           ), 0)
     WHERE l.id = lid;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_listing_rating_trg ON public.reviews;
CREATE TRIGGER sync_listing_rating_trg
AFTER INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.sync_listing_rating();

-- 3) Escrow double-spend guard on dispute resolution
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(_case_id uuid, _action text, _ruling text DEFAULT NULL)
RETURNS public.dispute_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c public.dispute_cases; o public.orders;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO c FROM public.dispute_cases WHERE id = _case_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  IF c.status NOT IN ('open','ai_reviewed') THEN
    RAISE EXCEPTION 'Escrow already released or dispute resolved';
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
    ELSE
      RAISE EXCEPTION 'INVALID_ACTION';
    END IF;
  END IF;

  UPDATE public.dispute_cases
    SET status = 'resolved',
        admin_ruling = coalesce(_ruling, CASE WHEN _action = 'release' THEN 'Escrow released to seller' ELSE 'Escrow refunded to buyer' END),
        resolved_by = auth.uid(), resolved_at = now()
    WHERE id = _case_id RETURNING * INTO c;

  INSERT INTO public.audit_logs (admin_id, action_type, target_table, target_id, meta)
    VALUES (auth.uid(), 'dispute_resolution', 'dispute_cases', _case_id,
            jsonb_build_object('severity', 'info', 'order_id', c.order_id, 'action', _action));
  RETURN c;
END;
$$;

-- 4) Anti self-referral in the account-creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_code TEXT;
  inviter UUID;
  chosen TEXT;
  is_owner BOOLEAN;
BEGIN
  ref_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  SELECT p.id INTO inviter FROM public.profiles p
    WHERE p.referral_code = upper(NEW.raw_user_meta_data->>'referral_code');

  -- Never attribute a new account to itself.
  IF inviter IS NOT NULL AND inviter = NEW.id THEN
    inviter := NULL;
  END IF;

  chosen := lower(coalesce(NEW.raw_user_meta_data->>'role',''));
  IF chosen NOT IN ('buyer','seller','hybrid','corporate') THEN
    chosen := 'buyer';
  END IF;

  is_owner := lower(coalesce(NEW.email,'')) IN ('swbrb397@gmail.com','ddjj68513@gmail.com');

  INSERT INTO public.profiles (id, display_name, referral_code, referred_by, terms_accepted_at, active_view)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)),
    ref_code,
    inviter,
    CASE WHEN (NEW.raw_user_meta_data->>'terms_accepted') = 'true' THEN now() ELSE NULL END,
    CASE WHEN chosen = 'seller' THEN 'seller' ELSE 'buyer' END
  );

  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, chosen::public.app_role) ON CONFLICT DO NOTHING;
  IF chosen = 'hybrid' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'buyer'), (NEW.id, 'seller') ON CONFLICT DO NOTHING;
  END IF;

  IF is_owner THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;

  IF inviter IS NOT NULL AND inviter <> NEW.id THEN
    INSERT INTO public.referrals (referrer_id, referred_id) VALUES (inviter, NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
