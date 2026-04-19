-- Bootstrap first admin: admin@gmail.com / admin123
-- Uses bcrypt via pgcrypto (already enabled in Supabase)

do $$
declare
  new_user_id uuid := gen_random_uuid();
begin
  -- Skip if user already exists
  if exists (select 1 from auth.users where email = 'admin@gmail.com') then
    -- Just ensure admin role
    update public.profiles set name = 'Admin' where id = (select id from auth.users where email = 'admin@gmail.com');
    insert into public.user_roles (user_id, role)
    select id, 'admin'::public.app_role from auth.users where email = 'admin@gmail.com'
    on conflict (user_id, role) do nothing;
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    'admin@gmail.com',
    crypt('admin123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Admin"}'::jsonb,
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', 'admin@gmail.com', 'email_verified', true),
    'email',
    new_user_id::text,
    now(), now(), now()
  );

  -- handle_new_user trigger created profile + 'user' role; promote to admin
  insert into public.user_roles (user_id, role) values (new_user_id, 'admin')
  on conflict (user_id, role) do nothing;

  update public.profiles set name = 'Admin' where id = new_user_id;
end $$;