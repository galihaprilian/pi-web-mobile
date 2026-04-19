#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="pi-web-mobile.service"
STATE_FILE="${HOME}/.config/pi-web-mobile/runtime-state.json"
TAILSCALE_HOST="${PIWEBMO_TAILSCALE_HOST:-work01.tucuxi-dace.ts.net}"
DEFAULT_PORT="${PIWEBMO_PORT:-5173}"

echo "=== systemd status ==="
systemctl --user --no-pager --lines=12 status "$SERVICE_NAME" || true

echo
if [[ -f "$STATE_FILE" ]]; then
  echo "=== runtime state ==="
  cat "$STATE_FILE"
  echo
  port="$(python3 - <<'PY' "$STATE_FILE"
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    data = json.load(f)
print(data.get('servicePort', ''))
PY
)"
  runtime_mode="$(python3 - <<'PY' "$STATE_FILE"
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    data = json.load(f)
print(data.get('runtimeMode', ''))
PY
)"
  port="${port:-$DEFAULT_PORT}"
  echo "URL: http://${TAILSCALE_HOST}:${port}"
  echo "Runtime mode: ${runtime_mode:-unknown}"
else
  echo "Runtime state file not found: $STATE_FILE"
fi
