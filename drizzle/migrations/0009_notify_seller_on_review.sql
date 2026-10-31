CREATE OR REPLACE FUNCTION public.notify_seller_on_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _title text;
BEGIN
  SELECT title INTO _title FROM public.orders WHERE id = NEW.order_id;
  INSERT INTO public.notifications (user_id, kind, title, body, link, meta)
  VALUES (NEW.reviewee_id, 'review', 'تقييم جديد على أحد طلباتك',
    'حصلت على تقييم ' || NEW.rating || ' من 5' || COALESCE(' على «' || _title || '»', '') || '.',
    '/dashboard', jsonb_build_object('order_id', NEW.order_id, 'rating', NEW.rating));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_seller_on_review() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS reviews_notify_seller ON public.reviews;
CREATE TRIGGER reviews_notify_seller AFTER INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.notify_seller_on_review();