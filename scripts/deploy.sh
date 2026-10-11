#!/bin/bash

set -e

echo "Starting CloudDrop deployment..."

IMAGE="${BACKEND_IMAGE:-ghcr.io/omoniyiifeabraham/clouddrop-backend:latest}"
FRONTEND="${FRONTEND_IMAGE:-ghcr.io/omoniyiifeabraham/clouddrop-frontend:latest}"

echo "Deployment image: ${IMAGE}"
echo "Frontend image: ${FRONTEND}"

# Pull both images before touching the running containers, so a failed pull
# leaves the current deployment in place.
echo "Pulling backend image..."
docker pull "$IMAGE"

echo "Pulling frontend image..."
docker pull "$FRONTEND"

echo "Starting backend, frontend and Nginx..."

export BACKEND_IMAGE="$IMAGE"
export FRONTEND_IMAGE="$FRONTEND"

docker compose -f docker-compose.prod.yml up -d backend frontend nginx

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

echo "Waiting for frontend health check..."

for i in {1..12}; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' clouddrop-frontend 2>/dev/null || true)

  if [ "$STATUS" = "healthy" ]; then
    echo "Frontend is healthy."
    break
  fi

  echo "Frontend status: ${STATUS:-starting}"
  sleep 5
done

FINAL_STATUS=$(docker inspect --format='{{.State.Health.Status}}' clouddrop-frontend 2>/dev/null || true)

if [ "$FINAL_STATUS" != "healthy" ]; then
  echo "Frontend failed health check."
  echo
  echo "Frontend logs:"
  docker compose -f docker-compose.prod.yml logs --tail=100 frontend
  exit 1
fi

# Compose does not restart Nginx when the backend or frontend is recreated or
# when nginx/default.conf changes, so it would keep stale container addresses
# and the old config. Test the config first so a bad file never takes it down.
echo "Testing Nginx config..."
docker compose -f docker-compose.prod.yml run --rm --no-deps nginx nginx -t

echo "Restarting Nginx..."
docker compose -f docker-compose.prod.yml restart nginx

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
echo "Deployed frontend image: ${FRONTEND}"
