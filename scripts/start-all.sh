#!/usr/bin/env bash
# Start API + portals (+ worker) in the background.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin:$PATH"
mkdir -p "$ROOT/.run" "$ROOT/uploads" "$ROOT/logs"

if [[ ! -f "$ROOT/.env" ]]; then
  echo "Missing .env — run: pnpm prepare:launch"
  exit 1
fi

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
export LOCAL_UPLOAD_DIR="${LOCAL_UPLOAD_DIR:-$ROOT/uploads}"
if [[ "$LOCAL_UPLOAD_DIR" != /* ]]; then
  export LOCAL_UPLOAD_DIR="$ROOT/${LOCAL_UPLOAD_DIR#./}"
fi
export JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-dev-access-secret-change-me-min-32-chars!!}"
export JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-dev-refresh-secret-change-me-min-32-chars!}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:3000,http://localhost:3001,http://localhost:3002}"
export COOKIE_SECURE="${COOKIE_SECURE:-false}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:4000}"
export NEXT_PUBLIC_ADMIN_WEB_URL="${NEXT_PUBLIC_ADMIN_WEB_URL:-http://localhost:3000}"
export NEXT_PUBLIC_CUSTOMER_PORTAL_URL="${NEXT_PUBLIC_CUSTOMER_PORTAL_URL:-http://localhost:3001}"
export NEXT_PUBLIC_EMPLOYEE_PORTAL_URL="${NEXT_PUBLIC_EMPLOYEE_PORTAL_URL:-http://localhost:3002}"
# Next.js `next start` requires NODE_ENV=production
export NODE_ENV=production
export COMPANY_NAME_AR="${COMPANY_NAME_AR:-مفروشات ماهر الأغبر وأولاده}"
export COMPANY_NAME_EN="${COMPANY_NAME_EN:-Maher Al-Aghbar & Sons Furniture}"

needs_prepare=0
[[ -f "$ROOT/apps/api/dist/main.js" ]] || needs_prepare=1
[[ -d "$ROOT/apps/admin-web/.next" ]] || needs_prepare=1
[[ -d "$ROOT/apps/customer-portal/.next" ]] || needs_prepare=1
[[ -d "$ROOT/apps/employee-portal/.next" ]] || needs_prepare=1
if [[ "$needs_prepare" -eq 1 ]]; then
  echo "==> Builds missing — running prepare:launch first"
  bash "$ROOT/scripts/prepare-launch.sh"
  load_dotenv "$ROOT/.env"
fi

echo "==> Infra"
if command -v brew >/dev/null 2>&1; then
  brew services start postgresql@18 >/dev/null 2>&1 || brew services start postgresql >/dev/null 2>&1 || true
fi
PSQL_URL="${DATABASE_URL%%\?*}"
if ! psql "$PSQL_URL" -c 'SELECT 1' >/dev/null 2>&1; then
  echo "Postgres not reachable at $PSQL_URL"
  echo "Run: pnpm prepare:launch"
  exit 1
fi
if ! redis-cli ping >/dev/null 2>&1; then
  redis-server --daemonize yes --port 6379 >/dev/null 2>&1 || brew services start redis >/dev/null 2>&1 || true
  sleep 1
fi
if ! redis-cli ping >/dev/null 2>&1; then
  echo "Redis not reachable on localhost:6379"
  exit 1
fi
echo "  Postgres + Redis OK"

is_up() {
  curl -sf -o /dev/null "$1" 2>/dev/null
}

start_bg() {
  local name="$1"
  local pidfile="$ROOT/.run/${name}.pid"
  local logfile="$ROOT/logs/${name}.log"
  shift
  if [[ -f "$pidfile" ]] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    echo "  $name already running (pid $(cat "$pidfile"))"
    return 0
  fi
  # Clear stale pid
  rm -f "$pidfile"
  echo "  starting ${name}..."
  (
    cd "$ROOT"
    nohup bash -lc "$*" >"$logfile" 2>&1 &
    echo $! >"$pidfile"
  )
}

# Prefer killing orphan listeners only when our pidfile is missing
ensure_port_free_or_owned() {
  local port="$1"
  local name="$2"
  local pidfile="$ROOT/.run/${name}.pid"
  if is_up "http://localhost:${port}/" || is_up "http://localhost:${port}/api/v1/health" || is_up "http://localhost:${port}/ar/login"; then
    if [[ -f "$pidfile" ]] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
      return 0
    fi
    # Port in use by something else — adopt by writing pid if single listener
    local pids
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      echo "$pids" | head -n1 >"$pidfile"
      echo "  $name already up on :$port (adopted pid $(cat "$pidfile"))"
      return 0
    fi
  fi
  return 1
}

if ! ensure_port_free_or_owned 4000 api; then
  start_bg api "cd '$ROOT/apps/api' && \
    DATABASE_URL='$DATABASE_URL' \
    REDIS_URL='$REDIS_URL' \
    JWT_ACCESS_SECRET='$JWT_ACCESS_SECRET' \
    JWT_REFRESH_SECRET='$JWT_REFRESH_SECRET' \
    CORS_ORIGINS='$CORS_ORIGINS' \
    LOCAL_UPLOAD_DIR='$LOCAL_UPLOAD_DIR' \
    COOKIE_SECURE='$COOKIE_SECURE' \
    COMPANY_NAME_AR='$COMPANY_NAME_AR' \
    COMPANY_NAME_EN='$COMPANY_NAME_EN' \
    NODE_ENV='$NODE_ENV' \
    pnpm start:prod"
  for _ in $(seq 1 60); do
    is_up "http://localhost:4000/api/v1/health" && break
    sleep 0.5
  done
fi

wait_http() {
  local url="$1"
  local label="$2"
  for _ in $(seq 1 60); do
    if is_up "$url"; then
      return 0
    fi
    sleep 0.5
  done
  echo "  WARN: $label did not become ready at $url"
  return 1
}

if ! ensure_port_free_or_owned 3000 admin; then
  start_bg admin "cd '$ROOT/apps/admin-web' && NODE_ENV=production NEXT_PUBLIC_API_URL='$NEXT_PUBLIC_API_URL' pnpm start"
fi
wait_http "http://localhost:3000/ar/login" "admin" || true

if ! ensure_port_free_or_owned 3001 customer; then
  start_bg customer "cd '$ROOT/apps/customer-portal' && NODE_ENV=production NEXT_PUBLIC_API_URL='$NEXT_PUBLIC_API_URL' pnpm start"
fi
wait_http "http://localhost:3001/ar/login" "customer" || true

if ! ensure_port_free_or_owned 3002 employee; then
  start_bg employee "cd '$ROOT/apps/employee-portal' && NODE_ENV=production NEXT_PUBLIC_API_URL='$NEXT_PUBLIC_API_URL' pnpm start"
fi
wait_http "http://localhost:3002/ar/login" "employee" || true

if [[ -f "$ROOT/apps/worker/dist/main.js" ]]; then
  start_bg worker "cd '$ROOT/apps/worker' && DATABASE_URL='$DATABASE_URL' REDIS_URL='$REDIS_URL' NODE_ENV=production pnpm start"
fi

echo ""
echo "==> Status"
curl -sf -o /dev/null -w "API        %{http_code}  http://localhost:4000/api/docs\n" http://localhost:4000/api/v1/health || echo "API        DOWN — see logs/api.log"
curl -sf -o /dev/null -w "Admin      %{http_code}  http://localhost:3000/ar/login\n" http://localhost:3000/ar/login || echo "Admin      DOWN — see logs/admin.log"
curl -sf -o /dev/null -w "Customer   %{http_code}  http://localhost:3001/ar/login\n" http://localhost:3001/ar/login || echo "Customer   DOWN — see logs/customer.log"
curl -sf -o /dev/null -w "Employee   %{http_code}  http://localhost:3002/ar/login\n" http://localhost:3002/ar/login || echo "Employee   DOWN — see logs/employee.log"
echo ""
echo "Demo password: Admin@12345!"
echo "  admin@maher-aghbar.jo | sales@maher-aghbar.jo | customer@cedar-hotel.jo"
echo "  Workers: worker@ | carpenter@ | painter@ | upholsterer@ | assembler@ | packer@ (…@maher-aghbar.jo)"
echo ""
echo "Mobile app:  pnpm mobile:start"
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
if [[ -n "${LAN_IP:-}" ]]; then
  echo "Phone API:   http://${LAN_IP}:4000  (set EXPO_PUBLIC_API_BASE_URL)"
fi
echo "Stop with:   pnpm stop:all"
