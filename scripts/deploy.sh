#!/bin/bash

set -e

echo "Starting CloudDrop deployment..."

IMAGE="${BACKEND_IMAGE:-ghcr.io/omoniyiifeabraham/clouddrop-backend:latest}"

echo "Deployment image: ${IMAGE}"

echo "Pulling backend image..."
docker pull "$IMAGE"

echo "Starting backend and Nginx..."

export BACKEND_IMAGE="$IMAGE"

docker compose -f docker-compose.prod.yml up -d backend nginx

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
  echo "Backend failed health check."
  echo
  echo "Backend logs:"
  docker compose -f docker-compose.prod.yml logs --tail=100 backend
  exit 1
fi

echo "Checking Nginx..."

NGINX_STATUS=$(docker inspect --format='{{.State.Status}}' clouddrop-nginx 2>/dev/null || true)

if [ "$NGINX_STATUS" != "running" ]; then
  echo "Nginx failed to start."
  echo
  echo "Nginx logs:"
  docker compose -f docker-compose.prod.yml logs --tail=100 nginx
  exit 1
fi

echo "Nginx is running."

echo
echo "CloudDrop deployment completed successfully."
echo "Deployed image: ${IMAGE}"
