# syntax=docker/dockerfile:1

# ---- deps: install all dependencies (incl. dev for the build) ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# ---- builder: compile the Next.js standalone server ----
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner: minimal, non-root runtime ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Standalone server + static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Migration/seed scripts + SQL (used by the Helm migrate hook Job)
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/db ./db
# Pure-JS deps needed by scripts (not traced into standalone)
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/postgres ./node_modules/postgres
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs

USER nextjs
EXPOSE 3000

# server.js is emitted by Next.js standalone output
CMD ["node", "server.js"]
