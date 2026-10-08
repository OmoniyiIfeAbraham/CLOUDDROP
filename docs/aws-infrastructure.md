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
- Public IPv4: `18.203.69.190`
- Private IPv4: `172.31.39.27`

## S3

- Bucket: `clouddrop-team-files-2026`

The S3 bucket was configured for team file storage.

### S3 Security Configuration

- Block Public Access: Enabled
- Object Ownership: Bucket owner enforced
- Server-side encryption: SSE-S3
- Versioning: Disabled

### S3 operations tested

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

## QA Status

### Completed

- EC2 instance deployed and running
- Ubuntu 26.04 LTS verified
- EC2 Instance Connect verified
- IAM role created
- IAM role attached to EC2
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
- Infrastructure security review completed

## Remaining

- Backend application integration with RDS
- Backend application integration with S3
- Full end-to-end application QA
- Application-level authorization/security testing
- Production deployment verification
- Health checks, logging, and monitoring verification
- Final infrastructure evidence/screenshots
- Final project documentation
