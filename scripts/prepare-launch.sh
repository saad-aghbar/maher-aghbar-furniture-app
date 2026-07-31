#!/usr/bin/env bash
# Prepare the monorepo so `pnpm start:all` can boot cleanly.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin:$PATH"

mkdir -p "$ROOT/uploads" "$ROOT/logs" "$ROOT/.run"

if [[ ! -f "$ROOT/.env" ]]; then
  echo "==> Creating .env from .env.example"
  cp "$ROOT/.env.example" "$ROOT/.env"
fi

# Load KEY=VALUE from .env without evaluating shell metacharacters in values.
load_dotenv() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      local key="${BASH_REMATCH[1]}"
      local val="${BASH_REMATCH[2]}"
      if [[ "$val" =~ ^\"(.*)\"$ ]]; then val="${BASH_REMATCH[1]}"; fi
      if [[ "$val" =~ ^\'(.*)\'$ ]]; then val="${BASH_REMATCH[1]}"; fi
      export "$key=$val"
    fi
  done < "$file"
}
load_dotenv "$ROOT/.env"

export DATABASE_URL="${DATABASE_URL:-postgresql://maher:maher@127.0.0.1:5432/maher_erp?schema=public}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export LOCAL_UPLOAD_DIR="$ROOT/uploads"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:4000}"

# Keep .env upload path absolute for API dotenv load
python3 - <<PY
from pathlib import Path
root = Path("$ROOT")
p = root / ".env"
lines = []
seen_upload = False
seen_public = False
for line in p.read_text().splitlines():
    if line.startswith("LOCAL_UPLOAD_DIR="):
        lines.append(f"LOCAL_UPLOAD_DIR={root / 'uploads'}")
        seen_upload = True
    elif line.startswith("NEXT_PUBLIC_API_URL="):
        lines.append("NEXT_PUBLIC_API_URL=http://localhost:4000")
        seen_public = True
    else:
        lines.append(line)
if not seen_upload:
    lines.append(f"LOCAL_UPLOAD_DIR={root / 'uploads'}")
if not seen_public:
    lines.append("NEXT_PUBLIC_API_URL=http://localhost:4000")
p.write_text("\n".join(lines) + "\n")
PY

ensure_postgres() {
  echo "==> Ensuring Postgres"
  if command -v brew >/dev/null 2>&1; then
    brew services start postgresql@18 >/dev/null 2>&1 || brew services start postgresql >/dev/null 2>&1 || true
    sleep 1
  fi

  local psql_url="${DATABASE_URL%%\?*}"
  if ! psql "$psql_url" -c 'SELECT 1' >/dev/null 2>&1; then
    echo "  Trying to create role/database via local postgres..."
    local admin_psql=""
    for cand in \
      "postgresql:///postgres" \
      "postgresql://$(whoami)@127.0.0.1:5432/postgres" \
      "postgresql://postgres@127.0.0.1:5432/postgres"; do
      if psql "$cand" -c 'SELECT 1' >/dev/null 2>&1; then
        admin_psql="$cand"
        break
      fi
    done

    if [[ -z "$admin_psql" ]] && command -v docker >/dev/null 2>&1; then
      echo "  Starting Postgres via Docker Compose..."
      docker compose -f "$ROOT/infra/docker/docker-compose.yml" up -d postgres redis
      for _ in $(seq 1 30); do
        psql "$psql_url" -c 'SELECT 1' >/dev/null 2>&1 && break
        sleep 1
      done
    elif [[ -n "$admin_psql" ]]; then
      psql "$admin_psql" -v ON_ERROR_STOP=1 <<'SQL' || true
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'maher') THEN
    CREATE ROLE maher LOGIN PASSWORD 'maher';
  END IF;
END
$$;
SQL
      psql "$admin_psql" -c "CREATE DATABASE maher_erp OWNER maher;" >/dev/null 2>&1 || true
      psql "$admin_psql" -c "GRANT ALL PRIVILEGES ON DATABASE maher_erp TO maher;" >/dev/null 2>&1 || true
    fi
  fi

  if ! psql "$psql_url" -c 'SELECT 1' >/dev/null 2>&1; then
    echo "ERROR: Postgres not reachable at ${psql_url}"
    echo "Start Postgres (brew services start postgresql@18) or:"
    echo "  docker compose -f infra/docker/docker-compose.yml up -d postgres redis"
    exit 1
  fi
  echo "  Postgres OK"
}

ensure_redis() {
  echo "==> Ensuring Redis"
  if redis-cli ping >/dev/null 2>&1; then
    echo "  Redis OK"
    return 0
  fi
  if command -v brew >/dev/null 2>&1; then
    brew services start redis >/dev/null 2>&1 || true
    sleep 1
  fi
  if ! redis-cli ping >/dev/null 2>&1; then
    redis-server --daemonize yes --port 6379 >/dev/null 2>&1 || true
    sleep 1
  fi
  if ! redis-cli ping >/dev/null 2>&1 && command -v docker >/dev/null 2>&1; then
    docker compose -f "$ROOT/infra/docker/docker-compose.yml" up -d redis >/dev/null 2>&1 || true
    sleep 2
  fi
  if ! redis-cli ping >/dev/null 2>&1; then
    echo "ERROR: Redis not reachable on localhost:6379"
    exit 1
  fi
  echo "  Redis OK"
}

ensure_postgres
ensure_redis

echo "==> Installing dependencies"
pnpm install

echo "==> Building shared packages"
pnpm --filter @maher/types build
pnpm --filter @maher/permissions build
pnpm --filter @maher/validation build
pnpm --filter @maher/logging build
pnpm --filter @maher/config build
pnpm --filter @maher/i18n build
pnpm --filter @maher/ui build
pnpm --filter @maher/database generate
pnpm --filter @maher/database build

echo "==> Database schema + seed"
(cd packages/database && DATABASE_URL="$DATABASE_URL" pnpm exec prisma db push --skip-generate)
(cd packages/database && DATABASE_URL="$DATABASE_URL" pnpm exec tsx prisma/seed.ts)

echo "==> Building apps"
pnpm --filter @maher/api build
pnpm --filter @maher/worker build
NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" pnpm --filter @maher/admin-web build
NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" pnpm --filter @maher/customer-portal build
NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" pnpm --filter @maher/employee-portal build

echo ""
echo "==> Launch ready"
echo "Start everything with:  pnpm start:all"
echo "Stop everything with:   pnpm stop:all"
