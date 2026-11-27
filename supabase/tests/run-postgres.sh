#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ $(id -u) == 0 ]]; then
  printf '%s\n' 'PostgreSQL initdb requires a regular local user.' >&2
  exit 1
fi
for command in initdb pg_ctl psql; do
  command -v "$command" >/dev/null || { printf 'Missing PostgreSQL command: %s\n' "$command" >&2; exit 1; }
done

test_dir="$(mktemp -d "${TMPDIR:-/tmp}/sofia-pg.XXXXXX")"
trap 'pg_ctl -D "$test_dir/db" -m immediate stop >/dev/null 2>&1 || true; rm -rf -- "$test_dir"' EXIT

initdb -D "$test_dir/db" --no-locale --encoding=UTF8 --auth=trust >/dev/null
pg_ctl -D "$test_dir/db" -l "$test_dir/postgres.log" -o "-k '$test_dir' -c listen_addresses=''" -w start >/dev/null

psql -X -h "$test_dir" -d postgres -q -v ON_ERROR_STOP=1 -f "$project_dir/supabase/tests/platform_stub.sql"
for migration in "$project_dir"/supabase/migrations/*.sql; do
  psql -X -h "$test_dir" -d postgres -q -v ON_ERROR_STOP=1 -f "$migration"
done
psql -X -h "$test_dir" -d postgres -q -o /dev/null -v ON_ERROR_STOP=1 -f "$project_dir/supabase/tests/workflows.sql"
psql -X -h "$test_dir" -d postgres -q -o /dev/null -v ON_ERROR_STOP=1 -f "$project_dir/supabase/tests/operating-book.sql"
psql -X -h "$test_dir" -d postgres -q -v ON_ERROR_STOP=1 -f "$project_dir/supabase/tests/accounting-core.sql"
printf '%s\n' 'Migrations and accounting policy checks passed.'
