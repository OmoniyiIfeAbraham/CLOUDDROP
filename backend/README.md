CloudDrop Backend

Backend API for the CloudDrop application.

Tech Stack
- Node.js
- Express
- TypeScript
- PostgreSQL
- Prisma
- AWS
- JWT Authentication
- Docker

Installation
Install dependencies:
npm install

Environment Variables
Create a .env file in the backend directory:
DATABASE_URL=""
JWT_SECRET=""
PORT=5000

Do not commit the .env file.
Running the Backend

Development:
npm run dev
Build:
npm run build
Production:
npm start
Testing
Run tests:
npm test -- --run

Health Check
GET /health

Expected response:
{
  "success": true,
  "message": "CloudDrop API is running"
}

API Base Path
/api/v1

Authentication Endpoints
Register
POST /api/v1/auth/register

Request body:
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "password"
}

Login
POST /api/v1/auth/login

Get Current User
GET /api/v1/auth/me

Requires:
Authorization: Bearer <token>

File Endpoints
All file endpoints require authentication.

List Files
GET /api/v1/files

Search Files
GET /api/v1/files/search?search=<filename>

Get File
GET /api/v1/files/:id

Upload File
POST /api/v1/files/upload

Uses multipart/form-data.
Form fields:
file
category
Supported categories:
Documents
Images
Videos
Audio
Archives
Other

Download File
GET /api/v1/files/:id/download

Share File
GET /api/v1/files/:id/share

Delete File
DELETE /api/v1/files/:id

Current File Storage Status
The file management endpoints are currently implemented and tested.

AWS S3 integration is the next stage for:
- Uploading files to S3
- Saving file metadata to PostgreSQL
- Downloading files from S3
- Deleting files from S3
- Generating temporary S3 presigned sharing URLs
