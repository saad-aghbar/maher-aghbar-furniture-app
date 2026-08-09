#!/usr/bin/env bash
# One-shot: ensure builds exist, then start the web/API stack.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin:$PATH"

needs_prepare=0
[[ -f "$ROOT/apps/api/dist/main.js" ]] || needs_prepare=1
# next start requires BUILD_ID; a partial .next dir is not enough
[[ -f "$ROOT/apps/admin-web/.next/BUILD_ID" ]] || needs_prepare=1
[[ -f "$ROOT/apps/customer-portal/.next/BUILD_ID" ]] || needs_prepare=1
[[ -f "$ROOT/apps/employee-portal/.next/BUILD_ID" ]] || needs_prepare=1

if [[ "$needs_prepare" -eq 1 ]]; then
  echo "==> Builds missing — running prepare:launch"
  bash "$ROOT/scripts/prepare-launch.sh"
else
  echo "==> Builds present — skipping full prepare"
fi

bash "$ROOT/scripts/start-all.sh"
