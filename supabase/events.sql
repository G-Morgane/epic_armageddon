-- Events table
create table public.events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  external_link text,
  address text,
  contact text,
  event_date date not null,
  event_end_date date,
  created_at timestamptz default now() not null
);

-- RLS
alter table public.events enable row level security;

-- Public read
create policy "Public read events" on public.events
  for select using (true);

-- Admins write
create policy "Admins insert events" on public.events
  for insert with check (public.get_my_role() in ('admin', 'super_admin'));

create policy "Admins update events" on public.events
  for update using (public.get_my_role() in ('admin', 'super_admin'));

create policy "Admins delete events" on public.events
  for delete using (public.get_my_role() in ('admin', 'super_admin'));
