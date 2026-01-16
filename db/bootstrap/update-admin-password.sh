#!/bin/sh
set -e

: "${POSTGRES_HOST:=db}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_DB:=verifmatos}"
: "${POSTGRES_USER:=verifmatos}"
: "${POSTGRES_PASSWORD:=verifmatos}"
: "${ADMIN_USERNAME:=admin}"
: "${ADMIN_PASSWORD:=change_me}"

export PGPASSWORD="$POSTGRES_PASSWORD"

until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
  echo "Waiting for database..."
  sleep 2
done

psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<SQL
UPDATE users
SET password = crypt('$ADMIN_PASSWORD', gen_salt('bf')),
    must_change_password = FALSE
WHERE username = '$ADMIN_USERNAME';
SQL

unset PGPASSWORD
