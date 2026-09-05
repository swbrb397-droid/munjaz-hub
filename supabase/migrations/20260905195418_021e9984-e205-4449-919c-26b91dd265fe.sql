CREATE TABLE IF NOT EXISTS public.crypto_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount_usdt numeric(18,6) NOT NULL CHECK (amount_usdt > 0),
  network public.usdt_network NOT NULL,
  provider text NOT NULL DEFAULT 'manual',
  external_id text,
  pay_address text,
  pay_url text,
  status text NOT NULL DEFAULT 'pending',
  tx_hash text,
  transaction_id uuid,
  credited_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '60 minutes',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crypto_invoices_provider_external_idx
  ON public.crypto_invoices (provider, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crypto_invoices_user_idx ON public.crypto_invoices (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.crypto_invoices TO authenticated;
GRANT ALL ON public.crypto_invoices TO service_role;

ALTER TABLE public.crypto_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own invoices" ON public.crypto_invoices;
CREATE POLICY "Users read own invoices" ON public.crypto_invoices
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users create own invoices" ON public.crypto_invoices;
CREATE POLICY "Users create own invoices" ON public.crypto_invoices
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending' AND credited_at IS NULL);

DROP TRIGGER IF EXISTS crypto_invoices_updated_at ON public.crypto_invoices;
CREATE TRIGGER crypto_invoices_updated_at BEFORE UPDATE ON public.crypto_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.process_auto_deposit(
  _invoice_id uuid DEFAULT NULL,
  _provider text DEFAULT NULL,
  _external_id text DEFAULT NULL,
  _amount numeric DEFAULT NULL,
  _tx_hash text DEFAULT NULL
)
RETURNS public.crypto_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE inv public.crypto_invoices; amt numeric(18,6); tx_id uuid;
BEGIN
  SELECT * INTO inv FROM public.crypto_invoices
   WHERE (_invoice_id IS NOT NULL AND id = _invoice_id)
      OR (_invoice_id IS NULL AND _external_id IS NOT NULL
          AND external_id = _external_id
          AND (_provider IS NULL OR provider = _provider))
   FOR UPDATE;

  IF inv.id IS NULL THEN RAISE EXCEPTION 'INVOICE_NOT_FOUND'; END IF;
  IF inv.status = 'paid' THEN RETURN inv; END IF;

  amt := round(coalesce(_amount, inv.amount_usdt)::numeric, 6);
  IF amt <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  PERFORM set_config('munjaz.escrow','on', true);
  UPDATE public.wallets SET available_usdt = available_usdt + amt WHERE user_id = inv.user_id;

  INSERT INTO public.wallet_transactions (user_id, type, status, amount, fee, network, address, tx_hash, note)
  VALUES (inv.user_id, 'deposit', 'confirmed', amt, 0, inv.network, inv.pay_address, _tx_hash,
          'Automated USDT deposit via ' || inv.provider)
  RETURNING id INTO tx_id;
  PERFORM set_config('munjaz.escrow','off', true);

  UPDATE public.crypto_invoices
     SET status = 'paid', tx_hash = coalesce(_tx_hash, tx_hash), transaction_id = tx_id, credited_at = now()
   WHERE id = inv.id
   RETURNING * INTO inv;

  RETURN inv;
END; $$;

REVOKE ALL ON FUNCTION public.process_auto_deposit(uuid, text, text, numeric, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_auto_deposit(uuid, text, text, numeric, text) TO service_role;