-- Cobrança via AbacatePay: assinatura mensal concede créditos + libera recursos.
alter table users add column abacate_customer_id text;

create table subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null unique references users(id) on delete cascade,
  plan                    text not null,                    -- starter | pro | studio
  status                  text not null default 'pending',  -- pending | active | canceled | expired
  abacate_subscription_id text,
  current_period_end      timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create trigger subscriptions_touch before update on subscriptions
  for each row execute function touch_updated_at();

-- Idempotência das concessões por ref (grant de plano/topup): webhook pode reenviar.
create unique index one_grant_per_ref on credit_ledger (ref)
  where entry_type = 'grant' and ref is not null;
