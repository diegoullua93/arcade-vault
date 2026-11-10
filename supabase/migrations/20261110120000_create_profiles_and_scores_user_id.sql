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
