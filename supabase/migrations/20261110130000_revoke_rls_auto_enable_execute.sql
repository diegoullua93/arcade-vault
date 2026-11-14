-- SPEC 13 (paso 3): rls_auto_enable() solo la usa el event trigger ensure_rls (lo dispara el sistema),
-- no debe poder llamarse por la API (/rest/v1/rpc/rls_auto_enable). Avisos 0028 y 0029 del linter.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
