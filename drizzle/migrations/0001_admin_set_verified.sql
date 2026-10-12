CREATE OR REPLACE FUNCTION public.admin_set_verified(p_user_id uuid, p_verified boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF coalesce(auth.jwt()->>'aal','') <> 'aal2' THEN RAISE EXCEPTION 'MFA_REQUIRED'; END IF;
  UPDATE public.profiles SET is_verified = p_verified WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  INSERT INTO public.audit_logs (admin_id, action_type, target_table, target_id, meta)
    VALUES (auth.uid(), CASE WHEN p_verified THEN 'user_verify_grant' ELSE 'user_verify_revoke' END, 'profiles', p_user_id, '{}'::jsonb);
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_verified(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_verified(uuid, boolean) TO authenticated;