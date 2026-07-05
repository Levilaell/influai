-- Geração em lote ("gere minha semana") vira job de background — evita timeout
-- da server action (5-7 roteiros levam ~50s+). A UI acompanha o progresso.
create table content_batches (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references brands(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  requested  int not null,
  created    int not null default 0,
  status     text not null default 'running', -- running | done | error
  error      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_batches_brand_idx on content_batches (brand_id, status);
create trigger content_batches_touch before update on content_batches
  for each row execute function touch_updated_at();
