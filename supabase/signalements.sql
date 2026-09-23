-- Signalements de bugs envoyés depuis le builder.
-- Nouvelle table uniquement : aucune table existante n'est modifiée, la prod n'est pas touchée.
-- Tout passe par les routes serveur (clé service), donc aucune policy publique :
--   POST /api/signalements        (ouvert, le builder s'utilise sans compte)
--   GET|PATCH /api/admin/signalements[/:id]  (exigerAdmin)
--
-- À exécuter tel quel dans le SQL editor Supabase. Rejouable sans effet de bord.

create table if not exists public.signalements (
  id uuid primary key default gen_random_uuid(),

  -- QUI : le builder est ouvert aux visiteurs, l'auteur peut être anonyme.
  -- `on delete set null` et non `cascade` : un compte supprimé ne doit pas
  -- effacer un bug encore ouvert.
  user_id uuid references auth.users (id) on delete set null,
  pseudo text,
  -- contact facultatif, surtout utile pour un signalement anonyme
  email text,

  -- LE SOUCI
  categorie text not null default 'autre'
    check (categorie in ('points', 'formation', 'option', 'regles', 'affichage', 'sauvegarde', 'pdf', 'autre')),
  message text not null check (char_length(message) between 5 and 4000),

  -- L'ENDROIT
  page text not null default 'builder',
  -- zone de l'écran, choisie dans la modale (catalogue, carte de formation, bilan...)
  emplacement text,
  url text,

  -- L'ARMÉE
  codex text,
  codex_nom text,
  codex_version text,
  faction text,

  -- LA LISTE au moment du signalement.
  -- Copie figée : le membre continue de modifier sa liste après l'envoi, et
  -- sans copie l'admin ne reproduit plus rien. `liste_id` n'est renseigné que
  -- si la liste était enregistrée sur le compte.
  liste_id uuid references public.listes_armee (id) on delete set null,
  liste_nom text,
  liste_total integer,
  liste_limite integer,
  liste_valide boolean,
  liste_data jsonb,
  -- erreurs de validation affichées au moment du signalement
  liste_erreurs jsonb,

  -- CONTEXTE technique
  user_agent text,
  ecran text,

  -- SUIVI côté admin
  statut text not null default 'nouveau'
    check (statut in ('nouveau', 'en_cours', 'resolu', 'refuse')),
  note_admin text,
  traite_par uuid references auth.users (id) on delete set null,
  traite_le timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- L'écran admin s'ouvre sur les signalements ouverts, du plus récent au plus ancien.
create index if not exists idx_signalements_statut on public.signalements (statut, created_at desc);
create index if not exists idx_signalements_codex on public.signalements (codex, created_at desc);
create index if not exists idx_signalements_user on public.signalements (user_id, created_at desc);

alter table public.signalements enable row level security;

-- Pas de policy : seule la clé service (routes serveur) accède à la table.

-- Horodatage de modification
create or replace function public.touch_signalements()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_signalements_updated on public.signalements;
create trigger trg_signalements_updated
  before update on public.signalements
  for each row execute function public.touch_signalements();
