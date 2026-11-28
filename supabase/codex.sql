-- Codex unifiés : brouillons et versions publiées (une fiche JSON par armée).
-- Lecture/écriture uniquement côté serveur (clé service) : pas de policy publique.

create table public.codex_drafts (
  slug text primary key,
  data jsonb not null,
  updated_at timestamptz default now() not null
);

create table public.codex_versions (
  id uuid default gen_random_uuid() primary key,
  slug text not null,
  version text not null,
  changelog text,
  data jsonb not null,
  -- PDF figé au moment de la publication (composition par défaut). Vide : le PDF est composé à la volée.
  pdf_url text,
  published_at timestamptz default now() not null
);

create index idx_codex_versions_slug on public.codex_versions (slug, published_at desc);

alter table public.codex_drafts enable row level security;
alter table public.codex_versions enable row level security;

-- Lecture publique des versions publiées (le builder et le PDF côté client pourront s'en servir)
create policy "Public read codex_versions" on public.codex_versions
  for select using (true);

-- Sur une base déjà créée avant l'ajout du PDF figé :
--   alter table public.codex_versions add column if not exists pdf_url text;
