-- Eventos de funil/uso (core/analytics.ts track) — best-effort, fora do caminho crítico.
-- Lidos no /admin (contagem por evento).
create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete set null,
  event       text not null,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists events_event_idx on events (event);
create index if not exists events_user_idx on events (user_id);
