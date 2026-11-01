-- Serpentina pasa a ser jugable. Sus 10 semillas (38 387–213 991) se borran para que el ranking
-- arranque vacío y la primera partida real sea el #1. La fila de `games` no cambia.
delete from public.scores where game_id = 'serpentina' and is_seed;
