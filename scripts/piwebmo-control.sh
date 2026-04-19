#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_DIR="${HOME}/.config/pi-web-mobile"
COMMAND_STATE_FILE="${STATE_DIR}/command-state.json"
SERVICE_NAME="pi-web-mobile.service"
TAILSCALE_HOST="${PIWEBMO_TAILSCALE_HOST:-work01.tucuxi-dace.ts.net}"
PORT="${PIWEBMO_PORT:-5173}"
CURRENT_CWD="$(pwd)"
HOME_DIR="${HOME}"

mkdir -p "$STATE_DIR"

require_project_selection="false"
default_project_path=""

if [[ "$CURRENT_CWD" == "$HOME_DIR" ]]; then
  default_project_path=""
elif [[ "$CURRENT_CWD" == "$HOME_DIR/"* ]]; then
  default_project_path="${CURRENT_CWD#"$HOME_DIR/"}"
else
  require_project_selection="true"
fi

python3 - <<'PY' "$COMMAND_STATE_FILE" "$default_project_path" "$require_project_selection" "$CURRENT_CWD"
import json, sys
path, default_project_path, require_project_selection, cwd = sys.argv[1:5]
data = {
    'defaultProjectPath': default_project_path,
    'requireProjectSelection': require_project_selection.lower() == 'true',
    'launchMode': 'command',
    'sourceCwd': cwd,
}
with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)
PY

systemctl --user daemon-reload
systemctl --user restart "$SERVICE_NAME" || systemctl --user start "$SERVICE_NAME"

echo "Pi Web Mobile service restarted."
if [[ "$require_project_selection" == "true" ]]; then
  echo "Current directory is outside HOME, app will ask for project selection on first open."
else
  echo "Default project: ${default_project_path:-~}"
fi

echo "Open: http://${TAILSCALE_HOST}:${PORT}"
