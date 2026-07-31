# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/package.json
RUN pnpm install --filter @maher/api... --frozen-lockfile=false

FROM deps AS build
COPY apps/api ./apps/api
COPY packages ./packages
RUN pnpm --filter @maher/types build \
 && pnpm --filter @maher/permissions build \
 && pnpm --filter @maher/validation build \
 && pnpm --filter @maher/logging build \
 && pnpm --filter @maher/config build \
 && pnpm --filter @maher/database generate \
 && pnpm --filter @maher/database build \
 && pnpm --filter @maher/api build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
