# Multi-stage build: Node build stage + nginx runtime stage
# Docs: https://vite.dev/guide/static-deploy

# ---------- Build stage ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .

# Build the static site (tsc + vite build)
ARG VITE_API_URL
ARG VITE_STELLAR_NETWORK
ARG VITE_STELLAR_NETWORK_PASSPHRASE
ARG VITE_STELLAR_HORIZON_URL
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_STELLAR_NETWORK=${VITE_STELLAR_NETWORK} \
    VITE_STELLAR_NETWORK_PASSPHRASE=${VITE_STELLAR_NETWORK_PASSPHRASE} \
    VITE_STELLAR_HORIZON_URL=${VITE_STELLAR_HORIZON_URL}

RUN npm run build

# ---------- Runtime stage ----------
FROM nginx:1.27-alpine AS production

# SPA routing with fallback to index.html + caching headers
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/ > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]