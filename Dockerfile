# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package files first (cache layer)
COPY package*.json ./

# Install all deps (including devDeps for build)
RUN npm ci --omit=dev

# ─── Stage 2: Production image ───────────────────────────────────────────────
FROM node:20-alpine AS production

# Timezone (Asia/Kolkata)
RUN apk add --no-cache tzdata
ENV TZ=Asia/Kolkata

WORKDIR /usr/src/app

# Copy installed node_modules from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy application source
COPY . .

# Azure App Service uses PORT env variable (default 8080)
# We default to 3000 for local dev
EXPOSE 3000

# Use non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Health check for Azure
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/health || exit 1

CMD ["node", "server.js"]
