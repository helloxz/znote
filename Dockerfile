FROM oven/bun:1 AS builder

WORKDIR /opt/zest

COPY package.json tsconfig.json drizzle.config.ts build_frontend.sh ./
COPY backend ./backend
COPY frontend/package.json frontend/index.html frontend/env.d.ts frontend/vite.config.ts frontend/tsconfig.json frontend/tsconfig.app.json frontend/tsconfig.node.json ./frontend/
COPY frontend/src ./frontend/src

RUN bun install
RUN cd frontend && bun install
RUN sh build_frontend.sh

FROM oven/bun:1-slim

WORKDIR /opt/zest

COPY package.json tsconfig.json drizzle.config.ts run.sh build_frontend.sh ./
COPY backend ./backend
COPY --from=builder /opt/zest/node_modules ./node_modules
COPY --from=builder /opt/zest/dist ./dist
COPY --from=builder /opt/zest/public ./public

VOLUME /opt/zest/data
EXPOSE 3080

CMD ["sh", "run.sh"]
