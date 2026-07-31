# syntax=docker/dockerfile:1
ARG APP_NAME=admin-web
ARG PORT=3000
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

FROM base AS deps
ARG APP_NAME
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json ./
COPY packages ./packages
COPY apps/${APP_NAME}/package.json ./apps/${APP_NAME}/package.json
RUN pnpm install --filter @maher/${APP_NAME}... --frozen-lockfile=false

FROM deps AS build
ARG APP_NAME
COPY apps/${APP_NAME} ./apps/${APP_NAME}
COPY packages ./packages
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @maher/types build \
 && pnpm --filter @maher/i18n build \
 && pnpm --filter @maher/ui build \
 && pnpm --filter @maher/${APP_NAME} build

FROM node:20-alpine AS runner
ARG APP_NAME
ARG PORT
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=${PORT}
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app /app
WORKDIR /app/apps/${APP_NAME}
EXPOSE ${PORT}
CMD ["pnpm", "start"]
