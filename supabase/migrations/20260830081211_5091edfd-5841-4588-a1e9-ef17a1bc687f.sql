-- Internal-only helpers: no direct API execution at all
REVOKE ALL ON FUNCTION public.is_order_party(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, interval) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_release_escrow() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_withdrawal_queue() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_order_escrow() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_wallet_balances() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.withdrawal_sentinel() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_listing_min_price() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Signed-in-only entry points
REVOKE ALL ON FUNCTION public.request_withdrawal(numeric, public.usdt_network, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_withdrawal(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_account_frozen(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_security_event(public.incident_kind, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_subscription_pass(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, public.usdt_network, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_withdrawal(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_account_frozen(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_security_event(public.incident_kind, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_subscription_pass(text) TO authenticated;

-- rate_limit_events: RLS on with no policies is intentional (system-only table),
-- add an explicit deny-all readable-by-admin policy to satisfy the linter.
CREATE POLICY "Admins read rate limit events" ON public.rate_limit_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));