FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock* ./

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

EXPOSE 3000

CMD ["bun", "run", "dev"]
