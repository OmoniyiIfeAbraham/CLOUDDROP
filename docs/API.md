# CloudDrop API Documentation

## 1. API Overview

CloudDrop provides a REST API for user authentication and file management.

### Base URL

```text
/api/v1
```

### Authentication

Protected endpoints require a JWT access token.

```http
Authorization: Bearer <token>
```

The token is returned after successful registration or login.

---

# 2. Authentication Endpoints

## 2.1 Register User

Creates a new CloudDrop account.

### Endpoint

```http
POST /api/v1/auth/register
```

### Authentication

Not required.

### Request Body

```json
{
  "firstName": "Eunice",
  "lastName": "Aduramigba",
  "email": "user@example.com",
  "password": "password123"
}
```

### Success Response

**201 Created**

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "user-uuid",
      "firstName": "Eunice",
      "lastName": "Aduramigba",
      "email": "user@example.com"
    },
    "token": "<jwt-token>"
  }
}
```

The password and password hash are never returned.

---

## 2.2 Login

Authenticates an existing user.

### Endpoint

```http
POST /api/v1/auth/login
```

### Authentication

Not required.

### Request Body

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Success Response

**200 OK**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user-uuid",
      "firstName": "Eunice",
      "lastName": "Aduramigba",
      "email": "user@example.com"
    },
    "token": "<jwt-token>"
  }
}
```

### Possible Error

**Invalid credentials**

```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

---

## 2.3 Get Current User

Returns the authenticated user's information.

### Endpoint

```http
GET /api/v1/auth/me
```

### Authentication

Required.

```http
Authorization: Bearer <token>
```

### Success Response

**200 OK**

```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "user": {
      "id": "user-uuid",
      "firstName": "Eunice",
      "lastName": "Aduramigba",
      "email": "user@example.com"
    }
  }
}
```

---

# 3. File Endpoints

All file endpoints require authentication.

```http
Authorization: Bearer <token>
```

---

## 3.1 Upload File

Uploads a file to Amazon S3 and stores its metadata in PostgreSQL.

### Endpoint

```http
POST /api/v1/files/upload
```

### Authentication

Required.

### Content Type

```text
multipart/form-data
```

### Form Fields

| Field | Required | Description |
|---|---|---|
| `file` | Yes | File to upload |
| `category` | Yes | File category |

### Supported Categories

```text
Documents
Images
Videos
Audio
Archives
Other
```

### File Limit

Maximum file size:

```text
100 MB
```

### Success Response

**201 Created**

```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "file": {
      "id": "file-uuid",
      "userId": "user-uuid",
      "originalName": "example.pdf",
      "s3Key": "user-uuid/file-uuid-example.pdf",
      "mimeType": "application/pdf",
      "size": 102400,
      "category": "Documents",
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  }
}
```

### Possible Errors

**400 — File missing**

```json
{
  "success": false,
  "message": "File is required",
  "error": {
    "code": "BAD_REQUEST"
  }
}
```

**400 — File too large**

```json
{
  "success": false,
  "message": "File size exceeds the 100 MB limit",
  "error": {
    "code": "FILE_TOO_LARGE"
  }
}
```

**400 — Unsupported file type**

```json
{
  "success": false,
  "message": "File type is not supported",
  "error": {
    "code": "UNSUPPORTED_FILE_TYPE"
  }
}
```

---

## 3.2 List User Files

Returns all files belonging to the authenticated user.

### Endpoint

```http
GET /api/v1/files
```

### Authentication

Required.

### Success Response

**200 OK**

```json
{
  "success": true,
  "message": "Files retrieved successfully",
  "data": {
    "files": []
  }
}
```

Files are returned with the newest files first.

---

## 3.3 Search Files

Searches the authenticated user's files by filename.

### Endpoint

```http
GET /api/v1/files/search?search=example
```

### Authentication

Required.

### Query Parameter

| Parameter | Required | Description |
|---|---|---|
| `search` | Yes | Text to search for in the filename |

### Success Response

**200 OK**

```json
{
  "success": true,
  "message": "Files search completed successfully",
  "data": {
    "files": []
  }
}
```

The search is case-insensitive.

---

## 3.4 Get File Details

Returns metadata for one file belonging to the authenticated user.

### Endpoint

```http
GET /api/v1/files/:id
```

### Authentication

Required.

### Example

```http
GET /api/v1/files/file-uuid
```

### Success Response

**200 OK**

```json
{
  "success": true,
  "message": "File retrieved successfully",
  "data": {
    "file": {
      "id": "file-uuid",
      "userId": "user-uuid",
      "originalName": "example.pdf",
      "s3Key": "user-uuid/file-uuid-example.pdf",
      "mimeType": "application/pdf",
      "size": 102400,
      "category": "Documents",
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  }
}
```

### Not Found

**404 Not Found**

```json
{
  "success": false,
  "message": "File not found",
  "error": {
    "code": "NOT_FOUND"
  }
}
```

---

## 3.5 Generate Download URL

Generates a temporary presigned S3 URL for downloading a file.

### Endpoint

```http
GET /api/v1/files/:id/download
```

### Authentication

Required.

### Success Response

**200 OK**

```json
{
  "success": true,
  "message": "File download URL generated successfully",
  "data": {
    "file": {
      "id": "file-uuid",
      "originalName": "example.pdf",
      "mimeType": "application/pdf",
      "size": 102400
    },
    "downloadUrl": "<temporary-s3-url>",
    "expiresIn": 600
  }
}
```

### URL Expiration

The download URL expires after:

```text
600 seconds = 10 minutes
```

The file itself is not deleted when the URL expires. A new download URL can be generated.

---

## 3.6 Generate Temporary Share URL

Generates a temporary presigned S3 URL that can be shared with another person.

### Endpoint

```http
GET /api/v1/files/:id/share
```

### Authentication

Required.

### Success Response

**200 OK**

```json
{
  "success": true,
  "message": "Share URL generated successfully",
  "data": {
    "file": {
      "id": "file-uuid",
      "originalName": "example.pdf",
      "mimeType": "application/pdf"
    },
    "shareUrl": "<temporary-s3-url>",
    "expiresIn": 10800
  }
}
```

### URL Expiration

The temporary share URL expires after:

```text
10800 seconds = 3 hours
```

CloudDrop does not create a permanent public link. The file remains private in S3 while the generated URL is temporary.

---

## 3.7 Delete File

Deletes a user's file from S3 and removes its metadata from PostgreSQL.

### Endpoint

```http
DELETE /api/v1/files/:id
```

### Authentication

Required.

### Example

```http
DELETE /api/v1/files/file-uuid
```

### Success Response

**200 OK**

```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

### Not Found

**404 Not Found**

```json
{
  "success": false,
  "message": "File not found",
  "error": {
    "code": "NOT_FOUND"
  }
}
```

---

# 4. Health Check

Checks whether the CloudDrop API is running.

### Endpoint

```http
GET /health
```

### Authentication

Not required.

### Success Response

**200 OK**

```json
{
  "success": true,
  "message": "CloudDrop API is running"
}
```

---

# 5. File Storage Architecture

CloudDrop separates file storage from file metadata.

### Amazon S3

Stores the actual uploaded files.

```text
Amazon S3
   ↓
Actual file
```

### PostgreSQL

Stores file metadata.

```text
PostgreSQL
   ↓
File ID
User ID
Original filename
S3 key
MIME type
File size
Category
Timestamps
```

### Prisma

Prisma is used by the backend to communicate with PostgreSQL.

---

# 6. File Access Flow

### Upload

```text
Client
  ↓
POST /files/upload
  ↓
Backend
  ↓
Validate file
  ↓
Upload to S3
  ↓
Save metadata in PostgreSQL
  ↓
Return file metadata
```

### Download

```text
Client
  ↓
GET /files/:id/download
  ↓
Backend verifies ownership
  ↓
Generate S3 presigned URL
  ↓
Return temporary URL
  ↓
Client downloads file from S3
```

### Share

```text
Client
  ↓
GET /files/:id/share
  ↓
Backend verifies ownership
  ↓
Generate temporary S3 presigned URL
  ↓
Return share URL
  ↓
Recipient accesses file
```

---

# 7. Security

- Passwords are hashed before being stored.
- Password hashes are never returned through the API.
- Authentication uses JWT.
- Protected endpoints require a Bearer token.
- Users can only access their own file metadata through authenticated file endpoints.
- S3 files are accessed through temporary presigned URLs.
- Download URLs expire after 10 minutes.
- Share URLs expire after 3 hours.
- Uploaded files are limited to 100 MB.
- Unsupported MIME types are rejected.

---

# 8. Current API Status

| Feature | Status |
|---|---|
| User registration | Implemented |
| User login | Implemented |
| Current user | Implemented |
| File upload | Implemented |
| File listing | Implemented |
| File search | Implemented |
| File details | Implemented |
| File download | Implemented |
| Temporary file sharing | Implemented |
| File deletion | Implemented |
| Health check | Implemented |
| S3 storage | Implemented |
| PostgreSQL metadata | Implemented |
| JWT authentication | Implemented |
| File validation | Implemented |
| API automated tests | 7/7 passing |

---

# 9. Notes for Frontend Integration

The frontend should:

1. Register or log in the user.
2. Store the returned JWT securely according to the team's frontend authentication approach.
3. Send the token with protected requests:

```http
Authorization: Bearer <token>
```

4. Use `multipart/form-data` for file uploads.
5. Send the file using the field name:

```text
file
```

6. Send the selected category using:

```text
category
```

7. Use the returned `downloadUrl` for file downloads.
8. Use the returned `shareUrl` when the user wants to share a file.
9. Request a new URL after the previous temporary URL expires.

---

# 10. API Base Path

All versioned API endpoints use:

```text
/api/v1
```

Examples:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me

GET  /api/v1/files
GET  /api/v1/files/search
POST /api/v1/files/upload
GET  /api/v1/files/:id
GET  /api/v1/files/:id/download
GET  /api/v1/files/:id/share
DELETE /api/v1/files/:id
```
