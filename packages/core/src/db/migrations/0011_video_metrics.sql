-- Métricas de desempenho por vídeo (manual agora; via IG Insights API depois).
-- Alimentam o loop de aprendizado da marca (brand_memory.learnings).
create table video_metrics (
  id          uuid primary key default gen_random_uuid(),
  video_id    uuid not null references videos(id) on delete cascade,
  views       int not null default 0,
  likes       int not null default 0,
  comments    int not null default 0,
  saves       int not null default 0,
  recorded_at timestamptz not null default now()
);
create index video_metrics_video_idx on video_metrics (video_id, recorded_at desc);
