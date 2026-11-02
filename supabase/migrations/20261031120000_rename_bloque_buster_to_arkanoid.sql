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
