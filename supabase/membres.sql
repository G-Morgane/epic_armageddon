-- Comptes membres du site (joueurs qui enregistrent leurs listes d'armée).
--
-- À exécuter AVANT d'ouvrir la moindre page de connexion publique.
-- Sans ce fichier, `handle_new_user()` (supabase/auth.sql) donne le rôle
-- `admin` à toute nouvelle ligne de auth.users : un inscrit public entrerait
-- directement dans /admin.
--
-- Rien n'est détruit : les profils existants gardent leur rôle.

-- 1. Le rôle `membre` devient une valeur légale, et la valeur par défaut.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('membre', 'admin', 'super_admin'));
alter table public.profiles alter column role set default 'membre';

-- 2. Un compte créé par inscription est un membre, jamais un admin.
--    Les admins sont promus à la main ou par /api/admin/invite.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    -- pseudo choisi à l'inscription ; sinon null, le site le demandera
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    -- `role` dans les métadonnées n'est PAS lisible par l'utilisateur final :
    -- seule la clé service peut l'écrire (auth.admin.createUser).
    coalesce(new.raw_user_meta_data->>'role', 'membre')
  );
  return new;
end;
$$ language plpgsql security definer;

-- 3. Un membre peut modifier son propre profil (pseudo).
drop policy if exists "Membres modifient leur profil" on public.profiles;
create policy "Membres modifient leur profil" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

--    Le rôle, lui, ne se change pas depuis le client : la policy ci-dessus
--    laisserait un membre s'écrire `role = 'admin'` sur sa propre ligne.
--    auth.uid() vaut null quand l'appel vient de la clé service (routes serveur).
create or replace function public.verrouiller_role()
returns trigger as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and public.get_my_role() <> 'super_admin' then
    raise exception 'Seul un super_admin peut changer un rôle';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_profiles_verrouiller_role on public.profiles;
create trigger trg_profiles_verrouiller_role
  before update on public.profiles
  for each row execute function public.verrouiller_role();

-- 4. Pseudos : uniques, insensibles à la casse, pour l'affichage sur les listes
--    partagées. Les profils sans pseudo (admins historiques) restent valides.
create unique index if not exists idx_profiles_pseudo
  on public.profiles (lower(display_name))
  where display_name is not null;
