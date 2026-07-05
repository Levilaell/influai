-- Report de problema em vídeo pronto (defeito leve do modelo). O usuário é avisado
-- antes de que artefatos pequenos podem acontecer; casos extremos você revisa e
-- reembolsa manualmente (grant de créditos).
create table video_reports (
  id         uuid primary key default gen_random_uuid(),
  video_id   uuid not null references videos(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  reason     text not null default '',
  status     text not null default 'open', -- open | refunded | rejected
  created_at timestamptz not null default now()
);
create index video_reports_status_idx on video_reports (status, created_at);
