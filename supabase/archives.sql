-- Archives : documents d'origine du jeu et suppléments publiés par Games Workshop.
-- À exécuter une fois dans l'éditeur SQL de Supabase.
create table if not exists public.archives (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  annee int not null,
  pdf_url text not null,
  created_at timestamptz default now() not null
);

alter table public.archives enable row level security;

create policy "Public read archives" on public.archives
  for select using (true);

create policy "Admins insert archives" on public.archives
  for insert with check (public.get_my_role() in ('admin', 'super_admin'));

create policy "Admins update archives" on public.archives
  for update using (public.get_my_role() in ('admin', 'super_admin'));

create policy "Admins delete archives" on public.archives
  for delete using (public.get_my_role() in ('admin', 'super_admin'));
