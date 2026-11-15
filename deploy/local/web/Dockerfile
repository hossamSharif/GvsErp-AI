# syntax=docker/dockerfile:1.6
# gvs-web: Next.js web app for the Local Edition (standalone server).
# Build from the repo root:
#   docker build -f deploy/local/web/Dockerfile -t gvs-web .
#
# No per-install values are baked in: the Supabase anon key and the
# DEPLOYMENT_MODE are read from the container env at request time
# (see apps/web/src/lib/runtime-config.ts).

ARG NODE_VERSION=20-alpine

FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
WORKDIR /repo

FROM base AS builder
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY packages/offline-engine/package.json ./packages/offline-engine/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile --filter @erp/web...

COPY apps/web ./apps/web
COPY packages/database ./packages/database
COPY packages/shared ./packages/shared
COPY packages/offline-engine ./packages/offline-engine
COPY packages/ui ./packages/ui

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_BUILD_STANDALONE=1
# Placeholders: the cloud reads these at build time; the local edition ignores
# them and uses the runtime config instead.
ENV NEXT_PUBLIC_SUPABASE_URL=http://localhost
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=local-runtime
RUN pnpm --filter @erp/database build \
 && pnpm --filter @erp/shared build \
 && pnpm --filter @erp/offline-engine build \
 && pnpm --filter @erp/ui build \
 && pnpm --filter @erp/web build

FROM node:${NODE_VERSION} AS runner
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone server + the static assets it doesn't copy itself.
COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/public ./apps/web/public

RUN addgroup -S app && adduser -S -G app app && chown -R app:app /app
USER app

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
