# Stage 1: builder — installe uniquement les deps prod (devDeps comme canvas
# ont des natives cairo/pango non requises runtime).
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
# HUSKY=0 évite l'échec du hook prepare (devDep)
RUN HUSKY=0 npm ci --omit=dev --ignore-scripts && npm rebuild better-sqlite3

# Stage 2: runtime — image finale allégée
FROM node:20-alpine AS runtime

RUN apk add --no-cache curl

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Copier les artefacts applicatifs
COPY server.js ./
COPY config/ ./config/
COPY contexts/ ./contexts/
COPY database/ ./database/
COPY game/ ./game/
COPY infrastructure/ ./infrastructure/
COPY lib/ ./lib/
COPY middleware/ ./middleware/
COPY public/ ./public/
COPY server/ ./server/
COPY sockets/ ./sockets/
COPY transport/ ./transport/

# Répertoires runtime
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app

EXPOSE ${PORT:-3000}

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/game.db \
    LOG_DIR=/app/logs

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fs http://localhost:${PORT:-3000}/health || exit 1

USER node

CMD ["node", "server.js"]
