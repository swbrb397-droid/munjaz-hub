CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('payment','order','account','suggestion','general')),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 5 AND 150),
  body text NOT NULL CHECK (char_length(body) BETWEEN 10 AND 2000),
  order_id uuid,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','answered','closed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  ai_summary text,
  ai_draft text,
  ai_classified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets owner read" ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tickets admin update" ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket msgs participant read" ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE TRIGGER tickets_text_guard BEFORE INSERT OR UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_text('subject','body');
CREATE TRIGGER ticket_msgs_text_guard BEFORE INSERT OR UPDATE ON public.support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_text('body');

CREATE OR REPLACE FUNCTION public.create_support_ticket(_category text, _subject text, _body text, _order_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _category NOT IN ('payment','order','account','suggestion','general') THEN RAISE EXCEPTION 'INVALID_CATEGORY'; END IF;
  IF (SELECT count(*) FROM public.support_tickets WHERE user_id = uid AND created_at > now() - interval '24 hours') >= 10 THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
  IF (SELECT count(*) FROM public.support_tickets WHERE user_id = uid AND status IN ('open','in_review')) >= 5 THEN RAISE EXCEPTION 'TOO_MANY_OPEN'; END IF;
  IF _order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.orders WHERE id = _order_id AND (buyer_id = uid OR seller_id = uid)) THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  INSERT INTO public.support_tickets (user_id, category, subject, body, order_id)
  VALUES (uid, _category, left(btrim(_subject),150), left(btrim(_body),2000), _order_id)
  RETURNING id INTO new_id;
  RETURN new_id;
END; $$;
REVOKE ALL ON FUNCTION public.create_support_ticket(text,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_support_ticket(text,text,text,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reply_support_ticket(_ticket_id uuid, _body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); t public.support_tickets; new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO t FROM public.support_tickets WHERE id = _ticket_id FOR UPDATE;
  IF t.id IS NULL OR t.user_id <> uid THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF t.status = 'closed' THEN RAISE EXCEPTION 'TICKET_CLOSED'; END IF;
  INSERT INTO public.support_ticket_messages (ticket_id, sender_id, is_admin, body)
  VALUES (_ticket_id, uid, false, left(btrim(_body),2000)) RETURNING id INTO new_id;
  UPDATE public.support_tickets SET status = 'open', updated_at = now() WHERE id = _ticket_id;
  RETURN new_id;
END; $$;
REVOKE ALL ON FUNCTION public.reply_support_ticket(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reply_support_ticket(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_reply_ticket(_ticket_id uuid, _body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); t public.support_tickets; new_id uuid;
BEGIN
  IF uid IS NULL OR NOT public.has_role(uid, 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO t FROM public.support_tickets WHERE id = _ticket_id;
  IF t.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  INSERT INTO public.support_ticket_messages (ticket_id, sender_id, is_admin, body)
  VALUES (_ticket_id, uid, true, left(btrim(_body),2000)) RETURNING id INTO new_id;
  UPDATE public.support_tickets SET status = 'answered', updated_at = now() WHERE id = _ticket_id;
  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (t.user_id, 'رد جديد على تذكرتك', left(t.subject, 80), '/support');
  RETURN new_id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_reply_ticket(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reply_ticket(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_update_ticket(_ticket_id uuid, _status text, _priority text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _status NOT IN ('open','in_review','answered','closed') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  UPDATE public.support_tickets
  SET status = _status,
      priority = coalesce(_priority, priority),
      updated_at = now()
  WHERE id = _ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.admin_update_ticket(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_ticket(uuid,text,text) TO authenticated, service_role;