-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('buyer','seller','admin');
CREATE TYPE public.kyc_tier AS ENUM ('tier0','tier1','tier2','tier3');
CREATE TYPE public.usdt_network AS ENUM ('trc20','bep20','polygon');
CREATE TYPE public.tx_type AS ENUM ('deposit','withdrawal','escrow_lock','escrow_release','escrow_refund','commission','referral_payout','adjustment');
CREATE TYPE public.tx_status AS ENUM ('pending','confirmed','failed','cancelled');
CREATE TYPE public.order_status AS ENUM ('pending','in_progress','delivered','completed','disputed','cancelled','refunded');
CREATE TYPE public.case_kind AS ENUM ('dispute','review_appeal');
CREATE TYPE public.case_status AS ENUM ('open','ai_reviewed','resolved','rejected');

-- ============ SHARED FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  bio TEXT,
  country TEXT,
  kyc_tier public.kyc_tier NOT NULL DEFAULT 'tier0',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  xp_points INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  completed_orders INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT NOT NULL UNIQUE,
  referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Profiles are viewable by signed-in users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Admins update any profile" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- protect privileged profile columns from self-service edits
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER protect_profiles BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ WALLETS ============
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  available_usdt NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (available_usdt >= 0),
  locked_usdt NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (locked_usdt >= 0),
  lifetime_earned NUMERIC(18,6) NOT NULL DEFAULT 0,
  default_network public.usdt_network NOT NULL DEFAULT 'trc20',
  payout_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own wallet" ON public.wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users update own wallet settings" ON public.wallets FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER wallets_updated_at BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.protect_wallet_balances()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN
    NEW.available_usdt := OLD.available_usdt;
    NEW.locked_usdt := OLD.locked_usdt;
    NEW.lifetime_earned := OLD.lifetime_earned;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER protect_wallets BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.protect_wallet_balances();

-- ============ WALLET TRANSACTIONS ============
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type public.tx_type NOT NULL,
  status public.tx_status NOT NULL DEFAULT 'pending',
  amount NUMERIC(18,6) NOT NULL,
  fee NUMERIC(18,6) NOT NULL DEFAULT 0,
  network public.usdt_network,
  address TEXT,
  tx_hash TEXT,
  order_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own transactions" ON public.wallet_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users create own withdrawal/deposit requests" ON public.wallet_transactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND type IN ('deposit','withdrawal') AND status = 'pending');
CREATE POLICY "Admins manage transactions" ON public.wallet_transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER wallet_tx_updated_at BEFORE UPDATE ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_wallet_tx_user ON public.wallet_transactions(user_id, created_at DESC);

-- ============ ORDERS & ESCROW ============
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number BIGSERIAL,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  title TEXT NOT NULL,
  category TEXT,
  sow_terms TEXT NOT NULL DEFAULT '',
  deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
  amount_usdt NUMERIC(18,6) NOT NULL CHECK (amount_usdt > 0),
  platform_fee_usdt NUMERIC(18,6) NOT NULL DEFAULT 0,
  status public.order_status NOT NULL DEFAULT 'pending',
  escrow_locked BOOLEAN NOT NULL DEFAULT false,
  delivery_days INTEGER NOT NULL DEFAULT 3,
  due_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  auto_release_at TIMESTAMPTZ,
  auto_release_hours INTEGER NOT NULL DEFAULT 72,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (buyer_id <> seller_id)
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order parties can read" ON public.orders FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Buyers create orders" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "Order parties can update" ON public.orders FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_orders_buyer ON public.orders(buyer_id, created_at DESC);
CREATE INDEX idx_orders_seller ON public.orders(seller_id, created_at DESC);
CREATE INDEX idx_orders_autorelease ON public.orders(auto_release_at) WHERE status = 'delivered';

-- ============ DISPUTES & REVIEW APPEALS ============
CREATE TABLE public.dispute_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  kind public.case_kind NOT NULL DEFAULT 'dispute',
  raised_by UUID NOT NULL,
  against_user UUID,
  reason TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  status public.case_status NOT NULL DEFAULT 'open',
  ai_verdict TEXT,
  ai_confidence NUMERIC(5,2),
  ai_refund_pct NUMERIC(5,2),
  ai_analyzed_at TIMESTAMPTZ,
  blackmail_score NUMERIC(5,2),
  admin_ruling TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.dispute_cases TO authenticated;
GRANT ALL ON public.dispute_cases TO service_role;
ALTER TABLE public.dispute_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Case parties can read" ON public.dispute_cases FOR SELECT TO authenticated
  USING (
    raised_by = auth.uid() OR against_user = auth.uid() OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid()))
  );
CREATE POLICY "Users open own cases" ON public.dispute_cases FOR INSERT TO authenticated
  WITH CHECK (raised_by = auth.uid());
CREATE POLICY "Admins resolve cases" ON public.dispute_cases FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER dispute_cases_updated_at BEFORE UPDATE ON public.dispute_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ REFERRALS ============
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referred_id UUID NOT NULL UNIQUE,
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.18 CHECK (commission_rate BETWEEN 0.15 AND 0.20),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '12 months'),
  total_earned_usdt NUMERIC(18,6) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (referrer_id <> referred_id)
);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Referral parties can read" ON public.referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage referrals" ON public.referrals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER referrals_updated_at BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.referral_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  referrer_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  platform_fee_usdt NUMERIC(18,6) NOT NULL DEFAULT 0,
  commission_usdt NUMERIC(18,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_commissions TO authenticated;
GRANT ALL ON public.referral_commissions TO service_role;
ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Referrer reads own commissions" ON public.referral_commissions FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ============ NEW USER BOOTSTRAP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ref_code TEXT;
  inviter UUID;
BEGIN
  ref_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  SELECT p.id INTO inviter FROM public.profiles p
    WHERE p.referral_code = upper(NEW.raw_user_meta_data->>'referral_code');

  INSERT INTO public.profiles (id, display_name, referral_code, referred_by)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)), ref_code, inviter);

  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'buyer') ON CONFLICT DO NOTHING;

  IF inviter IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_id) VALUES (inviter, NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ ESCROW LOGIC ============
-- lock funds when an order moves to in_progress; settle on completion/refund
CREATE OR REPLACE FUNCTION public.handle_order_escrow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  net_amount NUMERIC(18,6);
  fee NUMERIC(18,6);
  ref RECORD;
  comm NUMERIC(18,6);
BEGIN
  -- lock buyer funds into escrow
  IF NEW.status = 'in_progress' AND NOT NEW.escrow_locked THEN
    UPDATE public.wallets
      SET available_usdt = available_usdt - NEW.amount_usdt,
          locked_usdt = locked_usdt + NEW.amount_usdt
      WHERE user_id = NEW.buyer_id;
    NEW.escrow_locked := true;
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

    -- referral commission on platform fee, active for 12 months
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

  RETURN NEW;
END; $$;

CREATE TRIGGER orders_escrow BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_order_escrow();

-- auto-release delivered orders past their deadline
CREATE OR REPLACE FUNCTION public.auto_release_escrow()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE released INTEGER;
BEGIN
  WITH due AS (
    SELECT id FROM public.orders
    WHERE status = 'delivered' AND auto_release_at IS NOT NULL AND auto_release_at <= now()
  ), upd AS (
    UPDATE public.orders o SET status = 'completed' FROM due WHERE o.id = due.id RETURNING o.id
  )
  SELECT count(*) INTO released FROM upd;
  RETURN released;
END; $$;