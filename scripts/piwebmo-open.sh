#!/usr/bin/env bash
set -euo pipefail

STATE_FILE="${HOME}/.config/pi-web-mobile/runtime-state.json"
TAILSCALE_HOST="${PIWEBMO_TAILSCALE_HOST:-work01.tucuxi-dace.ts.net}"
DEFAULT_PORT="${PIWEBMO_PORT:-5173}"
TARGET="tailscale"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local)
      TARGET="local"
      shift
      ;;
    --tailscale)
      TARGET="tailscale"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: piwebmo-open [--local|--tailscale]"
      exit 1
      ;;
  esac
done

port="$DEFAULT_PORT"
if [[ -f "$STATE_FILE" ]]; then
  detected_port="$(python3 - <<'PY' "$STATE_FILE"
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    data = json.load(f)
print(data.get('servicePort', ''))
PY
)"
  port="${detected_port:-$DEFAULT_PORT}"
fi

host="$TAILSCALE_HOST"
if [[ "$TARGET" == "local" ]]; then
  host="localhost"
fi

url="http://${host}:${port}"
echo "Opening: $url"

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$url" >/dev/null 2>&1 &
  exit 0
fi

if command -v gio >/dev/null 2>&1; then
  gio open "$url" >/dev/null 2>&1 &
  exit 0
fi

python3 -m webbrowser "$url" >/dev/null 2>&1 || true
