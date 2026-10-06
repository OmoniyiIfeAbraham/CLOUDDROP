# CloudDrop AWS Infrastructure

## AWS Region

- Region: Europe (Ireland)
- Region code: `eu-west-1`

## EC2

- Instance Name: `CloudDrop-Server`
- Instance ID: `i-057c4c651255b57e7`
- Operating System: **Ubuntu 26.04 LTS**
- Instance Status: Running
- EC2 Instance Connect: Verified
- AWS Systems Manager (SSM): Configured and verified
- Session Manager: Verified
- Public IPv4: `18.203.69.190`
- Private IPv4: `172.31.39.27`

### Docker

Docker has been installed and configured on the CloudDrop production EC2 server.

- Docker: Installed and configured
- Docker Compose v2: Installed and configured
- Production environment is ready to run containerized CloudDrop services.

## S3

- Bucket: `clouddrop-team-files-2026`

The S3 bucket was configured for team file storage.

### S3 Security Configuration

- Block Public Access: Enabled
- Object Ownership: Bucket owner enforced
- Server-side encryption: SSE-S3
- Versioning: Disabled

### S3 Operations Tested

The EC2 instance successfully:

- Listed the S3 bucket
- Uploaded a test file
- Listed the uploaded object
- Downloaded the object
- Read the downloaded file
- Deleted the S3 object

Test file:

`test.txt`

Test content:

`CloudDrop S3 test`

## IAM

### EC2 IAM Role

- Role: `CloudDrop-EC2-S3-Role`

The IAM role is attached to the CloudDrop EC2 instance.

### S3 Permissions

The role currently has an inline policy:

- Policy: `CloudDrop-S3-Access-Policy`

Allowed S3 actions:

- `s3:ListBucket`
- `s3:GetObject`
- `s3:PutObject`
- `s3:DeleteObject`

The permissions are restricted to the CloudDrop S3 bucket and its objects.

### Backend IAM User

- User: `Eunice`
- Group: `CloudDrop-Backend`

Eunice was configured with controlled access for backend/cloud administration.

### Session Manager Access

A dedicated Session Manager policy was configured for the `CloudDrop-Backend` group.

The policy provides the required permissions to:

- Start a Session Manager session
- Discover the CloudDrop EC2 instance
- Check session and instance status
- Manage the user's own sessions
- Access the CloudDrop production server through AWS Systems Manager

Session Manager access was restricted to the CloudDrop production EC2 instance.

### GitHub Actions OIDC

A GitHub Actions OIDC identity provider was created in AWS:

- Provider: `token.actions.githubusercontent.com`

A dedicated IAM role was configured for GitHub Actions:

- Role: `CloudDrop-GitHubActions-SSM-Role`

The role is restricted to:

- Repository: `OmoniyiIfeAbraham/CLOUDDROP`
- Branch: `main`
- OIDC audience: `sts.amazonaws.com`

### GitHub Actions Deployment Policy

An inline policy was created:

- Policy: `CloudDrop-SSM-Deployment`

The policy allows GitHub Actions to:

- Send SSM commands to the CloudDrop EC2 instance
- Use `AWS-RunShellScript`
- Retrieve SSM command execution results

The GitHub Actions deployment setup uses OIDC rather than long-lived AWS access keys.

## RDS PostgreSQL

- DB identifier: `clouddrop-postgres`
- Engine: PostgreSQL 18.3-R2
- Port: `5432`
- Region: `eu-west-1`
- Public access: No
- Endpoint: `clouddrop-postgres.cr80cu0aq4ll.eu-west-1.rds.amazonaws.com`
- Database security group: `rds-ec2-1`

The RDS instance is configured for private access from the CloudDrop EC2 environment.

### RDS Connectivity Testing

Connectivity from EC2 to RDS was verified using:

- TCP connectivity test to port `5432`
- PostgreSQL client (`psql`)
- Successful PostgreSQL authentication
- Successful SQL query execution

The successful SQL test verified the current database, authenticated user, and PostgreSQL server version.

## VPC / Networking

The EC2 instance is running inside the project VPC.

- VPC: `vpc-0974e1d336512bc57`
- Subnet: `subnet-0834986a638d2d95`
- Security Group: `cloudrop-ec2-sg`

### Network Security

The infrastructure review verified:

- EC2 security-group configuration
- RDS security-group configuration
- EC2 → RDS access on PostgreSQL port `5432`
- RDS inbound access restricted to the EC2 security group
- S3 access through the EC2 IAM role
- Required VPC networking components and routing

## Production Deployment

The CloudDrop backend has been deployed to the production EC2 environment.

- Backend container deployed on EC2
- Nginx configured as a reverse proxy
- Production Docker Compose configuration configured
- Production environment variables configured
- Backend connected to RDS PostgreSQL
- Backend connected to S3
- Backend image deployed from GHCR
- Backend and Nginx containers running
- Backend health check passing
- Deployment verification passing

### Production Health Check

The deployed backend was tested through the EC2 public IP.

Response:

`{"success":true,"message":"CloudDrop API is running"}`

The external health check returned HTTP 200.

## QA Status

### Completed

- EC2 instance deployed and running
- Ubuntu 26.04 LTS verified
- EC2 Instance Connect verified
- AWS Systems Manager configured
- Session Manager access verified
- Docker installed and configured
- Docker Compose v2 installed and configured
- EC2 IAM role created and attached
- S3 bucket configured
- S3 security configuration verified
- S3 permissions configured
- S3 upload tested
- S3 download tested
- S3 object listing tested
- S3 object deletion tested
- RDS PostgreSQL infrastructure created
- RDS private access configured
- EC2 → RDS network connectivity verified
- PostgreSQL authentication from EC2 verified
- SQL query execution from EC2 verified
- VPC/networking reviewed
- Security-group configuration reviewed
- Backend deployed to production EC2
- Backend connected to RDS
- Backend connected to S3
- Nginx reverse proxy configured
- Production health check verified
- External HTTP 200 response verified
- Eunice IAM user and backend access configured
- Session Manager permissions configured
- GitHub Actions OIDC provider created
- GitHub Actions deployment IAM role configured
- GitHub Actions SSM deployment policy configured

## Remaining

- Connect the GitHub Actions workflow to the configured AWS OIDC role
- Test automatic GitHub Actions → EC2 deployment through SSM
- Test the production rollback process
- Complete full end-to-end application QA
- Perform application-level authorization/security testing
- Verify S3 and PostgreSQL synchronization during complete file operations
- Complete HTTPS/SSL and domain configuration
- Verify production logging and monitoring
- Collect final infrastructure evidence/screenshots
- Finalize project documentation
