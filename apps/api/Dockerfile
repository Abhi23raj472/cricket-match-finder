FROM node:22-alpine
WORKDIR /repo
RUN apk add --no-cache openssl && corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter @cmf/api... \
 && pnpm --filter @cmf/shared build \
 && pnpm --filter @cmf/api build
WORKDIR /repo/apps/api
EXPOSE 3000
# Apply pending migrations, then start the API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
