# CloudDrop DevOps Workflow

## 1. Development Workflow

All CloudDrop changes follow:

Task → Feature Branch → Development → Commit → Push → Pull Request → Review → Merge → Deployment → Verification

Direct pushes to `main` should not be used for development work.

---

## 2. Branch Strategy

The main production branch is:

main

Development work is completed on feature branches.

Examples:

feature/backend-setup
feature/docker-setup
feature/aws-s3-setup
feature/devops-cicd

Each feature branch should contain only the work related to its task.

---

## 3. Pull Request Workflow

When a task is complete:

1. Commit the changes.
2. Push the feature branch.
3. Open a Pull Request to `main`.
4. GitHub Actions runs CI.
5. Team member reviews the Pull Request.
6. Approved changes are merged into `main`.

---

## 4. Continuous Integration

GitHub Actions performs the following checks:

1. Checkout repository.
2. Set up Node.js.
3. Install backend dependencies.
4. Generate Prisma Client.
5. Build the backend.
6. Run backend tests.
7. Build the Docker image.

A Pull Request should not be merged if the required CI checks fail.

---

## 5. Container Image Publishing

When changes are pushed to `main` or the DevOps branch, GitHub Actions builds and publishes the backend image to GitHub Container Registry.

Registry:

ghcr.io/omoniyiifeabraham/clouddrop-backend

Each image receives:

- Git commit SHA tag
- `latest` tag

The commit SHA allows a specific version to be identified and restored.

---

## 6. Production Deployment

Production deployment runs on the EC2 server.

Production application directory:

/opt/clouddrop

The production stack uses:

- Docker
- Docker Compose
- CloudDrop Backend
- Nginx
- PostgreSQL / RDS
- Amazon S3

Deployment command:

./scripts/deploy.sh

The deployment process:

1. Pulls the selected backend image.
2. Starts the backend container.
3. Waits for the backend health check.
4. Reports deployment success.

---

## 7. Deployment Verification

After deployment:

./scripts/verify-deployment.sh

Verification checks:

- Backend container is running.
- Backend health check is healthy.
- Running backend image is displayed.
- Nginx container is running.
- `/health` returns HTTP 200.

---

## 8. Rollback

If a deployment fails, a previous image can be restored using its Git commit SHA.

Command:

./scripts/rollback.sh <image-tag>

Example:

./scripts/rollback.sh abc123456789

The rollback process:

1. Pulls the selected previous image.
2. Restarts the backend.
3. Waits for backend health.
4. Checks Nginx.
5. Checks the public `/health` endpoint.

---

## 9. Production Environment

Production environment variables are stored in:

/opt/clouddrop/.env

Required variables include:

NODE_ENV
PORT
DATABASE_URL
JWT_SECRET
AWS_REGION
S3_BUCKET_NAME

Production `.env` files must never be committed to GitHub.

---

## 10. AWS Access

The EC2 instance uses an IAM role for AWS access.

AWS credentials should not be hardcoded into:

- Source code
- Dockerfiles
- Docker Compose files
- GitHub repositories
- Scripts

The EC2 IAM role provides access to required AWS services such as S3.

---

## 11. Network Architecture

Internet traffic reaches Nginx.

Nginx forwards requests to the backend container.

The backend communicates with:

- PostgreSQL / RDS for database operations.
- Amazon S3 for file storage.

Internal backend port:

5000

Public HTTP port:

80

HTTPS port:

443 will be configured when SSL/domain setup is completed.

---

## 12. Deployment Responsibilities

### Backend / Cloud

Responsible for:

- Backend Docker configuration
- Docker Compose
- Deployment scripts
- Nginx configuration
- GitHub Actions
- GHCR image publishing
- Deployment verification
- Rollback procedures

### AWS Infrastructure

Responsible for:

- EC2
- RDS
- S3
- IAM
- Security Groups
- Networking
- EC2 Docker installation
- SSM configuration

### Team Lead / Integration

Responsible for:

- Architecture coordination
- Pull Request review
- Integration
- Final deployment coordination

---

## 13. Deployment Flow Summary

```text
Developer
    |
    v
Feature Branch
    |
    v
Pull Request
    |
    v
GitHub Actions
    |
    +----> Install Dependencies
    |
    +----> Prisma Generate
    |
    +----> Build
    |
    +----> Test
    |
    +----> Docker Build
    |
    v
GitHub Container Registry
    |
    v
EC2
    |
    v
Docker Compose
    |
    +----> Backend
    |
    +----> Nginx
    |
    v
Health Check
    |
    v
Deployment Verification
