# CloudDrop Deployment Guide

## 1. Deployment Flow

CloudDrop uses:

GitHub → GitHub Actions → GHCR → EC2 → Docker Compose → Health Check

The backend Docker image is published to:

ghcr.io/omoniyiifeabraham/clouddrop-backend

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

1. Pulls the latest backend image.
2. Starts or restarts the backend.
3. Waits for the backend health check.
4. Reports success when the backend is healthy.
5. Shows backend logs if deployment fails.

## 6. Deployment Verification

After deployment, run:

./scripts/verify-deployment.sh

The verification script checks:

- Backend container status
- Backend health status
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

If a deployment fails, a previous backend image can be restored using its Git commit SHA.

Example:

./scripts/rollback.sh abc123456789

The rollback script:

1. Pulls the specified GHCR image.
2. Sets it as the backend image.
3. Restarts the backend.
4. Waits for the health check.
5. Shows logs if the rollback fails.

The commit SHA must belong to a previously published CloudDrop backend image.

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
