FROM node:22-alpine@sha256:9385cd9f3001dfc3431e8ead12c43e9e1f87cc1b9b5c6cfd0f73865d405b27c4 AS deps

WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json /repo/
COPY apps/web/package.json /repo/apps/web/package.json
COPY apps/mcp-server/package.json /repo/apps/mcp-server/package.json
COPY packages/evals/package.json /repo/packages/evals/package.json
COPY packages/prompts/package.json /repo/packages/prompts/package.json
COPY packages/shared-types/package.json /repo/packages/shared-types/package.json
RUN npm ci --workspace @ragpilot/web --include-workspace-root=false

FROM deps AS builder
COPY apps/web /repo/apps/web
RUN npm --workspace @ragpilot/web run build

FROM node:22-alpine@sha256:9385cd9f3001dfc3431e8ead12c43e9e1f87cc1b9b5c6cfd0f73865d405b27c4 AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S ragpilot && adduser -S ragpilot -G ragpilot
COPY --from=deps /repo/node_modules /app/node_modules
COPY --from=builder /repo/apps/web/.next /app/.next
COPY --from=builder /repo/apps/web/package.json /app/package.json
COPY --from=builder /repo/apps/web/next.config.ts /app/next.config.ts
USER ragpilot
EXPOSE 3000
CMD ["./node_modules/.bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
