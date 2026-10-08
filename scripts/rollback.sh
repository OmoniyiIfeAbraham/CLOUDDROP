#!/bin/bash

set -e

if [ -z "$1" ]; then
  echo "Usage: ./scripts/rollback.sh <image-tag>"
  echo "Example: ./scripts/rollback.sh abc123456"
  exit 1
fi

IMAGE_TAG="$1"
IMAGE="ghcr.io/omoniyiifeabraham/clouddrop-backend:${IMAGE_TAG}"

echo "Starting CloudDrop rollback..."
echo "Target image: ${IMAGE}"

echo "Pulling rollback image..."
docker pull "$IMAGE"

echo "Updating backend image..."
export BACKEND_IMAGE="$IMAGE"

echo "Restarting backend..."
docker compose -f docker-compose.prod.yml up -d backend

echo "Waiting for backend health check..."

for i in {1..12}; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' clouddrop-backend 2>/dev/null || true)

  if [ "$STATUS" = "healthy" ]; then
    echo "Backend is healthy."
    break
  fi

  echo "Backend status: ${STATUS:-starting}"
  sleep 5
done

FINAL_STATUS=$(docker inspect --format='{{.State.Health.Status}}' clouddrop-backend 2>/dev/null || true)

if [ "$FINAL_STATUS" != "healthy" ]; then
  echo "Rollback failed. Backend did not become healthy."
  docker compose -f docker-compose.prod.yml logs --tail=100 backend
  exit 1
fi

echo "Checking Nginx..."

NGINX_STATUS=$(docker inspect --format='{{.State.Status}}' clouddrop-nginx 2>/dev/null || true)

if [ "$NGINX_STATUS" != "running" ]; then
  echo "ERROR: Nginx is not running."
  exit 1
fi

echo "Nginx is running."

echo "Checking public health endpoint..."

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health || true)

if [ "$HTTP_STATUS" != "200" ]; then
  echo "ERROR: Health endpoint returned HTTP ${HTTP_STATUS:-unknown}."
  exit 1
fi

echo "Health endpoint returned HTTP 200."

echo
echo "CloudDrop rollback completed successfully."
echo "Rolled back to: ${IMAGE}"
