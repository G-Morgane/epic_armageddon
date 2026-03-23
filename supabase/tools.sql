-- Tools table
create table public.tools (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  url text not null,
  button_label text not null default 'Ouvrir',
  sort_order int default 0,
  created_at timestamptz default now() not null
);

-- RLS
alter table public.tools enable row level security;

create policy "Public read tools" on public.tools
  for select using (true);

create policy "Admins insert tools" on public.tools
  for insert with check (public.get_my_role() in ('admin', 'super_admin'));

create policy "Admins update tools" on public.tools
  for update using (public.get_my_role() in ('admin', 'super_admin'));

create policy "Admins delete tools" on public.tools
  for delete using (public.get_my_role() in ('admin', 'super_admin'));

-- Seed existing tools
insert into public.tools (name, description, url, button_label, sort_order) values
  ('Army Builder', 'Créez vos listes d''armée en un simple clic ! L''EA List Builder est un outil en ligne créé par Cerkaire qui permet de construire ses armées à partir des listes officiellement validées par le Board d''Epic Armageddon.fr. L''outil est en constante évolution. Vous pouvez remonter les bugs sur le canal Discord #ea-army-builder.', 'https://cerkaire.github.io/epic-list-builder/', 'Ouvrir l''Army Builder', 1),
  ('Mod Tabletop Simulator', 'Le mod officiel de EA-FR pour Tabletop Simulator. TTS est un logiciel "bac à sable" disponible sur Steam permettant de recréer les jeux de plateau en ligne. L''équipe EA-FR a créé un mod spécialisé pour Epic Armageddon, permettant d''apprendre et de jouer avec des adversaires du monde entier.', 'https://steamcommunity.com/sharedfiles/filedetails/?id=2057192735', 'Télécharger le mod sur Steam', 2);
