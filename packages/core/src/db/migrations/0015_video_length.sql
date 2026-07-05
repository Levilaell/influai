-- Vídeo longo multi-segmento: N takes concatenados (Kling não faz 60-90s num take
-- só). segments = 1 mantém o comportamento atual (vídeo curto, take único).
alter table videos add column segments int not null default 1;
