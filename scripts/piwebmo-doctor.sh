#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="pi-web-mobile.service"
STATE_FILE="${HOME}/.config/pi-web-mobile/runtime-state.json"
SERVICE_FILE="${HOME}/.config/systemd/user/pi-web-mobile.service"
TAILSCALE_HOST="${PIWEBMO_TAILSCALE_HOST:-work01.tucuxi-dace.ts.net}"
DEFAULT_PORT="${PIWEBMO_PORT:-5173}"

pass_count=0
warn_count=0
fail_count=0

pass() {
  pass_count=$((pass_count + 1))
  echo "[PASS] $1"
}

warn() {
  warn_count=$((warn_count + 1))
  echo "[WARN] $1"
}

fail() {
  fail_count=$((fail_count + 1))
  echo "[FAIL] $1"
}

echo "== Pi Web Mobile Doctor =="

if command -v systemctl >/dev/null 2>&1; then
  pass "systemctl tersedia"
else
  fail "systemctl tidak tersedia"
fi

if systemctl --user show-environment >/dev/null 2>&1; then
  pass "systemd user session aktif"
else
  fail "systemd user session tidak aktif"
fi

if [[ -f "$SERVICE_FILE" ]]; then
  pass "service file ditemukan: $SERVICE_FILE"
else
  fail "service file tidak ditemukan: $SERVICE_FILE"
fi

active_state="$(systemctl --user is-active "$SERVICE_NAME" 2>/dev/null || true)"
if [[ "$active_state" == "active" ]]; then
  pass "service aktif"
else
  fail "service tidak aktif (state: ${active_state:-unknown})"
fi

enabled_state="$(systemctl --user is-enabled "$SERVICE_NAME" 2>/dev/null || true)"
if [[ "$enabled_state" == "enabled" ]]; then
  pass "service enabled"
else
  warn "service belum enabled (state: ${enabled_state:-unknown})"
fi

if command -v loginctl >/dev/null 2>&1; then
  linger_state="$(loginctl show-user "$USER" -p Linger --value 2>/dev/null || true)"
  if [[ "$linger_state" == "yes" ]]; then
    pass "linger aktif untuk user $USER"
  else
    warn "linger belum aktif (jalankan: sudo loginctl enable-linger $USER)"
  fi
else
  warn "loginctl tidak tersedia, skip cek linger"
fi

if [[ ":$PATH:" == *":$HOME/.local/bin:"* ]]; then
  pass "~/.local/bin ada di PATH"
else
  warn "~/.local/bin tidak ada di PATH"
fi

for cmd in piwebmo piwebmon piwebmo-status piwebmo-stop piwebmo-open; do
  if command -v "$cmd" >/dev/null 2>&1; then
    pass "command tersedia: $cmd"
  else
    fail "command tidak ditemukan: $cmd"
  fi
done

port="$DEFAULT_PORT"
if [[ -f "$STATE_FILE" ]]; then
  if python3 - <<'PY' "$STATE_FILE" >/dev/null 2>&1
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    json.load(f)
PY
  then
    pass "runtime state valid JSON"
    port="$(python3 - <<'PY' "$STATE_FILE" "$DEFAULT_PORT"
import json, sys
state_file, default_port = sys.argv[1], sys.argv[2]
with open(state_file, 'r', encoding='utf-8') as f:
    data = json.load(f)
print(data.get('servicePort') or default_port)
PY
)"
  else
    fail "runtime state invalid JSON: $STATE_FILE"
  fi
else
  warn "runtime state file belum ada: $STATE_FILE"
fi

if command -v ss >/dev/null 2>&1; then
  if ss -ltn 2>/dev/null | awk '{print $4}' | grep -q ":${port}$"; then
    pass "port listen terdeteksi: $port"
  else
    warn "port belum listen: $port"
  fi
else
  warn "ss command tidak tersedia, skip cek port"
fi

health_url="http://localhost:${port}/api/health"
health_json=""
for _ in $(seq 1 10); do
  if health_json="$(curl -fsS "$health_url" 2>/dev/null)"; then
    break
  fi
  sleep 1
done

if [[ -n "$health_json" ]]; then
  pass "health endpoint OK: $health_url"
else
  fail "health endpoint gagal: $health_url"
fi

if [[ -n "$health_json" ]]; then
  echo
  echo "Health response:"
  echo "$health_json"
fi

echo
echo "App URL (tailscale): http://${TAILSCALE_HOST}:${port}"

echo
echo "Summary: PASS=$pass_count WARN=$warn_count FAIL=$fail_count"
if [[ "$fail_count" -gt 0 ]]; then
  exit 1
fi
