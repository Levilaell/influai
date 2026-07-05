-- Usuários que entram via Google não têm senha — password_hash pode ser null.
alter table users alter column password_hash drop not null;
