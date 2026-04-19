-- Project Documents table
create table public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  uploaded_by uuid not null,
  name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);

create index idx_project_documents_project on public.project_documents(project_id);

alter table public.project_documents enable row level security;

-- All authenticated users can read documents (projects are visible to all authenticated users already)
create policy "Docs: authenticated read"
on public.project_documents for select
to authenticated
using (true);

-- Only admins can create/update/delete document rows
create policy "Docs: admins manage"
on public.project_documents for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- Storage bucket (private)
insert into storage.buckets (id, name, public)
values ('project-documents', 'project-documents', false)
on conflict (id) do nothing;

-- Storage policies: authenticated users can read; only admins can write/delete
create policy "Project docs: authenticated read"
on storage.objects for select
to authenticated
using (bucket_id = 'project-documents');

create policy "Project docs: admins upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'project-documents'
  and public.has_role(auth.uid(), 'admin')
);

create policy "Project docs: admins update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'project-documents'
  and public.has_role(auth.uid(), 'admin')
);

create policy "Project docs: admins delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'project-documents'
  and public.has_role(auth.uid(), 'admin')
);