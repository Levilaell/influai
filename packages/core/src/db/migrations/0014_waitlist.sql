-- Lista de espera da landing page (rota /). Guarda emails de interessados no
-- beta fechado; "source" permite reaproveitar para outras origens (ads, indicação).
create table waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  source     text not null default 'landing',
  created_at timestamptz not null default now()
);
