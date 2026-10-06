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
    echo "Rollback successful. Backend is healthy."
    exit 0
  fi

  echo "Backend status: ${STATUS:-starting}"
  sleep 5
done

echo "Rollback failed. Backend did not become healthy."
docker compose -f docker-compose.prod.yml logs --tail=100 backend
exit 1

