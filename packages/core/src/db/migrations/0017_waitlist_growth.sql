-- Waitlist matadora: nicho capturado, prévia gerada, código de indicação (loop viral)
-- e o vídeo grátis assíncrono (Fase 2). Posição = rank por indicações + ordem de entrada.
alter table waitlist add column if not exists niche text;
alter table waitlist add column if not exists preview jsonb;          -- persona + ideias + roteiro gerados
alter table waitlist add column if not exists referral_code text;      -- código próprio (compartilhável)
alter table waitlist add column if not exists referred_by text;        -- código de quem indicou
alter table waitlist add column if not exists lead_video_id uuid;      -- vídeo grátis (Fase 2)
alter table waitlist add column if not exists lead_status text default 'none'; -- none|queued|rendering|ready|failed

create unique index if not exists waitlist_referral_code_uq on waitlist (referral_code) where referral_code is not null;
create index if not exists waitlist_referred_by_idx on waitlist (referred_by);
