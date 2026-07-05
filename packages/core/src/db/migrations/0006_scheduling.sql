-- Agendamento de publicações. A publicação REAL no Instagram exige app review da
-- Meta (2-4 semanas) + conexão OAuth da conta profissional do usuário — até lá o
-- agendamento funciona e o publisher fica "aguardando conexão" (ou simula em dev).

-- Conexão social da marca (null até o usuário conectar via OAuth). Guarda o token
-- de acesso e o ig user id da conta profissional vinculada.
alter table brands add column instagram jsonb; -- { ig_user_id, access_token, username, connected_at }

create table scheduled_posts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  brand_id     uuid not null references brands(id) on delete cascade,
  video_id     uuid not null references videos(id) on delete cascade,
  platform     text not null default 'instagram',
  caption      text not null default '',
  scheduled_at timestamptz not null,
  status       text not null default 'scheduled', -- scheduled|publishing|published|failed|canceled
  external_id  text,   -- id da mídia publicada (ig media id)
  error        text,
  attempts     int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index scheduled_posts_due_idx on scheduled_posts (status, scheduled_at);
create index scheduled_posts_brand_idx on scheduled_posts (brand_id);
create trigger scheduled_posts_touch before update on scheduled_posts
  for each row execute function touch_updated_at();
