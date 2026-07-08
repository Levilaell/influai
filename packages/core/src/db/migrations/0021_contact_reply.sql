-- Resposta às mensagens de contato pelo /admin (sai como contato@influai.com.br —
-- o e-mail pessoal do admin nunca aparece pro usuário).
alter table contact_messages add column if not exists reply text;
alter table contact_messages add column if not exists replied_at timestamptz;
