REVOKE ALL ON FUNCTION public.auto_release_escrow() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_order_escrow() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_wallet_balances() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_columns() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_listing_min_price() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;