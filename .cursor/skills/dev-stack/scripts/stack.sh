#!/usr/bin/env bash
# Dev stack: API :4000, admin-web :3000, Metro :8081
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"

export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin:$HOME/.local/share/pnpm:$HOME/Library/pnpm:${PATH:-}"
unset CI CONTINUOUS_INTEGRATION || true

mkdir -p "$ROOT/.run" "$ROOT/logs"

API_URL="http://127.0.0.1:4000/api/v1/health"
ADMIN_URL="http://127.0.0.1:3000/ar/login"
METRO_URL="http://127.0.0.1:8081/status"

die() { echo "ERROR: $*" >&2; exit 1; }

need_pnpm() {
  command -v pnpm >/dev/null 2>&1 || die "pnpm not found. Install pnpm, then retry."
}

ensure_redis() {
  if redis-cli ping >/dev/null 2>&1; then
    return 0
  fi
  echo "  redis  starting…"
  brew services start redis >/dev/null 2>&1 || redis-server --daemonize yes --port 6379 >/dev/null 2>&1 || true
  sleep 1
  if redis-cli ping >/dev/null 2>&1; then
    echo "  redis  OK"
    return 0
  fi
  echo "  redis  DOWN — API will fail (ioredis ECONNREFUSED)"
  return 1
}

listen_pids() {
  lsof -nP -t -iTCP:"$1" -sTCP:LISTEN 2>/dev/null || true
}

kill_port() {
  local port="$1"
  local pids
  pids="$(listen_pids "$port")"
  if [[ -n "$pids" ]]; then
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 0.4
    pids="$(listen_pids "$port")"
    if [[ -n "$pids" ]]; then
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
    fi
  fi
}

stop_named() {
  local name="$1"
  local pidfile="$ROOT/.run/dev-${name}.pid"
  if [[ -f "$pidfile" ]]; then
    local pid
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      pkill -P "$pid" 2>/dev/null || true
      kill "$pid" 2>/dev/null || true
      sleep 0.3
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$pidfile"
  fi
}

http_code() {
  curl -sS -o /dev/null -w "%{http_code}" --max-time 4 "$1" 2>/dev/null || echo "000"
}

api_ok() {
  local body
  body="$(curl -sS --max-time 4 "$API_URL" 2>/dev/null || true)"
  [[ "$body" == *'"status":"ok"'* ]] || [[ "$body" == *'"status": "ok"'* ]]
}

admin_ok() {
  local code
  code="$(http_code "$ADMIN_URL")"
  [[ "$code" == "200" ]]
}

metro_ok() {
  local code
  code="$(http_code "$METRO_URL")"
  [[ "$code" == "200" ]]
}

start_bg() {
  local name="$1"
  local logfile="$ROOT/logs/dev-${name}.log"
  local pidfile="$ROOT/.run/dev-${name}.pid"
  shift
  : >"$logfile"
  # New session so the process can outlive this script. Cursor /run still
  # prefers block_until_ms: 0 terminals — see SKILL.md.
  python3 - "$ROOT" "$logfile" "$pidfile" "$*" <<'PY'
import os, subprocess, sys
root, logfile, pidfile, cmd = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
env = os.environ.copy()
env.pop("CI", None)
env.pop("CONTINUOUS_INTEGRATION", None)
log = open(logfile, "ab", buffering=0)
proc = subprocess.Popen(
    ["bash", "-lc", cmd],
    cwd=root,
    stdin=subprocess.DEVNULL,
    stdout=log,
    stderr=subprocess.STDOUT,
    start_new_session=True,
    env=env,
)
open(pidfile, "w", encoding="utf-8").write(str(proc.pid))
PY
}

wait_ok() {
  local label="$1"
  local attempts="${2:-90}"
  local i
  for i in $(seq 1 "$attempts"); do
    case "$label" in
      api) api_ok && return 0 ;;
      admin) admin_ok && return 0 ;;
      metro) metro_ok && return 0 ;;
    esac
    sleep 1
  done
  return 1
}

start_api() {
  need_pnpm
  start_bg api "pnpm dev:api"
}

start_admin() {
  need_pnpm
  start_bg admin "pnpm dev:admin"
}

start_metro() {
  need_pnpm
  start_bg metro "pnpm --filter @maher/mobile exec expo start --host lan"
}

ensure_up() {
  local name="$1"
  local port="$2"
  local check="$3"
  if $check; then
    echo "  $name  already OK"
    return 0
  fi
  echo "  $name  starting…"
  stop_named "$name"
  kill_port "$port"
  sleep 0.3
  "start_${name}"
  if wait_ok "$name" 90; then
    echo "  $name  OK"
    return 0
  fi
  echo "  $name  FAILED — last log:"
  tail -n 40 "$ROOT/logs/dev-${name}.log" 2>/dev/null || true
  return 1
}

restart_if_bad() {
  local name="$1"
  local port="$2"
  local check="$3"
  if $check; then
    echo "  $name  OK"
    return 0
  fi
  echo "  $name  unhealthy — restarting"
  stop_named "$name"
  kill_port "$port"
  sleep 0.3
  "start_${name}"
  if wait_ok "$name" 90; then
    echo "  $name  OK (restarted)"
    return 0
  fi
  echo "  $name  FAILED — last log:"
  tail -n 40 "$ROOT/logs/dev-${name}.log" 2>/dev/null || true
  return 1
}

print_status() {
  echo ""
  echo "==> Status"
  if api_ok; then
    echo "API    OK   http://127.0.0.1:4000   $API_URL"
  else
    echo "API    DOWN http://127.0.0.1:4000   $API_URL"
  fi
  if admin_ok; then
    echo "Admin  OK   http://127.0.0.1:3000   $ADMIN_URL"
  else
    echo "Admin  DOWN http://127.0.0.1:3000   $ADMIN_URL"
  fi
  if metro_ok; then
    echo "Metro  OK   http://127.0.0.1:8081   $METRO_URL"
  else
    echo "Metro  DOWN http://127.0.0.1:8081   $METRO_URL"
  fi
}

cmd_status() {
  print_status
  api_ok && admin_ok && metro_ok
}

cmd_run() {
  echo "==> /run  API + admin + Metro  ($ROOT)"
  echo "NOTE: prefer Cursor background Shells (block_until_ms 0). This script detaches with a new session."
  local rc=0
  ensure_redis || rc=1
  ensure_up api 4000 api_ok || rc=1
  ensure_up admin 3000 admin_ok || rc=1
  ensure_up metro 8081 metro_ok || rc=1
  print_status
  echo ""
  echo "Website: http://localhost:3000/ar/login"
  echo "API:     http://localhost:4000/api/v1/health"
  echo "Expo Go (this Mac): exp://127.0.0.1:8081"
  echo "Do not paste http://localhost:8081 into Expo Go."
  echo "Stop with /stop"
  return "$rc"
}

cmd_fix() {
  echo "==> /fix  check API + admin + Metro  ($ROOT)"
  local rc=0
  if ! redis-cli ping >/dev/null 2>&1; then
    ensure_redis || rc=1
  fi
  restart_if_bad api 4000 api_ok || rc=1
  restart_if_bad admin 3000 admin_ok || rc=1
  restart_if_bad metro 8081 metro_ok || rc=1
  print_status
  return "$rc"
}

cmd_stop() {
  echo "==> /stop  API + admin + Metro"
  stop_named api
  stop_named admin
  stop_named metro
  kill_port 4000
  kill_port 3000
  kill_port 8081
  echo "Stopped  :4000  :3000  :8081"
}

usage() {
  echo "Usage: stack.sh run | fix | stop | status"
  exit 2
}

case "${1:-}" in
  run) cmd_run ;;
  fix) cmd_fix ;;
  stop) cmd_stop ;;
  status) cmd_status ;;
  *) usage ;;
esac
