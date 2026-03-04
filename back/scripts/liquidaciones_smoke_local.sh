#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:8001}" \
LOGIN_EMAIL="${LOGIN_EMAIL:-morellfrancisco@gmail.com}" \
LOGIN_PASSWORD="${LOGIN_PASSWORD:-Pancho17}" \
PUBLISH_REAL="${PUBLISH_REAL:-false}" \
"$(dirname "$0")/liquidaciones_sandbox_smoke.sh"
