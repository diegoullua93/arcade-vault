-- PRE-VUELO · producción. Solo lectura: pégalo en el SQL Editor de PRODUCCIÓN antes de 01-schema.sql.
-- Esperado en un proyecto nuevo: sin tablas/vistas en public y 0 usuarios.
-- Si rls_auto_enable_existe = false no hay problema: 01-schema.sql la crea.
select 'tablas_public' as chequeo, coalesce(string_agg(c.relname, ', '), '(ninguna)') as resultado
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','v','m')
union all
select 'rls_auto_enable_existe', exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'rls_auto_enable')::text
union all
select 'event_trigger_ensure_rls', exists (select 1 from pg_event_trigger where evtname = 'ensure_rls')::text
union all
select 'usuarios_auth', (select count(*) from auth.users)::text
union all
select 'version_postgres', version();
