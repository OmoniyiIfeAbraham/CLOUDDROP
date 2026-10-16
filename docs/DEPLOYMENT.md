# CloudDrop Deployment Guide

## 1. Deployment Flow

CloudDrop uses:

GitHub → GitHub Actions → GHCR → EC2 → Docker Compose → Health Check

The Docker images are published to:

ghcr.io/omoniyiifeabraham/clouddrop-backend
ghcr.io/omoniyiifeabraham/clouddrop-frontend

Images are tagged with both:

- latest — latest deployment image
- Git commit SHA — specific version for tracking and rollback

## 2. Production Files

Production deployment uses:

- docker-compose.prod.yml
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
Nginx :80
   |
   v
CloudDrop Backend :5000
   |
   +----> PostgreSQL / RDS
   |
   +----> Amazon S3

The backend listens on port 5000.

Nginx provides the public HTTP entry point on port 80.

HTTPS on port 443 will be configured when the production domain and SSL setup are ready.

## 5. Deployment

From the CloudDrop application directory:

./scripts/deploy.sh

The deployment script:

1. Pulls the backend and frontend images (BACKEND_IMAGE and FRONTEND_IMAGE, latest by default). A failed pull stops the deployment before any container changes.
2. Starts or restarts the backend and frontend.
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
