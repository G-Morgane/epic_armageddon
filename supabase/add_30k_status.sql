-- Drop and recreate the check constraint to include '30k'
alter table public.armies drop constraint if exists armies_status_check;
alter table public.armies add constraint armies_status_check check (status in ('official', 'beta', 'experimental', '30k'));

-- Update existing 30k armies
update public.armies set status = '30k' where name in ('Légions 30K', 'Tagmatah Omnissia', 'Solar Auxilia', 'Héros et Mercenaires');
