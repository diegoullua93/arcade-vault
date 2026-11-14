-- ARCADE VAULT · esquema completo para PRODUCCIÓN (proyecto vacío).
-- GENERADO por supabase/prod/build-schema.sh a partir de supabase/migrations/*.sql: no lo edites a mano.
-- Diferencias respecto a desarrollo:
--   1) `scores` se crea VACÍA (sin las 50 filas semilla is_seed); las migraciones que las movían o
--      borraban quedan sin efecto.
--   2) rls_auto_enable()/ensure_rls se crean antes del revoke (no estaban versionados antes del SPEC 14).
-- Ejecutar UNA sola vez en el SQL Editor de producción, después de 00-preflight.sql.


-- ============================================================
-- 20261028120000_create_games.sql
-- ============================================================
create table public.games (
  id         text primary key,
  title      text not null,
  short      text not null,
  long       text not null,
  category   text not null check (category in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover      text not null,
  color      text not null check (color in ('cyan','magenta','yellow','green')),
  sort_order integer not null unique
);

alter table public.games enable row level security;

create policy "games_select_public"
  on public.games
  for select
  to anon, authenticated
  using (true);

insert into public.games (id, title, short, long, category, cover, color, sort_order) values
  ('bloque-buster', 'BLOQUE BUSTER', 'Rebota la pelota y destruye muros de neón.', 'Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?', 'ARCADE', 'cover-bricks', 'cyan', 1),
  ('caida', 'CAÍDA', 'Encaja las piezas antes de que el techo te aplaste.', 'Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.', 'PUZZLE', 'cover-tetro', 'magenta', 2),
  ('serpentina', 'SERPENTINA', 'Crece sin morder tu propia cola.', 'Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.', 'ARCADE', 'cover-snake', 'green', 3),
  ('gloton', 'GLOTÓN', 'Devora puntos y escapa de los fantasmas.', 'Un círculo glotón patrulla un laberinto coleccionando puntos luminosos. Cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles.', 'ARCADE', 'cover-glot', 'yellow', 4),
  ('invasores', 'INVASORES', 'Defiende el planeta de filas alienígenas.', 'Olas de pixeles hostiles descienden formación tras formación. Mueve tu cañón en horizontal y abre fuego con precisión, antes de que toquen la superficie.', 'SHOOTER', 'cover-invaders', 'green', 5),
  ('asteroids', 'ASTEROIDS', 'Pulveriza asteroides en gravedad cero.', 'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.', 'SHOOTER', 'cover-asteroids', 'yellow', 6),
  ('ranaria', 'RANARIA', 'Cruza la autopista de pixeles.', 'Salta entre carriles de coches a toda velocidad y troncos a la deriva en el río. Llega a los nenúfares antes de que se acabe el tiempo.', 'ARCADE', 'cover-rana', 'green', 7),
  ('duelo-pixel', 'DUELO PIXEL', 'Dos paletas. Una pelota. Reflejos máximos.', 'El duelo más puro: dos paletas verticales se enfrentan por rebotar una pelota luminosa. Modo solitario contra la CPU o partida local a dos jugadores.', 'VERSUS', 'cover-duelo', 'cyan', 8);


-- ============================================================
-- 20261028120100_create_scores.sql
-- ============================================================
-- (omitido en producción: INSERT de semillas de scores)
create table public.scores (
  id          uuid primary key default gen_random_uuid(),
  game_id     text not null references public.games(id),
  player_name text not null check (char_length(player_name) between 1 and 20),
  score       integer not null check (score between 1 and 9999999),
  is_seed     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc);

alter table public.scores enable row level security;

create policy "scores_select_public"
  on public.scores
  for select
  to anon, authenticated
  using (true);

create policy "scores_insert_public"
  on public.scores
  for insert
  to anon, authenticated
  with check (is_seed = false);


-- Una fila por juego con partidas.
create view public.game_stats with (security_invoker = true) as
  select game_id, max(score) as best, count(*) as plays
  from public.scores
  group by game_id;

-- Mejor marca por nombre (sin distinguir mayúsculas); desempate: la más antigua.
create function public.get_leaderboard(p_game_id text, p_limit integer default 10)
returns table (rank integer, player_name text, score integer, created_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (row_number() over (order by b.score desc, b.created_at asc, b.player_name asc))::integer,
    b.player_name,
    b.score,
    b.created_at
  from (
    select distinct on (lower(s.player_name))
      s.player_name, s.score, s.created_at
    from public.scores s
    where s.game_id = p_game_id
    order by lower(s.player_name), s.score desc, s.created_at asc
  ) b
  order by 1
  limit greatest(p_limit, 0)
$$;

-- Mejor marca y rango de un nombre en un juego; sin filas si no ha jugado.
create function public.get_player_best(p_game_id text, p_player_name text)
returns table (rank integer, score integer, created_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.rank, r.score, r.created_at
  from (
    select
      (row_number() over (order by b.score desc, b.created_at asc, b.player_name asc))::integer as rank,
      b.player_name,
      b.score,
      b.created_at
    from (
      select distinct on (lower(s.player_name))
        s.player_name, s.score, s.created_at
      from public.scores s
      where s.game_id = p_game_id
      order by lower(s.player_name), s.score desc, s.created_at asc
    ) b
  ) r
  where lower(r.player_name) = lower(p_player_name)
$$;


-- ============================================================
-- 20261029120000_rename_caida_to_tetris.sql
-- ============================================================
-- Tetris sale de references/03-tetris con id `tetris`: la fila `caida` del catálogo pasa a ser `tetris`
-- conservando portada, color, categoría, textos y sort_order. La FK scores.game_id -> games.id no tiene
-- ON UPDATE CASCADE y sort_order es unique, así que: apartar, insertar, mover semillas y borrar.
update public.games set sort_order = 0 where id = 'caida';

insert into public.games (id, title, short, long, category, cover, color, sort_order)
  select 'tetris', 'TETRIS', short, long, category, cover, color, 2
  from public.games
  where id = 'caida';

update public.scores set game_id = 'tetris' where game_id = 'caida';

delete from public.games where id = 'caida';


-- ============================================================
-- 20261031120000_rename_bloque_buster_to_arkanoid.sql
-- ============================================================
-- Arkanoid sale de references/04-arkanoid con id `arkanoid`: la fila `bloque-buster` del catálogo pasa a ser
-- `arkanoid` conservando portada, color, categoría, textos y sort_order. Sus semillas (37 347–230 564) son
-- inalcanzables (el máximo real es 2 080 puntos), así que se borran. La FK scores.game_id -> games.id no tiene
-- ON UPDATE CASCADE y sort_order es unique, así que: apartar, insertar, borrar semillas, mover y borrar.
update public.games set sort_order = 0 where id = 'bloque-buster';

insert into public.games (id, title, short, long, category, cover, color, sort_order)
  select 'arkanoid', 'ARKANOID', short, long, category, cover, color, 1
  from public.games
  where id = 'bloque-buster';

delete from public.scores where game_id = 'bloque-buster' and is_seed;

update public.scores set game_id = 'arkanoid' where game_id = 'bloque-buster';

delete from public.games where id = 'bloque-buster';


-- ============================================================
-- 20261101120000_delete_serpentina_seeds.sql
-- ============================================================
-- Serpentina pasa a ser jugable. Sus 10 semillas (38 387–213 991) se borran para que el ranking
-- arranque vacío y la primera partida real sea el #1. La fila de `games` no cambia.
delete from public.scores where game_id = 'serpentina' and is_seed;


-- ============================================================
-- 20261110120000_create_profiles_and_scores_user_id.sql
-- ============================================================
-- SPEC 12 (paso 1, aditivo): perfiles con username único, alta por trigger,
-- disponibilidad de username y dueño de cada marca. No toca las políticas de scores.

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null check (username ~ '^[A-Z0-9_]{3,10}$'),
  created_at timestamptz not null default now()
);

create unique index profiles_username_key on public.profiles (lower(username));

alter table public.profiles enable row level security;

-- Cada usuario solo ve y crea su propia fila. Sin UPDATE ni DELETE (username inmutable).
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (id = (select auth.uid()));

-- Alta por correo: el registro manda el username en raw_user_meta_data.
-- Sin username (p. ej. Google) no se crea perfil; se elige luego en /auth/username.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := upper(nullif(btrim(new.raw_user_meta_data ->> 'username'), ''));
begin
  if v_username is not null then
    insert into public.profiles (id, username) values (new.id, v_username);
  end if;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- true si el username no existe en profiles ni en scores.player_name (sin distinguir mayúsculas).
-- security definer para no abrir SELECT público de profiles; la usa el registro antes de tener sesión.
create function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.profiles p where lower(p.username) = lower(p_username))
     and not exists (select 1 from public.scores s where lower(s.player_name) = lower(p_username));
$$;

revoke execute on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

-- Dueño de la marca. Las filas existentes quedan con user_id null.
alter table public.scores
  add column user_id uuid references auth.users (id) on delete set null;

create index scores_user_id_idx on public.scores (user_id);


-- ============================================================
-- 20261110120100_scores_insert_own.sql
-- ============================================================
-- SPEC 12 (paso 8): solo el dueño puede insertar su marca.
-- Sustituye el insert público (cualquiera con la clave publishable, con cualquier nombre) por
-- uno que exige sesión, user_id = auth.uid() y player_name = username del perfil.
-- SELECT público y sin UPDATE/DELETE: igual que hasta ahora. Las filas existentes siguen con user_id null.

drop policy "scores_insert_public" on public.scores;

create policy "scores_insert_own"
  on public.scores
  for insert
  to authenticated
  with check (
    is_seed = false
    and user_id = (select auth.uid())
    and player_name = (
      select p.username from public.profiles p where p.id = (select auth.uid())
    )
  );


-- ============================================================
-- rls_auto_enable() + ensure_rls antes del revoke (de 20261114120400)
-- ============================================================
-- SPEC 14 (SEC-08): rls_auto_enable() y el event trigger ensure_rls los creó el proyecto de Supabase y no
-- estaban versionados; una BD nueva construida solo con estas migraciones no los tendría. Migración
-- idempotente con la definición real (inspeccionada en el SPEC 13). En la BD actual no cambia nada:
-- `create or replace` conserva los privilegios y el trigger solo se crea si falta.

create or replace function public.rls_auto_enable()
 returns event_trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog'
as $function$
declare
  cmd record;
  tbl name;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
     if cmd.schema_name is not null and cmd.schema_name in ('public') and cmd.schema_name not in ('pg_catalog','information_schema') and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%' then
      begin
        select c.relname into tbl from pg_catalog.pg_class c where c.oid = cmd.objid;
        execute format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
     else
        raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     end if;
  end loop;
end;
$function$;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    create event trigger ensure_rls on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      execute function public.rls_auto_enable();
  end if;
end $$;

-- ============================================================
-- 20261110130000_revoke_rls_auto_enable_execute.sql
-- ============================================================
-- SPEC 13 (paso 3): rls_auto_enable() solo la usa el event trigger ensure_rls (lo dispara el sistema),
-- no debe poder llamarse por la API (/rest/v1/rpc/rls_auto_enable). Avisos 0028 y 0029 del linter.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;


-- ============================================================
-- 20261114120000_profiles_username_history_trigger.sql
-- ============================================================
-- SPEC 14 (SEC-03): la unicidad del username frente a los nombres del leaderboard vivía solo en la
-- Server Action. Este trigger la mueve a la BD: rechaza un perfil cuyo username (sin distinguir
-- mayúsculas) aparece en scores.player_name de filas que no son del propio usuario. Cubre auth.signUp
-- directo (vía handle_new_user) y el insert directo en profiles.
-- SECURITY DEFINER para leer scores sin depender de las políticas del llamador.

create function public.check_username_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.scores s
    where lower(s.player_name) = lower(new.username)
      and (s.user_id is null or s.user_id <> new.id)
  ) then
    raise exception 'username_taken' using errcode = '23505';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_username_history() from public, anon, authenticated;

create trigger profiles_check_username_history
  before insert on public.profiles
  for each row execute function public.check_username_history();


-- ============================================================
-- 20261114120100_games_playable_and_scores_policy.sql
-- ============================================================
-- SPEC 14 (SEC-05, catálogo y política): solo se pueden guardar marcas de juegos jugables.
-- Un juego nuevo se activa con `playable = true` en su propia migración (ver /add-game).

alter table public.games add column playable boolean not null default false;

update public.games set playable = true where id in ('asteroids', 'tetris', 'arkanoid', 'serpentina');

drop policy "scores_insert_own" on public.scores;

create policy "scores_insert_own"
  on public.scores
  for insert
  to authenticated
  with check (
    is_seed = false
    and user_id = (select auth.uid())
    and player_name = (
      select p.username from public.profiles p where p.id = (select auth.uid())
    )
    and exists (select 1 from public.games g where g.id = scores.game_id and g.playable)
  );


-- ============================================================
-- 20261114120200_scores_rate_limit.sql
-- ============================================================
-- SPEC 14 (SEC-05, frecuencia): como máximo 10 marcas por usuario en 60 segundos.
-- Terminar una partida de cualquier juego lleva bastante más de 6 segundos, así que una partida
-- normal nunca lo alcanza. Frena el relleno masivo del leaderboard con una sesión válida.
-- Es SECURITY INVOKER: scores tiene SELECT público, no necesita privilegios extra.

create function public.scores_rate_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is not null and (
    select count(*)
    from public.scores s
    where s.user_id = new.user_id
      and s.created_at > now() - interval '60 seconds'
  ) >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.scores_rate_limit() from public, anon, authenticated;

create trigger scores_rate_limit
  before insert on public.scores
  for each row execute function public.scores_rate_limit();


-- ============================================================
-- 20261114120300_minimal_table_grants.sql
-- ============================================================
-- SPEC 14 (SEC-06 y SEC-05, grants): privilegios mínimos para los roles de la API.
-- Supabase concede por defecto todos los privilegios de tabla a anon y authenticated y deja a RLS como
-- única barrera. Se quitan y se vuelve a conceder solo lo que usa la app:
--   anon:          SELECT en games, scores y game_stats (leaderboards y catálogo públicos).
--   authenticated: SELECT en games, scores, game_stats y profiles (RLS limita profiles a la fila propia);
--                  INSERT en profiles (id, username) y en scores (game_id, player_name, score, user_id).
-- `id`, `created_at` e `is_seed` de scores los fija la BD (valores por defecto), no el cliente.
-- Sin UPDATE, DELETE, TRUNCATE, REFERENCES ni TRIGGER para nadie de la API.

revoke all on public.games, public.scores, public.profiles, public.game_stats from anon, authenticated;

grant select on public.games, public.scores, public.game_stats to anon, authenticated;
grant select on public.profiles to authenticated;

grant insert (id, username) on public.profiles to authenticated;
grant insert (game_id, player_name, score, user_id) on public.scores to authenticated;


-- ============================================================
-- 20261114120400_version_rls_auto_enable.sql
-- ============================================================
-- SPEC 14 (SEC-08): rls_auto_enable() y el event trigger ensure_rls los creó el proyecto de Supabase y no
-- estaban versionados; una BD nueva construida solo con estas migraciones no los tendría. Migración
-- idempotente con la definición real (inspeccionada en el SPEC 13). En la BD actual no cambia nada:
-- `create or replace` conserva los privilegios y el trigger solo se crea si falta.

create or replace function public.rls_auto_enable()
 returns event_trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog'
as $function$
declare
  cmd record;
  tbl name;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
     if cmd.schema_name is not null and cmd.schema_name in ('public') and cmd.schema_name not in ('pg_catalog','information_schema') and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%' then
      begin
        select c.relname into tbl from pg_catalog.pg_class c where c.oid = cmd.objid;
        execute format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
     else
        raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     end if;
  end loop;
end;
$function$;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    create event trigger ensure_rls on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      execute function public.rls_auto_enable();
  end if;
end $$;

