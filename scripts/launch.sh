#!/usr/bin/env bash
# One-shot: ensure builds exist, then start the web/API stack.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin:$PATH"

needs_prepare=0
[[ -f "$ROOT/apps/api/dist/main.js" ]] || needs_prepare=1
[[ -d "$ROOT/apps/admin-web/.next" ]] || needs_prepare=1
[[ -d "$ROOT/apps/customer-portal/.next" ]] || needs_prepare=1
[[ -d "$ROOT/apps/employee-portal/.next" ]] || needs_prepare=1

if [[ "$needs_prepare" -eq 1 ]]; then
  echo "==> Builds missing — running prepare:launch"
  bash "$ROOT/scripts/prepare-launch.sh"
else
  echo "==> Builds present — skipping full prepare"
  # Ensure mobile env exists without pinning the API host (phone derives LAN from Metro)
  if [[ ! -f "$ROOT/apps/mobile/.env" ]]; then
    mkdir -p "$ROOT/apps/mobile"
    printf 'EXPO_PUBLIC_ENVIRONMENT=local\n' > "$ROOT/apps/mobile/.env"
  fi
fi

bash "$ROOT/scripts/start-all.sh"

echo ""
echo "==> Mobile (separate Metro process)"
echo "  pnpm mobile:start"
echo "  Scan the QR with Expo Go (SDK 54). Phone and Mac must share Wi-Fi."
echo "  Docs: docs/mobile-local-development.md"
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
if [[ -n "${LAN_IP:-}" ]]; then
  echo "  Derived phone API host: http://${LAN_IP}:4000 (no .env edit needed)"
fi
