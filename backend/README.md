# CloudDrop Backend

Backend API for the CloudDrop application.

## Tech Stack

- Node.js
- Express
- TypeScript
- PostgreSQL
- Prisma
- AWS

## Installation

Install dependencies:

```bash
npm install
```

## Environment Variables

Create a `.env` file in the backend directory:

```env
DATABASE_URL=""
PORT=5000
```

Do not commit the `.env` file.

## Running the Backend

Development:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Production:

```bash
npm start
```

## Testing

Run tests:

```bash
npm test -- --run
```

## Health Check

```text
GET /health
```

Expected response:

```json
{
  "success": true,
  "message": "CloudDrop API is running"
}
```

## API Base Path

```text
/api/v1
```
