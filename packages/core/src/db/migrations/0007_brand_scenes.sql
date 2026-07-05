-- Cenários específicos da marca (gerados a partir do Cérebro/nicho) — nada de
-- "academia" numa marca de finanças. Lista de { label (PT), prompt (EN) }.
alter table brands add column scenes jsonb not null default '[]'::jsonb;
