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
