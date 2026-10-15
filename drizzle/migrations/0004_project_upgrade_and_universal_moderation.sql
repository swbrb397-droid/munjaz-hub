CREATE OR REPLACE FUNCTION public.contains_profanity(_t text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT coalesce(
    lower(translate(coalesce(_t,''), 'ـ', '')) ~ ('(^|[^[:alpha:]])(يا|ال|وال|و|بال)?(عرص|منيك|منيوك|خول|زبالة|كلب|حمار|غبي|تافه|حقير|قذر|كسم|طيز|زب|شرموط|شرموطة|قحبة|نجس|وسخ|احمق|أحمق|معفن|fuck|fucking|shit|bitch|asshole|bastard|idiot|moron)([^[:alpha:]]|$)')
    OR lower(coalesce(_t,'')) ~ 'كس ام'
  , false);
$$;
GRANT EXECUTE ON FUNCTION public.contains_profanity(text) TO authenticated, service_role;

-- Generic guard: blocks contact info + profanity on changed text columns only (existing rows never break unrelated updates).
CREATE OR REPLACE FUNCTION public.guard_user_text()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE col text; newv text; oldv text;
BEGIN
  FOREACH col IN ARRAY TG_ARGV LOOP
    newv := to_jsonb(NEW) ->> col;
    oldv := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ->> col ELSE NULL END;
    IF newv IS NOT NULL AND newv IS DISTINCT FROM oldv THEN
      IF public.contains_profanity(newv) THEN RAISE EXCEPTION 'PROFANITY_BLOCKED'; END IF;
      IF public.contains_contact_info(newv) THEN RAISE EXCEPTION 'CONTACT_INFO_BLOCKED'; END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;

CREATE TRIGGER projects_text_guard BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_text('title','description','screening_question');
CREATE TRIGGER proposals_text_guard BEFORE INSERT OR UPDATE ON public.project_proposals
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_text('cover_letter','screening_answer');
CREATE TRIGGER reviews_text_guard BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_text('comment');
CREATE TRIGGER profiles_text_guard BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_text('display_name','bio');
CREATE TRIGGER listings_text_guard BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_text('title_ar','title_en','description');
CREATE TRIGGER order_messages_text_guard BEFORE INSERT OR UPDATE ON public.order_messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_text('body');

-- Project upgrade fields
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS screening_question text,
  ADD COLUMN IF NOT EXISTS min_level integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.projects ADD CONSTRAINT projects_skills_max CHECK (cardinality(skills) <= 5);
ALTER TABLE public.projects ADD CONSTRAINT projects_min_level_range CHECK (min_level BETWEEN 1 AND 8);
ALTER TABLE public.projects ADD CONSTRAINT projects_screening_len CHECK (screening_question IS NULL OR char_length(screening_question) <= 300);
ALTER TABLE public.project_proposals ADD COLUMN IF NOT EXISTS screening_answer text;
ALTER TABLE public.project_proposals ADD CONSTRAINT proposals_answer_len CHECK (screening_answer IS NULL OR char_length(screening_answer) <= 1000);

-- Freelancer rank (mirrors the 8-tier ladder on orders, volume and rating)
CREATE OR REPLACE FUNCTION public.freelancer_level(_uid uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH m AS (
    SELECT coalesce(p.completed_orders,0) AS o, coalesce(p.rating,0) AS r,
      coalesce((SELECT sum(amount_usdt) FROM public.orders WHERE seller_id = _uid AND status = 'completed'),0) AS v
    FROM public.profiles p WHERE p.id = _uid
  )
  SELECT coalesce(max(t.lvl),1) FROM m, (VALUES
    (1,0,0,0),(2,5,150,4.2),(3,15,600,4.5),(4,40,2000,4.7),(5,90,5000,4.8),
    (6,200,12000,4.85),(7,450,30000,4.9),(8,800,60000,4.95)) AS t(lvl,o,v,r)
  WHERE m.o >= t.o AND m.v >= t.v AND m.r >= t.r;
$$;
GRANT EXECUTE ON FUNCTION public.freelancer_level(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_project_v2(
  _title text, _description text, _category text, _budget_min numeric, _budget_max numeric, _delivery_days integer,
  _skills text[], _screening text, _min_level integer, _attachments jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); new_id uuid; a jsonb; clean_skills text[];
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _budget_min IS NULL OR _budget_min < 3 OR _budget_max IS NULL OR _budget_max < _budget_min THEN RAISE EXCEPTION 'MIN_AMOUNT'; END IF;
  IF _delivery_days IS NULL OR _delivery_days < 1 OR _delivery_days > 90 THEN RAISE EXCEPTION 'INVALID_DAYS'; END IF;
  SELECT coalesce(array_agg(DISTINCT left(btrim(s), 40)), '{}') INTO clean_skills FROM unnest(coalesce(_skills,'{}')) s WHERE btrim(s) <> '';
  IF cardinality(clean_skills) > 5 THEN RAISE EXCEPTION 'TOO_MANY_SKILLS'; END IF;
  IF public.contains_profanity(array_to_string(clean_skills,' ')) OR public.contains_contact_info(array_to_string(clean_skills,' ')) THEN RAISE EXCEPTION 'CONTACT_INFO_BLOCKED'; END IF;
  _attachments := coalesce(_attachments, '[]'::jsonb);
  IF jsonb_typeof(_attachments) <> 'array' OR jsonb_array_length(_attachments) > 3 THEN RAISE EXCEPTION 'TOO_MANY_FILES'; END IF;
  FOR a IN SELECT * FROM jsonb_array_elements(_attachments) LOOP
    IF coalesce(a->>'path','') NOT LIKE uid::text || '/%' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  END LOOP;
  new_id := public.create_project(_title, _description, _category, _budget_min, _budget_max, _delivery_days);
  UPDATE public.projects SET skills = clean_skills,
    screening_question = nullif(left(btrim(coalesce(_screening,'')), 300), ''),
    min_level = greatest(1, least(8, coalesce(_min_level,1))),
    attachments = _attachments
  WHERE id = new_id;
  RETURN new_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.create_project_v2(text,text,text,numeric,numeric,integer,text[],text,integer,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_project_v2(text,text,text,numeric,numeric,integer,text[],text,integer,jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_project_proposal_v2(_project_id uuid, _amount numeric, _delivery_days integer, _cover text, _answer text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); p public.projects; new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO p FROM public.projects WHERE id = _project_id;
  IF p.id IS NULL OR p.status <> 'open' THEN RAISE EXCEPTION 'PROJECT_NOT_OPEN'; END IF;
  IF public.freelancer_level(uid) < coalesce(p.min_level,1) THEN RAISE EXCEPTION 'LEVEL_TOO_LOW'; END IF;
  _answer := nullif(left(btrim(coalesce(_answer,'')), 1000), '');
  IF p.screening_question IS NOT NULL AND (_answer IS NULL OR char_length(_answer) < 5) THEN RAISE EXCEPTION 'ANSWER_REQUIRED'; END IF;
  IF _delivery_days IS NULL OR _delivery_days < 1 OR _delivery_days > 90 THEN RAISE EXCEPTION 'INVALID_DAYS'; END IF;
  new_id := public.submit_project_proposal(_project_id, _amount, _delivery_days, _cover);
  IF _answer IS NOT NULL THEN UPDATE public.project_proposals SET screening_answer = _answer WHERE id = new_id; END IF;
  RETURN new_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.submit_project_proposal_v2(uuid,numeric,integer,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_project_proposal_v2(uuid,numeric,integer,text,text) TO authenticated, service_role;

-- Project attachments storage: owner writes own folder, signed-in users read.
CREATE POLICY "project files upload own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "project files read signed in" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-files');
CREATE POLICY "project files delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-files' AND (storage.foldername(name))[1] = auth.uid()::text);