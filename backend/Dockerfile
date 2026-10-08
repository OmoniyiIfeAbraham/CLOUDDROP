FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
# Copy dependency files
COPY prisma ./prisma/

RUN npm ci
# Install dependencies and generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

COPY prisma ./prisma
COPY prisma7.config.ts ./

RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

EXPOSE 5000

# Health check calling /health
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

CMD ["npm", "start"]
