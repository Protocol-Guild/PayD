FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY src/ ./src/

RUN npm run build

# Database bootstrap can run independently of the API compilation step.
FROM node:20-alpine AS migrations
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY src/db/migrations-core.mjs ./src/db/migrations-core.mjs
COPY src/db/migrations/ ./src/db/migrations/
COPY src/db/seed.sql ./src/db/seed.sql
COPY staging/bootstrap.mjs ./staging/bootstrap.mjs
CMD ["node", "staging/bootstrap.mjs"]

FROM node:20-alpine AS production

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /usr/src/app/dist ./dist
COPY .well-known/ ./.well-known/
COPY src/db/migrations-core.mjs ./dist/db/migrations-core.mjs
COPY src/db/migrations/ ./dist/db/migrations/
COPY staging/start.mjs ./staging/start.mjs

EXPOSE 3001

CMD ["node", "dist/index.js"]
