-- ENUMS
create type public.app_role as enum ('admin', 'user');
create type public.task_status as enum ('todo', 'in_progress', 'done');
create type public.task_priority as enum ('low', 'medium', 'high');
create type public.attendance_status as enum ('present', 'late', 'absent', 'half_day');

-- updated_at helper
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- USER ROLES (separate)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.current_user_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.user_roles where user_id = auth.uid()
  order by case role when 'admin' then 1 else 2 end limit 1
$$;

create policy "Profiles: users read own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "Profiles: admins read all" on public.profiles for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Profiles: users update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Profiles: admins update all" on public.profiles for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "Roles: users read own" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "Roles: admins read all" on public.user_roles for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Roles: admins manage all" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create trigger trg_profiles_updated_at before update on public.profiles
for each row execute function public.update_updated_at_column();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name',''))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user')
  on conflict (user_id, role) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- PROJECTS
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.projects enable row level security;

create policy "Projects: authenticated read" on public.projects for select to authenticated using (true);
create policy "Projects: admins write" on public.projects for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create trigger trg_projects_updated_at before update on public.projects
for each row execute function public.update_updated_at_column();

-- TASKS
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  project_id uuid not null references public.projects(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_tasks_project on public.tasks(project_id);
create index idx_tasks_assigned on public.tasks(assigned_to);
alter table public.tasks enable row level security;

create policy "Tasks: admins all" on public.tasks for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "Tasks: users read assigned" on public.tasks for select to authenticated using (assigned_to = auth.uid());
create policy "Tasks: users update assigned" on public.tasks for update to authenticated
  using (assigned_to = auth.uid()) with check (assigned_to = auth.uid());

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

create trigger trg_tasks_user_scope before update on public.tasks
for each row execute function public.enforce_task_user_update_scope();

create trigger trg_tasks_updated_at before update on public.tasks
for each row execute function public.update_updated_at_column();

-- COMMENTS
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
create index idx_comments_task on public.comments(task_id);
alter table public.comments enable row level security;

create or replace function public.can_access_task(_task_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tasks t
    where t.id = _task_id
      and (public.has_role(auth.uid(),'admin') or t.assigned_to = auth.uid())
  )
$$;

create policy "Comments: read if task accessible" on public.comments for select to authenticated using (public.can_access_task(task_id));
create policy "Comments: insert own if task accessible" on public.comments for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_task(task_id));
create policy "Comments: delete own or admin" on public.comments for delete to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- ATTENDANCE SETTINGS (singleton)
create table public.attendance_settings (
  id boolean primary key default true check (id = true),
  check_in_start time not null default '09:00',
  check_in_end time not null default '10:00',
  check_out_start time not null default '17:00',
  check_out_end time not null default '20:00',
  timezone text not null default 'UTC',
  updated_at timestamptz not null default now()
);
insert into public.attendance_settings (id) values (true) on conflict (id) do nothing;
alter table public.attendance_settings enable row level security;

create policy "AS: authenticated read" on public.attendance_settings for select to authenticated using (true);
create policy "AS: admins update" on public.attendance_settings for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create trigger trg_attendance_settings_updated_at before update on public.attendance_settings
for each row execute function public.update_updated_at_column();

-- ATTENDANCE
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  check_in timestamptz,
  check_out timestamptz,
  status public.attendance_status not null default 'absent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);
create index idx_attendance_user_date on public.attendance(user_id, date desc);
alter table public.attendance enable row level security;

create policy "Att: users read own" on public.attendance for select to authenticated using (user_id = auth.uid());
create policy "Att: admins read all" on public.attendance for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Att: users insert own" on public.attendance for insert to authenticated with check (user_id = auth.uid());
create policy "Att: users update own" on public.attendance for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Att: admins manage all" on public.attendance for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

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

create trigger trg_attendance_compute_status before insert or update on public.attendance
for each row execute function public.compute_attendance_status();

create trigger trg_attendance_updated_at before update on public.attendance
for each row execute function public.update_updated_at_column();