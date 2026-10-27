-- PENDING (apply after backend resume, then support_tickets_pending.sql).
-- Review handle_order_escrow body before running section 2.

-- 1) P0: enforce order status transitions
CREATE OR REPLACE FUNCTION public.enforce_order_transitions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR public.has_role(uid, 'admin') THEN RETURN NEW; END IF; -- service role / admin
  IF NEW.buyer_id IS DISTINCT FROM OLD.buyer_id OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
     OR NEW.amount_usdt IS DISTINCT FROM OLD.amount_usdt
     OR NEW.platform_fee_usdt IS DISTINCT FROM OLD.platform_fee_usdt THEN
    RAISE EXCEPTION 'ORDER_FINANCIAL_FIELDS_IMMUTABLE';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'completed' AND uid <> OLD.buyer_id THEN
      RAISE EXCEPTION 'ONLY_BUYER_OR_ADMIN_CAN_COMPLETE_ORDER';
    END IF;
    IF NEW.status = 'delivered' AND uid <> OLD.seller_id THEN
      RAISE EXCEPTION 'ONLY_SELLER_CAN_MARK_DELIVERED';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_enforce_order_transitions ON public.orders;
CREATE TRIGGER trg_enforce_order_transitions BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_transitions();

-- 2) P0: platform fee computed server-side only.
-- In handle_order_escrow replace
--   COALESCE(NULLIF(NEW.platform_fee_usdt,0), NEW.amount_usdt * fee_pct)
-- with
--   ROUND(NEW.amount_usdt * fee_pct, 6)

-- 3) P1: block direct wallet tampering from the browser
DROP POLICY IF EXISTS "Users create own withdrawal/deposit requests" ON public.wallet_transactions;
REVOKE INSERT, UPDATE, DELETE ON public.wallet_transactions FROM authenticated, anon;
REVOKE UPDATE ON public.wallets FROM authenticated, anon;

-- 4) P1: payout settings via guarded RPC (if UI updates wallets directly, switch it to this)
CREATE OR REPLACE FUNCTION public.update_payout_settings(_address text, _network text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF _network NOT IN ('trc20','bep20','polygon') THEN RAISE EXCEPTION 'INVALID_NETWORK'; END IF;
  IF (_network = 'trc20' AND _address !~ '^T[a-zA-Z0-9]{33}$')
     OR (_network <> 'trc20' AND _address !~ '^0x[a-fA-F0-9]{40}$') THEN
    RAISE EXCEPTION 'INVALID_ADDRESS';
  END IF;
  UPDATE public.wallets SET payout_address = _address, payout_network = _network
   WHERE user_id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.update_payout_settings(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_payout_settings(text, text) TO authenticated;
