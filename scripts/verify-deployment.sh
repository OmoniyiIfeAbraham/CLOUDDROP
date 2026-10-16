#!/usr/bin/env bash
set -euo pipefail

PUBLIC_HEALTH_URL="https://clouddrop-c8.duckdns.org/health"

echo "Checking CloudDrop deployment..."
echo

check_container() {
  local name="$1"
  local status health

  status=$(docker inspect --format='{{.State.Status}}' "$name" 2>/dev/null || true)
  if [ "$status" != "running" ]; then
    echo "ERROR: $name is not running (status: ${status:-unknown})."
    return 1
  fi

  health=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$name" 2>/dev/null || true)
  if [ "$health" != "healthy" ]; then
    echo "ERROR: $name is not healthy (health: ${health:-unknown})."
    return 1
  fi

  echo "$name is running and healthy."
}

check_image() {
  local container="$1"
  local expected="${2:-}"
  local actual

  actual=$(docker inspect --format='{{.Config.Image}}' "$container" 2>/dev/null || true)
  if [ -z "$actual" ]; then
    echo "ERROR: Cannot determine image for $container."
    return 1
  fi

  echo "$container image: $actual"

  if [ -n "$expected" ] && [ "$actual" != "$expected" ]; then
    echo "ERROR: $container image does not match the expected image."
    echo "Expected: $expected"
    echo "Actual:   $actual"
    return 1
  fi
}

echo "=== Backend ==="
check_container clouddrop-backend
check_image clouddrop-backend "${BACKEND_IMAGE:-}"

echo
echo "=== Frontend ==="
check_container clouddrop-frontend
check_image clouddrop-frontend "${FRONTEND_IMAGE:-}"

echo
echo "=== Nginx ==="
NGINX_STATUS=$(docker inspect --format='{{.State.Status}}' clouddrop-nginx 2>/dev/null || true)
if [ "$NGINX_STATUS" != "running" ]; then
  echo "ERROR: Nginx is not running (status: ${NGINX_STATUS:-unknown})."
  exit 1
fi
echo "Nginx is running."

echo
echo "=== Public HTTPS health endpoint ==="
HTTP_STATUS=$(curl --silent --show-error --max-time 15 \
  --output /dev/null --write-out '%{http_code}' \
  "$PUBLIC_HEALTH_URL") || {
    echo "ERROR: Could not reach $PUBLIC_HEALTH_URL"
    exit 1
  }

if [ "$HTTP_STATUS" != "200" ]; then
  echo "ERROR: Public health endpoint returned HTTP $HTTP_STATUS."
  exit 1
fi

echo "Public health endpoint returned HTTP 200."
echo
echo "CloudDrop deployment verification successful."

if [ -n "${BACKEND_IMAGE:-}" ]; then
  echo "Verified backend image: $BACKEND_IMAGE"
fi
if [ -n "${FRONTEND_IMAGE:-}" ]; then
  echo "Verified frontend image: $FRONTEND_IMAGE"
fi
