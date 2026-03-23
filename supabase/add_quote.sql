-- Replace description with quote fields
alter table public.armies add column if not exists quote text;
alter table public.armies add column if not exists quote_author text;

-- Migrate existing descriptions to quote
update public.armies set quote = description where description is not null;

-- Drop description column
alter table public.armies drop column if exists description;
