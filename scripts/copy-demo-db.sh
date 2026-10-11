#!/usr/bin/env bash
# Copy the local mock factory into an empty remote demo database.
# Refuses loopback targets so this cannot wipe the database it dumps.
# Does not run demo:reset.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin:$PATH"

if [[ -z "${DEMO_TARGET_DATABASE_URL:-}" ]]; then
  echo "Set DEMO_TARGET_DATABASE_URL to the empty Neon (or other remote) Postgres URL." >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" && -f .env ]]; then
  DATABASE_URL="$(python3 - <<'PY'
from pathlib import Path
for line in Path(".env").read_text().splitlines():
    if line.startswith("DATABASE_URL="):
        print(line.split("=", 1)[1].strip().strip('"').strip("'"))
        break
PY
)"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set. The local mock database URL is required as the dump source." >&2
  exit 1
fi

python3 - "$DATABASE_URL" "$DEMO_TARGET_DATABASE_URL" <<'PY'
import sys
from urllib.parse import urlparse

source, target = sys.argv[1], sys.argv[2]
loopback = {"127.0.0.1", "localhost", "::1"}

def host_of(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"postgres", "postgresql"} or not parsed.hostname:
        raise SystemExit(f"Not a postgres URL: scheme={parsed.scheme or '(missing)'} host={parsed.hostname or '(missing)'}")
    return parsed.hostname.lower()

source_host = host_of(source)
target_host = host_of(target)
if target_host in loopback:
    raise SystemExit(f"Refusing restore onto loopback host {target_host}.")
if target_host == source_host:
    raise SystemExit("Refusing restore: target host is the same as the source host.")
print(f"Dump {source_host} -> restore {target_host}")
PY

# Prisma URLs include ?schema=public, which libpq rejects.
libpq_url() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
parsed = urlparse(sys.argv[1])
query = urlencode([(k, v) for k, v in parse_qsl(parsed.query) if k != "schema"])
print(urlunparse(parsed._replace(query=query)))
PY
}

dump="$(mktemp -t maher-demo-dump.XXXXXX)"
trap 'rm -f "$dump"' EXIT

pg_dump --format=custom --no-owner --no-acl --dbname="$(libpq_url "$DATABASE_URL")" --file="$dump"
pg_restore --no-owner --no-acl --clean --if-exists --dbname="$(libpq_url "$DEMO_TARGET_DATABASE_URL")" "$dump"
echo "Remote demo database restored."
