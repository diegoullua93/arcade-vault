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
