# Build from the repo root: docker build -f apps/api/Dockerfile .
FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@12.3.2
WORKDIR /repo

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @irs-az/api
COPY apps/api apps/api
RUN pnpm --filter @irs-az/api exec prisma generate \
  && pnpm --filter @irs-az/api build \
  && pnpm --filter @irs-az/api deploy --prod --legacy /out \
  && cp -r apps/api/dist apps/api/prisma /out/ \
  && cd /out && npx prisma generate

FROM base AS runner
ENV NODE_ENV=production PORT=4000
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4000
# Apply pending migrations, then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
