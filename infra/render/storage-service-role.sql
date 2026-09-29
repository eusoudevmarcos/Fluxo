-- No Supabase o papel service_role tem BYPASSRLS; no Render nao da (exige superusuario). O Storage
-- API usa service_role para achar buckets e gerenciar objetos, entao, sem isto, qualquer upload
-- responde "Bucket not found". Da ao service_role acesso total SO no schema storage, via politica
-- de RLS. Site e app nunca usam a chave de servico.
-- Rodar depois que o Storage API subir pela primeira vez (ele cria as tabelas) e de novo apos
-- atualizar a versao dele. Pode rodar mais de uma vez.
\set ON_ERROR_STOP on

select format(
  'create policy "service_role full access" on storage.%I for all to service_role using (true) with check (true)',
  tables.tablename
)
from pg_tables tables
where tables.schemaname = 'storage'
  and tables.rowsecurity
  and not exists (
    select 1 from pg_policies policies
    where policies.schemaname = 'storage'
      and policies.tablename = tables.tablename
      and policies.policyname = 'service_role full access'
  ) \gexec
