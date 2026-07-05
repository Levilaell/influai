-- Estilo do rosto da persona: realista (padrão) ou animado 3D (Pixar).
alter table personas add column face_style text not null default 'realista';
