#!/usr/bin/env bash
# Recria o banco de teste local e aplica as migrações
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PSQL="psql -h ${PGHOST:-/var/run/postgresql} -p ${PGPORT:-5433} -U ${PGUSER:-postgres} -v ON_ERROR_STOP=1 -q"
$PSQL -d postgres -c "drop database if exists ${PGDATABASE:-bh}" -c "create database ${PGDATABASE:-bh}" >/dev/null
$PSQL -d ${PGDATABASE:-bh} -f "$DIR/tests/shim.sql" 2>&1 | grep -v "wal_level\|HINT" || true
for f in "$DIR"/migrations/*.sql; do case "$f" in *_storage.sql) continue;; esac; $PSQL -d ${PGDATABASE:-bh} -f "$f" >/dev/null 2>&1 || $PSQL -d ${PGDATABASE:-bh} -f "$f"; done
