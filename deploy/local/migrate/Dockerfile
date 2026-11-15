# gvs-migrate: one-shot container that applies pending SQL migrations.
# Build from the repo root:
#   docker build -f deploy/local/migrate/Dockerfile -t gvs-migrate .
FROM postgres:17-alpine

COPY packages/database/migrations /migrations
COPY deploy/local/migrate/migrate.sh /usr/local/bin/migrate.sh
RUN chmod +x /usr/local/bin/migrate.sh

ENV MIGRATIONS_DIR=/migrations
ENTRYPOINT ["/usr/local/bin/migrate.sh"]
