REVOKE EXECUTE ON FUNCTION public.redeem_subscription_code(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.preview_subscription_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_subscription_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_subscription_code(text) TO authenticated;