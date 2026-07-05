-- Estilo do vídeo escolhido pelo usuário (cenário + dinâmica de câmera + cartela).
-- Sem surpresas: o que ele marca no formulário é o que sai.
alter table videos add column style jsonb not null default '{}'::jsonb;
