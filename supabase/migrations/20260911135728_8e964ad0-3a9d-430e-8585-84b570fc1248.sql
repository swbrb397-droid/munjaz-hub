CREATE TABLE public.governance_settings (
  id integer PRIMARY KEY DEFAULT 1,
  ai_autonomous_enabled boolean NOT NULL DEFAULT false,
  ai_confidence_threshold numeric(5,2) NOT NULL DEFAULT 85,
  sla_free_hours integer NOT NULL DEFAULT 48,
  sla_pro_hours integer NOT NULL DEFAULT 12,
  daily_deposit_limit numeric(18,6) NOT NULL DEFAULT 10000,
  escrow_stability_fee integer NOT NULL DEFAULT 10,
  auto_release_hours integer NOT NULL DEFAULT 72,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT governance_settings_singleton CHECK (id = 1)
);

GRANT SELECT, UPDATE ON public.governance_settings TO authenticated;
GRANT ALL ON public.governance_settings TO service_role;

ALTER TABLE public.governance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users read governance_settings" ON public.governance_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins update governance_settings" ON public.governance_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER governance_settings_updated_at BEFORE UPDATE ON public.governance_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.governance_settings (id) VALUES (1);