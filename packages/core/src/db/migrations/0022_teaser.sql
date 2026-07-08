-- Teaser de boas-vindas (funil novo): vídeo de ~8s com marca d'água em que a persona
-- se apresenta ao DONO do negócio. Grátis, 1 por persona automática (cadastro).
alter table personas add column if not exists teaser_status text;       -- null | generating | ready | failed
alter table personas add column if not exists teaser_storage_key text;
