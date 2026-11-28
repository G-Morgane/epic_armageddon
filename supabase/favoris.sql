-- Codex mis en favori par un membre.
-- Nouvelle table uniquement : rien d'existant n'est modifié.
-- Tout passe par les routes serveur (clé service), donc aucune policy publique.

create table if not exists public.favoris_armee (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- l'armée du catalogue public (/armees/{faction}/{id})
  army_id uuid not null references public.armies (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, army_id)
);

create index if not exists idx_favoris_armee_user on public.favoris_armee (user_id, created_at desc);

alter table public.favoris_armee enable row level security;

-- Pas de policy : seule la clé service (routes serveur) accède à la table.
