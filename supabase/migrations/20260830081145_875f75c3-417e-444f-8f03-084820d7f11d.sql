-- ORDER MESSAGES
CREATE TABLE public.order_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL DEFAULT '',
  attachment_name text,
  attachment_path text,
  lang text NOT NULL DEFAULT 'ar',
  translations jsonb NOT NULL DEFAULT '{}'::jsonb,
  edited_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.order_messages TO authenticated;
GRANT ALL ON public.order_messages TO service_role;
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_order_party(_order_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = _order_id AND (o.buyer_id = _user_id OR o.seller_id = _user_id));
$$;

CREATE POLICY "Order parties read messages" ON public.order_messages FOR SELECT TO authenticated
  USING (public.is_order_party(order_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Order parties send messages" ON public.order_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_order_party(order_id, auth.uid()));
CREATE POLICY "Senders edit own messages" ON public.order_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (sender_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER order_messages_updated_at BEFORE UPDATE ON public.order_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX order_messages_order_idx ON public.order_messages(order_id, created_at);
ALTER TABLE public.order_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;

-- ORDER MILESTONES
CREATE TABLE public.order_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  title text NOT NULL,
  pct integer NOT NULL DEFAULT 0,
  amount_usdt numeric(18,6) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  position integer NOT NULL DEFAULT 0,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_milestones TO authenticated;
GRANT ALL ON public.order_milestones TO service_role;
ALTER TABLE public.order_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order parties read milestones" ON public.order_milestones FOR SELECT TO authenticated
  USING (public.is_order_party(order_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Order parties write milestones" ON public.order_milestones FOR INSERT TO authenticated
  WITH CHECK (public.is_order_party(order_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Order parties update milestones" ON public.order_milestones FOR UPDATE TO authenticated
  USING (public.is_order_party(order_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_order_party(order_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Order parties delete milestones" ON public.order_milestones FOR DELETE TO authenticated
  USING (public.is_order_party(order_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER order_milestones_updated_at BEFORE UPDATE ON public.order_milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ORDER DELIVERABLES
CREATE TABLE public.order_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  checksum text,
  is_final boolean NOT NULL DEFAULT false,
  approval_state text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_deliverables TO authenticated;
GRANT ALL ON public.order_deliverables TO service_role;
ALTER TABLE public.order_deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order parties read deliverables" ON public.order_deliverables FOR SELECT TO authenticated
  USING (public.is_order_party(order_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Uploader adds deliverables" ON public.order_deliverables FOR INSERT TO authenticated
  WITH CHECK (uploader_id = auth.uid() AND public.is_order_party(order_id, auth.uid()));
CREATE POLICY "Order parties update deliverables" ON public.order_deliverables FOR UPDATE TO authenticated
  USING (public.is_order_party(order_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_order_party(order_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Uploader deletes deliverables" ON public.order_deliverables FOR DELETE TO authenticated
  USING (uploader_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER order_deliverables_updated_at BEFORE UPDATE ON public.order_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SUBSCRIPTION PASSES
CREATE TABLE public.custom_subscription_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  tier public.account_tier NOT NULL DEFAULT 'pro',
  duration_days integer NOT NULL DEFAULT 30,
  note text,
  created_by uuid,
  used_by uuid,
  used_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.custom_subscription_passes TO authenticated;
GRANT ALL ON public.custom_subscription_passes TO service_role;
ALTER TABLE public.custom_subscription_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage passes" ON public.custom_subscription_passes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Redeemer reads own pass" ON public.custom_subscription_passes FOR SELECT TO authenticated
  USING (used_by = auth.uid());
CREATE TRIGGER passes_updated_at BEFORE UPDATE ON public.custom_subscription_passes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.redeem_subscription_pass(_code text)
RETURNS public.custom_subscription_passes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.custom_subscription_passes; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO p FROM public.custom_subscription_passes WHERE code = upper(btrim(_code)) FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'PASS_NOT_FOUND'; END IF;
  IF p.used_by IS NOT NULL THEN RAISE EXCEPTION 'PASS_ALREADY_USED'; END IF;
  IF p.expires_at <= now() THEN RAISE EXCEPTION 'PASS_EXPIRED'; END IF;
  UPDATE public.custom_subscription_passes SET used_by = uid, used_at = now() WHERE id = p.id RETURNING * INTO p;
  UPDATE public.profiles SET account_tier = p.tier WHERE id = uid;
  RETURN p;
END; $$;

-- PLATFORM GOVERNANCE SETTINGS
CREATE TABLE public.platform_governance_settings (
  id boolean PRIMARY KEY DEFAULT true,
  autonomous_ai boolean NOT NULL DEFAULT false,
  ai_confidence_threshold numeric(5,2) NOT NULL DEFAULT 85,
  sla_hours_free integer NOT NULL DEFAULT 48,
  sla_hours_pro integer NOT NULL DEFAULT 12,
  refill_daily_limit numeric(18,6) NOT NULL DEFAULT 10000,
  warranty_escrow_pct integer NOT NULL DEFAULT 10,
  auto_release_hours integer NOT NULL DEFAULT 72,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_singleton CHECK (id)
);
GRANT SELECT, INSERT, UPDATE ON public.platform_governance_settings TO authenticated;
GRANT ALL ON public.platform_governance_settings TO service_role;
ALTER TABLE public.platform_governance_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read governance" ON public.platform_governance_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins change governance" ON public.platform_governance_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER governance_updated_at BEFORE UPDATE ON public.platform_governance_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.platform_governance_settings (id) VALUES (true);