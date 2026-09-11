ALTER TABLE public.kyc_submissions ADD COLUMN IF NOT EXISTS full_name text;

CREATE OR REPLACE FUNCTION public.submit_kyc(_doc_type text, _front_path text, _back_path text DEFAULT NULL::text, _full_name text DEFAULT NULL::text)
 RETURNS kyc_submissions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); row_out public.kyc_submissions;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF coalesce(btrim(_front_path),'') = '' THEN RAISE EXCEPTION 'FRONT_REQUIRED'; END IF;
  PERFORM public.check_rate_limit('kyc_submit', 5, interval '1 hour');

  INSERT INTO public.kyc_submissions (user_id, doc_type, front_path, back_path, status, full_name)
  VALUES (uid, coalesce(nullif(btrim(_doc_type),''),'id'), _front_path, nullif(btrim(_back_path),''), 'pending', nullif(btrim(_full_name),''))
  RETURNING * INTO row_out;

  UPDATE public.profiles SET kyc_status = 'pending' WHERE id = uid;
  RETURN row_out;
END; $function$;