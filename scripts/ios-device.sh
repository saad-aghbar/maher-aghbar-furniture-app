#!/usr/bin/env bash
# Build, install, and launch the mobile app on a physical iPhone/iPad.
#
# Replaces `expo run:ios --device`, which aborts on Xcode 26+ because it probes
# for Contents/Developer/Applications/Simulator.app — removed in favour of DeviceHub.
# Drives xcodebuild + devicectl directly instead.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin:${PATH:-}"
unset CI CONTINUOUS_INTEGRATION || true

IOS_DIR="$ROOT/apps/mobile/ios"
CONFIGURATION="Debug"
METRO_PORT=8081
UDID="${IOS_DEVICE_UDID:-}"
HOST_IP="${METRO_HOST:-}"
LAUNCH=1

die() { echo "ERROR: $*" >&2; exit 1; }
step() { echo; echo "==> $*"; }

usage() {
  cat <<'EOF'
Usage: scripts/ios-device.sh [options]

  --udid <UDID>   Target device. Defaults to the only connected physical device.
  --host <IP>     Metro host. Defaults to this Mac's LAN IP.
  --release       Build Release instead of Debug (no Metro needed).
  --no-launch     Build and install, but do not launch.
  -h, --help      Show this help.

Env: IOS_DEVICE_UDID, METRO_HOST
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --udid) UDID="${2:-}"; shift 2 ;;
    --host) HOST_IP="${2:-}"; shift 2 ;;
    --release) CONFIGURATION="Release"; shift ;;
    --no-launch) LAUNCH=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown option: $1 (try --help)" ;;
  esac
done

command -v xcrun >/dev/null 2>&1 || die "xcrun not found. Install Xcode."
[[ -d "$IOS_DIR" ]] || die "No native project at $IOS_DIR. Run: pnpm --filter @maher/mobile exec expo prebuild -p ios"

# ---------------------------------------------------------------- device

step "Locating device"
DEVICES_JSON="$(mktemp -t maher-devices)"
trap 'rm -f "$DEVICES_JSON"' EXIT
xcrun devicectl list devices --json-output "$DEVICES_JSON" >/dev/null 2>&1 ||
  die "devicectl could not list devices."

# Physical devices only: simulators report transportType "sameMachine".
DEVICE_LINE="$(node -e '
const fs = require("fs");
const [file, wanted] = process.argv.slice(1);
const devices = JSON.parse(fs.readFileSync(file, "utf8")).result.devices || [];
const physical = devices.filter((d) => {
  const transport = d.connectionProperties?.transportType;
  return transport && transport !== "sameMachine";
});
// Prefer devices with a live tunnel; fall back to merely-reachable ones.
const live = physical.filter((d) => d.connectionProperties?.tunnelState === "connected");
const reachable = physical.filter((d) => d.connectionProperties?.tunnelState !== "unavailable");
const pool = wanted
  ? physical.filter((d) => d.hardwareProperties?.udid === wanted)
  : (live.length ? live : reachable);

if (!pool.length) {
  const known = physical
    .map((d) => `  ${d.deviceProperties?.name} (${d.hardwareProperties?.udid})`)
    .join("\n");
  console.log(`__NONE__\n${known}`);
  process.exit(0);
}
if (pool.length > 1) {
  const list = pool
    .map((d) => `  --udid ${d.hardwareProperties?.udid}   ${d.deviceProperties?.name}`)
    .join("\n");
  console.log(`__MANY__\n${list}`);
  process.exit(0);
}
const d = pool[0];
console.log([
  d.hardwareProperties?.udid,
  d.deviceProperties?.name,
  d.deviceProperties?.developerModeStatus || "unknown",
  d.connectionProperties?.tunnelState || "unknown",
].join("\t"));
' "$DEVICES_JSON" "$UDID")"

case "$DEVICE_LINE" in
  __NONE__*)
    echo "${DEVICE_LINE#__NONE__}" >&2
    die "No connected physical device. Plug it in, unlock it, and tap Trust."
    ;;
  __MANY__*)
    echo "Several devices are connected. Pick one:" >&2
    echo "${DEVICE_LINE#__MANY__}" >&2
    die "Re-run with --udid."
    ;;
esac

IFS=$'\t' read -r UDID DEVICE_NAME DEV_MODE TUNNEL <<<"$DEVICE_LINE"
echo "  $DEVICE_NAME"
echo "  udid $UDID  ·  developer mode $DEV_MODE  ·  $TUNNEL"

if [[ "$DEV_MODE" != "enabled" ]]; then
  cat >&2 <<EOF

Developer Mode is off on "$DEVICE_NAME".

  Settings > Privacy & Security > Developer Mode > on, then Restart.

If that row is missing, force-quit Settings and reopen it — iOS injects the row
when the Mac initiates pairing and will not refresh an already-open Settings view.
EOF
  exit 1
fi

# ---------------------------------------------------------------- metro host

if [[ -z "$HOST_IP" ]]; then
  HOST_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
fi
[[ -n "$HOST_IP" ]] || die "No LAN IP found. Connect to Wi-Fi or pass --host <ip>."

if [[ "$CONFIGURATION" == "Debug" ]]; then
  if curl -fsS -m 3 "http://$HOST_IP:$METRO_PORT/status" >/dev/null 2>&1; then
    echo "  metro OK at http://$HOST_IP:$METRO_PORT"
  else
    echo "  WARNING: Metro is not answering on http://$HOST_IP:$METRO_PORT" >&2
    echo "           Start it with /start, or the app will open to the dev launcher." >&2
  fi
fi

# ---------------------------------------------------------------- build

cd "$IOS_DIR"

WORKSPACE="$(find . -maxdepth 1 -name '*.xcworkspace' -not -name 'project.xcworkspace' | head -1)"
[[ -n "$WORKSPACE" ]] || die "No .xcworkspace in $IOS_DIR. Run pod install."
WORKSPACE="${WORKSPACE#./}"
SCHEME="${WORKSPACE%.xcworkspace}"

if [[ -f Podfile.lock && -f Pods/Manifest.lock ]] && ! diff -q Podfile.lock Pods/Manifest.lock >/dev/null 2>&1; then
  echo "  pods out of sync — running pod install"
  pod install >/dev/null || die "pod install failed."
fi

step "Building $SCHEME ($CONFIGURATION) for $DEVICE_NAME"
BUILD_LOG="$ROOT/logs/ios-device-build.log"
mkdir -p "$ROOT/logs"
echo "  log: $BUILD_LOG"

if ! xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -destination "id=$UDID" \
  -derivedDataPath build \
  -allowProvisioningUpdates \
  build >"$BUILD_LOG" 2>&1; then
  echo >&2
  echo "Build failed. Last errors:" >&2
  grep -E "error:|Signing for|requires a provisioning profile" "$BUILD_LOG" | tail -20 >&2 ||
    tail -40 "$BUILD_LOG" >&2
  die "See $BUILD_LOG"
fi

APP="$(find "build/Build/Products/$CONFIGURATION-iphoneos" -maxdepth 1 -name '*.app' | head -1)"
[[ -n "$APP" ]] || die "No .app produced under build/Build/Products/$CONFIGURATION-iphoneos"
APP="$IOS_DIR/${APP#./}"
echo "  built $(basename "$APP")"

# Read identity from the built bundle so a prebuild rename cannot desync this.
PLIST="$APP/Info.plist"
BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$PLIST")"
URL_SCHEME="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleURLTypes:0:CFBundleURLSchemes:0' "$PLIST" 2>/dev/null || true)"
echo "  bundle $BUNDLE_ID"

# ---------------------------------------------------------------- install

step "Installing to $DEVICE_NAME"
xcrun devicectl device install app --device "$UDID" "$APP" >/dev/null ||
  die "Install failed."
echo "  installed"

[[ "$LAUNCH" == "1" ]] || { echo; echo "Done (skipped launch)."; exit 0; }

# ---------------------------------------------------------------- launch

step "Launching"
LAUNCH_ARGS=(--device "$UDID" --terminate-existing)
if [[ "$CONFIGURATION" == "Debug" && -n "$URL_SCHEME" ]]; then
  LAUNCH_ARGS+=(--payload-url "$URL_SCHEME://expo-development-client/?url=http%3A%2F%2F$HOST_IP%3A$METRO_PORT")
fi

TRUST_HINT_SHOWN=0
for attempt in $(seq 1 40); do
  OUT="$(xcrun devicectl device process launch "${LAUNCH_ARGS[@]}" "$BUNDLE_ID" 2>&1 || true)"

  if grep -qi "Launched application" <<<"$OUT"; then
    echo "  launched on $DEVICE_NAME"
    echo
    echo "Metro: http://$HOST_IP:$METRO_PORT"
    echo "API:   http://$HOST_IP:4000/api/v1"
    exit 0
  fi

  if grep -qi "not been explicitly trusted" <<<"$OUT"; then
    if [[ "$TRUST_HINT_SHOWN" == "0" ]]; then
      cat <<EOF

The signing certificate is not trusted yet on this device.

  Settings > General > VPN & Device Management > Developer App > Trust

Waiting for you to tap Trust…
EOF
      TRUST_HINT_SHOWN=1
    fi
    sleep 8
    continue
  fi

  echo "$OUT" >&2
  die "Launch failed."
done

die "Timed out waiting for the certificate to be trusted."
