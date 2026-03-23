-- Profiles table (linked to Supabase Auth)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'admin' check (role in ('admin', 'super_admin')),
  created_at timestamptz default now() not null
);

-- RLS on profiles
alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "Users read own profile" on public.profiles
  for select using (auth.uid() = id);

-- Super admins can read all profiles
create policy "Super admins read all profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin')
  );

-- Super admins can update all profiles
create policy "Super admins update profiles" on public.profiles
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin')
  );

-- Super admins can delete profiles
create policy "Super admins delete profiles" on public.profiles
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin')
  );

-- Write policies for armies (admin + super_admin)
create policy "Admins update armies" on public.armies
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'))
  );

create policy "Admins insert armies" on public.armies
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'))
  );

create policy "Admins delete armies" on public.armies
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'))
  );

-- Write policies for army_versions (admin + super_admin)
create policy "Admins insert army_versions" on public.army_versions
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'))
  );

create policy "Admins update army_versions" on public.army_versions
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'))
  );

create policy "Admins delete army_versions" on public.army_versions
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'))
  );

-- Storage: admins can upload PDFs
create policy "Admins upload PDFs" on storage.objects
  for insert with check (
    bucket_id = 'army-pdfs' and
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'))
  );

create policy "Admins delete PDFs" on storage.objects
  for delete using (
    bucket_id = 'army-pdfs' and
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'))
  );

-- Function to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), 'admin');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger on auth.users insert
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
