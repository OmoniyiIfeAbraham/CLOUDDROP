# CloudDrop DevOps Workflow

## 1. Development Workflow

All CloudDrop changes follow:

Task → Feature Branch → Development → Commit → Push → Pull Request → Review → Merge → Deployment → Verification

Direct pushes to `main` should not be used for development work.

---

## 2. Branch Strategy

The main production branch is:

```text
main
```

Development work is completed on feature branches.

Examples:

```text
feature/backend-setup
feature/docker-setup
feature/aws-s3-setup
feature/devops-cicd
```

Each feature branch should contain only the work related to its task.

---

## 3. Pull Request Workflow

When a task is complete:

1. Commit the changes.
2. Push the feature branch.
3. Open a Pull Request to `main`.
4. GitHub Actions runs the required CI checks.
5. A team member reviews the Pull Request.
6. Approved changes are merged into `main`.
7. The deployment workflow can then deploy the approved version.

---

## 4. Continuous Integration

GitHub Actions performs the required application checks, including:

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

CloudDrop backend images are published to GitHub Container Registry.

Registry:

```text
ghcr.io/omoniyiifeabraham/clouddrop-backend
```

Images are tagged using the Git commit SHA, allowing a specific version to be identified and restored.

The `latest` tag represents the current deployment image.

Commit SHA tags are important for rollback because they allow a specific previously published backend image to be selected.

---

## 6. Production Deployment

Production deployment runs on the CloudDrop EC2 server.

Production application directory:

```text
/opt/clouddrop
```

The production stack uses:

- Docker
- Docker Compose
- CloudDrop Backend
- CloudDrop Frontend
- Nginx
- PostgreSQL / Amazon RDS
- Amazon S3

The deployment script is:

```bash
./scripts/deploy.sh
```

The deployment process:

1. Selects the backend and frontend Docker images.
2. Pulls both images from GHCR before changing any container.
3. Starts or updates the backend and frontend containers.
4. Waits for the backend and frontend health checks.
5. Tests the Nginx config and restarts Nginx.
6. Confirms Nginx is running.
7. Reports deployment success.

---

## 7. GitHub Actions → AWS EC2 Deployment

CloudDrop uses GitHub Actions to trigger production deployment on EC2.

GitHub authenticates with AWS using:

- GitHub Actions OIDC
- AWS IAM role
- AWS Systems Manager Session Manager

The deployment IAM role is restricted to the CloudDrop GitHub repository and the required SSM permissions.

GitHub Actions sends an AWS Systems Manager command to the CloudDrop EC2 instance.

The EC2 deployment process then:

```text
GitHub Actions
      |
      v
GitHub OIDC
      |
      v
AWS IAM Role
      |
      v
AWS Systems Manager
      |
      v
CloudDrop EC2
      |
      v
/opt/clouddrop/scripts/deploy.sh
      |
      v
Docker Compose
      |
      +----> Backend
      |
      +----> Frontend
      |
      +----> Nginx
```

The deployment workflow takes a backend image tag and a frontend image tag (both default to `latest`) when starting the deployment.

The AWS IAM role ARN is stored in GitHub repository secrets and is not hardcoded into the workflow.

---

## 8. Deployment Verification

After deployment, the verification script can be run with:

```bash
./scripts/verify-deployment.sh
```

Verification checks:

- Backend container is running.
- Backend health check is healthy.
- Running backend image is identified.
- Frontend health check is healthy.
- Nginx container is running.
- Public `/health` endpoint returns HTTP 200.

The backend health endpoint is:

```text
/health
```

A successful response confirms that the CloudDrop API is running.

---

## 9. Rollback

If a deployment needs to be reverted, a previously published backend image can be restored using its Git commit SHA image tag.

Command:

```bash
./scripts/rollback.sh <image-tag>
```

Example:

```bash
./scripts/rollback.sh d4c562e92866b20cc25b1ba0d59fca55f0c49362
```

The rollback process:

1. Pulls the selected previous image from GHCR.
2. Updates the backend image.
3. Restarts the backend container.
4. Waits for the backend health check.
5. Confirms Nginx is running.
6. Checks the public `/health` endpoint.
7. Reports whether the rollback was successful.

### Rollback Test

The rollback procedure was successfully tested in the production EC2 environment.

The backend was temporarily rolled back to a previous image:

```text
d4c562e92866b20cc25b1ba0d59fca55f0c49362
```

The rollback verification confirmed:

- Previous image pulled successfully.
- Backend became healthy.
- Nginx remained running.
- `/health` returned HTTP 200.

The current `latest` deployment was then restored successfully.

---

## 10. Production Environment

Production environment variables are stored on the EC2 server in:

```text
/opt/clouddrop/.env
```

Required variables include:

```text
NODE_ENV
PORT
DATABASE_URL
JWT_SECRET
AWS_REGION
S3_BUCKET_NAME
```

Production `.env` files must never be committed to GitHub.

Secrets must not be hardcoded into source code, Dockerfiles, Docker Compose files, workflows, or scripts.

---

## 11. AWS Access

The CloudDrop EC2 instance uses an IAM role for AWS service access.

AWS credentials should not be hardcoded into:

- Source code
- Dockerfiles
- Docker Compose files
- GitHub repositories
- Deployment scripts

The EC2 IAM role provides the required AWS permissions, including access to Amazon S3.

GitHub Actions uses OIDC to authenticate to AWS for deployment operations instead of storing long-lived AWS access keys.

---

## 12. Network Architecture

Internet traffic reaches Nginx.

Nginx forwards requests to the backend container.

The backend communicates with:

- PostgreSQL / Amazon RDS for database operations.
- Amazon S3 for file storage.

Internal backend port:

```text
5000
```

Public HTTP port:

```text
80
```

HTTPS port:

```text
443
```

HTTPS/domain configuration is handled separately.

---

## 13. Deployment Responsibilities

### DevOps / CI-CD

Responsible for:

- Deployment configuration
- Docker deployment configuration
- Docker Compose production configuration
- Deployment scripts
- Nginx deployment configuration
- GitHub Actions
- GHCR image publishing
- GitHub OIDC integration
- AWS SSM deployment
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

### Backend / Cloud

Responsible for:

- Backend application
- API implementation
- Database integration
- S3 application integration
- Authentication and authorization
- Backend testing
- API documentation

### Team Lead / Integration

Responsible for:

- Architecture coordination
- Pull Request review
- Integration
- Final deployment coordination

---

## 14. Deployment Flow Summary

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
GitHub Actions Deployment
    |
    v
GitHub OIDC
    |
    v
AWS IAM
    |
    v
AWS Systems Manager
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
```

---

## 15. Current DevOps Status

Completed:

- GitHub Actions CI/CD foundation
- Docker image publishing
- GHCR integration
- EC2 production environment
- GitHub OIDC authentication
- AWS IAM deployment role
- AWS Systems Manager deployment
- Automated EC2 deployment
- Backend health checks
- Nginx verification
- Deployment verification
- Rollback procedure
- Successful rollback test
- Restoration to the current `latest` deployment

Remaining:

- Final DevOps documentation review
- Pull Request to `main`
- Team review and merge

Handled separately:

- Domain/DNS configuration
- HTTPS/SSL configuration
