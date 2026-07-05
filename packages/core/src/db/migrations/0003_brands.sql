-- Camada MARCA (Workspace): separa "o negócio" (marca) de "o rosto" (persona).
--   Conta → N Marcas → (Cérebro da Marca + Memória Operacional + N Personas + N Vídeos)
-- O Cérebro da Marca (brand_profiles) e a Memória Operacional vivem na MARCA,
-- compartilhados por todas as personas dela. Migração preserva dados: cada
-- persona existente vira uma marca própria (mantém o comportamento 1:1 atual).

create table brands (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index brands_user_idx on brands (user_id);
create trigger brands_touch before update on brands
  for each row execute function touch_updated_at();

-- Memória Operacional: acompanha cada operação da marca (dedup de temas,
-- aprendizados de estilo) — lida em toda geração e atualizada após cada vídeo.
create table brand_memory (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid not null unique references brands(id) on delete cascade,
  covered_topics jsonb not null default '[]'::jsonb,  -- [{topic, video_id, at}]
  learnings      jsonb not null default '[]'::jsonb,  -- ["hook curto performou melhor", ...]
  style_guide    text  not null default '',
  updated_at     timestamptz not null default now()
);
create trigger brand_memory_touch before update on brand_memory
  for each row execute function touch_updated_at();

-- Vínculos
alter table personas add column brand_id uuid;
alter table videos   add column brand_id uuid;
alter table brand_profiles add column brand_id uuid;

-- ── Migração de dados: 1 marca por persona existente ──────────────────
do $$
declare p record; bid uuid;
begin
  for p in select id, user_id, name from personas loop
    insert into brands (user_id, name) values (p.user_id, p.name) returning id into bid;
    update personas set brand_id = bid where id = p.id;
    insert into brand_memory (brand_id) values (bid);
  end loop;
end $$;

update brand_profiles bp set brand_id = pe.brand_id from personas pe where pe.id = bp.persona_id;
update videos v set brand_id = pe.brand_id from personas pe where pe.id = v.persona_id;

-- ── Restrições depois de popular ──────────────────────────────────────
alter table personas alter column brand_id set not null;
alter table videos   alter column brand_id set not null;
alter table personas add constraint personas_brand_fk foreign key (brand_id) references brands(id) on delete cascade;
alter table videos   add constraint videos_brand_fk   foreign key (brand_id) references brands(id) on delete cascade;
create index personas_brand_idx on personas (brand_id);
create index videos_brand_idx on videos (brand_id);

-- Cérebro da Marca passa a ser chaveado pela MARCA (não pela persona)
delete from brand_profiles where brand_id is null; -- órfãos (não deve haver)
alter table brand_profiles drop column persona_id;
alter table brand_profiles alter column brand_id set not null;
alter table brand_profiles add constraint brand_profiles_brand_uk unique (brand_id);
alter table brand_profiles add constraint brand_profiles_brand_fk foreign key (brand_id) references brands(id) on delete cascade;
