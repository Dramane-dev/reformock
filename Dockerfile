FROM node:24-alpine AS deps

ARG TARGETARCH

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,id=pnpm-$TARGETARCH,target=/pnpm/store \
    PNPM_HOME=/pnpm pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:24-alpine

ARG PORT=3000
ARG API_PREFIX=/v1

ENV NODE_ENV=production \
    PORT=${PORT} \
    API_PREFIX=${API_PREFIX}

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY public ./public

USER node

EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD ["node", "-e", "fetch(`http://localhost:${process.env.PORT}${process.env.API_PREFIX}/healthcheck`).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

CMD ["node", "src/index.ts"]
