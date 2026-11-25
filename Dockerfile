FROM oven/bun:1-alpine

RUN apk add --no-cache ffmpeg git \
    && git config --global url."https://github.com/".insteadOf "ssh://git@github.com/" \
    && git config --global --add url."https://github.com/".insteadOf "git+ssh://git@github.com/" \
    && git config --global --add url."https://github.com/".insteadOf "git@github.com:"

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY . .
RUN mkdir -p /app/src/database

ENV NODE_ENV=production

CMD ["bun", "run", "start"]
