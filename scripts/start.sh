#!/usr/bin/env bash
set -euo pipefail

INTEL_PORT="${INTEL_DASHBOARD_PORT:-9001}"
INTEL_BASEPATH="${INTEL_DASHBOARD_BASEPATH:-intel-dashboard}"

intel-dashboard \
  --server.port "${INTEL_PORT}" \
  --server.address "0.0.0.0" \
  --server.baseUrlPath "${INTEL_BASEPATH#'/'}" \
  --server.headless true \
  --server.enableCORS false \
  --server.enableXsrfProtection false &

node server/index.js
