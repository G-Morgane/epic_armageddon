-- Listes d'armée du builder.
-- Nouvelle table uniquement : aucune table existante n'est modifiée, la prod n'est pas touchée.
-- Tout passe par les routes serveur (clé service), donc aucune policy publique.

create table if not exists public.listes_armee (
  id uuid primary key default gen_random_uuid(),
  -- propriétaire ; null = liste anonyme rattachée à un code de partage seul
  user_id uuid references auth.users (id) on delete cascade,
  codex text not null,
  nom text not null,
  limite integer not null default 3000,
  -- la liste elle-même (formations, options, choix), au format de shared/codex/liste.ts
  data jsonb not null,
  -- code court du lien de partage ; null tant que la liste n'est pas partagée
  code_partage text unique,
  total integer,
  valide boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_listes_armee_user on public.listes_armee (user_id, updated_at desc);
create index if not exists idx_listes_armee_codex on public.listes_armee (codex);

alter table public.listes_armee enable row level security;

-- Pas de policy : seule la clé service (routes serveur) accède à la table.
-- Le partage public passe par /api/listes/partage/[code], qui ne renvoie que la liste demandée.

-- Horodatage de modification
create or replace function public.touch_listes_armee()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_listes_armee_updated on public.listes_armee;
create trigger trg_listes_armee_updated
  before update on public.listes_armee
  for each row execute function public.touch_listes_armee();
