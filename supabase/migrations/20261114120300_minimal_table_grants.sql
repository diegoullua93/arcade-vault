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
