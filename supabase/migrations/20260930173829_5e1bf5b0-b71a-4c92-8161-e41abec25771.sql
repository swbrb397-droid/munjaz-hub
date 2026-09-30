CREATE OR REPLACE FUNCTION public.admin_adjust_user_role(p_user_id uuid, p_role text, p_action text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF coalesce(auth.jwt()->>'aal','') <> 'aal2' THEN RAISE EXCEPTION 'MFA_REQUIRED'; END IF;
  IF p_role NOT IN ('admin','moderator','buyer','seller','hybrid','corporate') THEN RAISE EXCEPTION 'INVALID_ROLE'; END IF;
  IF p_user_id = auth.uid() AND p_role = 'admin' AND p_action = 'remove' THEN RAISE EXCEPTION 'CANNOT_TARGET_SELF'; END IF;
  IF p_action = 'add' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (p_user_id, p_role::public.app_role) ON CONFLICT DO NOTHING;
  ELSIF p_action = 'remove' THEN
    DELETE FROM public.user_roles WHERE user_id = p_user_id AND role = p_role::public.app_role;
  ELSE RAISE EXCEPTION 'INVALID_ACTION'; END IF;
  INSERT INTO public.audit_logs (admin_id, action_type, target_table, target_id, meta)
    VALUES (auth.uid(), 'role_' || p_action, 'user_roles', p_user_id, jsonb_build_object('role', p_role));
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_deactivate_user(p_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF coalesce(auth.jwt()->>'aal','') <> 'aal2' THEN RAISE EXCEPTION 'MFA_REQUIRED'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'CANNOT_TARGET_SELF'; END IF;
  UPDATE public.profiles SET is_deactivated = true, deactivated_at = now(), is_frozen = true,
    frozen_reason = coalesce(frozen_reason, 'Account deactivated'), frozen_at = coalesce(frozen_at, now())
  WHERE id = p_user_id;
  UPDATE public.listings SET is_published = false WHERE owner_id = p_user_id;
  INSERT INTO public.audit_logs (admin_id, action_type, target_table, target_id, meta)
    VALUES (auth.uid(), 'user_deactivate', 'profiles', p_user_id, '{}'::jsonb);
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_toggle_user_ban(p_user_id uuid, p_banned boolean, p_reason text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF coalesce(auth.jwt()->>'aal','') <> 'aal2' THEN RAISE EXCEPTION 'MFA_REQUIRED'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'CANNOT_TARGET_SELF'; END IF;
  IF p_banned AND length(trim(coalesce(p_reason,''))) < 5 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  UPDATE public.profiles SET is_frozen = p_banned,
    frozen_reason = CASE WHEN p_banned THEN trim(p_reason) ELSE NULL END,
    frozen_at = CASE WHEN p_banned THEN now() ELSE NULL END
  WHERE id = p_user_id;
  INSERT INTO public.audit_logs (admin_id, action_type, target_table, target_id, meta)
    VALUES (auth.uid(), CASE WHEN p_banned THEN 'user_ban' ELSE 'user_unban' END, 'profiles', p_user_id, jsonb_build_object('reason', p_reason));
END; $function$;

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_user_created ON public.kyc_submissions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON public.reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_orders_listing ON public.orders(listing_id);

CREATE OR REPLACE FUNCTION public.admin_get_users_directory()
RETURNS TABLE(id uuid, display_name text, avatar_url text, referral_code text, created_at timestamptz,
  is_frozen boolean, frozen_reason text, is_deactivated boolean, kyc_status text, is_verified boolean,
  account_tier text, roles text[], available_usdt numeric, locked_usdt numeric, lifetime_earned numeric,
  invited_count bigint, referral_earned numeric, latest_kyc text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN QUERY
  SELECT p.id, p.display_name, p.avatar_url, p.referral_code, p.created_at, p.is_frozen, p.frozen_reason,
    p.is_deactivated, p.kyc_status, p.is_verified, p.account_tier::text,
    COALESCE((SELECT array_agg(r.role::text) FROM public.user_roles r WHERE r.user_id = p.id), '{}'),
    COALESCE(w.available_usdt,0), COALESCE(w.locked_usdt,0), COALESCE(w.lifetime_earned,0),
    COALESCE(rf.n,0), COALESCE(rf.e,0),
    (SELECT k.status FROM public.kyc_submissions k WHERE k.user_id = p.id ORDER BY k.created_at DESC LIMIT 1)
  FROM public.profiles p
  LEFT JOIN public.wallets w ON w.user_id = p.id
  LEFT JOIN (SELECT referrer_id, count(*) n, sum(total_earned_usdt) e FROM public.referrals GROUP BY referrer_id) rf ON rf.referrer_id = p.id
  ORDER BY p.created_at DESC LIMIT 1000;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_get_users_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_users_directory() TO authenticated;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS quality smallint CHECK (quality BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS communication smallint CHECK (communication BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS punctuality smallint CHECK (punctuality BETWEEN 1 AND 5);
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS reviews_count integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS reviews_order_reviewer_uniq ON public.reviews(order_id, reviewer_id);

DROP POLICY IF EXISTS "Order parties write reviews" ON public.reviews;
CREATE POLICY "Buyers review sellers" ON public.reviews FOR INSERT TO authenticated
WITH CHECK (reviewer_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.orders o WHERE o.id = reviews.order_id AND o.status = 'completed'
    AND o.buyer_id = auth.uid() AND o.seller_id = reviews.reviewee_id));

CREATE OR REPLACE FUNCTION public.sync_listing_rating()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE lid uuid;
BEGIN
  SELECT o.listing_id INTO lid FROM public.orders o WHERE o.id = NEW.order_id;
  IF lid IS NOT NULL THEN
    UPDATE public.listings l SET
      rating = COALESCE((SELECT ROUND(AVG(r.rating)::numeric, 2) FROM public.reviews r
        JOIN public.orders o2 ON o2.id = r.order_id WHERE o2.listing_id = lid AND r.reviewer_id = o2.buyer_id), 0),
      reviews_count = (SELECT count(*) FROM public.reviews r JOIN public.orders o2 ON o2.id = r.order_id
        WHERE o2.listing_id = lid AND r.reviewer_id = o2.buyer_id)
    WHERE l.id = lid;
  END IF;
  RETURN NEW;
END; $function$;

UPDATE public.listings l SET reviews_count = (SELECT count(*) FROM public.reviews r JOIN public.orders o ON o.id = r.order_id
  WHERE o.listing_id = l.id AND r.reviewer_id = o.buyer_id);