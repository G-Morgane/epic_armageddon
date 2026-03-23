-- Documents table
create table public.documents (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  version text,
  pdf_url text not null,
  sort_order int default 0,
  created_at timestamptz default now() not null
);

-- RLS
alter table public.documents enable row level security;

create policy "Public read documents" on public.documents
  for select using (true);

create policy "Admins insert documents" on public.documents
  for insert with check (public.get_my_role() in ('admin', 'super_admin'));

create policy "Admins update documents" on public.documents
  for update using (public.get_my_role() in ('admin', 'super_admin'));

create policy "Admins delete documents" on public.documents
  for delete using (public.get_my_role() in ('admin', 'super_admin'));

-- Seed existing documents
insert into public.documents (title, description, version, pdf_url, sort_order) values
  ('Livre de Règles Complet', 'Le livre de règles officiel amendé par EA-FR dans son intégralité.', 'V.3', 'https://nomrnaobradtiddfewxm.supabase.co/storage/v1/object/public/army-pdfs/regles/ldr-complet-v3.pdf', 1),
  ('Livre de Règles Abrégé', 'Une version condensée des règles, idéale comme aide-mémoire en partie.', 'V.1.3', 'https://nomrnaobradtiddfewxm.supabase.co/storage/v1/object/public/army-pdfs/regles/ldr-abrege-v1.3.pdf', 2),
  ('FAQ', 'La Foire Aux Questions officielle, clarifiant les zones d''ombre des règles.', 'V.1.1', 'https://nomrnaobradtiddfewxm.supabase.co/storage/v1/object/public/army-pdfs/regles/faq-2022-v1.1.pdf', 3);
