#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SYSTEMD_USER_DIR="${HOME}/.config/systemd/user"
BIN_DIR="${HOME}/.local/bin"
SERVICE_FILE="${SYSTEMD_USER_DIR}/pi-web-mobile.service"
NPM_BIN="$(command -v npm)"
NODE_PATH_DIR="$(dirname "$NPM_BIN")"
PORT="${PIWEBMO_PORT:-5173}"
HOST="${PIWEBMO_HOST:-0.0.0.0}"
TAILSCALE_HOST="${PIWEBMO_TAILSCALE_HOST:-work01.tucuxi-dace.ts.net}"
RUNTIME_MODE="${PIWEBMO_RUNTIME_MODE:-preview}"

mkdir -p "$SYSTEMD_USER_DIR" "$BIN_DIR"
chmod +x \
  "$REPO_DIR/scripts/piwebmo-service-wrapper.sh" \
  "$REPO_DIR/scripts/piwebmo-control.sh" \
  "$REPO_DIR/scripts/piwebmo-stop.sh" \
  "$REPO_DIR/scripts/piwebmo-status.sh" \
  "$REPO_DIR/scripts/piwebmo-open.sh"

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Pi Web Mobile service
After=network.target

[Service]
Type=simple
WorkingDirectory=$REPO_DIR
Environment=PIWEBMO_NPM_BIN=$NPM_BIN
Environment=PIWEBMO_PORT=$PORT
Environment=PIWEBMO_HOST=$HOST
Environment=PIWEBMO_TAILSCALE_HOST=$TAILSCALE_HOST
Environment=PIWEBMO_RUNTIME_MODE=$RUNTIME_MODE
Environment=PATH=$NODE_PATH_DIR:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=$REPO_DIR/scripts/piwebmo-service-wrapper.sh
Restart=always
RestartSec=2

[Install]
WantedBy=default.target
EOF

cat > "$BIN_DIR/piwebmo" <<EOF
#!/usr/bin/env bash
exec "$REPO_DIR/scripts/piwebmo-control.sh" "\$@"
EOF
chmod +x "$BIN_DIR/piwebmo"

cat > "$BIN_DIR/piwebmon" <<EOF
#!/usr/bin/env bash
exec "$REPO_DIR/scripts/piwebmo-control.sh" "\$@"
EOF
chmod +x "$BIN_DIR/piwebmon"

cat > "$BIN_DIR/piwebmo-stop" <<EOF
#!/usr/bin/env bash
exec "$REPO_DIR/scripts/piwebmo-stop.sh" "\$@"
EOF
chmod +x "$BIN_DIR/piwebmo-stop"

cat > "$BIN_DIR/piwebmo-status" <<EOF
#!/usr/bin/env bash
exec "$REPO_DIR/scripts/piwebmo-status.sh" "\$@"
EOF
chmod +x "$BIN_DIR/piwebmo-status"

cat > "$BIN_DIR/piwebmo-open" <<EOF
#!/usr/bin/env bash
exec "$REPO_DIR/scripts/piwebmo-open.sh" "\$@"
EOF
chmod +x "$BIN_DIR/piwebmo-open"

systemctl --user daemon-reload
systemctl --user enable pi-web-mobile.service >/dev/null
systemctl --user restart pi-web-mobile.service || systemctl --user start pi-web-mobile.service

if loginctl enable-linger "$USER" >/dev/null 2>&1; then
  echo "Enabled linger for $USER"
else
  echo "Could not enable linger automatically. If autostart is unreliable, run: sudo loginctl enable-linger $USER"
fi

echo "Installed:"
echo "- Service: $SERVICE_FILE"
echo "- Runtime mode: $RUNTIME_MODE"
echo "- Commands: $BIN_DIR/piwebmo, $BIN_DIR/piwebmon, $BIN_DIR/piwebmo-stop, $BIN_DIR/piwebmo-status, $BIN_DIR/piwebmo-open"
echo "- URL: http://$TAILSCALE_HOST:$PORT"
echo ""
echo "Usage:"
echo "  cd /some/project && piwebmo"
