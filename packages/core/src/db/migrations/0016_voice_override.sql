-- "Trocar voz e refazer" um vídeo pronto: novo vídeo com o mesmo roteiro/estilo,
-- mas com uma voz diferente (override sobre a voz da persona).
alter table videos add column voice_override text;
