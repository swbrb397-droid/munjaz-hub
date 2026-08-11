ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_listing_id_idx ON public.orders(listing_id);
CREATE INDEX IF NOT EXISTS orders_buyer_idx ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS orders_seller_idx ON public.orders(seller_id);

CREATE OR REPLACE FUNCTION public.protect_wallet_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(current_setting('munjaz.escrow', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN
    NEW.available_usdt := OLD.available_usdt;
    NEW.locked_usdt := OLD.locked_usdt;
    NEW.lifetime_earned := OLD.lifetime_earned;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.handle_order_escrow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  net_amount NUMERIC(18,6);
  fee NUMERIC(18,6);
  ref RECORD;
  comm NUMERIC(18,6);
  buyer_balance NUMERIC(18,6);
BEGIN
  PERFORM set_config('munjaz.escrow', 'on', true);

  -- lock buyer funds into escrow
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

  -- delivery sets the auto-release deadline
  IF NEW.status = 'delivered' AND OLD.status <> 'delivered' THEN
    NEW.delivered_at := COALESCE(NEW.delivered_at, now());
    NEW.auto_release_at := NEW.delivered_at + make_interval(hours => NEW.auto_release_hours);
  END IF;

  -- release escrow to seller
  IF NEW.status = 'completed' AND OLD.status <> 'completed' AND NEW.escrow_locked THEN
    fee := ROUND(COALESCE(NULLIF(NEW.platform_fee_usdt,0), NEW.amount_usdt * 0.10), 6);
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

  -- refund escrow to buyer
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