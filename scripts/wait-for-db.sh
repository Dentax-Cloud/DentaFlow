#!/bin/sh
set -e

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-dentaflow}"
DB_NAME="${DB_NAME:-dentaflow}"

echo "Waiting for Postgres at ${DB_HOST}:${DB_PORT}..."

until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do
  sleep 1
done

echo "Postgres is ready."
