-- Schema do MVP auto-contido, adaptado de docs/database-schema.sql:
--  * auth própria (tabela users) no lugar de Supabase auth.users; sem RLS
--  * escopo núcleo: sem publications/social_accounts/subscriptions/video_shots
--  * ledger append-only com índices únicos parciais de idempotência

create extension if not exists "pgcrypto";

-- ── ENUMS ──────────────────────────────────────────────────────────
create type video_status as enum (
  'draft', 'estimated', 'queued', 'scripting', 'keyframing', 'rendering',
  'voicing', 'assembling', 'ready', 'failed', 'canceled'
);

create type persona_status as enum (
  'draft', 'candidates_generating', 'candidates_ready',
  'sheet_generating', 'ready', 'failed'
);

create type ledger_entry_type as enum (
  'grant', 'purchase', 'hold', 'hold_release', 'adjustment'
);

-- ── USUÁRIOS ───────────────────────────────────────────────────────
create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  display_name  text,
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── CRÉDITOS (ledger append-only) ──────────────────────────────────
create table credit_ledger (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  entry_type   ledger_entry_type not null,
  amount       integer not null,
  video_id     uuid,
  persona_id   uuid,
  ref          text,
  note         text,
  created_at   timestamptz not null default now(),

  constraint amount_sign check (
    (entry_type in ('grant','purchase','hold_release') and amount > 0) or
    (entry_type = 'hold' and amount < 0) or
    (entry_type = 'adjustment')
  )
);
create index credit_ledger_user_idx on credit_ledger (user_id, created_at desc);

-- Idempotência: um hold e um release por vídeo; idem por ref (personas)
create unique index one_hold_per_video on credit_ledger (video_id)
  where entry_type = 'hold' and video_id is not null;
create unique index one_release_per_video on credit_ledger (video_id)
  where entry_type = 'hold_release' and video_id is not null;
create unique index one_hold_per_ref on credit_ledger (ref)
  where entry_type = 'hold' and ref is not null;
create unique index one_release_per_ref on credit_ledger (ref)
  where entry_type = 'hold_release' and ref is not null;

create or replace function get_credit_balance(p_user_id uuid)
returns integer language sql stable as $$
  select coalesce(sum(amount), 0)::integer
  from credit_ledger where user_id = p_user_id;
$$;

-- ── PERSONAS ───────────────────────────────────────────────────────
create table personas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  status        persona_status not null default 'draft',
  name          text not null,
  slug          text not null,
  description   text not null,
  niche         text,
  voice_id      text not null default 'matilda',
  moderation    jsonb not null default '{}'::jsonb,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, slug)
);

create table persona_assets (
  id           uuid primary key default gen_random_uuid(),
  persona_id   uuid not null references personas(id) on delete cascade,
  kind         text not null,   -- 'candidate' | 'front' | 'three_quarter' | 'profile' | 'speaking'
  idx          integer not null default 0,
  storage_key  text not null,
  provider_url text,            -- URL efêmera do provedor (otimização <1h)
  created_at   timestamptz not null default now()
);
create index persona_assets_persona_idx on persona_assets (persona_id);

-- ── VÍDEOS ─────────────────────────────────────────────────────────
create table videos (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,
  persona_id        uuid not null references personas(id),
  status            video_status not null default 'draft',
  topic             text not null,
  script            jsonb,
  estimated_credits integer,
  actual_cost_usd   numeric(8,4),
  final_storage_key text,
  progress          jsonb not null default '{}'::jsonb,
  error             text,
  ai_label          boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index videos_user_idx on videos (user_id, created_at desc);
create index videos_active_idx on videos (status)
  where status not in ('ready','failed','canceled');

-- FKs do ledger (depois de videos/personas existirem)
alter table credit_ledger
  add constraint credit_ledger_video_fk foreign key (video_id) references videos(id) on delete set null,
  add constraint credit_ledger_persona_fk foreign key (persona_id) references personas(id) on delete set null;

-- ── JOB STEPS (idempotência por step) ──────────────────────────────
create table job_steps (
  job_key      text not null,   -- 'video:<uuid>' | 'persona:<uuid>:candidates:<n>' | 'persona:<uuid>:sheet'
  step         text not null,
  output       jsonb not null default '{}'::jsonb,
  cost_usd     numeric(8,4) not null default 0,
  completed_at timestamptz not null default now(),
  primary key (job_key, step)
);

-- ── updated_at automático ──────────────────────────────────────────
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger users_touch before update on users
  for each row execute function touch_updated_at();
create trigger personas_touch before update on personas
  for each row execute function touch_updated_at();
create trigger videos_touch before update on videos
  for each row execute function touch_updated_at();
