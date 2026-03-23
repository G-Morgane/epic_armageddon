-- Drop existing profile policies
drop policy if exists "Users read own profile" on public.profiles;
drop policy if exists "Super admins read all profiles" on public.profiles;
drop policy if exists "Super admins update profiles" on public.profiles;
drop policy if exists "Super admins delete profiles" on public.profiles;

-- Create a security definer function to get role (avoids recursion)
create or replace function public.get_my_role()
returns text as $$
  select role from public.profiles where id = auth.uid()
$$ language sql security definer stable;

-- Profiles: users can read their own, super admins can read all
create policy "Read own or super admin reads all" on public.profiles
  for select using (
    auth.uid() = id or public.get_my_role() = 'super_admin'
  );

-- Super admins can update profiles
create policy "Super admins update profiles" on public.profiles
  for update using (public.get_my_role() = 'super_admin');

-- Super admins can delete profiles
create policy "Super admins delete profiles" on public.profiles
  for delete using (public.get_my_role() = 'super_admin');

-- Also fix armies/army_versions write policies to use the function
drop policy if exists "Admins update armies" on public.armies;
drop policy if exists "Admins insert armies" on public.armies;
drop policy if exists "Admins delete armies" on public.armies;
drop policy if exists "Admins insert army_versions" on public.army_versions;
drop policy if exists "Admins update army_versions" on public.army_versions;
drop policy if exists "Admins delete army_versions" on public.army_versions;

create policy "Admins update armies" on public.armies
  for update using (public.get_my_role() in ('admin', 'super_admin'));

create policy "Admins insert armies" on public.armies
  for insert with check (public.get_my_role() in ('admin', 'super_admin'));

create policy "Admins delete armies" on public.armies
  for delete using (public.get_my_role() in ('admin', 'super_admin'));

create policy "Admins insert army_versions" on public.army_versions
  for insert with check (public.get_my_role() in ('admin', 'super_admin'));

create policy "Admins update army_versions" on public.army_versions
  for update using (public.get_my_role() in ('admin', 'super_admin'));

create policy "Admins delete army_versions" on public.army_versions
  for delete using (public.get_my_role() in ('admin', 'super_admin'));
