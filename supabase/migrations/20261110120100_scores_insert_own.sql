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
