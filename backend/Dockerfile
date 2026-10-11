FROM node:24-alpine

WORKDIR /app

COPY package*.json ./

COPY certs/eu-west-1-bundle.pem /etc/ssl/certs/rds-eu-west-1-bundle.pem

RUN npm ci

COPY prisma ./prisma
COPY prisma7.config.ts ./

RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

EXPOSE 5000

CMD ["npm", "start"]
