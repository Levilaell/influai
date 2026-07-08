-- Mensagens do formulário de contato (LP pública + /suporte dentro do app).
-- Guardamos no banco SEMPRE (e-mail de aviso é best-effort) — nada se perde.
create table if not exists contact_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete set null,  -- null = visitante da LP
  name        text not null default '',
  email       text not null,
  message     text not null,
  source      text not null default 'lp',                    -- 'lp' | 'app'
  created_at  timestamptz not null default now()
);
create index if not exists contact_messages_created_idx on contact_messages (created_at desc);
