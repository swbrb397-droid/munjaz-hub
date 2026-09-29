-- Trigger and scheduled/internal routines: never callable from the API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_order_escrow() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_wallet_balances() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_listing_rating() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_rating() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.withdrawal_sentinel() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_release_escrow() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_withdrawal_queue() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, interval) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.preview_subscription_code(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.preview_subscription_pass(text) FROM PUBLIC, anon, authenticated;

-- Signed-in only (were open to visitors).
REVOKE EXECUTE ON FUNCTION public.admin_resolve_incident(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_metrics() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resolve_extension_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_incident(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_extension_request(uuid, boolean) TO authenticated;

COMMENT ON FUNCTION public.admin_toggle_user_ban(uuid, boolean, text) IS 'Admin-only: raises FORBIDDEN unless public.has_role(auth.uid(),''admin'').';
COMMENT ON FUNCTION public.admin_deactivate_user(uuid) IS 'Admin-only: raises FORBIDDEN unless public.has_role(auth.uid(),''admin'').';
COMMENT ON FUNCTION public.admin_send_user_notification(uuid, text, text, text) IS 'Admin-only: raises FORBIDDEN unless public.has_role(auth.uid(),''admin'').';
COMMENT ON FUNCTION public.admin_adjust_user_role(uuid, text, text) IS 'Admin-only: raises FORBIDDEN unless public.has_role(auth.uid(),''admin'').';