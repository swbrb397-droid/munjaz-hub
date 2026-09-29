DO $$
DECLARE src text;
BEGIN
  src := pg_get_functiondef('public.request_withdrawal(numeric, usdt_network, text)'::regprocedure);
  src := replace(src, 'dep_part := LEAST(amt, public.unspent_deposit_balance(uid));',
    'dep_part := GREATEST(0, LEAST(amt, amt - (COALESCE(bal,0) - public.unspent_deposit_balance(uid))));');
  EXECUTE src;
END $$;