#!/usr/bin/env node
/**
 * AUTO-DEPLOY SERVER
 * Écoute les webhooks GitHub et redémarre automatiquement le projet
 * Port: 9000 (configurable via DEPLOY_PORT)
 */

const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const PORT = process.env.DEPLOY_PORT || 9000;
const SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'your-webhook-secret-change-me';
const PROJECT_DIR = __dirname;
const LOG_FILE = path.join(PROJECT_DIR, 'deploy.log');

// Logs
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage.trim());
  fs.appendFileSync(LOG_FILE, logMessage);
}

// Vérifie la signature GitHub
function verifySignature(payload, signature) {
  if (!signature) {
    return false;
  }

  const hmac = crypto.createHmac('sha256', SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

// Exécute une commande shell
function runCommand(command) {
  return new Promise((resolve, reject) => {
    log(`Executing: ${command}`);
    exec(command, { cwd: PROJECT_DIR }, (error, stdout, stderr) => {
      if (error) {
        log(`Error: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        log(`Stderr: ${stderr}`);
      }
      if (stdout) {
        log(`Stdout: ${stdout}`);
      }
      resolve(stdout);
    });
  });
}

// Script de déploiement
async function deploy() {
  log('========================================');
  log('🚀 Starting deployment...');

  try {
    // 1. Arrêter le serveur existant
    log('Step 1/6: Stopping existing server...');
    try {
      await runCommand('lsof -ti:3000 | xargs kill -9 2>/dev/null || true');
      await runCommand('pkill -f "node.*server.js" || true');
    } catch (err) {
      log('No server to stop (this is OK)');
    }

    // 2. Git fetch et pull
    log('Step 2/6: Pulling latest changes...');
    await runCommand('git fetch origin');
    await runCommand('git reset --hard origin/main');

    // 3. Installer les dépendances
    log('Step 3/6: Installing dependencies...');
    await runCommand('npm install --production');

    // 4. Build si nécessaire (optionnel)
    // await runCommand('npm run build');

    // 5. Nettoyer les anciens processus zombies
    log('Step 4/6: Cleaning up zombie processes...');
    await runCommand('pkill -9 node || true');

    // 6. Redémarrer le serveur
    log('Step 5/6: Starting server...');
    // Utiliser nohup pour garder le processus actif après déconnexion
    await runCommand('nohup npm start > server.log 2>&1 &');

    // 7. Vérifier que le serveur démarre
    log('Step 6/6: Verifying server startup...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
      await runCommand('lsof -i:3000');
      log('✅ Server is running on port 3000');
    } catch (err) {
      log('⚠️  Warning: Could not verify server is running');
    }

    log('✅ Deployment completed successfully!');
    log('========================================\n');

    return { success: true, message: 'Deployment successful' };

  } catch (error) {
    log(`❌ Deployment failed: ${error.message}`);
    log('========================================\n');
    return { success: false, message: error.message };
  }
}

// Serveur HTTP pour recevoir les webhooks
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        // Vérifier la signature GitHub
        const signature = req.headers['x-hub-signature-256'];

        if (!verifySignature(body, signature)) {
          log('⚠️  Invalid signature from webhook request');
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid signature' }));
          return;
        }

        // Parser le payload
        const payload = JSON.parse(body);
        const event = req.headers['x-github-event'];

        log(`📬 Received GitHub event: ${event}`);

        // Ne déployer que sur push vers main
        if (event === 'push' && payload.ref === 'refs/heads/main') {
          log(`🔔 Push detected to main branch by ${payload.pusher.name}`);
          log(`Commits: ${payload.commits.length}`);

          // Lancer le déploiement de manière asynchrone
          deploy().then(result => {
            log(`Deployment result: ${JSON.stringify(result)}`);
          });

          // Répondre immédiatement au webhook
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            message: 'Deployment started',
            status: 'processing'
          }));
        } else {
          log(`ℹ️  Ignoring event ${event} for ref ${payload.ref || 'N/A'}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Event ignored' }));
        }

      } catch (error) {
        log(`❌ Error processing webhook: ${error.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });

  } else if (req.method === 'GET' && req.url === '/health') {
    // Health check endpoint
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      uptime: process.uptime(),
      deployServer: 'running'
    }));

  } else if (req.method === 'POST' && req.url === '/deploy') {
    // Manual deploy endpoint (protégé par secret)
    const authHeader = req.headers['authorization'];

    if (authHeader !== `Bearer ${SECRET}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    log('🔧 Manual deployment triggered');

    deploy().then(result => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    }).catch(error => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: error.message
      }));
    });

  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// Démarrer le serveur
server.listen(PORT, () => {
  log(`🎧 Deploy server listening on port ${PORT}`);
  log(`📁 Project directory: ${PROJECT_DIR}`);
  log(`🔐 Webhook secret: ${SECRET.slice(0, 3)}***`);
  log(`📝 Logs: ${LOG_FILE}`);
  log('Ready to receive GitHub webhooks!\n');
});

// Gérer les erreurs
process.on('uncaughtException', (error) => {
  log(`Uncaught exception: ${error.message}`);
  console.error(error);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled rejection at ${promise}: ${reason}`);
  console.error(reason);
});

// Cleanup gracieux
process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    log('Deploy server stopped');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('Received SIGINT, shutting down gracefully...');
  server.close(() => {
    log('Deploy server stopped');
    process.exit(0);
  });
});
