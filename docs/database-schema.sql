-- ============================================================================
-- SCHEMA: SaaS de Influenciadores de IA
-- PostgreSQL 15+ (pensado para Supabase/Neon; auth delegada a auth.users)
--
-- Princípios:
--  1. credit_ledger é APPEND-ONLY (nunca UPDATE/DELETE) — saldo = SUM(amount).
--     Auditável, imune a race conditions de "contador de créditos".
--  2. videos/video_shots carregam uma máquina de estados explícita — o worker
--     de jobs só transiciona estados válidos (ver docs/jobs-architecture.md).
--  3. Todo evento externo (fal, Stripe, Meta, TikTok) passa por webhook_events
--     com chave de idempotência antes de produzir efeito.
-- ============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ────────────────────────────────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────────────────────────────────
create type video_status as enum (
  'draft',        -- roteiro em edição, nada gerado
  'estimated',    -- custo previsto, aguardando confirmação do usuário
  'queued',       -- créditos em hold, job enfileirado
  'scripting',    -- gerando roteiro
  'keyframing',   -- gerando keyframes
  'rendering',    -- gerando shots de vídeo
  'voicing',      -- gerando narração
  'assembling',   -- montagem FFmpeg
  'ready',        -- final.mp4 disponível
  'failed',       -- erro terminal (créditos devolvidos)
  'canceled'      -- cancelado pelo usuário (créditos devolvidos)
);

create type shot_status as enum ('pending', 'keyframe_ready', 'rendering', 'ready', 'failed');

create type ledger_entry_type as enum (
  'grant',         -- créditos de plano/assinatura (+)
  'purchase',      -- top-up avulso (+)
  'hold',          -- reserva ao enfileirar vídeo (−)
  'hold_release',  -- devolução total/parcial do hold (falha, cancelamento, sobra) (+)
  'adjustment'     -- ajuste manual de suporte (±)
);

create type platform as enum ('youtube', 'tiktok', 'instagram');

create type publication_status as enum (
  'draft', 'scheduled', 'publishing', 'published', 'failed'
);

create type quality_tier as enum ('economico', 'padrao', 'cinema');

-- ────────────────────────────────────────────────────────────────────────────
-- USUÁRIOS / ASSINATURAS
-- ────────────────────────────────────────────────────────────────────────────
create table profiles (
  id            uuid primary key,              -- = auth.users.id
  display_name  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references profiles(id) on delete cascade,
  stripe_customer_id    text not null,
  stripe_subscription_id text unique,
  plan                  text not null,          -- 'starter' | 'pro' | 'studio'
  status                text not null,          -- espelho do status Stripe
  monthly_credits       integer not null,
  current_period_end    timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index on subscriptions (user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- CRÉDITOS (ledger append-only)
-- ────────────────────────────────────────────────────────────────────────────
create table credit_ledger (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  entry_type   ledger_entry_type not null,
  amount       integer not null,                -- positivo ou negativo, em créditos
  video_id     uuid,                            -- referência para hold/release
  ref          text,                            -- id externo (invoice Stripe, ticket, etc.)
  note         text,
  created_at   timestamptz not null default now(),

  constraint amount_sign check (
    (entry_type in ('grant','purchase','hold_release') and amount > 0) or
    (entry_type = 'hold' and amount < 0) or
    (entry_type = 'adjustment')
  )
);
create index on credit_ledger (user_id, created_at desc);
-- Impede hold duplicado para o mesmo vídeo (idempotência do enqueue):
create unique index one_hold_per_video on credit_ledger (video_id)
  where entry_type = 'hold';

-- Saldo do usuário. Para checagem transacional no enqueue, use:
--   select get_credit_balance($1) >= $2 for update de uma advisory lock por user.
create or replace function get_credit_balance(p_user_id uuid)
returns integer language sql stable as $$
  select coalesce(sum(amount), 0)::integer
  from credit_ledger where user_id = p_user_id;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- PERSONAS (Persona Lock)
-- ────────────────────────────────────────────────────────────────────────────
create table personas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  name          text not null,
  slug          text not null,
  description   text not null,          -- aparência (prompt em inglês)
  niche         text,
  voice_id      text,                   -- voz ElevenLabs fixa da persona
  lora_url      text,                   -- LoRA treinado (feature Pro, fase 2)
  moderation    jsonb not null default '{}'::jsonb, -- resultado do gate (deepfake/NSFW)
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, slug)
);

-- Character sheet: imagens de referência da persona (identity lock)
create table persona_assets (
  id          uuid primary key default gen_random_uuid(),
  persona_id  uuid not null references personas(id) on delete cascade,
  kind        text not null,            -- 'front' | 'three_quarter' | 'profile' | 'speaking' | ...
  storage_key text not null,            -- caminho no R2 (nunca URL efêmera da fal)
  width       integer,
  height      integer,
  created_at  timestamptz not null default now()
);
create index on persona_assets (persona_id);

-- ────────────────────────────────────────────────────────────────────────────
-- VÍDEOS / SHOTS
-- ────────────────────────────────────────────────────────────────────────────
create table videos (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  persona_id      uuid not null references personas(id),
  status          video_status not null default 'draft',
  tier            quality_tier not null default 'padrao',
  audio_mode      text not null default 'native',   -- 'native' | 'tts'
  topic           text not null,
  script          jsonb,                 -- roteiro estruturado (title, hook, shots[], hashtags)
  shot_seconds    integer not null default 8,
  estimated_credits integer,             -- mostrado ao usuário ANTES da confirmação
  actual_cost_usd numeric(8,4),          -- COGS real acumulado (telemetria de margem)
  final_storage_key text,                -- final.mp4 no R2
  error           text,                  -- última mensagem de erro (status=failed)
  job_id          text,                  -- id do run no orquestrador (Trigger.dev/Inngest)
  ai_label        boolean not null default true, -- rótulo "conteúdo gerado por IA" (compliance)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on videos (user_id, created_at desc);
create index on videos (status) where status not in ('ready','failed','canceled');

create table video_shots (
  id             uuid primary key default gen_random_uuid(),
  video_id       uuid not null references videos(id) on delete cascade,
  idx            integer not null,       -- ordem no vídeo (0-based)
  status         shot_status not null default 'pending',
  visual_prompt  text,
  dialogue       text,
  camera         text,
  keyframe_key   text,                   -- imagem no R2
  clip_key       text,                   -- clipe .mp4 no R2
  provider_request_id text,              -- request_id da fal (retry/idempotência/suporte)
  attempts       integer not null default 0,
  error          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (video_id, idx)
);
create index on video_shots (video_id);

-- ────────────────────────────────────────────────────────────────────────────
-- PUBLICAÇÃO / MÉTRICAS
-- ────────────────────────────────────────────────────────────────────────────
create table social_accounts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  persona_id     uuid references personas(id),
  platform       platform not null,
  external_id    text not null,          -- channel id / ig user id / open_id TikTok
  handle         text,
  access_token   text not null,          -- CRIPTOGRAFAR na aplicação (pgsodium/kms)
  refresh_token  text,
  token_expires_at timestamptz,
  scopes         text[],
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, platform, external_id)
);

create table publications (
  id             uuid primary key default gen_random_uuid(),
  video_id       uuid not null references videos(id) on delete cascade,
  social_account_id uuid not null references social_accounts(id) on delete cascade,
  status         publication_status not null default 'draft',
  title          text,
  description    text,
  scheduled_at   timestamptz,            -- null = publicar imediatamente
  published_at   timestamptz,
  external_post_id text,                 -- id do post na plataforma
  error          text,
  attempts       integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index publications_due on publications (scheduled_at)
  where status = 'scheduled';

-- Série temporal de métricas (alimenta o loop de dados: hooks que performam →
-- recomendações de roteiro por nicho — o fosso competitivo da fase 3)
create table publication_metrics (
  id              uuid primary key default gen_random_uuid(),
  publication_id  uuid not null references publications(id) on delete cascade,
  collected_at    timestamptz not null default now(),
  views           bigint,
  likes           bigint,
  comments        bigint,
  shares          bigint,
  watch_time_s    bigint,
  raw             jsonb
);
create index on publication_metrics (publication_id, collected_at desc);

-- ────────────────────────────────────────────────────────────────────────────
-- WEBHOOKS / IDEMPOTÊNCIA
-- ────────────────────────────────────────────────────────────────────────────
create table webhook_events (
  id           uuid primary key default gen_random_uuid(),
  source       text not null,            -- 'fal' | 'stripe' | 'meta' | 'tiktok' | 'youtube'
  external_id  text not null,            -- event id do provedor
  payload      jsonb not null,
  processed_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (source, external_id)           -- dedupe de retries do provedor
);

-- ────────────────────────────────────────────────────────────────────────────
-- updated_at automático
-- ────────────────────────────────────────────────────────────────────────────
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','subscriptions','personas','videos','video_shots',
                           'social_accounts','publications']
  loop
    execute format('create trigger %I_touch before update on %I
                    for each row execute function touch_updated_at()', t, t);
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- RLS (Supabase): habilitar em todas as tabelas com user_id; política padrão
--   using (user_id = auth.uid())
-- credit_ledger: SELECT apenas — INSERT somente via service role (workers).
-- ────────────────────────────────────────────────────────────────────────────
