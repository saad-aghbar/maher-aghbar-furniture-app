# syntax=docker/dockerfile:1
# Unified website (apps/web, @maher/web). Render sets PORT at runtime.
ARG APP_NAME=web
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
ARG NEXT_PUBLIC_API_URL=https://maher-demo-api.onrender.com
COPY apps/${APP_NAME} ./apps/${APP_NAME}
COPY packages ./packages
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @maher/types build \
 && pnpm --filter @maher/permissions build \
 && pnpm --filter @maher/workflow-domain build \
 && pnpm --filter @maher/i18n build \
 && pnpm --filter @maher/ui build \
 && pnpm --filter @maher/${APP_NAME} build

FROM node:20-alpine AS runner
ARG APP_NAME
ARG PORT
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=${PORT}
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app /app
WORKDIR /app/apps/${APP_NAME}
EXPOSE ${PORT}
CMD ["sh", "-c", "exec pnpm exec next start -H 0.0.0.0 -p \"${PORT:-3000}\""]
