#!/bin/bash

set -e

echo "Starting CloudDrop deployment..."

echo "Pulling latest backend image..."
docker compose pull backend

echo "Starting backend..."
docker compose up -d backend

echo "Waiting for backend health check..."

for i in {1..12}; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' clouddrop-backend 2>/dev/null || true)

  if [ "$STATUS" = "healthy" ]; then
    echo "Backend is healthy."
    exit 0
  fi

  echo "Backend status: ${STATUS:-starting}"
  sleep 5
done

echo "Backend failed health check."
docker compose logs --tail=100 backend
exit 1
