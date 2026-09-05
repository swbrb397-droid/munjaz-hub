ALTER TABLE public.crypto_invoices REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'crypto_invoices'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crypto_invoices;
  END IF;
END $$;