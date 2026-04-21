
-- 1. project_members table
create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index idx_project_members_project on public.project_members(project_id);
create index idx_project_members_user on public.project_members(user_id);

alter table public.project_members enable row level security;

-- 2. Helper function: is the user a member of the project?
create or replace function public.is_project_member(_project_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = _project_id and user_id = _user_id
  )
$$;

-- 3. RLS on project_members
create policy "PM: admins manage all"
  on public.project_members for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "PM: users read own membership"
  on public.project_members for select
  to authenticated
  using (user_id = auth.uid());

-- 4. Tighten projects RLS: members and admins only
drop policy if exists "Projects: authenticated read" on public.projects;

create policy "Projects: members and admins read"
  on public.projects for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.is_project_member(id, auth.uid())
  );

-- 5. Tighten project_documents RLS
drop policy if exists "Docs: authenticated read" on public.project_documents;

create policy "Docs: members and admins read"
  on public.project_documents for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.is_project_member(project_id, auth.uid())
  );

-- 6. Storage policies: restrict project-documents bucket to members/admins
drop policy if exists "project-documents: read" on storage.objects;
drop policy if exists "project-documents: admin write" on storage.objects;
drop policy if exists "project-documents: admin delete" on storage.objects;

create policy "project-documents: read"
  on storage.objects for select
  to authenticated
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
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'project-documents'
    and public.has_role(auth.uid(),'admin')
  );

create policy "project-documents: admin delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'project-documents'
    and public.has_role(auth.uid(),'admin')
  );

-- 7. Prevent assigning tasks to admins
create or replace function public.prevent_admin_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_to is not null and public.has_role(new.assigned_to, 'admin') then
    raise exception 'Cannot assign tasks to admin users';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_admin_task_assignment on public.tasks;
create trigger trg_prevent_admin_task_assignment
  before insert or update of assigned_to on public.tasks
  for each row execute function public.prevent_admin_task_assignment();

-- 8. Auto-add task assignee as project member (so they can see the project)
create or replace function public.ensure_assignee_is_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_to is not null then
    insert into public.project_members (project_id, user_id, role)
    values (new.project_id, new.assigned_to, 'member')
    on conflict (project_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ensure_assignee_is_member on public.tasks;
create trigger trg_ensure_assignee_is_member
  after insert or update of assigned_to on public.tasks
  for each row execute function public.ensure_assignee_is_member();
