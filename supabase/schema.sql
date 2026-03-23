-- Armies table
create table public.armies (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  faction text not null check (faction in ('imperium', 'chaos', 'xenos')),
  cover_image text,
  description text,
  created_at timestamptz default now() not null
);

-- Army versions table (PDF history)
create table public.army_versions (
  id uuid default gen_random_uuid() primary key,
  army_id uuid not null references public.armies(id) on delete cascade,
  version text not null,
  pdf_url text not null,
  changelog text,
  published_at timestamptz default now() not null,
  is_current boolean default false not null
);

-- Only one current version per army
create unique index idx_one_current_version
  on public.army_versions (army_id)
  where (is_current = true);

-- Index for faster lookups
create index idx_army_versions_army_id on public.army_versions (army_id);
create index idx_armies_faction on public.armies (faction);

-- Storage bucket for army PDFs
insert into storage.buckets (id, name, public)
values ('army-pdfs', 'army-pdfs', true);

-- Allow public read access to PDFs
create policy "Public read access" on storage.objects
  for select using (bucket_id = 'army-pdfs');

-- RLS policies
alter table public.armies enable row level security;
alter table public.army_versions enable row level security;

-- Public read access
create policy "Public read armies" on public.armies
  for select using (true);

create policy "Public read army_versions" on public.army_versions
  for select using (true);
