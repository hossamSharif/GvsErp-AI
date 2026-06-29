# syntax=docker/dockerfile:1.6
# Multi-stage build for apps/api in a pnpm workspace monorepo.
# Targets Fly.io / any container runtime. Builds @erp/database,
# @erp/shared and @erp/offline-engine first (they are workspace deps of the
# API), then builds the API and produces a minimal prod-only runtime image.

ARG NODE_VERSION=20-alpine

# ---------- base ----------
FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
WORKDIR /repo

# ---------- builder ----------
FROM base AS builder

# Copy lockfile + workspace manifests first so layer caches survive source edits.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY packages/offline-engine/package.json ./packages/offline-engine/

RUN pnpm install --frozen-lockfile

# Bring in source for the api and its workspace deps only.
COPY apps/api ./apps/api
COPY packages/database ./packages/database
COPY packages/shared ./packages/shared
COPY packages/offline-engine ./packages/offline-engine

# Build deps before the API so their dist/ exists when the API resolves them.
RUN pnpm --filter @erp/database build \
 && pnpm --filter @erp/shared build \
 && pnpm --filter @erp/offline-engine build \
 && pnpm --filter @erp/api build

# Self-contained prod bundle (workspace deps inlined into node_modules).
RUN pnpm --filter @erp/api --prod deploy /deploy

# ---------- runner ----------
FROM node:${NODE_VERSION} AS runner
RUN apk add --no-cache libc6-compat tini
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /deploy/dist ./dist
COPY --from=builder /deploy/node_modules ./node_modules
COPY --from=builder /deploy/package.json ./

RUN addgroup -S app && adduser -S -G app app && chown -R app:app /app
USER app

EXPOSE 3001
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
