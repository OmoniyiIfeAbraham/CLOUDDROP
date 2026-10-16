# CloudDrop AWS Infrastructure and QA

Last reviewed: 16 October 2026

This document records the CloudDrop AWS infrastructure, production deployment,
security configuration, and verification results. Values are identified as
verified only where evidence is available. Credentials, passwords, access tokens,
and secret environment-variable values must not be committed to this document.

## 1. Architecture Overview

CloudDrop is deployed on AWS in the Europe (Ireland) region. The production
application uses the following components:

- **Amazon EC2:** Ubuntu server hosting the application containers.
- **Docker and Docker Compose:** Run the frontend, backend, and reverse proxy.
- **Amazon S3:** Private object storage for team/application files.
- **Amazon RDS for PostgreSQL:** Database hosted separately from the EC2 server.
- **Amazon VPC and security groups:** Network isolation and controlled connectivity.
- **AWS IAM:** EC2 permissions and deployment access.
- **AWS Systems Manager (SSM):** Remote deployment command execution.
- **GitHub Actions and GitHub Container Registry (GHCR):** Automated deployment
  workflow and container image distribution.
- **Nginx and Let's Encrypt:** HTTPS termination and reverse proxying.

### Production URL

- Application: <https://clouddrop-c8.duckdns.org>
- Health endpoint: <https://clouddrop-c8.duckdns.org/health>
- AWS Region: `eu-west-1` (Europe/Ireland)

## 2. EC2 Compute

| Setting | Value |
|---|---|
| Instance name | `CloudDrop-Server` |
| Instance ID | `i-057c4c651255b57e7` |
| Operating system | Ubuntu 26.04 LTS |
| Region | `eu-west-1` |
| Instance state | Running (last recorded verification) |
| Public IPv4 | `63.34.106.190` (last recorded verification) |
| Private IPv4 | `172.31.39.27` |
| EC2 IAM role | `CloudDrop-EC2-S3-Role` |
| Docker version | `29.1.3` |
| Docker Compose version | `2.40.3` |

The public IP can change if the instance's address configuration changes. Confirm
the current address in the EC2 console before relying on it.

The instance runs the CloudDrop application containers. Remote administration and
deployment use the approved access mechanisms; do not place AWS access keys or
database credentials in this document or in source control.

### Disk capacity warning

A previous check reported approximately 95% root-disk usage, with about 1.4 GB
free. This is a capacity warning that should be rechecked. No cleanup or Docker
pruning is documented as having been performed. Monitor disk space and investigate
before the disk becomes full.

## 3. VPC and Network Security

| Setting | Value |
|---|---|
| VPC ID | `vpc-0974e1d336512bc57` |
| EC2 private IPv4 | `172.31.39.27` |
| EC2 security group name | `cloudrop-ec2-sg` (name recorded previously; confirm current spelling/configuration) |
| RDS security group name | `rds-ec2-1` |
| RDS security group ID | `sg-08b180b03ddb3fbd8` |
| EC2 source security group ID | `sg-0c6d517f203e79851` |

The exact EC2 subnet ID is intentionally omitted because the current value needs
to be reconfirmed against the EC2 console.

### EC2-to-RDS traffic

The recorded RDS security-group rule allows PostgreSQL TCP port `5432` from the
EC2 security group `sg-0c6d517f203e79851`. The EC2 instance was reported to have
that security group attached. This is preferable to allowing database access
from all internet addresses.

Confirm the live security-group rules and attached groups in AWS before making
future networking changes.

## 4. IAM and Systems Manager

### EC2 instance role

- Role name: `CloudDrop-EC2-S3-Role`
- Purpose: Provide the EC2 instance with AWS permissions without storing long-lived
  access keys on the server.
- Recorded attached policies:
  - `AmazonSSMManagedInstanceCore`
  - `CloudDrop-Deployment-Artifacts-ReadOnly`
  - `CloudDrop-S3-Access-Policy`

`AmazonSSMManagedInstanceCore` provides the standard permissions required for
Systems Manager managed-instance functionality. Confirm the instance's current
SSM managed status before relying on Session Manager.

### GitHub Actions deployment role

- Role name: `CloudDrop-GitHubActions-SSM-Role`
- Purpose: Allow the GitHub Actions deployment workflow to obtain AWS credentials
  through GitHub OpenID Connect (OIDC) and issue deployment commands through SSM.

The deployment workflow has previously completed successfully. Review the current
IAM trust policy and permissions whenever repository names, branches, or workflow
permissions change. Keep the trust policy restricted to the intended repository
and refs, and grant only the permissions required for deployment.

### IAM security practices

- Prefer IAM roles and short-lived OIDC credentials over static access keys.
- Restrict S3 access to the CloudDrop bucket and its objects.
- Restrict deployment permissions to the intended workflow and resources.
- Never commit `.env` files, credentials, tokens, or private keys.

## 5. Amazon S3

| Setting | Value |
|---|---|
| Bucket | `clouddrop-team-files-2026` |
| Region | `eu-west-1` |
| Public access block | All four Block Public Access settings enabled (last recorded review) |
| Object ownership | Bucket owner enforced; ACLs disabled |
| Default encryption | SSE-S3 |
| Versioning | Disabled (last recorded review) |

The bucket is intended for private CloudDrop file storage. Public access should
remain blocked. Application sharing should use the backend's authorization and
time-limited sharing mechanism rather than making the bucket public.

### EC2-to-S3 verification

The following operations were previously tested successfully from EC2:

- List the bucket.
- Upload a test object.
- List the uploaded object.
- Download the object.
- Read the downloaded content.
- Delete the test object.

Test object used: `test.txt`

Test content: `CloudDrop S3 test`

### S3 permissions

The recorded custom policy is named `CloudDrop-S3-Access-Policy`. Its documented
actions are:

- `s3:ListBucket`
- `s3:GetObject`
- `s3:PutObject`
- `s3:DeleteObject`

The intended scope is the CloudDrop bucket and its objects. Confirm the current
policy resource ARNs and statements in IAM before treating the exact policy scope
as freshly audited.

## 6. Amazon RDS for PostgreSQL

| Setting | Value |
|---|---|
| DB identifier | `clouddrop-postgres` |
| Engine | PostgreSQL; exact current engine version needs reconfirmation |
| Instance class | `db.t4g.micro` (last recorded value) |
| Region | `eu-west-1` |
| Availability Zone | `eu-west-1b` (last recorded value) |
| Port | `5432` |
| Publicly accessible | No (last recorded console value) |
| Endpoint | `clouddrop-postgres.cr80cu0aq4ll.eu-west-1.rds.amazonaws.com` |
| RDS security group | `rds-ec2-1` |
| Application database | `cloud_drop` |

The RDS console may show the default `postgres` database and master username.
The application's configured database name has been checked as `cloud_drop`.
Do not confuse the default database with the application's database.

### Connectivity verification

Previous EC2-side checks confirmed:

- TCP connectivity to RDS port `5432`.
- PostgreSQL client connectivity.
- Successful database authentication.
- Successful SQL query execution.

These checks establish that database connectivity worked at the time of testing.
They do not by themselves prove that every application database operation is
currently working.

### TLS and certificate notes

A regional RDS CA bundle was previously present at:

`/etc/ssl/certs/rds-eu-west-1-bundle.pem`

Manual PostgreSQL driver TLS testing, including `SELECT 1`, succeeded with the
bundle. Earlier application logs reported a Prisma error involving a
self-signed certificate in the certificate chain. The issue was investigated;
recheck current application logs and database-backed application operations
before declaring the TLS issue permanently resolved.

The recorded RDS CA identifier was `rds-ca-rsa2048-g1`, with a recorded expiry
date of 4 October 2027. Confirm the current CA and expiry in RDS before planning
certificate rotation.

## 7. Containers, Reverse Proxy, and HTTPS

### Production domain

- Hostname: `clouddrop-c8.duckdns.org`
- Recorded public IPv4: `63.34.106.190`
- HTTP redirects to HTTPS.
- HTTPS is terminated by the Nginx reverse proxy using Let's Encrypt certificates.
- Nginx proxies `/api/` requests to the backend and `/health` to the backend health
  endpoint.
- The Nginx configuration allows request bodies up to 26 MB for the API path.

### Containers

The following container names were running and healthy where health status was
reported during the last recorded check on 16 October 2026:

| Container | Image | Recorded status |
|---|---|---|
| `clouddrop-nginx` | `nginx:alpine` | Running |
| `clouddrop-frontend` | `ghcr.io/omoniyiifeabraham/clouddrop-frontend:b8202811d6d52897899075e9599f4a52affa6e5c` | Running; healthy |
| `clouddrop-backend` | `ghcr.io/omoniyiifeabraham/clouddrop-backend:b8202811d6d52897899075e9599f4a52affa6e5c` | Running; healthy |

These are recorded observations, not a guarantee of the containers' current state.
Confirm the current image tags and health before each release or incident report.

### Deployment

The deployment process pulls the selected backend and frontend container images
from GHCR and starts the application services using Docker Compose. The GitHub
Actions workflow has previously completed successfully using AWS OIDC and SSM.

Use the repository's current deployment workflow and scripts as the source of
truth for exact steps. Verify the workflow and script versions on the branch
being reviewed before documenting additional automation as available.

## 8. Production Verification and QA

The following results were recorded during production verification on
16 October 2026.

| Check | Result | Notes |
|---|---|---|
| Public HTTPS homepage | Passed | HTTP `200` |
| Public backend health endpoint | Passed | HTTP `200`; response reported that the CloudDrop API is running |
| Unauthenticated `/api/v1/auth/me` | Expected response | HTTP `401`; authentication is required |
| Backend container | Passed at last check | Docker reported healthy |
| Frontend container | Passed at last check | Docker reported healthy |
| Production login | Passed | Confirmed by user |
| File upload | Passed | Confirmed by user in the end-to-end workflow |
| File download | Passed | Confirmed by user in the end-to-end workflow |
| Share-link workflow | Passed | Confirmed by user in the end-to-end workflow |
| EC2-to-S3 operations | Passed in earlier test | List, upload, download, read, and delete |
| EC2-to-RDS connectivity and SQL | Passed in earlier test | Recheck after relevant configuration or application changes |

The unauthenticated `401` response from `/api/v1/auth/me` is expected for a request
without a valid authentication token; it is not, by itself, evidence of a
production outage.

### Scope of these results

These checks are evidence of the tested paths at the recorded time. They do not
replace a complete security assessment, load test, backup/restore test, or
continuous monitoring.

## 9. Outstanding Checks and Follow-up

Before final infrastructure sign-off, consider confirming:

- [ ] Current EC2 status checks and public/private networking values.
- [ ] Current EC2 subnet ID and attached security groups.
- [ ] Current RDS PostgreSQL engine version and security-group rules.
- [ ] Current S3 policy resource ARNs and bucket configuration.
- [ ] Current SSM managed-instance status and deployment-role trust policy.
- [ ] Current container image tags and matching Git commit/workflow run.
- [ ] Current application logs for database TLS or Prisma errors.
- [ ] Current root-disk capacity; previous check reported about 95% usage.
- [ ] Backup retention and a tested database restore procedure.
- [ ] Monitoring and alerting coverage.
- [ ] Infrastructure evidence/screenshots suitable for the project report.

Items in this checklist are follow-up checks, not assertions that the feature is
missing or broken.

## 10. Evidence and Change Management

Retain appropriate, non-sensitive evidence for:

- EC2 instance details and status checks.
- VPC and security-group rules.
- IAM role attachments and restricted policy resources.
- S3 Block Public Access, ownership, and encryption settings.
- RDS availability, private-access setting, and security-group configuration.
- GitHub Actions deployment success and deployed image identifiers.
- Public HTTPS homepage and health-check responses.
- End-to-end login, upload, download, and share-link testing.
- Disk-capacity checks and relevant application logs.

Redact passwords, tokens, secret environment variables, private keys, and any
personal or customer file data before adding evidence to GitHub.

Infrastructure changes and documentation updates should follow the team's
workflow:

**Issue → Feature Branch → Commits → Pull Request → Review → Approval → Merge**

Do not merge directly into `main`. Submit this documentation change as a pull
request for review.
