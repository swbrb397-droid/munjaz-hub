REVOKE EXECUTE ON FUNCTION public.financial_halt_active() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.financial_halt_active() TO authenticated, service_role;