#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="pi-web-mobile.service"
STATE_FILE="${HOME}/.config/pi-web-mobile/runtime-state.json"
TAILSCALE_HOST="${PIWEBMO_TAILSCALE_HOST:-work01.tucuxi-dace.ts.net}"
DEFAULT_PORT="${PIWEBMO_PORT:-5173}"
JSON_MODE="false"
WATCH_MODE="false"
WATCH_INTERVAL="2"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --json)
      JSON_MODE="true"
      shift
      ;;
    --watch)
      WATCH_MODE="true"
      shift
      ;;
    --interval)
      WATCH_INTERVAL="${2:-2}"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: piwebmo-status [--json] [--watch] [--interval <seconds>]"
      exit 1
      ;;
  esac
done

if [[ "$JSON_MODE" == "true" && "$WATCH_MODE" == "true" ]]; then
  echo "--json and --watch cannot be used together"
  exit 1
fi

render_once() {
  local runtime_json="{}"
  local port="$DEFAULT_PORT"
  local runtime_mode="unknown"
  local launch_mode="unknown"

  if [[ -f "$STATE_FILE" ]]; then
    runtime_json="$(cat "$STATE_FILE")"
    port="$(python3 - <<'PY' "$STATE_FILE" "$DEFAULT_PORT"
import json, sys
state_file, default_port = sys.argv[1], sys.argv[2]
with open(state_file, 'r', encoding='utf-8') as f:
    data = json.load(f)
print(data.get('servicePort') or default_port)
PY
)"
    runtime_mode="$(python3 - <<'PY' "$STATE_FILE"
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    data = json.load(f)
print(data.get('runtimeMode', 'unknown'))
PY
)"
    launch_mode="$(python3 - <<'PY' "$STATE_FILE"
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    data = json.load(f)
print(data.get('launchMode', 'unknown'))
PY
)"
  fi

  local url="http://${TAILSCALE_HOST}:${port}"
  local health_url="http://localhost:${port}/api/health"
  local active_state
  local enabled_state
  local health_json
  local health_ok="false"

  active_state="$(systemctl --user is-active "$SERVICE_NAME" 2>/dev/null || true)"
  enabled_state="$(systemctl --user is-enabled "$SERVICE_NAME" 2>/dev/null || true)"
  health_json="$(curl -fsS "$health_url" 2>/dev/null || true)"
  if [[ -n "$health_json" ]]; then
    health_ok="true"
  fi

  if [[ "$JSON_MODE" == "true" ]]; then
    python3 - <<'PY' "$SERVICE_NAME" "$active_state" "$enabled_state" "$url" "$health_url" "$health_ok" "$runtime_mode" "$launch_mode" "$port" "$runtime_json" "$health_json"
import json, sys
(
    service_name,
    active,
    enabled,
    url,
    health_url,
    health_ok,
    runtime_mode,
    launch_mode,
    port,
    runtime_json,
    health_json,
) = sys.argv[1:12]

runtime_state = {}
if runtime_json.strip():
    try:
        runtime_state = json.loads(runtime_json)
    except Exception:
        runtime_state = {"raw": runtime_json}

health_state = None
if health_json.strip():
    try:
        health_state = json.loads(health_json)
    except Exception:
        health_state = {"raw": health_json}

result = {
    "service": {
        "name": service_name,
        "active": active,
        "enabled": enabled,
    },
    "runtime": {
        "mode": runtime_mode,
        "launchMode": launch_mode,
        "port": int(port),
        "state": runtime_state,
    },
    "urls": {
        "app": url,
        "health": health_url,
    },
    "health": {
        "ok": health_ok.lower() == "true",
        "response": health_state,
    },
}
print(json.dumps(result, indent=2))
PY
    return 0
  fi

  echo "=== systemd status ==="
  systemctl --user --no-pager --lines=12 status "$SERVICE_NAME" || true

  echo
  echo "=== runtime state ==="
  if [[ -f "$STATE_FILE" ]]; then
    cat "$STATE_FILE"
  else
    echo "Runtime state file not found: $STATE_FILE"
  fi

  echo
  echo "URL: $url"
  echo "Runtime mode: $runtime_mode"
  echo "Launch mode: $launch_mode"
  if [[ "$health_ok" == "true" ]]; then
    echo "Health: OK ($health_url)"
  else
    echo "Health: UNREACHABLE ($health_url)"
  fi
}

if [[ "$WATCH_MODE" == "true" ]]; then
  while true; do
    clear || true
    echo "piwebmo-status --watch (interval: ${WATCH_INTERVAL}s)"
    echo "$(date)"
    echo
    render_once
    sleep "$WATCH_INTERVAL"
  done
fi

render_once
