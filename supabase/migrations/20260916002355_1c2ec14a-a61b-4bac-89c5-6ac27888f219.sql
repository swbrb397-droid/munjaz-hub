CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

UPDATE auth.users
SET encrypted_password = extensions.crypt('Admin@123456', extensions.gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW(),
    raw_app_meta_data = jsonb_set(COALESCE(raw_app_meta_data, '{}'::jsonb), '{provider}', '"email"')
WHERE email IN ('swbrb397@gmail.com', 'ddjj68513@gmail.com');

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
WHERE email IN ('swbrb397@gmail.com', 'ddjj68513@gmail.com')
ON CONFLICT DO NOTHING;