# CloudDrop Deployment Guide

## Deployment Flow

CloudDrop uses the following deployment flow:

GitHub → GitHub Actions → GHCR → EC2 → Docker Compose → Health Check

## Backend Container

The backend runs inside Docker on port 5000.

The Docker image is published to GitHub Container Registry:

ghcr.io/omoniyiifeabraham/clouddrop-backend:latest

## EC2 Application Directory

The production application will be located at:

/opt/clouddrop

## Environment Configuration

Production environment variables are stored in the EC2 `.env` file.

Required variables:

- NODE_ENV
- PORT
- DATABASE_URL
- JWT_SECRET
- AWS_REGION
- S3_BUCKET_NAME

Production secrets must not be committed to GitHub.

## Deployment

From the CloudDrop application directory:

```bash
./scripts/deploy.sh
