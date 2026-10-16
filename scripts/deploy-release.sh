#!/usr/bin/env bash
set -euo pipefail

# Called from the exact-commit runtime bundle sent by GitHub Actions.
APP_DIR="${CLOUDDROP_APP_DIR:-/opt/clouddrop}"
RELEASE_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
COMPONENT="${1:-}"
BACKEND_TAG="${2:-}"
FRONTEND_TAG="${3:-}"
RUN_NUMBER="${4:-0}"

validate_tag() {
  [[ "$1" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]] || {
    echo "Invalid image tag" >&2
    return 1
  }
}

case "$COMPONENT" in
  frontend) validate_tag "$FRONTEND_TAG" ;;
  backend) validate_tag "$BACKEND_TAG" ;;
  all) validate_tag "$BACKEND_TAG"; validate_tag "$FRONTEND_TAG" ;;
  *) echo "Expected frontend, backend or all" >&2; exit 1 ;;
esac
[[ "$RUN_NUMBER" =~ ^[0-9]+$ ]] || { echo "Invalid run number" >&2; exit 1; }

cd "$APP_DIR"
# Serialize host changes without dropping queued releases for either component.
exec 9> .deployment.lock
flock -w 900 9
mkdir -p .deployment-state
STATE_FILE=".deployment-state/$COMPONENT.run"
if [ "$COMPONENT" != all ] && [ "$RUN_NUMBER" -gt 0 ] && [ -f "$STATE_FILE" ]; then
  previous=$(cat "$STATE_FILE")
  [[ "$previous" =~ ^[0-9]+$ ]] || { echo "Invalid deployment state" >&2; exit 1; }
  if [ "$RUN_NUMBER" -le "$previous" ]; then
    echo "Skipping superseded $COMPONENT run $RUN_NUMBER (already deployed $previous)."
    exit 0
  fi
fi

running_image() {
  local image
  image=$(docker inspect --format='{{.Config.Image}}' "clouddrop-$1")
  [ -n "$image" ] || { echo "Missing running $1 image; bootstrap with manual deployment." >&2; return 1; }
  printf '%s' "$image"
}

case "$COMPONENT" in
  frontend)
    BACKEND_IMAGE=$(running_image backend)
    FRONTEND_IMAGE="ghcr.io/omoniyiifeabraham/clouddrop-frontend:$FRONTEND_TAG"
    ;;
  backend)
    BACKEND_IMAGE="ghcr.io/omoniyiifeabraham/clouddrop-backend:$BACKEND_TAG"
    FRONTEND_IMAGE=$(running_image frontend)
    ;;
  all)
    BACKEND_IMAGE="ghcr.io/omoniyiifeabraham/clouddrop-backend:$BACKEND_TAG"
    FRONTEND_IMAGE="ghcr.io/omoniyiifeabraham/clouddrop-frontend:$FRONTEND_TAG"
    ;;
esac
export BACKEND_IMAGE FRONTEND_IMAGE
export DEPLOY_COMPONENT="$COMPONENT"

# Sync only operational files. Preserve the host .env and certificates.
mkdir -p nginx scripts
install -m 644 "$RELEASE_DIR/docker-compose.prod.yml" docker-compose.prod.yml
install -m 644 "$RELEASE_DIR/nginx/default.conf" nginx/default.conf
for script in deploy.sh verify-deployment.sh rollback.sh; do
  install -m 755 "$RELEASE_DIR/scripts/$script" "scripts/$script"
done

bash ./scripts/deploy.sh
bash ./scripts/verify-deployment.sh
if [ "$COMPONENT" != all ] && [ "$RUN_NUMBER" -gt 0 ]; then
  printf '%s\n' "$RUN_NUMBER" > "$STATE_FILE"
fi
echo "Verified $COMPONENT release: backend=$BACKEND_IMAGE frontend=$FRONTEND_IMAGE"
