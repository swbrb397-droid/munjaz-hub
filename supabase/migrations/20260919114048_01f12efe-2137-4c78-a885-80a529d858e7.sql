CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_verified_totp(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.mfa_factors
    WHERE user_id = _user_id
      AND factor_type = 'totp'
      AND status = 'verified'
  );
$$;

REVOKE ALL ON FUNCTION private.has_verified_totp(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_verified_totp(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_recent_mfa_verification(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT NOT private.has_verified_totp(_user_id)
    OR COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

REVOKE ALL ON FUNCTION public.has_recent_mfa_verification(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_recent_mfa_verification(uuid) TO authenticated, service_role;

DROP FUNCTION public.has_verified_totp(uuid);