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

mkdir -p "$SYSTEMD_USER_DIR" "$BIN_DIR"
chmod +x "$REPO_DIR/scripts/piwebmo-service-wrapper.sh" "$REPO_DIR/scripts/piwebmo-control.sh"

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Pi Web Mobile dev service
After=network.target

[Service]
Type=simple
WorkingDirectory=$REPO_DIR
Environment=PIWEBMO_NPM_BIN=$NPM_BIN
Environment=PIWEBMO_PORT=$PORT
Environment=PIWEBMO_HOST=$HOST
Environment=PIWEBMO_TAILSCALE_HOST=$TAILSCALE_HOST
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
echo "- Commands: $BIN_DIR/piwebmo and $BIN_DIR/piwebmon"
echo "- URL: http://$TAILSCALE_HOST:$PORT"
echo ""
echo "Usage:"
echo "  cd /some/project && piwebmo"
