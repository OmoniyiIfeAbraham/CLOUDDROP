# CloudDrop Architecture

## Overview

## Application Components

### Frontend
React + TypeScript + Vite

### Backend
Node.js + Express + TypeScript

### Database
Amazon RDS PostgreSQL

### Object Storage
Amazon S3

### Compute
Amazon EC2

### Authentication
JWT

### AWS Authorization
IAM Role / EC2 Instance Profile

### Reverse Proxy
Nginx

### Containerization
Docker

### CI/CD
GitHub Actions

## Request Flow

## File Upload Flow

## File Download/Sharing Flow

## Security Architecture

## CI/CD Flow

## Architecture Flow

User
 ↓ HTTPS
Nginx
 ↓
EC2 / CloudDrop
 ├──→ S3
 │     Files
 │
 └──→ RDS PostgreSQL
       Metadata


Developer
 ↓
Feature Branch
 ↓
Pull Request
 ↓
Review
 ↓
main
 ↓
GitHub Actions
 ↓
Test → Build → Docker → Deploy
 ↓
EC2
 ↓
Health Check