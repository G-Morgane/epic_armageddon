-- Army tags table (filterable categories per faction, e.g. "Eldars", "Orcs" for xenos)
create table public.army_tags (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  faction text not null check (faction in ('imperium', 'chaos', 'xenos')),
  position int default 0 not null,
  created_at timestamptz default now() not null,
  unique(name, faction)
);

-- Junction table: assign tags to armies
create table public.army_tag_assignments (
  army_id uuid not null references public.armies(id) on delete cascade,
  tag_id uuid not null references public.army_tags(id) on delete cascade,
  primary key (army_id, tag_id)
);

-- Indexes
create index idx_army_tags_faction on public.army_tags (faction);
create index idx_army_tag_assignments_army on public.army_tag_assignments (army_id);
create index idx_army_tag_assignments_tag on public.army_tag_assignments (tag_id);

-- RLS
alter table public.army_tags enable row level security;
alter table public.army_tag_assignments enable row level security;

-- Public read access
create policy "Public read army_tags" on public.army_tags
  for select using (true);

create policy "Public read army_tag_assignments" on public.army_tag_assignments
  for select using (true);

-- Admin write access (authenticated users)
create policy "Admin insert army_tags" on public.army_tags
  for insert with check (auth.role() = 'authenticated');
create policy "Admin update army_tags" on public.army_tags
  for update using (auth.role() = 'authenticated');
create policy "Admin delete army_tags" on public.army_tags
  for delete using (auth.role() = 'authenticated');

create policy "Admin insert army_tag_assignments" on public.army_tag_assignments
  for insert with check (auth.role() = 'authenticated');
create policy "Admin delete army_tag_assignments" on public.army_tag_assignments
  for delete using (auth.role() = 'authenticated');
