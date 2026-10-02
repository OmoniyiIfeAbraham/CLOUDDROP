# CloudDrop AWS Infrastructure

## AWS Region

- Region: Europe (Ireland)
- Region code: eu-west-1

## EC2

- Instance Name: CloudDrop-Server
- Instance ID: i-057c4c651255b57e7
- Operating System: Ubuntu 26.04 LTS
- Instance Status: Running
- EC2 Instance Connect: Verified
- Public IPv4: 18.203.69.190
- Private IPv4: 172.31.39.27

## S3

- Bucket: clouddrop-team-files-2026

The S3 bucket was configured for team file storage.

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

- Role: CloudDrop-EC2-S3-Role

The IAM role is attached to the CloudDrop EC2 instance.

### S3 Permissions

The role currently has an inline policy:

- Policy: CloudDrop-S3-Access-Policy

Allowed S3 actions:

- s3:ListBucket
- s3:GetObject
- s3:PutObject
- s3:DeleteObject

The permissions are restricted to the CloudDrop S3 bucket and its objects.

## VPC / Networking

The EC2 instance is running inside the project VPC.

- VPC: vpc-0974e1d336512bc57
- Subnet: subnet-0834986a638d2d95
- Security Group: cloudrop-ec2-sg

Detailed network/security-group verification remains part of the infrastructure QA work.

## QA Status

### Completed

- EC2 instance deployed and running
- EC2 Instance Connect verified
- IAM role created
- IAM role attached to EC2
- S3 bucket configured
- S3 permissions configured
- S3 upload tested
- S3 download tested
- S3 object listing tested
- S3 object deletion tested

# Remaining

- RDS PostgreSQL infrastructure
- Detailed VPC/networking verification
- Security Group review/hardening
- Infrastructure security review
- End-to-end application QA
