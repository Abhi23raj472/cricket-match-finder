FROM node:22-alpine
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter @cmf/api... \
 && pnpm --filter @cmf/shared build \
 && pnpm --filter @cmf/api build
WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
