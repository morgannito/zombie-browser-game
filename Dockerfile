# Stage 1: build — compile better-sqlite3 avec les outils natifs
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --production && npm rebuild better-sqlite3

# Stage 2: runtime — image finale sans les outils de build
FROM node:20-alpine AS runtime

WORKDIR /app

# Copier uniquement les artefacts nécessaires
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY server.js ./
COPY config/ ./config/
COPY database/ ./database/
COPY game/ ./game/
COPY lib/ ./lib/
COPY middleware/ ./middleware/
COPY public/ ./public/
COPY routes/ ./routes/
COPY shared/ ./shared/
COPY sockets/ ./sockets/

# Créer les répertoires runtime et donner les droits à node
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app

EXPOSE 3000

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/game.db \
    LOG_DIR=/app/logs

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

USER node

CMD ["node", "server.js"]
