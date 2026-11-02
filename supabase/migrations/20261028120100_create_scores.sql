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

-- Semillas: 10 filas por juego no jugable (copiadas una vez de seededScores).
insert into public.scores (game_id, player_name, score, is_seed, created_at) values
  ('bloque-buster', 'RGB_QUEEN', 230564, true, '2026-02-16 12:00:00+00'),
  ('bloque-buster', 'CYBER_LU', 186907, true, '2026-06-04 12:00:00+00'),
  ('bloque-buster', 'ATARI_KID', 184760, true, '2026-03-02 12:00:00+00'),
  ('bloque-buster', 'M00NRYU', 182767, true, '2026-01-25 12:00:00+00'),
  ('bloque-buster', 'PIXEL_DAD', 165908, true, '2026-09-08 12:00:00+00'),
  ('bloque-buster', 'JOY_STK', 115535, true, '2026-12-03 12:00:00+00'),
  ('bloque-buster', 'NEONFOX', 111943, true, '2026-06-01 12:00:00+00'),
  ('bloque-buster', 'BIT_LORD', 97984, true, '2026-03-11 12:00:00+00'),
  ('bloque-buster', 'VECTORX', 50138, true, '2026-08-25 12:00:00+00'),
  ('bloque-buster', 'VAULT_07', 37347, true, '2026-08-26 12:00:00+00'),
  ('caida', 'NEONFOX', 298105, true, '2026-01-23 12:00:00+00'),
  ('caida', 'BIT_LORD', 259979, true, '2026-07-28 12:00:00+00'),
  ('caida', 'ATARI_KID', 224310, true, '2026-01-10 12:00:00+00'),
  ('caida', 'JOY_STK', 210555, true, '2026-03-15 12:00:00+00'),
  ('caida', 'MAGENTA88', 209758, true, '2026-02-26 12:00:00+00'),
  ('caida', 'PIXEL_DAD', 132901, true, '2026-02-11 12:00:00+00'),
  ('caida', 'M00NRYU', 127495, true, '2026-09-04 12:00:00+00'),
  ('caida', 'RGB_QUEEN', 101908, true, '2026-11-02 12:00:00+00'),
  ('caida', 'Z3R0COOL', 96834, true, '2026-11-20 12:00:00+00'),
  ('caida', 'VAULT_07', 72261, true, '2026-04-24 12:00:00+00'),
  ('serpentina', 'M00NRYU', 213991, true, '2026-11-15 12:00:00+00'),
  ('serpentina', 'BIT_LORD', 199680, true, '2026-12-27 12:00:00+00'),
  ('serpentina', 'PX_KAI', 176325, true, '2026-12-19 12:00:00+00'),
  ('serpentina', 'GLITCHA', 131934, true, '2026-09-06 12:00:00+00'),
  ('serpentina', 'NEONFOX', 128453, true, '2026-02-25 12:00:00+00'),
  ('serpentina', 'MAGENTA88', 119131, true, '2026-01-08 12:00:00+00'),
  ('serpentina', 'VAULT_07', 88378, true, '2026-02-04 12:00:00+00'),
  ('serpentina', 'RGB_QUEEN', 66558, true, '2026-09-03 12:00:00+00'),
  ('serpentina', 'ARKADYA', 43014, true, '2026-06-22 12:00:00+00'),
  ('serpentina', 'SCANLINE', 38387, true, '2026-02-28 12:00:00+00'),
  ('gloton', 'NEONFOX', 269482, true, '2026-09-11 12:00:00+00'),
  ('gloton', 'PIXEL_DAD', 251134, true, '2026-10-06 12:00:00+00'),
  ('gloton', 'MAGENTA88', 193468, true, '2026-05-13 12:00:00+00'),
  ('gloton', 'ARKADYA', 189558, true, '2026-08-14 12:00:00+00'),
  ('gloton', 'VAULT_07', 172143, true, '2026-01-15 12:00:00+00'),
  ('gloton', 'DROID_X', 161445, true, '2026-02-02 12:00:00+00'),
  ('gloton', 'GLITCHA', 105378, true, '2026-10-27 12:00:00+00'),
  ('gloton', 'CYBER_LU', 93341, true, '2026-12-07 12:00:00+00'),
  ('gloton', 'Z3R0COOL', 89002, true, '2026-03-08 12:00:00+00'),
  ('gloton', 'RGB_QUEEN', 51748, true, '2026-09-09 12:00:00+00'),
  ('invasores', 'SCANLINE', 279080, true, '2026-10-22 12:00:00+00'),
  ('invasores', 'ARKADYA', 265942, true, '2026-08-10 12:00:00+00'),
  ('invasores', 'GLITCHA', 236256, true, '2026-03-03 12:00:00+00'),
  ('invasores', 'PIXEL_DAD', 181306, true, '2026-08-21 12:00:00+00'),
  ('invasores', 'ATARI_KID', 168177, true, '2026-07-01 12:00:00+00'),
  ('invasores', 'M00NRYU', 166879, true, '2026-03-21 12:00:00+00'),
  ('invasores', 'VAULT_07', 147597, true, '2026-10-18 12:00:00+00'),
  ('invasores', 'RETROVIRA', 111848, true, '2026-06-28 12:00:00+00'),
  ('invasores', 'Z3R0COOL', 93107, true, '2026-10-26 12:00:00+00'),
  ('invasores', 'MAGENTA88', 53378, true, '2026-10-28 12:00:00+00'),
  ('ranaria', 'ARKADYA', 246940, true, '2026-01-05 12:00:00+00'),
  ('ranaria', 'PIXEL_DAD', 245375, true, '2026-09-05 12:00:00+00'),
  ('ranaria', 'PX_KAI', 235964, true, '2026-01-09 12:00:00+00'),
  ('ranaria', 'SCANLINE', 223131, true, '2026-04-16 12:00:00+00'),
  ('ranaria', 'JOY_STK', 213250, true, '2026-10-08 12:00:00+00'),
  ('ranaria', 'MAGENTA88', 116773, true, '2026-05-16 12:00:00+00'),
  ('ranaria', 'VAULT_07', 66829, true, '2026-03-12 12:00:00+00'),
  ('ranaria', 'RGB_QUEEN', 55028, true, '2026-10-03 12:00:00+00'),
  ('ranaria', 'BIT_LORD', 40274, true, '2026-04-14 12:00:00+00'),
  ('ranaria', 'RETROVIRA', 18452, true, '2026-05-18 12:00:00+00'),
  ('duelo-pixel', 'VAULT_07', 226480, true, '2026-01-10 12:00:00+00'),
  ('duelo-pixel', 'M00NRYU', 203873, true, '2026-03-09 12:00:00+00'),
  ('duelo-pixel', 'DROID_X', 188387, true, '2026-10-19 12:00:00+00'),
  ('duelo-pixel', 'SCANLINE', 158166, true, '2026-03-16 12:00:00+00'),
  ('duelo-pixel', 'ARKADYA', 155002, true, '2026-02-22 12:00:00+00'),
  ('duelo-pixel', 'NEONFOX', 145218, true, '2026-08-20 12:00:00+00'),
  ('duelo-pixel', 'CYBER_LU', 87596, true, '2026-03-01 12:00:00+00'),
  ('duelo-pixel', 'MAGENTA88', 60074, true, '2026-01-02 12:00:00+00'),
  ('duelo-pixel', 'RETROVIRA', 49186, true, '2026-10-21 12:00:00+00'),
  ('duelo-pixel', 'PIXEL_DAD', 41964, true, '2026-08-20 12:00:00+00');

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
