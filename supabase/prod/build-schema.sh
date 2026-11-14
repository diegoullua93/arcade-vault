#!/usr/bin/env bash
# Regenera supabase/prod/01-schema.sql a partir de supabase/migrations/*.sql (ejecutar desde la raíz:
# bash supabase/prod/build-schema.sh). Diferencias respecto a aplicar las migraciones tal cual:
#   1) scores se crea VACÍA: se omite el INSERT de semillas de 20261028120100_create_scores.sql.
#   2) rls_auto_enable() y ensure_rls se crean ANTES del revoke de 20261110130000 (en una BD nueva la
#      migración del revoke fallaría si la función no existe; la definitiva es 20261114120400).
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=supabase/prod/01-schema.sql
REVOKE=20261110130000_revoke_rls_auto_enable_execute.sql
SEEDS=20261028120100_create_scores.sql
BLOCK=supabase/migrations/20261114120400_version_rls_auto_enable.sql

{
  cat <<'EOF'
-- ARCADE VAULT · esquema completo para PRODUCCIÓN (proyecto vacío).
-- GENERADO por supabase/prod/build-schema.sh a partir de supabase/migrations/*.sql: no lo edites a mano.
-- Diferencias respecto a desarrollo:
--   1) `scores` se crea VACÍA (sin las 50 filas semilla is_seed); las migraciones que las movían o
--      borraban quedan sin efecto.
--   2) rls_auto_enable()/ensure_rls se crean antes del revoke (no estaban versionados antes del SPEC 14).
-- Ejecutar UNA sola vez en el SQL Editor de producción, después de 00-preflight.sql.

EOF
  for f in supabase/migrations/*.sql; do
    name=$(basename "$f")
    if [ "$name" = "$REVOKE" ]; then
      printf '\n-- ============================================================\n-- rls_auto_enable() + ensure_rls antes del revoke (de 20261114120400)\n-- ============================================================\n'
      cat "$BLOCK"
    fi
    printf '\n-- ============================================================\n-- %s\n-- ============================================================\n' "$name"
    if [ "$name" = "$SEEDS" ]; then
      echo "-- (omitido en producción: INSERT de semillas de scores)"
      awk '/^-- Semillas:/{skip=1} skip&&/\);[[:space:]]*$/{skip=0; next} !skip' "$f"
    else
      cat "$f"
    fi
    echo
  done
} > "$OUT"
echo "Generado $OUT ($(wc -l < "$OUT") líneas)"
