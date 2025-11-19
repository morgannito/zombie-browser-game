#!/bin/bash
# Script d'installation rapide du système de déploiement automatique

set -e

echo "🚀 Installation du système de déploiement automatique"
echo "======================================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js n'est pas installé${NC}"
    echo "Installez Node.js avec: brew install node"
    exit 1
fi

echo -e "${GREEN}✅ Node.js détecté: $(node --version)${NC}"

# Vérifier Git
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git n'est pas installé${NC}"
    echo "Installez Git avec: brew install git"
    exit 1
fi

echo -e "${GREEN}✅ Git détecté: $(git --version)${NC}"
echo ""

# Générer le secret webhook
echo "🔐 Génération du secret webhook..."
SECRET=$(openssl rand -hex 32)
echo -e "${GREEN}✅ Secret généré: ${SECRET:0:8}...${NC}"
echo ""

# Demander le port
read -p "Port du serveur de déploiement (défaut: 9000): " DEPLOY_PORT
DEPLOY_PORT=${DEPLOY_PORT:-9000}

# Créer .env.deploy.local
echo "📝 Création de .env.deploy.local..."
cat > .env.deploy.local <<EOF
# Configuration du serveur de déploiement
DEPLOY_PORT=${DEPLOY_PORT}
GITHUB_WEBHOOK_SECRET=${SECRET}
DEPLOY_BRANCH=main
EOF

echo -e "${GREEN}✅ Fichier .env.deploy.local créé${NC}"
echo ""

# Rendre deploy-server.js exécutable
chmod +x deploy-server.js
echo -e "${GREEN}✅ deploy-server.js rendu exécutable${NC}"

# Détecter le chemin de Node.js
NODE_PATH=$(which node)
echo -e "${GREEN}✅ Node.js détecté à: ${NODE_PATH}${NC}"

# Obtenir le répertoire actuel
PROJECT_DIR=$(pwd)
echo -e "${GREEN}✅ Répertoire projet: ${PROJECT_DIR}${NC}"
echo ""

# Mettre à jour le fichier plist avec les bons chemins
echo "📝 Configuration du service LaunchAgent..."
sed -i '' "s|<string>/usr/local/bin/node</string>|<string>${NODE_PATH}</string>|g" com.zombiegame.deploy.plist
sed -i '' "s|<string>/Users/mriu/Downloads/zombie-jeu-claude-zombie-browser-game-01LsByqwV5Bu53dYRWW7nWbA/deploy-server.js</string>|<string>${PROJECT_DIR}/deploy-server.js</string>|g" com.zombiegame.deploy.plist
sed -i '' "s|<string>/Users/mriu/Downloads/zombie-jeu-claude-zombie-browser-game-01LsByqwV5Bu53dYRWW7nWbA</string>|<string>${PROJECT_DIR}</string>|g" com.zombiegame.deploy.plist
sed -i '' "s|<string>changeme-generate-strong-secret</string>|<string>${SECRET}</string>|g" com.zombiegame.deploy.plist

echo -e "${GREEN}✅ Service LaunchAgent configuré${NC}"
echo ""

# Test du serveur
echo "🧪 Test du serveur de déploiement..."
echo "Appuyez sur Ctrl+C après avoir vu 'Ready to receive GitHub webhooks!'"
echo ""

node deploy-server.js &
DEPLOY_PID=$!

sleep 3

# Vérifier que le serveur tourne
if ps -p $DEPLOY_PID > /dev/null; then
    echo -e "${GREEN}✅ Serveur de déploiement fonctionne!${NC}"
    kill $DEPLOY_PID
else
    echo -e "${RED}❌ Le serveur n'a pas démarré${NC}"
    exit 1
fi

echo ""
echo "======================================================="
echo -e "${GREEN}✅ Installation terminée!${NC}"
echo "======================================================="
echo ""
echo "📋 Prochaines étapes:"
echo ""
echo "1. ${YELLOW}Exposer le serveur à Internet${NC}"
echo "   Option A - IP publique:"
echo "     - Configurez votre routeur pour rediriger le port ${DEPLOY_PORT}"
echo "     - Configurez le firewall macOS"
echo ""
echo "   Option B - Tunnel ngrok (test):"
echo "     brew install ngrok"
echo "     ngrok http ${DEPLOY_PORT}"
echo ""
echo "   Option C - Localtunnel (gratuit):"
echo "     npm install -g localtunnel"
echo "     lt --port ${DEPLOY_PORT} --subdomain zombiegame"
echo ""
echo "2. ${YELLOW}Configurer le webhook GitHub${NC}"
echo "   - URL: http://votre-ip-ou-tunnel:${DEPLOY_PORT}/webhook"
echo "   - Content type: application/json"
echo "   - Secret: ${SECRET}"
echo "   - Event: Just the push event"
echo ""
echo "3. ${YELLOW}Installer le service (optionnel)${NC}"
echo "   npm run deploy:install"
echo ""
echo "4. ${YELLOW}Tester${NC}"
echo "   git add ."
echo "   git commit -m 'test: auto deploy'"
echo "   git push origin main"
echo ""
echo "📝 Fichiers créés:"
echo "   - .env.deploy.local (configuration)"
echo "   - deploy.log (sera créé au premier déploiement)"
echo ""
echo "📚 Documentation complète: DEPLOY_SETUP.md"
echo ""
echo -e "${GREEN}🎉 Votre Mac mini est prêt pour le déploiement automatique!${NC}"
