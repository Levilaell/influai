-- Cérebro da Marca: contexto do negócio capturado uma vez (print / texto /
-- entrevista), ligado à persona, para alimentar o motor de ideias e o roteiro.
create table brand_profiles (
  id                uuid primary key default gen_random_uuid(),
  persona_id        uuid not null unique references personas(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  business          text not null,
  audience          text not null,
  value_proposition text not null,
  tone              text not null,
  niche             text not null,
  content_pillars   jsonb not null default '[]'::jsonb,
  products          jsonb not null default '[]'::jsonb,
  confidence        text not null default 'média',
  notes             text not null default '',
  source            text not null default 'text', -- 'image' | 'text' | 'interview'
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index brand_profiles_user_idx on brand_profiles (user_id);

create trigger brand_profiles_touch before update on brand_profiles
  for each row execute function touch_updated_at();
