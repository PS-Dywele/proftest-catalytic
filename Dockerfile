# syntax=docker/dockerfile:1

##############################
# Stage 1 — build with Bun
##############################
FROM node:22-alpine AS builder

# Bun needs bash/libstdc++ on Alpine
RUN apk add --no-cache bash curl unzip libstdc++ \
  && curl -fsSL https://bun.sh/install | bash
ENV BUN_INSTALL=/root/.bun
ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build the app as a standalone Node (Nitro) server
COPY . .
ENV NODE_ENV=production
ENV NITRO_PRESET=node-server
# Cisco Secure Access normally publishes a dedicated hostname and preserves `/`,
# so the default is root. Set this only when the public URL genuinely contains a
# path prefix, e.g. --build-arg APP_BASE_PATH=/catalytic/.
ARG APP_BASE_PATH=/
ENV APP_BASE_PATH=${APP_BASE_PATH}
ENV NITRO_APP_BASE_URL=${APP_BASE_PATH}
RUN bun run build

##############################
# Stage 2 — runtime (Node 22)
##############################
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV NITRO_PORT=3000
ENV NITRO_HOST=0.0.0.0
ARG APP_BASE_PATH=/
ENV APP_BASE_PATH=${APP_BASE_PATH}
ENV NITRO_APP_BASE_URL=${APP_BASE_PATH}

# The Nitro node-server output is fully self-contained:
# .output/server (bundled server + deps) and .output/public (static assets).
COPY --from=builder --chown=node:node /app/.output ./.output

USER node
EXPOSE 3000

# BusyBox wget is included in Alpine. This catches missing SSR routes and an
# incorrectly configured base path instead of leaving a broken container healthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}${APP_BASE_PATH}" || exit 1

CMD ["node", ".output/server/index.mjs"]
