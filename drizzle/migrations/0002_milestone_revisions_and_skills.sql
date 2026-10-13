ALTER TABLE public.order_milestones ADD COLUMN IF NOT EXISTS revisions_allowed integer NOT NULL DEFAULT 2;
ALTER TABLE public.order_milestones ADD COLUMN IF NOT EXISTS revisions_used integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS skills text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.profiles ADD CONSTRAINT profiles_skills_max CHECK (cardinality(skills) <= 15) NOT VALID;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_len CHECK (bio IS NULL OR char_length(bio) <= 600) NOT VALID;

CREATE OR REPLACE FUNCTION public.request_order_revision(p_deliverable_id uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE d public.order_deliverables; o public.orders; m public.order_milestones;
BEGIN
  SELECT * INTO d FROM public.order_deliverables WHERE id = p_deliverable_id;
  IF d.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = d.order_id FOR UPDATE;
  IF o.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF o.status NOT IN ('in_progress','delivered') THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
  -- Per-milestone budget: charge the current (first unreleased) milestone.
  SELECT * INTO m FROM public.order_milestones
    WHERE order_id = o.id AND status <> 'released'
    ORDER BY position ASC LIMIT 1 FOR UPDATE;
  IF m.id IS NOT NULL THEN
    IF m.revisions_used >= m.revisions_allowed THEN RAISE EXCEPTION 'REVISION_LIMIT_REACHED'; END IF;
    UPDATE public.order_milestones SET revisions_used = revisions_used + 1 WHERE id = m.id;
  ELSE
    IF o.revisions_used >= o.revisions_allowed THEN RAISE EXCEPTION 'REVISION_LIMIT_REACHED'; END IF;
  END IF;
  UPDATE public.orders SET revisions_used = revisions_used + 1,
    status = CASE WHEN status = 'delivered' THEN 'in_progress'::order_status ELSE status END
    WHERE id = o.id;
  UPDATE public.order_deliverables SET approval_state = 'revision' WHERE id = d.id;
  RETURN CASE WHEN m.id IS NOT NULL THEN m.revisions_used + 1 ELSE o.revisions_used + 1 END;
END $function$;

DROP FUNCTION IF EXISTS public.get_public_profiles(uuid[]);
CREATE FUNCTION public.get_public_profiles(_ids uuid[])
 RETURNS TABLE(id uuid, display_name text, avatar_url text, bio text, country text, is_verified boolean, xp_points integer, level integer, rating numeric, completed_orders integer, account_tier account_tier, created_at timestamp with time zone, skills text[])
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT p.id, p.display_name, p.avatar_url, p.bio, p.country, p.is_verified, p.xp_points, p.level,
         p.rating, p.completed_orders, p.account_tier, p.created_at, p.skills
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND p.id = ANY(_ids)
  LIMIT 200;
$function$;
REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated, service_role;