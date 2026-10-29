-- 1) Order transitions guard (named a_* so it runs before orders_escrow, which legitimately sets the fee)
CREATE OR REPLACE FUNCTION public.enforce_order_transitions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR public.has_role(uid, 'admin') THEN RETURN NEW; END IF;
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
DROP TRIGGER IF EXISTS a_enforce_order_transitions ON public.orders;
CREATE TRIGGER a_enforce_order_transitions BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_transitions();

-- 2) Platform fee computed server-side only
DO $$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.handle_order_escrow'::regproc);
  def := replace(def, 'ROUND(COALESCE(NULLIF(NEW.platform_fee_usdt,0), NEW.amount_usdt * fee_pct), 6)', 'ROUND(NEW.amount_usdt * fee_pct, 6)');
  EXECUTE def;
END $$;

-- 3) Block direct wallet tampering; keep only payout address columns editable
DROP POLICY IF EXISTS "Users create own withdrawal/deposit requests" ON public.wallet_transactions;
REVOKE INSERT, UPDATE, DELETE ON public.wallet_transactions FROM authenticated, anon;
REVOKE UPDATE ON public.wallets FROM authenticated, anon;
GRANT UPDATE (payout_address, payout_address_updated_at) ON public.wallets TO authenticated;