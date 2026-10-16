# CloudDrop Deployment Guide

## 1. Deployment Flow

CloudDrop uses:

GitHub â†’ GitHub Actions â†’ GHCR â†’ EC2 â†’ Docker Compose â†’ Health Check

The Docker images are published to:

ghcr.io/omoniyiifeabraham/clouddrop-backend
ghcr.io/omoniyiifeabraham/clouddrop-frontend

Images are tagged with both:

- latest â€” latest deployment image
- Git commit SHA â€” specific version for tracking and rollback

### Independent automatic releases

A push/merge to `main` that changes `frontend/**` runs frontend validation, image publishing and frontend deployment. A `backend/**` change does the same for the backend. Neither waits for the other component's CI. Shared runtime changes (`scripts/**`, `nginx/**`, `docker-compose.prod.yml` and the deployment workflow) trigger both build workflows. Failed checks stop the affected component's release.

The deployment workflow accepts a successful main-branch push build from this repository, checks out that exact commit and sends a non-secret runtime bundle through SSM. The bundle contains production Compose, Nginx config and operational scripts. It never contains the EC2 `.env` or certificates. `deploy-release.sh` installs these files before running the component deployment and public HTTPS verification.

The changed component receives its commit-SHA image. The other component's image reference is read from its existing container and preserved. If the other container is missing, use the manual workflow with both image tags to bootstrap the deployment.

EC2 needs Linux `flock`. A host lock serializes release execution. Separate successful run-number markers in `/opt/clouddrop/.deployment-state/` prevent late completion of an older build from undoing a newer release of the same component. Staging bundles remain in `/opt/clouddrop/.release-*` for inspection. Operators should coordinate manual rollbacks with active releases.

GitHub Actions shows the deployment job after the relevant build succeeds. Its SSM result and output identify deployed image tags; a green build by itself is not proof of a successful deployment. Database migrations are not automatic and require release preparation. The pipeline changes must first be pushed/merged to `main` before this flow can run.

## 2. Production Files

Production deployment uses:

- docker-compose.prod.yml
- scripts/deploy-release.sh
- scripts/deploy.sh
- scripts/verify-deployment.sh
- scripts/rollback.sh
- nginx/default.conf

Production application directory on EC2:

/opt/clouddrop

## 3. Environment Configuration

Production environment variables are stored in the EC2 .env file.

Required variables:

- NODE_ENV
- PORT
- DATABASE_URL
- JWT_SECRET
- AWS_REGION
- S3_BUCKET_NAME

Production secrets must never be committed to GitHub.

AWS credentials are not hardcoded. The EC2 IAM role provides AWS access.

## 4. Production Architecture

Internet
   |
   v
Nginx :443 (HTTPS; port 80 redirects)
   |
   v
CloudDrop Backend :5000
   |
   +----> PostgreSQL / RDS
   |
   +----> Amazon S3

The backend listens on port 5000.

Nginx terminates HTTPS on port 443 using the mounted certificates. Port 80 redirects to HTTPS except ACME challenges. `/` routes to the frontend container, while `/api/v1/`, `/s/` and `/health` route to the backend.

## 5. Deployment

From the CloudDrop application directory:

./scripts/deploy.sh

The deployment script:

1. Pulls only the selected component image for automatic releases, or both images for a manual/full deployment. A failed pull stops before container changes.
2. Starts the selected service with `--no-deps` for a component release, preserving the other service. A full deployment starts both services.
3. Waits for the backend and frontend health checks.
4. Tests the Nginx config, then restarts Nginx so it picks up config changes and the new containers.
5. Reports success when everything is healthy.
6. Shows the failing container's logs if deployment fails.

## 6. Deployment Verification

After deployment, run:

./scripts/verify-deployment.sh

The verification script checks:

- Backend container status
- Backend health status
- Frontend health status
- Nginx container status
- Public /health endpoint

Successful verification should report:

CloudDrop deployment verification successful.

## 7. Health Check

The backend exposes:

GET /health

Expected response:

{
  "success": true,
  "message": "CloudDrop API is running"
}

## 8. Rollback

Rollback restores a previously published backend and frontend image pair.
Use commit SHA tags from a release verified as working.

Example: `./scripts/rollback.sh BACKEND_COMMIT_SHA FRONTEND_COMMIT_SHA`

Before running the command:

1. Identify a known-good backend and frontend image pair.
2. Confirm both image tags exist in GitHub Container Registry.
3. Confirm the pair is compatible with the current database schema and migrations.
4. Run the rollback from the production application directory on EC2.

The script pulls both images before changing services, validates the Nginx configuration,
updates the backend and frontend services, waits for both application containers to become healthy,
restarts Nginx, verifies the running image references, and checks the public HTTPS health endpoint.

The script does not automatically restore the previously running pair if
rollback verification fails. Investigate container status and logs before
attempting another change. Image availability alone does not prove a release
is safe to roll back.

## 9. Container Registry

GitHub Container Registry is used for backend images:

ghcr.io/omoniyiifeabraham/clouddrop-backend

GitHub Actions publishes images using the GitHub GITHUB_TOKEN.

The production EC2 server must authenticate to GHCR before pulling private images.

## 10. Security

- Never hardcode AWS credentials.
- Use the EC2 IAM role for AWS access.
- Never commit production .env files.
- Never commit passwords, tokens, private keys, or credentials.
- Keep production secrets on the EC2 server.
- Use GHCR for container image storage.
- Use health checks to verify deployments.
- Use rollback support to recover from failed deployments.
