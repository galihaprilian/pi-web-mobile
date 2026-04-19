#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_DIR="${HOME}/.config/pi-web-mobile"
COMMAND_STATE_FILE="${STATE_DIR}/command-state.json"
RUNTIME_STATE_FILE="${STATE_DIR}/runtime-state.json"
PORT="${PIWEBMO_PORT:-5173}"
HOST="${PIWEBMO_HOST:-0.0.0.0}"
NPM_BIN="${PIWEBMO_NPM_BIN:-$(command -v npm)}"
RUNTIME_MODE="${PIWEBMO_RUNTIME_MODE:-preview}"

mkdir -p "$STATE_DIR"

if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
fi

startup_id="$(date +%s)-$RANDOM"
default_project=""
require_project_selection="true"
launch_mode="service"

if [[ -f "$COMMAND_STATE_FILE" ]]; then
  python3 - <<'PY' "$COMMAND_STATE_FILE" "$RUNTIME_STATE_FILE" "$startup_id" "$RUNTIME_MODE" "$PORT"
import json, sys
command_path, runtime_path, startup_id, runtime_mode, service_port = sys.argv[1:6]
with open(command_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
runtime = {
    'startupId': startup_id,
    'defaultProjectPath': data.get('defaultProjectPath', ''),
    'requireProjectSelection': bool(data.get('requireProjectSelection', False)),
    'launchMode': data.get('launchMode', 'command'),
    'sourceCwd': data.get('sourceCwd', ''),
    'runtimeMode': runtime_mode,
    'servicePort': int(service_port),
}
with open(runtime_path, 'w', encoding='utf-8') as f:
    json.dump(runtime, f, indent=2)
PY
  rm -f "$COMMAND_STATE_FILE"
else
  cat > "$RUNTIME_STATE_FILE" <<EOF
{
  "startupId": "$startup_id",
  "defaultProjectPath": "",
  "requireProjectSelection": true,
  "launchMode": "service",
  "sourceCwd": "",
  "runtimeMode": "$RUNTIME_MODE",
  "servicePort": $PORT
}
EOF
fi

if [[ "$RUNTIME_MODE" == "preview" ]]; then
  "$NPM_BIN" run build
  exec "$NPM_BIN" run preview -- --host "$HOST" --port "$PORT" --strictPort
fi

exec "$NPM_BIN" run dev -- --host "$HOST" --port "$PORT" --strictPort
