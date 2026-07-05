-- Higiene de conta: verificação de e-mail, aceite de termos, reset de senha.
alter table users add column email_verified_at timestamptz;
alter table users add column terms_accepted_at timestamptz;

create table auth_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  kind       text not null,          -- 'verify' | 'reset'
  token_hash text not null,          -- sha256 do token (o token cru só vai no e-mail)
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index auth_tokens_hash_idx on auth_tokens (token_hash);
