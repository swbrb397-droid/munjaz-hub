ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS hide_online_status boolean NOT NULL DEFAULT false;

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'development',
  budget_min numeric(18,2) NOT NULL,
  budget_max numeric(18,2) NOT NULL,
  delivery_days integer NOT NULL DEFAULT 7,
  status text NOT NULL DEFAULT 'open',
  proposals_count integer NOT NULL DEFAULT 0,
  awarded_proposal_id uuid,
  order_id uuid REFERENCES public.orders(id),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_status_chk CHECK (status IN ('open','in_progress','completed','closed','removed')),
  CONSTRAINT projects_category_chk CHECK (category IN ('development','design','writing','marketing','video','ai','other')),
  CONSTRAINT projects_budget_chk CHECK (budget_min >= 3 AND budget_max >= budget_min AND budget_max <= 100000),
  CONSTRAINT projects_days_chk CHECK (delivery_days BETWEEN 1 AND 90)
);
GRANT SELECT ON public.projects TO anon, authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads visible projects" ON public.projects FOR SELECT TO anon, authenticated
  USING (status IN ('open','in_progress','completed'));
CREATE POLICY "Owners read own projects" ON public.projects FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Admins read all projects" ON public.projects FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX projects_status_created_idx ON public.projects(status, created_at DESC);
CREATE INDEX projects_owner_idx ON public.projects(owner_id);
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.project_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  freelancer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_usdt numeric(18,2) NOT NULL,
  delivery_days integer NOT NULL,
  cover_letter text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proposals_unique UNIQUE (project_id, freelancer_id),
  CONSTRAINT proposals_status_chk CHECK (status IN ('pending','accepted','rejected','withdrawn')),
  CONSTRAINT proposals_amount_chk CHECK (amount_usdt >= 3 AND amount_usdt <= 100000),
  CONSTRAINT proposals_days_chk CHECK (delivery_days BETWEEN 1 AND 90)
);
GRANT SELECT ON public.project_proposals TO authenticated;
GRANT ALL ON public.project_proposals TO service_role;
ALTER TABLE public.project_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Freelancer reads own proposals" ON public.project_proposals FOR SELECT TO authenticated USING (freelancer_id = auth.uid());
CREATE POLICY "Project owner reads proposals" ON public.project_proposals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "Admins read all proposals" ON public.project_proposals FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX proposals_freelancer_idx ON public.project_proposals(freelancer_id, created_at DESC);
CREATE TRIGGER proposals_updated_at BEFORE UPDATE ON public.project_proposals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Anti-circumvention: phones, emails, messenger links.
CREATE OR REPLACE FUNCTION public.contains_contact_info(_t text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(
    _t ~* '(wa\.me|whatsapp|t\.me/|telegram|discord\.gg|snapchat|instagram\.com|facebook\.com|واتس|وتساب|تيليجرام|تلجرام|تليجرام|سناب)'
    OR _t ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'
    OR regexp_replace(translate(_t, '٠١٢٣٤٥٦٧٨٩', '0123456789'), '[\s\-\.\(\)]', '', 'g') ~ '\+?[0-9]{9,}'
  , false);
$$;

CREATE OR REPLACE FUNCTION public.assert_active_account(_uid uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND (is_frozen OR is_deactivated)) THEN
    RAISE EXCEPTION 'ACCOUNT_FROZEN';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.create_project(_title text, _description text, _category text, _budget_min numeric, _budget_max numeric, _delivery_days integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); new_id uuid; recent int;
BEGIN
  PERFORM public.assert_active_account(uid);
  _title := btrim(coalesce(_title,'')); _description := btrim(coalesce(_description,''));
  IF char_length(_title) < 10 OR char_length(_title) > 120 THEN RAISE EXCEPTION 'INVALID_TITLE'; END IF;
  IF char_length(_description) < 50 OR char_length(_description) > 4000 THEN RAISE EXCEPTION 'INVALID_DESCRIPTION'; END IF;
  IF public.contains_contact_info(_title || ' ' || _description) THEN RAISE EXCEPTION 'CONTACT_INFO_BLOCKED'; END IF;
  SELECT count(*) INTO recent FROM public.projects WHERE owner_id = uid AND created_at > now() - interval '24 hours';
  IF recent >= 5 THEN RAISE EXCEPTION 'PROJECT_DAILY_LIMIT'; END IF;
  INSERT INTO public.projects(owner_id, title, description, category, budget_min, budget_max, delivery_days)
  VALUES (uid, _title, _description, _category, round(_budget_min,2), round(_budget_max,2), _delivery_days)
  RETURNING id INTO new_id;
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.proposal_daily_cap(_uid uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN completed_orders >= 40 THEN 40 WHEN completed_orders >= 5 THEN 20 ELSE 10 END
  FROM public.profiles WHERE id = _uid;
$$;

CREATE OR REPLACE FUNCTION public.my_proposal_quota()
RETURNS TABLE(used integer, cap integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(*)::int FROM public.project_proposals WHERE freelancer_id = auth.uid() AND created_at > now() - interval '24 hours'),
         coalesce(public.proposal_daily_cap(auth.uid()), 10);
$$;

CREATE OR REPLACE FUNCTION public.submit_project_proposal(_project_id uuid, _amount numeric, _delivery_days integer, _cover text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); p public.projects; used int; new_id uuid;
BEGIN
  PERFORM public.assert_active_account(uid);
  SELECT * INTO p FROM public.projects WHERE id = _project_id FOR UPDATE;
  IF p.id IS NULL OR p.status <> 'open' THEN RAISE EXCEPTION 'PROJECT_NOT_OPEN'; END IF;
  IF p.owner_id = uid THEN RAISE EXCEPTION 'SELF_PROPOSAL'; END IF;
  _cover := btrim(coalesce(_cover,''));
  IF char_length(_cover) < 30 OR char_length(_cover) > 2500 THEN RAISE EXCEPTION 'INVALID_COVER'; END IF;
  IF public.contains_contact_info(_cover) THEN RAISE EXCEPTION 'CONTACT_INFO_BLOCKED'; END IF;
  IF _amount IS NULL OR _amount < 3 THEN RAISE EXCEPTION 'MIN_AMOUNT'; END IF;
  SELECT count(*) INTO used FROM public.project_proposals WHERE freelancer_id = uid AND created_at > now() - interval '24 hours';
  IF used >= coalesce(public.proposal_daily_cap(uid), 10) THEN RAISE EXCEPTION 'PROPOSAL_DAILY_LIMIT'; END IF;
  IF EXISTS (SELECT 1 FROM public.project_proposals WHERE project_id = _project_id AND freelancer_id = uid) THEN
    RAISE EXCEPTION 'ALREADY_PROPOSED';
  END IF;
  INSERT INTO public.project_proposals(project_id, freelancer_id, amount_usdt, delivery_days, cover_letter)
  VALUES (_project_id, uid, round(_amount,2), _delivery_days, _cover) RETURNING id INTO new_id;
  UPDATE public.projects SET proposals_count = proposals_count + 1 WHERE id = _project_id;
  INSERT INTO public.notifications(user_id, kind, title, body, link, meta)
  VALUES (p.owner_id, 'project_proposal', 'عرض جديد على مشروعك', p.title, '/project/' || p.id, jsonb_build_object('project_id', p.id));
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.withdraw_project_proposal(_proposal_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr public.project_proposals;
BEGIN
  SELECT * INTO pr FROM public.project_proposals WHERE id = _proposal_id FOR UPDATE;
  IF pr.id IS NULL OR pr.freelancer_id <> auth.uid() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF pr.status <> 'pending' THEN RAISE EXCEPTION 'NOT_PENDING'; END IF;
  UPDATE public.project_proposals SET status = 'withdrawn' WHERE id = _proposal_id;
  UPDATE public.projects SET proposals_count = GREATEST(0, proposals_count - 1) WHERE id = pr.project_id;
END; $$;

CREATE OR REPLACE FUNCTION public.close_own_project(_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.projects;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = _project_id FOR UPDATE;
  IF p.id IS NULL OR p.owner_id <> auth.uid() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p.status <> 'open' THEN RAISE EXCEPTION 'PROJECT_NOT_OPEN'; END IF;
  UPDATE public.projects SET status = 'closed' WHERE id = _project_id;
  UPDATE public.project_proposals SET status = 'rejected' WHERE project_id = _project_id AND status = 'pending';
END; $$;

-- Accept: creates a real order and funds escrow through the existing trigger.
CREATE OR REPLACE FUNCTION public.accept_project_proposal(_proposal_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); pr public.project_proposals; p public.projects; g RECORD;
  seller_tier account_tier; fee_pct numeric; new_order uuid; bal numeric;
BEGIN
  PERFORM public.assert_active_account(uid);
  PERFORM public.assert_financial_open();
  SELECT * INTO pr FROM public.project_proposals WHERE id = _proposal_id FOR UPDATE;
  IF pr.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT * INTO p FROM public.projects WHERE id = pr.project_id FOR UPDATE;
  IF p.owner_id <> uid THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p.status <> 'open' OR pr.status <> 'pending' THEN RAISE EXCEPTION 'PROJECT_NOT_OPEN'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = pr.freelancer_id AND (is_frozen OR is_deactivated)) THEN
    RAISE EXCEPTION 'FREELANCER_UNAVAILABLE';
  END IF;
  SELECT available_usdt INTO bal FROM public.wallets WHERE user_id = uid;
  IF bal IS NULL OR bal < pr.amount_usdt THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;

  SELECT * INTO g FROM public.governance_settings WHERE id = 1;
  SELECT account_tier INTO seller_tier FROM public.profiles WHERE id = pr.freelancer_id;
  fee_pct := CASE seller_tier WHEN 'pro' THEN coalesce(g.fee_pro_pct,5) WHEN 'corporate' THEN coalesce(g.fee_corporate_pct,2.5) ELSE coalesce(g.fee_free_pct,10) END / 100.0;

  INSERT INTO public.orders(buyer_id, seller_id, title, category, amount_usdt, platform_fee_usdt, delivery_days, sow_terms, status)
  VALUES (uid, pr.freelancer_id, left(p.title,160), 'freelance', pr.amount_usdt, round(pr.amount_usdt * fee_pct, 6), pr.delivery_days,
          left('مشروع: ' || p.title || E'\n\n' || p.description || E'\n\nعرض المستقل:\n' || pr.cover_letter, 4000), 'pending')
  RETURNING id INTO new_order;
  UPDATE public.orders SET status = 'in_progress' WHERE id = new_order;

  UPDATE public.project_proposals SET status = 'accepted' WHERE id = pr.id;
  UPDATE public.project_proposals SET status = 'rejected' WHERE project_id = p.id AND id <> pr.id AND status = 'pending';
  UPDATE public.projects SET status = 'in_progress', awarded_proposal_id = pr.id, order_id = new_order WHERE id = p.id;

  INSERT INTO public.notifications(user_id, kind, title, body, link, meta)
  VALUES (pr.freelancer_id, 'proposal_accepted', 'تم قبول عرضك وحجز المبلغ في الضمان', p.title, '/fulfillment/' || new_order,
          jsonb_build_object('project_id', p.id, 'order_id', new_order));
  INSERT INTO public.notifications(user_id, kind, title, body, link, meta)
  SELECT freelancer_id, 'proposal_rejected', 'لم يتم اختيار عرضك', p.title, '/project/' || p.id, jsonb_build_object('project_id', p.id)
  FROM public.project_proposals WHERE project_id = p.id AND id <> pr.id AND status = 'rejected';
  RETURN new_order;
END; $$;

-- Keep project status in sync with its order.
CREATE OR REPLACE FUNCTION public.sync_project_from_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'completed' THEN
      UPDATE public.projects SET status = 'completed' WHERE order_id = NEW.id AND status = 'in_progress';
    ELSIF NEW.status IN ('cancelled','refunded') THEN
      UPDATE public.projects SET status = 'closed' WHERE order_id = NEW.id AND status = 'in_progress';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER orders_sync_project AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.sync_project_from_order();

CREATE OR REPLACE FUNCTION public.admin_moderate_project(_project_id uuid, _action text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.projects;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO p FROM public.projects WHERE id = _project_id FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF p.status IN ('in_progress','completed') THEN RAISE EXCEPTION 'PROJECT_HAS_ESCROW'; END IF;
  IF _action = 'close' THEN UPDATE public.projects SET status = 'closed', admin_note = _note WHERE id = p.id;
  ELSIF _action = 'remove' THEN UPDATE public.projects SET status = 'removed', admin_note = _note WHERE id = p.id;
  ELSIF _action = 'reopen' THEN UPDATE public.projects SET status = 'open', admin_note = _note WHERE id = p.id;
  ELSE RAISE EXCEPTION 'INVALID_ACTION'; END IF;
  IF _action IN ('close','remove') THEN
    UPDATE public.project_proposals SET status = 'rejected' WHERE project_id = p.id AND status = 'pending';
    INSERT INTO public.notifications(user_id, kind, title, body, link, meta)
    VALUES (p.owner_id, 'project_moderated', 'قامت الإدارة بإغلاق مشروعك', coalesce(_note, p.title), '/projects', jsonb_build_object('project_id', p.id));
  END IF;
  INSERT INTO public.audit_logs(admin_id, action_type, target_table, target_id, meta)
  VALUES (auth.uid(), 'project_' || _action, 'projects', p.id, jsonb_build_object('note', _note, 'previous_status', p.status));
END; $$;

-- Presence
CREATE OR REPLACE FUNCTION public.touch_presence()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE public.profiles SET last_active_at = now()
  WHERE id = auth.uid() AND (last_active_at IS NULL OR last_active_at < now() - interval '2 minutes');
END; $$;

CREATE OR REPLACE FUNCTION public.set_presence_visibility(_hidden boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  UPDATE public.profiles SET hide_online_status = coalesce(_hidden,false) WHERE id = auth.uid();
END; $$;

CREATE OR REPLACE FUNCTION public.get_presence(_ids uuid[])
RETURNS TABLE(id uuid, last_active_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, CASE WHEN p.hide_online_status THEN NULL ELSE p.last_active_at END
  FROM public.profiles p WHERE p.id = ANY(_ids[1:200]);
$$;

CREATE OR REPLACE FUNCTION public.get_freelancers_directory(_limit integer DEFAULT 60)
RETURNS TABLE(id uuid, display_name text, avatar_url text, bio text, country text, is_verified boolean, rating numeric,
  completed_orders integer, account_tier account_tier, listings_count bigint, last_active_at timestamptz, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.avatar_url, p.bio, p.country, p.is_verified, p.rating, p.completed_orders, p.account_tier,
    (SELECT count(*) FROM public.listings l WHERE l.owner_id = p.id AND l.is_published),
    CASE WHEN p.hide_online_status THEN NULL ELSE p.last_active_at END, p.created_at
  FROM public.profiles p
  WHERE NOT p.is_frozen AND NOT p.is_deactivated
    AND (p.completed_orders > 0 OR EXISTS (SELECT 1 FROM public.listings l WHERE l.owner_id = p.id AND l.is_published))
  ORDER BY p.completed_orders DESC, p.rating DESC, p.created_at ASC
  LIMIT LEAST(GREATEST(coalesce(_limit,60),1),200);
$$;

CREATE OR REPLACE FUNCTION public.admin_user_activity()
RETURNS TABLE(id uuid, last_active_at timestamptz, last_listing_at timestamptz, last_project_at timestamptz, proposals_24h bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN QUERY SELECT p.id, p.last_active_at,
    (SELECT max(l.created_at) FROM public.listings l WHERE l.owner_id = p.id),
    (SELECT max(pr.created_at) FROM public.projects pr WHERE pr.owner_id = p.id),
    (SELECT count(*) FROM public.project_proposals pp WHERE pp.freelancer_id = p.id AND pp.created_at > now() - interval '24 hours')
  FROM public.profiles p;
END; $$;

REVOKE EXECUTE ON FUNCTION public.create_project(text,text,text,numeric,numeric,integer), public.submit_project_proposal(uuid,numeric,integer,text),
  public.withdraw_project_proposal(uuid), public.close_own_project(uuid), public.accept_project_proposal(uuid),
  public.admin_moderate_project(uuid,text,text), public.touch_presence(), public.set_presence_visibility(boolean),
  public.my_proposal_quota(), public.admin_user_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_project(text,text,text,numeric,numeric,integer), public.submit_project_proposal(uuid,numeric,integer,text),
  public.withdraw_project_proposal(uuid), public.close_own_project(uuid), public.accept_project_proposal(uuid),
  public.admin_moderate_project(uuid,text,text), public.touch_presence(), public.set_presence_visibility(boolean),
  public.my_proposal_quota(), public.admin_user_activity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_presence(uuid[]), public.get_freelancers_directory(integer) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_project_from_order(), public.assert_active_account(uuid), public.proposal_daily_cap(uuid) FROM PUBLIC, anon;