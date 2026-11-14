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
