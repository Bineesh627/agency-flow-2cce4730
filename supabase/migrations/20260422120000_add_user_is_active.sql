-- Add is_active flag to profiles
alter table public.profiles
  add column if not exists is_active boolean not null default true;

-- Let admins update the is_active column (already covered by "Profiles: admins update all" policy)
-- No new RLS needed.
