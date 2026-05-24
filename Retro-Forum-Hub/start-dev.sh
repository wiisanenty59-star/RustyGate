#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v podman >/dev/null 2>&1; then
  echo "ERROR: podman is required but not installed."
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "ERROR: pnpm is required but not installed."
  exit 1
fi

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

DB_NAME="${POSTGRES_DB:-rustygate}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
DB_PORT="${DB_PORT:-5433}"
CONTAINER_NAME="rustygate-db"
DATA_DIR="$ROOT_DIR/.postgres-data"
IMAGE="docker.io/library/postgres:16"

mkdir -p "$DATA_DIR"

if podman container exists "$CONTAINER_NAME" >/dev/null 2>&1; then
  echo "Found existing container $CONTAINER_NAME. Starting it if necessary..."
  if ! podman inspect -f '{{.State.Running}}' "$CONTAINER_NAME" | grep -q true; then
    podman start "$CONTAINER_NAME"
  fi
else
  echo "Creating and starting PostgreSQL container $CONTAINER_NAME..."
  podman run -d \
    --name "$CONTAINER_NAME" \
    -p "$DB_PORT":5432 \
    -e POSTGRES_DB="$DB_NAME" \
    -e POSTGRES_USER="$DB_USER" \
    -e POSTGRES_PASSWORD="$DB_PASSWORD" \
    -v "$DATA_DIR":/var/lib/postgresql/data:Z \
    "$IMAGE"
fi

echo "Waiting for PostgreSQL to accept connections on port $DB_PORT..."
until podman exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" >/dev/null 2>&1; do
  sleep 1
done

echo "PostgreSQL is ready."

RUN_FRONTEND=false
while [ $# -gt 0 ]; do
  case "$1" in
    --frontend|-f|--all|all)
      RUN_FRONTEND=true
      shift
      ;;
    *)
      echo "Usage: $0 [--frontend]"
      exit 1
      ;;
  esac
done

start_frontend() {
  echo "Starting frontend dev server..."
  pnpm --dir "$ROOT_DIR/artifacts/hidden-freeways" dev &
  FRONTEND_PID=$!
}

cleanup() {
  if [ -n "${FRONTEND_PID:-}" ]; then
    echo "Stopping frontend dev server..."
    kill "$FRONTEND_PID" 2>/dev/null || true
    wait "$FRONTEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "Starting API server..."
cd "$ROOT_DIR/artifacts/api-server"

export DATABASE_URL="${DATABASE_URL:-postgres://$DB_USER:$DB_PASSWORD@127.0.0.1:$DB_PORT/$DB_NAME}"
export SESSION_SECRET="${SESSION_SECRET:-$(openssl rand -hex 32)}"

echo "Applying database schema..."
yes '' | pnpm --dir "$ROOT_DIR/lib/db" exec drizzle-kit push --force --config ./drizzle.config.ts

if [ "$RUN_FRONTEND" = true ]; then
  start_frontend
  pnpm run dev &
  BACKEND_PID=$!
  wait -n "$BACKEND_PID" "$FRONTEND_PID"
  exit "$?"
else
  pnpm run dev
fi
