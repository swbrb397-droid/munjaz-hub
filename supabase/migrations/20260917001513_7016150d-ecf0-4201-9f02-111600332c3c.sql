CREATE OR REPLACE FUNCTION public.admin_resolve_incident(_incident_id uuid, _frozen boolean)
RETURNS public.security_incidents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE row_out public.security_incidents;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  UPDATE public.security_incidents
     SET resolved = true,
         froze_account = _frozen,
         meta = coalesce(meta,'{}'::jsonb) || jsonb_build_object(
           'resolution', CASE WHEN _frozen THEN 'resolved_frozen' ELSE 'resolved_unfrozen' END,
           'resolved_by', auth.uid(),
           'resolved_at', now()
         )
   WHERE id = _incident_id
   RETURNING * INTO row_out;
  IF row_out.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  RETURN row_out;
END; $$;