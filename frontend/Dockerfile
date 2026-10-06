FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .

# These values are public browser build inputs, not pod runtime configuration.
ARG VITE_API_URL
ARG PUBLIC_STELLAR_NETWORK
ARG PUBLIC_STELLAR_HORIZON_URL
ARG PUBLIC_STELLAR_RPC_URL
ENV VITE_API_URL=${VITE_API_URL} \
    PUBLIC_STELLAR_NETWORK=${PUBLIC_STELLAR_NETWORK} \
    PUBLIC_STELLAR_HORIZON_URL=${PUBLIC_STELLAR_HORIZON_URL} \
    PUBLIC_STELLAR_RPC_URL=${PUBLIC_STELLAR_RPC_URL}
RUN : "${PUBLIC_STELLAR_NETWORK:?Set the public Stellar network build argument}" && \
    : "${PUBLIC_STELLAR_HORIZON_URL:?Set the public Horizon build argument}" && \
    : "${PUBLIC_STELLAR_RPC_URL:?Set the public Soroban RPC build argument}" && \
    npm run build

FROM nginx:alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
