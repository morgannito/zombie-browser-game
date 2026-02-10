#!/usr/bin/env node
/**
 * AUTO-DEPLOY SERVER
 * Ecoute les webhooks GitHub et redémarre automatiquement le projet
 * Port: 9000 (configurable via DEPLOY_PORT)
 */

const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const PORT = process.env.DEPLOY_PORT || 9000;
const SECRET = process.env.GITHUB_WEBHOOK_SECRET;
const PROJECT_DIR = __dirname;
const LOG_FILE = path.join(PROJECT_DIR, 'deploy.log');
const PID_FILE = path.join(PROJECT_DIR, '.game.pid');

// Require GITHUB_WEBHOOK_SECRET - refuse to start without it
if (!SECRET) {
  console.error(
    '[FATAL] GITHUB_WEBHOOK_SECRET environment variable is not set. ' +
      'The deploy server cannot start without a webhook secret. ' +
      'Set it via: export GITHUB_WEBHOOK_SECRET="your-secret"'
  );
  process.exit(1);
}

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

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
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

/**
 * Write a PID to the PID file after starting the game server.
 * @param {number} pid - The process ID to record
 */
function writePidFile(pid) {
  fs.writeFileSync(PID_FILE, String(pid), 'utf-8');
  log(`PID ${pid} written to ${PID_FILE}`);
}

/**
 * Read the PID from the PID file, if it exists and is valid.
 * @returns {number|null} The PID or null if unavailable
 */
function readPidFile() {
  try {
    if (!fs.existsSync(PID_FILE)) {
      return null;
    }
    const content = fs.readFileSync(PID_FILE, 'utf-8').trim();
    const pid = parseInt(content, 10);
    if (isNaN(pid) || pid <= 0) {
      return null;
    }
    return pid;
  } catch {
    return null;
  }
}

/**
 * Check if a process with the given PID is still running.
 * @param {number} pid
 * @returns {boolean}
 */
function isProcessRunning(pid) {
  try {
    // signal 0 checks existence without killing
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Stop the game server gracefully using the PID file.
 * Sends SIGTERM and waits for exit. Falls back to SIGKILL
 * only on the recorded PID if SIGTERM fails.
 */
async function stopGameServer() {
  const pid = readPidFile();
  if (!pid) {
    log('No PID file found, no server to stop');
    return;
  }

  if (!isProcessRunning(pid)) {
    log(`PID ${pid} is not running, cleaning up stale PID file`);
    cleanupPidFile();
    return;
  }

  log(`Sending SIGTERM to PID ${pid}...`);
  try {
    process.kill(pid, 'SIGTERM');
  } catch (err) {
    log(`Failed to send SIGTERM to ${pid}: ${err.message}`);
    cleanupPidFile();
    return;
  }

  // Wait up to 10 seconds for graceful shutdown
  const maxWait = 10;
  for (let i = 0; i < maxWait; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (!isProcessRunning(pid)) {
      log(`PID ${pid} stopped gracefully`);
      cleanupPidFile();
      return;
    }
  }

  // Force kill only this specific PID as last resort
  log(`PID ${pid} did not exit after ${maxWait}s, sending SIGKILL`);
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // Process may have exited between check and kill
  }
  cleanupPidFile();
}

/**
 * Remove the PID file.
 */
function cleanupPidFile() {
  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Start the game server and record its PID.
 */
async function startGameServer() {
  log('Starting game server...');
  const child = exec('node server.js > server.log 2>&1', { cwd: PROJECT_DIR });

  if (child.pid) {
    writePidFile(child.pid);
    // Detach so deploy-server does not wait on it
    child.unref();
  }
}

// Script de déploiement
async function deploy() {
  log('========================================');
  log('Starting deployment...');

  try {
    // 1. Arrêter le serveur existant via PID file
    log('Step 1/5: Stopping existing server...');
    await stopGameServer();

    // 2. Git fetch et pull
    log('Step 2/5: Pulling latest changes...');
    await runCommand('git fetch origin');
    await runCommand('git reset --hard origin/main');

    // 3. Installer les dépendances
    log('Step 3/5: Installing dependencies...');
    await runCommand('npm install --production');

    // 4. Redémarrer le serveur
    log('Step 4/5: Starting server...');
    await startGameServer();

    // 5. Vérifier que le serveur démarre
    log('Step 5/5: Verifying server startup...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
      await runCommand('lsof -i:3000');
      log('Server is running on port 3000');
    } catch {
      log('Warning: Could not verify server is running');
    }

    log('Deployment completed successfully!');
    log('========================================\n');

    return { success: true, message: 'Deployment successful' };
  } catch (error) {
    log(`Deployment failed: ${error.message}`);
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
          log('Invalid signature from webhook request');
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid signature' }));
          return;
        }

        // Parser le payload
        const payload = JSON.parse(body);
        const event = req.headers['x-github-event'];

        log(`Received GitHub event: ${event}`);

        // Ne déployer que sur push vers main
        if (event === 'push' && payload.ref === 'refs/heads/main') {
          log(`Push detected to main branch by ${payload.pusher.name}`);
          log(`Commits: ${payload.commits.length}`);

          // Lancer le déploiement de manière asynchrone
          deploy().then(result => {
            log(`Deployment result: ${JSON.stringify(result)}`);
          });

          // Répondre immédiatement au webhook
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              message: 'Deployment started',
              status: 'processing'
            })
          );
        } else {
          log(`Ignoring event ${event} for ref ${payload.ref || 'N/A'}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Event ignored' }));
        }
      } catch (error) {
        log(`Error processing webhook: ${error.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/health') {
    // Health check endpoint
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'healthy',
        uptime: process.uptime(),
        deployServer: 'running'
      })
    );
  } else if (req.method === 'POST' && req.url === '/deploy') {
    // Manual deploy endpoint (protégé par secret)
    const authHeader = req.headers['authorization'];

    if (authHeader !== `Bearer ${SECRET}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    log('Manual deployment triggered');

    deploy()
      .then(result => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      })
      .catch(error => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: false,
            message: error.message
          })
        );
      });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// Démarrer le serveur
server.listen(PORT, () => {
  log(`Deploy server listening on port ${PORT}`);
  log(`Project directory: ${PROJECT_DIR}`);
  log(`Webhook secret: ${SECRET.slice(0, 3)}***`);
  log(`PID file: ${PID_FILE}`);
  log(`Logs: ${LOG_FILE}`);
  log('Ready to receive GitHub webhooks!\n');
});

// Gérer les erreurs
process.on('uncaughtException', error => {
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
