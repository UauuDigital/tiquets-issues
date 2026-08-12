-- supabase/migrations/0002_fix_usuaris.sql
-- tiquets.usuaris ja existia d'un intent anterior (seguint una guia
-- descartada que no tenia columna email i sí una columna rol). Aquesta
-- migracio la corregeix a l'estructura definitiva, i elimina la taula
-- tiquets.issues sobrant (els tiquets continuen sent GitHub Issues).

drop table if exists tiquets.issues;

alter table tiquets.usuaris
  add column if not exists email text,
  add column if not exists creat_el timestamptz not null default now();

alter table tiquets.usuaris drop column if exists rol;

update tiquets.usuaris set email = '' where email is null;
alter table tiquets.usuaris alter column email set not null;

notify pgrst, 'reload schema';
