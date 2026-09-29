-- Prepara um Postgres "puro" (Render) para a pilha Supabase auto-hospedada:
-- papeis que o GoTrue, o PostgREST e o Storage esperam, schemas e privilegios padrao.
-- Rodar UMA vez, como o usuario dono do banco do Render, ANTES de subir os servicos:
--   psql "$RENDER_DATABASE_URL" -v authenticator_password=... -v auth_admin_password=... \
--        -v storage_admin_password=... -f infra/render/bootstrap.sql
-- (infra/render/setup-render-db.mjs faz isso lendo .env.migration.) Pode rodar de novo sem efeito.

\set ON_ERROR_STOP on

-- Papeis da API (sem login). service_role nao ganha BYPASSRLS: exige superusuario, e nem o site
-- nem o app usam a chave de servico -- tudo passa pela RLS.
select 'create role anon nologin noinherit'
where not exists (select 1 from pg_roles where rolname = 'anon') \gexec
select 'create role authenticated nologin noinherit'
where not exists (select 1 from pg_roles where rolname = 'authenticated') \gexec
select 'create role service_role nologin noinherit'
where not exists (select 1 from pg_roles where rolname = 'service_role') \gexec

-- PostgREST conecta como authenticator e troca para anon/authenticated conforme o JWT.
select format('create role authenticator login noinherit password %L', :'authenticator_password')
where not exists (select 1 from pg_roles where rolname = 'authenticator') \gexec
select format('alter role authenticator with login password %L', :'authenticator_password') \gexec
grant anon, authenticated, service_role to authenticator;

-- Donos dos schemas do GoTrue (login) e do Storage (arquivos).
select format('create role supabase_auth_admin login noinherit password %L', :'auth_admin_password')
where not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') \gexec
select format('alter role supabase_auth_admin with login password %L', :'auth_admin_password') \gexec
select format('create role supabase_storage_admin login noinherit password %L', :'storage_admin_password')
where not exists (select 1 from pg_roles where rolname = 'supabase_storage_admin') \gexec
select format('alter role supabase_storage_admin with login password %L', :'storage_admin_password') \gexec
grant anon, authenticated, service_role to supabase_storage_admin;

-- O dono do banco precisa pertencer a esses papeis para criar schemas em nome deles e, depois,
-- aplicar as migrations que referenciam auth.users e storage.objects.
grant supabase_auth_admin, supabase_storage_admin to current_user;
grant anon, authenticated, service_role to current_user;

-- Schemas.
create schema if not exists auth authorization supabase_auth_admin;
create schema if not exists storage authorization supabase_storage_admin;
create schema if not exists extensions;

grant usage on schema extensions to public;
select format('grant create on database %I to supabase_auth_admin, supabase_storage_admin', current_database()) \gexec

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

alter role supabase_auth_admin set search_path = auth;
alter role supabase_storage_admin set search_path = storage, public;

grant usage on schema auth to anon, authenticated, service_role, supabase_storage_admin;
grant usage on schema storage to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Mesmo padrao do Supabase: tabelas novas em public ficam acessiveis aos papeis da API, e a
-- seguranca fica na RLS (todas as tabelas do projeto tem RLS habilitada nas migrations).
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

-- Publicacao que as migrations 043/038 referenciam (Realtime nao roda no Render; fica vazia ate
-- alguma tabela ser adicionada).
select 'create publication supabase_realtime'
where not exists (select 1 from pg_publication where pubname = 'supabase_realtime') \gexec
