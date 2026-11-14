-- VERIFICACIÓN · producción (solo lectura). Pégalo en el SQL Editor de PRODUCCIÓN tras 01-schema.sql.
-- Cada fila trae "esperado" y "obtenido"; la columna ok debe ser true en todas.
with r as (
  select 'tablas_public' as chequeo, 'games, profiles, scores' as esperado,
    (select string_agg(c.relname, ', ' order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r') as obtenido
  union all select 'vista_game_stats', 'game_stats',
    (select string_agg(c.relname, ', ') from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'v')
  union all select 'rls_activa_en_tablas', '3',
    (select count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity)
  union all select 'policies', 'games.games_select_public, profiles.profiles_insert_own, profiles.profiles_select_own, scores.scores_insert_own, scores.scores_select_public',
    (select string_agg(tablename || '.' || policyname, ', ' order by tablename, policyname) from pg_policies where schemaname = 'public')
  union all select 'funciones_public', 'check_username_history, get_leaderboard, get_player_best, handle_new_user, is_username_available, rls_auto_enable, scores_rate_limit',
    (select string_agg(p.proname, ', ' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public')
  union all select 'triggers', 'on_auth_user_created, profiles_check_username_history, scores_rate_limit',
    (select string_agg(tgname, ', ' order by tgname) from pg_trigger where tgrelid in ('public.profiles'::regclass, 'public.scores'::regclass, 'auth.users'::regclass) and not tgisinternal and tgname in ('on_auth_user_created', 'profiles_check_username_history', 'scores_rate_limit'))
  union all select 'juegos_playable', 'arkanoid, asteroids, serpentina, tetris',
    (select string_agg(id, ', ' order by id) from public.games where playable)
  union all select 'grants_anon', 'game_stats=SELECT, games=SELECT, scores=SELECT',
    (select string_agg(table_name || '=' || privs, ', ' order by table_name) from (select table_name, string_agg(privilege_type, ',' order by privilege_type) privs from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon' group by table_name) g)
  union all select 'grants_authenticated', 'game_stats=SELECT, games=SELECT, profiles=SELECT, scores=SELECT',
    (select string_agg(table_name || '=' || privs, ', ' order by table_name) from (select table_name, string_agg(privilege_type, ',' order by privilege_type) privs from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated' group by table_name) g)
  union all select 'event_trigger_ensure_rls', 'true',
    exists (select 1 from pg_event_trigger where evtname = 'ensure_rls')::text
  union all select 'games', '8', (select count(*)::text from public.games)
  union all select 'ids_games', 'arkanoid, asteroids, duelo-pixel, gloton, invasores, ranaria, serpentina, tetris',
    (select string_agg(id, ', ' order by id) from public.games)
  union all select 'scores_vacia', '0', (select count(*)::text from public.scores)
  union all select 'profiles', '0', (select count(*)::text from public.profiles)
  union all select 'anon_no_ejecuta_rls_auto_enable', 'false',
    has_function_privilege('anon', 'public.rls_auto_enable()', 'execute')::text
  union all select 'authenticated_no_ejecuta_rls_auto_enable', 'false',
    has_function_privilege('authenticated', 'public.rls_auto_enable()', 'execute')::text
  union all select 'anon_no_ejecuta_handle_new_user', 'false',
    has_function_privilege('anon', 'public.handle_new_user()', 'execute')::text
  union all select 'anon_si_ejecuta_is_username_available', 'true',
    has_function_privilege('anon', 'public.is_username_available(text)', 'execute')::text
  union all select 'game_stats_security_invoker', 'true',
    (select coalesce((reloptions::text ilike '%security_invoker=true%')::text, 'false') from pg_class
      where oid = 'public.game_stats'::regclass)
)
select chequeo, esperado, obtenido, (esperado = obtenido) as ok from r;
