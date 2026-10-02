
-- MODULE 2: message integrity
DROP POLICY IF EXISTS "Senders edit own messages" ON public.order_messages;
CREATE POLICY "Order parties update messages" ON public.order_messages FOR UPDATE TO authenticated
  USING (public.is_order_party(order_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_order_party(order_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.guard_order_message_integrity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE frozen boolean;
BEGIN
  SELECT (o.status = 'disputed') OR EXISTS (SELECT 1 FROM public.dispute_cases d WHERE d.order_id = o.id)
    INTO frozen FROM public.orders o WHERE o.id = OLD.order_id;
  IF TG_OP = 'DELETE' THEN
    IF coalesce(frozen,false) THEN RAISE EXCEPTION 'MESSAGES_FROZEN'; END IF;
    RETURN OLD;
  END IF;
  IF NEW.body IS DISTINCT FROM OLD.body OR NEW.attachment_path IS DISTINCT FROM OLD.attachment_path
     OR NEW.attachment_name IS DISTINCT FROM OLD.attachment_name OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.order_id IS DISTINCT FROM OLD.order_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    IF coalesce(frozen,false) THEN RAISE EXCEPTION 'MESSAGES_FROZEN'; END IF;
    IF auth.uid() IS NOT NULL AND OLD.sender_id <> auth.uid() THEN RAISE EXCEPTION 'NOT_SENDER'; END IF;
    IF NEW.sender_id IS DISTINCT FROM OLD.sender_id OR NEW.order_id IS DISTINCT FROM OLD.order_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'IMMUTABLE_FIELDS'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS order_messages_integrity ON public.order_messages;
CREATE TRIGGER order_messages_integrity BEFORE UPDATE OR DELETE ON public.order_messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_message_integrity();

-- MODULE 4: partial dispute settlement
DROP FUNCTION IF EXISTS public.admin_resolve_dispute(uuid, text, text);
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(_case_id uuid, _action text, _ruling text DEFAULT NULL, _refund_pct numeric DEFAULT NULL)
RETURNS dispute_cases LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.dispute_cases; o public.orders; refund_amt numeric(18,6); release_gross numeric(18,6);
  fee numeric(18,6); net numeric(18,6); pct numeric;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO c FROM public.dispute_cases WHERE id = _case_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF c.status NOT IN ('open','ai_reviewed') THEN RAISE EXCEPTION 'Escrow already released or dispute resolved'; END IF;

  IF _action = 'split' THEN
    pct := _refund_pct;
    IF pct IS NULL OR pct <= 0 OR pct >= 100 THEN RAISE EXCEPTION 'INVALID_SPLIT'; END IF;
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
    ELSIF _action = 'split' THEN
      IF NOT o.escrow_locked THEN RAISE EXCEPTION 'ESCROW_NOT_LOCKED'; END IF;
      PERFORM set_config('munjaz.escrow', 'on', true);
      refund_amt := round(o.amount_usdt * pct / 100.0, 6);
      release_gross := o.amount_usdt - refund_amt;
      fee := round(COALESCE(o.platform_fee_usdt,0) * release_gross / o.amount_usdt, 6);
      net := release_gross - fee;
      UPDATE public.wallets SET locked_usdt = locked_usdt - o.amount_usdt, available_usdt = available_usdt + refund_amt
        WHERE user_id = o.buyer_id;
      UPDATE public.wallets SET available_usdt = available_usdt + net, lifetime_earned = lifetime_earned + net
        WHERE user_id = o.seller_id;
      INSERT INTO public.wallet_transactions (user_id, type, status, amount, order_id, note)
        VALUES (o.buyer_id, 'escrow_refund', 'confirmed', refund_amt, o.id, 'Partial dispute refund ' || pct || '%');
      INSERT INTO public.wallet_transactions (user_id, type, status, amount, fee, order_id, note)
        VALUES (o.seller_id, 'escrow_release', 'confirmed', net, fee, o.id, 'Partial dispute release ' || (100 - pct) || '%');
      -- escrow_locked=false first so the escrow trigger does not pay out again.
      UPDATE public.orders SET escrow_locked = false, platform_fee_usdt = fee, status = 'completed', completed_at = now()
        WHERE id = o.id;
      IF fee > 0 THEN
        PERFORM public.pay_referral_commission(o.seller_id, o.id, fee);
        IF o.buyer_id <> o.seller_id THEN PERFORM public.pay_referral_commission(o.buyer_id, o.id, fee); END IF;
      END IF;
      PERFORM set_config('munjaz.escrow', 'off', true);
    ELSE
      RAISE EXCEPTION 'INVALID_ACTION';
    END IF;
  ELSIF _action NOT IN ('release','refund','split') THEN
    RAISE EXCEPTION 'INVALID_ACTION';
  END IF;

  UPDATE public.dispute_cases
    SET status = 'resolved',
        ai_refund_pct = CASE WHEN _action='split' THEN pct WHEN _action='refund' THEN 100 ELSE 0 END,
        admin_ruling = coalesce(_ruling, CASE _action WHEN 'release' THEN 'Escrow released to seller'
          WHEN 'refund' THEN 'Escrow refunded to buyer' ELSE 'Split: ' || pct || '% buyer / ' || (100-pct) || '% seller' END),
        resolved_by = auth.uid(), resolved_at = now()
    WHERE id = _case_id RETURNING * INTO c;

  INSERT INTO public.audit_logs (admin_id, action_type, target_table, target_id, meta)
    VALUES (auth.uid(), 'dispute_resolution', 'dispute_cases', _case_id,
      jsonb_build_object('severity','info','order_id',c.order_id,'action',_action,
        'refund_pct', CASE WHEN _action='split' THEN pct WHEN _action='refund' THEN 100 ELSE 0 END,
        'refund_usdt', refund_amt, 'seller_net_usdt', net, 'fee_usdt', fee));
  RETURN c;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_dispute(uuid,text,text,numeric) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(uuid,text,text,numeric) TO authenticated;

-- MODULE 5: buyer instant cancellation (15 minutes, no seller activity)
CREATE OR REPLACE FUNCTION public.buyer_instant_cancel(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF o.id IS NULL OR o.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF o.status NOT IN ('pending','in_progress') THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
  IF o.created_at < now() - interval '15 minutes' THEN RAISE EXCEPTION 'CANCEL_WINDOW_CLOSED'; END IF;
  IF EXISTS (SELECT 1 FROM public.order_deliverables WHERE order_id = o.id)
     OR EXISTS (SELECT 1 FROM public.order_messages WHERE order_id = o.id AND sender_id = o.seller_id)
     OR EXISTS (SELECT 1 FROM public.order_milestones WHERE order_id = o.id AND status <> 'pending') THEN
    RAISE EXCEPTION 'SELLER_STARTED';
  END IF;
  UPDATE public.orders SET status = 'cancelled' WHERE id = o.id; -- escrow trigger refunds 100%
END $$;
REVOKE EXECUTE ON FUNCTION public.buyer_instant_cancel(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.buyer_instant_cancel(uuid) TO authenticated;
