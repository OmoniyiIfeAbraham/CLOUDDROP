#!/bin/bash

set -e

echo "Checking CloudDrop deployment..."
echo

echo "Checking backend container..."

BACKEND_STATUS=$(docker inspect --format='{{.State.Status}}' clouddrop-backend 2>/dev/null || true)

if [ "$BACKEND_STATUS" != "running" ]; then
  echo "ERROR: Backend container is not running."
  exit 1
fi

echo "Backend container is running."

echo
echo "Checking backend health..."

BACKEND_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' clouddrop-backend 2>/dev/null || true)

if [ "$BACKEND_HEALTH" != "healthy" ]; then
  echo "ERROR: Backend health check failed."
  echo "Current status: ${BACKEND_HEALTH:-unknown}"
  exit 1
fi

echo "Backend is healthy."

echo
echo "Checking deployed backend image..."

BACKEND_IMAGE=$(docker inspect --format='{{.Config.Image}}' clouddrop-backend 2>/dev/null || true)

if [ -z "$BACKEND_IMAGE" ]; then
  echo "ERROR: Could not determine backend image."
  exit 1
fi

echo "Backend image: $BACKEND_IMAGE"

echo
echo "Checking Nginx container..."

NGINX_STATUS=$(docker inspect --format='{{.State.Status}}' clouddrop-nginx 2>/dev/null || true)

if [ "$NGINX_STATUS" != "running" ]; then
  echo "ERROR: Nginx container is not running."
  exit 1
fi

echo "Nginx container is running."

echo
echo "Checking public health endpoint..."

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health || true)

if [ "$HTTP_STATUS" != "200" ]; then
  echo "ERROR: Health endpoint returned HTTP ${HTTP_STATUS:-unknown}."
  exit 1
fi

echo "Health endpoint returned HTTP 200."

echo
echo "CloudDrop deployment verification successful."
echo "Running backend image: $BACKEND_IMAGE"
