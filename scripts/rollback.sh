#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
PUBLIC_HEALTH_URL="https://clouddrop-c8.duckdns.org/health"

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <backend-image-tag> <frontend-image-tag>"
  exit 1
fi

# Accept Docker-compatible tag characters and reject malformed input.
validate_tag() {
  local tag="$1"
  local name="$2"

  if [[ ! "$tag" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]]; then
    echo "ERROR: Invalid ${name} image tag: ${tag}" >&2
    return 1
  fi
}

validate_tag "$1" "backend"
validate_tag "$2" "frontend"

BACKEND_IMAGE="ghcr.io/omoniyiifeabraham/clouddrop-backend:$1"
FRONTEND_IMAGE="ghcr.io/omoniyiifeabraham/clouddrop-frontend:$2"

echo "Pulling both rollback images before changing services..."
docker pull "$BACKEND_IMAGE"
docker pull "$FRONTEND_IMAGE"

export BACKEND_IMAGE FRONTEND_IMAGE

echo "Checking Nginx configuration..."
docker compose -f "$COMPOSE_FILE" run --rm --no-deps nginx nginx -t

echo "Applying rollback image pair..."
docker compose -f "$COMPOSE_FILE" up -d backend frontend

wait_healthy() {
  local container="$1"
  local status=""
  for _ in $(seq 1 24); do
    status=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$container" 2>/dev/null || true)
    if [ "$status" = "healthy" ]; then
      echo "$container is healthy."
      return 0
    fi
    echo "$container health: ${status:-unknown}"
    sleep 5
  done
  echo "ERROR: $container did not become healthy."
  docker compose -f "$COMPOSE_FILE" logs --tail=100 "${container#clouddrop-}" || true
  return 1
}

wait_healthy clouddrop-backend
wait_healthy clouddrop-frontend

echo "Restarting Nginx..."
docker compose -f "$COMPOSE_FILE" restart nginx

NGINX_STATUS=$(docker inspect --format='{{.State.Status}}' clouddrop-nginx 2>/dev/null || true)
if [ "$NGINX_STATUS" != "running" ]; then
  echo "ERROR: Nginx is not running."
  exit 1
fi

ACTUAL_BACKEND=$(docker inspect --format='{{.Config.Image}}' clouddrop-backend)
ACTUAL_FRONTEND=$(docker inspect --format='{{.Config.Image}}' clouddrop-frontend)

if [ "$ACTUAL_BACKEND" != "$BACKEND_IMAGE" ]; then
  echo "ERROR: Backend image mismatch: $ACTUAL_BACKEND"
  exit 1
fi
if [ "$ACTUAL_FRONTEND" != "$FRONTEND_IMAGE" ]; then
  echo "ERROR: Frontend image mismatch: $ACTUAL_FRONTEND"
  exit 1
fi

HTTP_STATUS=$(curl --silent --show-error --max-time 15 \
  --output /dev/null --write-out '%{http_code}' "$PUBLIC_HEALTH_URL") || {
    echo "ERROR: Could not reach $PUBLIC_HEALTH_URL"
    exit 1
  }

if [ "$HTTP_STATUS" != "200" ]; then
  echo "ERROR: Public health endpoint returned HTTP $HTTP_STATUS."
  exit 1
fi

echo "Rollback verification successful."
echo "Backend image: $ACTUAL_BACKEND"
echo "Frontend image: $ACTUAL_FRONTEND"
echo "Public health endpoint: HTTP 200"
