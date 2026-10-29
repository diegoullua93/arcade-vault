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
