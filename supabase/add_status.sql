-- Add status column to armies
alter table public.armies add column if not exists status text not null default 'official' check (status in ('official', 'beta', 'experimental'));
