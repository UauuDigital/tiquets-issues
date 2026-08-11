-- supabase/migrations/0001_init.sql
-- Executar al SQL Editor de Supabase (Database -> SQL Editor) del projecte
-- compartit amb "compras". Totes les taules viuen a l'esquema `tiquets`,
-- separat de `public` (que es de l'altra app).

create schema if not exists tiquets;
create extension if not exists pgcrypto;
create extension if not exists pg_cron;

-- Sol·licituds de registre pendents d'aprovacio. Cap policy RLS per a
-- anon/authenticated: nomes el service role (backend Express) hi opera.
create table if not exists tiquets.solicituds_registre (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nom text not null,
  missatge text,
  email_verificat boolean not null default false,
  token_verificacio text,
  token_expira timestamptz,
  estat text not null default 'pendent' check (estat in ('pendent', 'acceptat', 'rebutjat')),
  creat_el timestamptz not null default now()
);
create index if not exists solicituds_registre_email_idx on tiquets.solicituds_registre (email);
create index if not exists solicituds_registre_token_idx on tiquets.solicituds_registre (token_verificacio);
alter table tiquets.solicituds_registre enable row level security;

-- Usuaris aprovats. id = auth.users.id (auth es sempre a nivell de
-- projecte, no d'esquema). Una unica policy: cadascu pot llegir la seva
-- propia fila (el backend, amb service role, la salta i pot llegir/
-- escriure qualsevol fila).
create table if not exists tiquets.usuaris (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nom text not null,
  actiu boolean not null default true,
  creat_el timestamptz not null default now()
);
alter table tiquets.usuaris enable row level security;
create policy "usuaris_select_own_row"
  on tiquets.usuaris for select
  using (auth.uid() = id);

-- Registre de "pings" perque pg_cron generi activitat i Supabase Free no
-- pausi el projecte per inactivitat. Dimecres se n'insereix un, diumenge
-- s'elimina el que ja te mes d'un dia.
create table if not exists tiquets.heartbeat (
  id uuid primary key default gen_random_uuid(),
  creat_el timestamptz not null default now()
);

select cron.schedule(
  'tiquets-heartbeat-crea',
  '0 6 * * 3',
  $$ insert into tiquets.heartbeat default values; $$
);

select cron.schedule(
  'tiquets-heartbeat-neteja',
  '0 6 * * 0',
  $$ delete from tiquets.heartbeat where creat_el < now() - interval '1 day'; $$
);

-- Un esquema nou no dona automaticament permisos als rols que fa servir
-- Supabase (service_role, authenticated, anon): cal concedir-los, sino
-- l'API retorna "permission denied for schema tiquets".
grant usage on schema tiquets to service_role, authenticated, anon;

grant all on all tables in schema tiquets to service_role;
grant select, insert, update, delete on all tables in schema tiquets to authenticated;
grant select on all tables in schema tiquets to anon;

-- Perque les taules que es creïn en el futur amb aquest mateix rol
-- heretin els mateixos permisos automaticament.
alter default privileges in schema tiquets grant all on tables to service_role;
alter default privileges in schema tiquets grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema tiquets grant select on tables to anon;
