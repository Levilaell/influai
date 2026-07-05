-- Recursos da marca: logo, produtos e outras imagens de referência que podem
-- aparecer na CENA do vídeo (o keyframe do Nano Banana aceita até 14 refs, então
-- combinamos o rosto da persona + o produto/logo). Reutilizáveis entre vídeos.
create table brand_assets (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references brands(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  kind        text not null default 'product', -- 'logo' | 'product' | 'other'
  label       text not null default '',
  storage_key text not null,
  created_at  timestamptz not null default now()
);
create index brand_assets_brand_idx on brand_assets (brand_id);

-- Referências escolhidas para um vídeo específico (storage keys dos brand_assets)
alter table videos add column reference_keys jsonb not null default '[]'::jsonb;
