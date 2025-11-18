# Utiliser Node.js 20 LTS (requis par better-sqlite3 v12.4.1)
FROM node:20-alpine

# Installer les dépendances pour better-sqlite3 (compilation native)
RUN apk add --no-cache python3 make g++

# Définir le répertoire de travail
WORKDIR /app

# Copier package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances (avec rebuild de better-sqlite3)
RUN npm install --production && \
    npm rebuild better-sqlite3

# Copier le reste de l'application
COPY . .

# Créer les répertoires nécessaires avec permissions
RUN mkdir -p /app/data /app/logs && \
    chmod -R 755 /app/data /app/logs

# Exposer le port 3000
EXPOSE 3000

# Variables d'environnement par défaut
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/game.db \
    LOG_DIR=/app/logs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Commande pour démarrer l'application
CMD ["node", "server.js"]
