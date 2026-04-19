#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="pi-web-mobile.service"

systemctl --user stop "$SERVICE_NAME"
echo "Stopped $SERVICE_NAME"
