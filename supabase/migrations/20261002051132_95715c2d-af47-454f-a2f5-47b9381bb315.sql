BEGIN;
SELECT set_config('munjaz.escrow','on',true);
TRUNCATE TABLE public.orders, public.wallet_transactions, public.crypto_invoices, public.withdrawal_requests, public.referral_commissions, public.dispute_cases CASCADE;
UPDATE public.wallets SET available_usdt=0, locked_usdt=0, lifetime_earned=0, updated_at=now() WHERE true;
UPDATE public.profiles SET completed_orders=0, rating=0, updated_at=now() WHERE true;
UPDATE public.referrals SET total_earned_usdt=0, updated_at=now() WHERE true;
COMMIT;

CREATE TABLE public.admin_profit_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  tx_ref text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_profit_withdrawals TO authenticated;
GRANT ALL ON public.admin_profit_withdrawals TO service_role;
ALTER TABLE public.admin_profit_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read owner withdrawals" ON public.admin_profit_withdrawals
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins with 2FA record owner withdrawals" ON public.admin_profit_withdrawals
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'admin') AND admin_id = auth.uid()
    AND coalesce(auth.jwt()->>'aal','') = 'aal2');

CREATE OR REPLACE FUNCTION public.admin_revenue_summary()
RETURNS TABLE(gross_commission numeric, owner_withdrawals numeric, net_available numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE g numeric; w numeric;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT coalesce(sum(platform_fee_usdt),0) INTO g FROM public.orders WHERE status='completed';
  SELECT coalesce(sum(amount),0) INTO w FROM public.admin_profit_withdrawals;
  RETURN QUERY SELECT g, w, g - w;
END; $$;
REVOKE ALL ON FUNCTION public.admin_revenue_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revenue_summary() TO authenticated;