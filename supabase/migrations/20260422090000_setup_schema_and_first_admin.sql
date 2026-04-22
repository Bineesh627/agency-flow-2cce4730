-- ============================================================
-- FULL IDEMPOTENT SCHEMA SETUP
-- Run this once in the Supabase SQL Editor.
-- All statements are safe to re-run (IF NOT EXISTS / OR REPLACE).
-- ============================================================

-- EXTENSIONS
create extension if not exists pgcrypto;

-- ============================================================
-- ENUMS
-- ============================================================
do $$ begin
  create type public.app_role as enum ('admin', 'user');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_status as enum ('todo', 'in_progress', 'done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_priority as enum ('low', 'medium', 'high');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attendance_status as enum ('present', 'late', 'absent', 'half_day');
exception when duplicate_object then null; end $$;

-- ============================================================
-- HELPER: updated_at trigger function
-- ============================================================
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- ============================================================
-- TABLE: profiles
-- ============================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text not null default '',
  email        text not null,
  job_position text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- ============================================================
-- TABLE: user_roles
-- ============================================================
create table if not exists public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.current_user_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.user_roles where user_id = auth.uid()
  order by case role when 'admin' then 1 else 2 end limit 1
$$;

create or replace function public.get_public_profiles(_ids uuid[])
returns table(id uuid, name text, job_position text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.job_position
  from public.profiles p
  where p.id = any(_ids);
$$;

grant execute on function public.get_public_profiles(uuid[]) to authenticated;

-- ============================================================
-- RLS: profiles
-- ============================================================
drop policy if exists "Profiles: users read own"            on public.profiles;
drop policy if exists "Profiles: admins read all"           on public.profiles;
drop policy if exists "Profiles: users update own"          on public.profiles;
drop policy if exists "Profiles: admins update all"         on public.profiles;
drop policy if exists "Profiles: authenticated read basic"  on public.profiles;

create policy "Profiles: users read own"
  on public.profiles for select to authenticated using (id = auth.uid());
create policy "Profiles: admins read all"
  on public.profiles for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Profiles: users update own"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "Profiles: admins update all"
  on public.profiles for update to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- RLS: user_roles
-- ============================================================
drop policy if exists "Roles: users read own"    on public.user_roles;
drop policy if exists "Roles: admins read all"   on public.user_roles;
drop policy if exists "Roles: admins manage all" on public.user_roles;

create policy "Roles: users read own"
  on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "Roles: admins read all"
  on public.user_roles for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Roles: admins manage all"
  on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- TRIGGER: handle_new_user  →  creates profile + default 'user' role
--          FIRST ever signup automatically gets 'admin' role instead
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_first_user boolean;
begin
  -- Create profile row
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (id) do nothing;

  -- Check if this is the very first user in the system
  select not exists (
    select 1 from auth.users where id != new.id
  ) into is_first_user;

  if is_first_user then
    -- First signup → grant admin
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  else
    -- Everyone else → regular user
    insert into public.user_roles (user_id, role)
    values (new.id, 'user')
    on conflict (user_id, role) do nothing;
  end if;

  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- TABLE: projects
-- ============================================================
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.projects enable row level security;

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.update_updated_at_column();

-- ============================================================
-- TABLE: project_members
-- ============================================================
create table if not exists public.project_members (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null,
  role       text not null default 'member',
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);
create index if not exists idx_project_members_project on public.project_members(project_id);
create index if not exists idx_project_members_user on public.project_members(user_id);
alter table public.project_members enable row level security;

create or replace function public.is_project_member(_project_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.project_members
    where project_id = _project_id and user_id = _user_id
  )
$$;

-- ============================================================
-- RLS: projects
-- ============================================================
drop policy if exists "Projects: authenticated read"       on public.projects;
drop policy if exists "Projects: members and admins read"  on public.projects;
drop policy if exists "Projects: admins write"             on public.projects;

create policy "Projects: members and admins read"
  on public.projects for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.is_project_member(id, auth.uid())
  );
create policy "Projects: admins write"
  on public.projects for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- RLS: project_members
-- ============================================================
drop policy if exists "PM: admins manage all"        on public.project_members;
drop policy if exists "PM: users read own membership" on public.project_members;

create policy "PM: admins manage all"
  on public.project_members for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
create policy "PM: users read own membership"
  on public.project_members for select to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- TABLE: tasks
-- ============================================================
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  status      public.task_status not null default 'todo',
  priority    public.task_priority not null default 'medium',
  project_id  uuid not null references public.projects(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by  uuid references auth.users(id) on delete set null,
  due_date    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_tasks_project  on public.tasks(project_id);
create index if not exists idx_tasks_assigned on public.tasks(assigned_to);
alter table public.tasks enable row level security;

-- RLS: tasks
drop policy if exists "Tasks: admins all"           on public.tasks;
drop policy if exists "Tasks: users read assigned"  on public.tasks;
drop policy if exists "Tasks: users update assigned" on public.tasks;

create policy "Tasks: admins all"
  on public.tasks for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));
create policy "Tasks: users read assigned"
  on public.tasks for select to authenticated
  using (assigned_to = auth.uid());
create policy "Tasks: users update assigned"
  on public.tasks for update to authenticated
  using (assigned_to = auth.uid())
  with check (assigned_to = auth.uid());

-- Trigger: enforce non-admin users can only update status
create or replace function public.enforce_task_user_update_scope()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.has_role(auth.uid(),'admin') then return new; end if;
  if new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.priority is distinct from old.priority
     or new.project_id is distinct from old.project_id
     or new.assigned_to is distinct from old.assigned_to
     or new.created_by is distinct from old.created_by
     or new.due_date is distinct from old.due_date then
    raise exception 'Only admins can modify task details. Users may only update status.';
  end if;
  return new;
end; $$;

drop trigger if exists trg_tasks_user_scope on public.tasks;
create trigger trg_tasks_user_scope
  before update on public.tasks
  for each row execute function public.enforce_task_user_update_scope();

-- Trigger: prevent assigning tasks to admins
create or replace function public.prevent_admin_task_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_to is not null and public.has_role(new.assigned_to, 'admin') then
    raise exception 'Cannot assign tasks to admin users';
  end if;
  return new;
end; $$;

drop trigger if exists trg_prevent_admin_task_assignment on public.tasks;
create trigger trg_prevent_admin_task_assignment
  before insert or update of assigned_to on public.tasks
  for each row execute function public.prevent_admin_task_assignment();

-- Trigger: auto-add assignee as project member
create or replace function public.ensure_assignee_is_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_to is not null then
    insert into public.project_members (project_id, user_id, role)
    values (new.project_id, new.assigned_to, 'member')
    on conflict (project_id, user_id) do nothing;
  end if;
  return new;
end; $$;

drop trigger if exists trg_ensure_assignee_is_member on public.tasks;
create trigger trg_ensure_assignee_is_member
  after insert or update of assigned_to on public.tasks
  for each row execute function public.ensure_assignee_is_member();

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.update_updated_at_column();

-- ============================================================
-- TABLE: comments
-- ============================================================
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_comments_task on public.comments(task_id);
alter table public.comments enable row level security;

create or replace function public.can_access_task(_task_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tasks t
    where t.id = _task_id
      and (public.has_role(auth.uid(),'admin') or t.assigned_to = auth.uid())
  )
$$;

drop policy if exists "Comments: read if task accessible"          on public.comments;
drop policy if exists "Comments: insert own if task accessible"    on public.comments;
drop policy if exists "Comments: delete own or admin"              on public.comments;

create policy "Comments: read if task accessible"
  on public.comments for select to authenticated
  using (public.can_access_task(task_id));
create policy "Comments: insert own if task accessible"
  on public.comments for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_task(task_id));
create policy "Comments: delete own or admin"
  on public.comments for delete to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- ============================================================
-- TABLE: attendance_settings (singleton)
-- ============================================================
create table if not exists public.attendance_settings (
  id              boolean primary key default true check (id = true),
  check_in_start  time not null default '09:00',
  check_in_end    time not null default '10:00',
  check_out_start time not null default '17:00',
  check_out_end   time not null default '20:00',
  timezone        text not null default 'UTC',
  updated_at      timestamptz not null default now()
);
insert into public.attendance_settings (id) values (true) on conflict (id) do nothing;
alter table public.attendance_settings enable row level security;

drop policy if exists "AS: authenticated read" on public.attendance_settings;
drop policy if exists "AS: admins update"      on public.attendance_settings;

create policy "AS: authenticated read"
  on public.attendance_settings for select to authenticated using (true);
create policy "AS: admins update"
  on public.attendance_settings for update to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

drop trigger if exists trg_attendance_settings_updated_at on public.attendance_settings;
create trigger trg_attendance_settings_updated_at
  before update on public.attendance_settings
  for each row execute function public.update_updated_at_column();

-- ============================================================
-- TABLE: attendance
-- ============================================================
create table if not exists public.attendance (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null default current_date,
  check_in   timestamptz,
  check_out  timestamptz,
  status     public.attendance_status not null default 'absent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);
create index if not exists idx_attendance_user_date on public.attendance(user_id, date desc);
alter table public.attendance enable row level security;

drop policy if exists "Att: users read own"    on public.attendance;
drop policy if exists "Att: admins read all"   on public.attendance;
drop policy if exists "Att: users insert own"  on public.attendance;
drop policy if exists "Att: users update own"  on public.attendance;
drop policy if exists "Att: admins manage all" on public.attendance;

create policy "Att: users read own"
  on public.attendance for select to authenticated using (user_id = auth.uid());
create policy "Att: admins read all"
  on public.attendance for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Att: users insert own"
  on public.attendance for insert to authenticated with check (user_id = auth.uid());
create policy "Att: users update own"
  on public.attendance for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Att: admins manage all"
  on public.attendance for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

create or replace function public.compute_attendance_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s public.attendance_settings%rowtype;
  ci_local time;
  co_local time;
begin
  select * into s from public.attendance_settings where id = true;

  if new.check_in is not null then
    ci_local := (new.check_in at time zone s.timezone)::time;
    if ci_local > s.check_in_end then
      new.status := 'late';
    elsif ci_local > s.check_in_start then
      new.status := 'late';
    else
      new.status := 'present';
    end if;
  else
    new.status := 'absent';
  end if;

  if new.check_in is not null and new.check_out is null then
    if (now() at time zone s.timezone)::time > s.check_out_end then
      new.status := 'half_day';
    end if;
  end if;

  if new.check_in is not null and new.check_out is not null then
    co_local := (new.check_out at time zone s.timezone)::time;
    if co_local < s.check_out_start then
      new.status := 'half_day';
    end if;
  end if;

  return new;
end; $$;

drop trigger if exists trg_attendance_compute_status on public.attendance;
create trigger trg_attendance_compute_status
  before insert or update on public.attendance
  for each row execute function public.compute_attendance_status();

drop trigger if exists trg_attendance_updated_at on public.attendance;
create trigger trg_attendance_updated_at
  before update on public.attendance
  for each row execute function public.update_updated_at_column();

-- ============================================================
-- TABLE: project_documents
-- ============================================================
create table if not exists public.project_documents (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  uploaded_by  uuid not null,
  name         text not null,
  storage_path text not null unique,
  mime_type    text not null,
  size_bytes   bigint not null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_project_documents_project on public.project_documents(project_id);
alter table public.project_documents enable row level security;

drop policy if exists "Docs: authenticated read"       on public.project_documents;
drop policy if exists "Docs: members and admins read"  on public.project_documents;
drop policy if exists "Docs: admins manage"            on public.project_documents;

create policy "Docs: members and admins read"
  on public.project_documents for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.is_project_member(project_id, auth.uid())
  );
create policy "Docs: admins manage"
  on public.project_documents for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- STORAGE: project-documents bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('project-documents', 'project-documents', false)
on conflict (id) do nothing;

drop policy if exists "project-documents: read"         on storage.objects;
drop policy if exists "project-documents: admin write"  on storage.objects;
drop policy if exists "project-documents: admin delete" on storage.objects;
drop policy if exists "Project docs: authenticated read" on storage.objects;
drop policy if exists "Project docs: admins upload"     on storage.objects;
drop policy if exists "Project docs: admins update"     on storage.objects;
drop policy if exists "Project docs: admins delete"     on storage.objects;

create policy "project-documents: read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'project-documents'
    and (
      public.has_role(auth.uid(),'admin')
      or public.is_project_member(
        ((storage.foldername(name))[1])::uuid,
        auth.uid()
      )
    )
  );
create policy "project-documents: admin write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-documents'
    and public.has_role(auth.uid(),'admin')
  );
create policy "project-documents: admin delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-documents'
    and public.has_role(auth.uid(),'admin')
  );

-- ============================================================
-- DONE: Schema is fully set up.
-- The FIRST user to sign up will automatically be granted 'admin'.
-- All subsequent users get the 'user' role.
-- ============================================================
