# syntax=docker/dockerfile:1
FROM node:22.13.0-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22.13.0-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN node scripts/build-production-migrator.mjs /tmp/migrate-production.mjs

FROM node:22.13.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next-study-space/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next-study-space/static ./.next-study-space/static
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /tmp/migrate-production.mjs ./scripts/migrate-production.mjs
RUN node -e "const fs=require('node:fs');const p=JSON.parse(fs.readFileSync('package.json'));p.scripts['db:migrate']='node scripts/migrate-production.mjs';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\\n')"
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- 'http://127.0.0.1:3000/api/health?probe=live' >/dev/null || exit 1
CMD ["node", "server.js"]
