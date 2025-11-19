require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const http = require('http').createServer(app);

// Security: Configure allowed origins from environment
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').filter(o => o.length > 0)
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

// CORS strict validation in production
if (ALLOWED_ORIGINS.length === 0 && process.env.NODE_ENV === 'production') {
  console.error('[SECURITY] ALLOWED_ORIGINS must be set in production');
  process.exit(1);
}

const io = require('socket.io')(http, {
  // CORS Configuration - Strict validation
  cors: {
    origin: (origin, callback) => {
      // Allow requests without origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        console.warn('[CORS] Blocked request from origin:', origin);
        callback(new Error('CORS policy violation'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  },
  // Activer la compression des paquets Socket.IO
  perMessageDeflate: {
    threshold: 1024  // Compresser si > 1KB (réduction 30-40%)
  },
  // Permettre polling comme fallback pour éviter les erreurs 400
  // Le client upgradera automatiquement vers websocket quand disponible
  transports: ['polling', 'websocket'],
  allowEIO3: true, // Support Socket.IO v2 clients
  pingTimeout: 60000,
  pingInterval: 25000,
  // Connection options
  connectTimeout: 45000,
  upgradeTimeout: 30000
});
const path = require('path');

// Production infrastructure
const logger = require('./lib/infrastructure/Logger');
const DatabaseManager = require('./lib/database/DatabaseManager');
const Container = require('./lib/application/Container');
const MetricsCollector = require('./lib/infrastructure/MetricsCollector');

// Security infrastructure
const JwtService = require('./lib/infrastructure/auth/JwtService');
const { validate, playerReadySchema, playerActionSchema, reconnectSchema } = require('./lib/infrastructure/validation/schemas');

// Import des modules d'optimisation
const EntityManager = require('./lib/server/EntityManager');
const CollisionManager = require('./lib/server/CollisionManager');
const NetworkManager = require('./lib/server/NetworkManager');
const MathUtils = require('./lib/MathUtils');
const perfIntegration = require('./lib/server/PerformanceIntegration');

// Import des modules de game logic
const ConfigManager = require('./lib/server/ConfigManager');
const ZombieManager = require('./lib/server/ZombieManager');
const RoomManager = require('./lib/server/RoomManager');
const PlayerManager = require('./lib/server/PlayerManager');

const PORT = process.env.PORT || 3000;

// Initialize database
const dbManager = DatabaseManager.getInstance();
dbManager.initialize();
logger.info('Database initialized', { mode: 'WAL' });

// Initialize Clean Architecture container
const container = Container.getInstance();
container.initialize();
logger.info('Application container initialized');

// Initialize metrics collector
const metricsCollector = MetricsCollector.getInstance();
metricsCollector.setTargetFPS(perfIntegration.perfConfig.current.tickRate);
logger.info('Metrics collector initialized');

// Initialize JWT service
const jwtService = new JwtService(logger);
logger.info('JWT service initialized');

// Apply JWT authentication to all Socket.IO connections
// TEMPORARILY DISABLED - Need to implement client-side JWT first
// io.use(jwtService.socketMiddleware());
logger.info('Socket.IO JWT middleware DISABLED (temporary)');

// ===============================================
// SECURITY MIDDLEWARE
// ===============================================

// Security headers (Helmet.js)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per 15 minutes
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiter to API routes
app.use('/api/', apiLimiter);

// Body parser with size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Servir les fichiers statiques
app.use(express.static('public'));

// ===============================================
// REST API ENDPOINTS (Clean Architecture)
// ===============================================

// ===============================================
// AUTHENTICATION ENDPOINT
// ===============================================

/**
 * POST /api/auth/login - Authentification JWT
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username } = req.body;

    // Validation
    if (!username || username.length < 2 || username.length > 20) {
      return res.status(400).json({
        error: 'Invalid username (2-20 characters required)'
      });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({
        error: 'Username can only contain letters, numbers, underscore and dash'
      });
    }

    // Créer ou récupérer le joueur
    const playerRepository = container.get('playerRepository');
    let player = await playerRepository.findByUsername(username);

    if (!player) {
      // Créer un nouveau joueur
      const createPlayerUseCase = container.get('createPlayer');
      const playerId = require('crypto').randomUUID();
      player = await createPlayerUseCase.execute({ id: playerId, username });
    }

    // Générer JWT
    const token = jwtService.generateToken({
      userId: player.id,
      username: player.username
    });

    logger.info('Player authenticated', {
      userId: player.id,
      username: player.username
    });

    res.json({
      token,
      player: {
        id: player.id,
        username: player.username,
        highScore: player.highScore || 0,
        totalKills: player.totalKills || 0,
        gamesPlayed: player.gamesPlayed || 0
      }
    });
  } catch (error) {
    logger.error('Login failed', { error: error.message });
    res.status(500).json({ error: 'Login failed' });
  }
});

// Health check endpoint
// ===============================================
// MONITORING ENDPOINTS
// ===============================================

/**
 * GET /health - Health check avancé avec métriques détaillées
 */
app.get('/health', (req, res) => {
  const dbStatus = dbManager.isInitialized ? 'healthy' : 'unhealthy';
  const metrics = metricsCollector.getMetrics();

  const healthStatus = {
    status: dbStatus === 'healthy' ? 'healthy' : 'unhealthy',
    timestamp: Date.now(),
    uptime: metrics.system.uptime,
    performanceMode: perfIntegration.perfConfig.mode,

    // Game state
    game: {
      players: {
        current: metrics.players.current,
        peak: metrics.players.peak
      },
      zombies: {
        current: metrics.zombies.current,
        killed: metrics.zombies.killed
      },
      wave: metrics.game.currentWave,
      activeSessions: metrics.game.activeGames
    },

    // Performance
    performance: {
      fps: {
        actual: metrics.performance.actualFPS,
        target: metrics.performance.targetFPS
      },
      frameTime: {
        avg: parseFloat(metrics.performance.avgFrameTime.toFixed(2)),
        max: parseFloat(metrics.performance.maxFrameTime.toFixed(2))
      }
    },

    // System resources
    system: {
      memory: {
        heapUsedMB: metrics.system.memory.heapUsedMB,
        heapTotalMB: metrics.system.memory.heapTotalMB,
        rssMB: metrics.system.memory.rssMB,
        systemUsagePercent: metrics.system.system.memoryUsagePercent
      },
      cpu: {
        cores: metrics.system.system.cpus,
        loadAverage: metrics.system.system.loadAverage
      }
    },

    // Database
    database: dbStatus
  };

  const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

/**
 * GET /api/metrics - Métriques Prometheus pour monitoring externe
 */
app.get('/api/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(metricsCollector.getPrometheusMetrics());
});

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { limit = 10, playerId } = req.query;
    const getLeaderboard = container.get('getLeaderboard');

    const result = await getLeaderboard.execute({
      limit: parseInt(limit),
      playerId
    });

    res.json(result);
  } catch (error) {
    logger.error('Leaderboard API error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Submit score to leaderboard
app.post('/api/leaderboard', async (req, res) => {
  try {
    const { playerId, wave, level, kills, survivalTime } = req.body;
    const submitScore = container.get('submitScore');

    const entry = await submitScore.execute({
      playerId,
      wave,
      level,
      kills,
      survivalTime
    });

    res.status(201).json(entry.toObject());
  } catch (error) {
    logger.error('Submit score API error', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

// Get player upgrades
app.get('/api/players/:id/upgrades', async (req, res) => {
  try {
    const { id } = req.params;
    const getUpgrades = container.get('getUpgrades');

    const result = await getUpgrades.execute({ playerId: id });
    res.json(result);
  } catch (error) {
    logger.error('Get upgrades API error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Buy permanent upgrade
app.post('/api/players/:id/upgrades', async (req, res) => {
  try {
    const { id } = req.params;
    const { upgradeName, cost, maxLevel } = req.body;
    const buyUpgrade = container.get('buyUpgrade');

    const upgrades = await buyUpgrade.execute({
      playerId: id,
      upgradeName,
      cost,
      maxLevel
    });

    res.json(upgrades.toObject());
  } catch (error) {
    logger.error('Buy upgrade API error', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

// Create player
app.post('/api/players', async (req, res) => {
  try {
    const { id, username } = req.body;
    const createPlayer = container.get('createPlayer');

    const player = await createPlayer.execute({ id, username });
    res.status(201).json(player.toObject());
  } catch (error) {
    logger.error('Create player API error', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

// Get player stats
app.get('/api/players/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const playerRepo = container.getRepository('player');

    const player = await playerRepo.findById(id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const stats = await playerRepo.getStats(id);
    res.json({ player: player.toObject(), stats });
  } catch (error) {
    logger.error('Get player API error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Importer la configuration
const {
  CONFIG,
  WEAPONS,
  POWERUP_TYPES,
  ZOMBIE_TYPES,
  LEVEL_UP_UPGRADES,
  SHOP_ITEMS,
  INACTIVITY_TIMEOUT,
  HEARTBEAT_CHECK_INTERVAL
} = ConfigManager;

// État du jeu
const gameState = {
  players: {},
  zombies: {},
  bullets: {},
  powerups: {},
  particles: {},
  poisonTrails: {},
  loot: {},
  explosions: {},
  walls: [],
  rooms: [],
  currentRoom: 0,
  bossSpawned: false,
  nextZombieId: 0,
  nextBulletId: 0,
  nextPowerupId: 0,
  nextParticleId: 0,
  nextPoisonTrailId: 0,
  nextLootId: 0,
  nextExplosionId: 0,
  wave: 1,
  zombiesKilledThisWave: 0,
  zombiesSpawnedThisWave: 0,
  permanentUpgrades: {
    maxHealthUpgrade: 0,
    damageUpgrade: 0,
    speedUpgrade: 0,
    goldMultiplier: 1
  }
};

// ===============================================
// MANAGERS D'OPTIMISATION & GAME LOGIC
// ===============================================

// Managers d'optimisation
const entityManager = new EntityManager(gameState, CONFIG);
const collisionManager = new CollisionManager(gameState, CONFIG);
const networkManager = new NetworkManager(io, gameState);

// Managers de game logic - CORRECTION: Créer roomManager AVANT zombieManager
const roomManager = new RoomManager(gameState, CONFIG, io);
const playerManager = new PlayerManager(gameState, CONFIG, LEVEL_UP_UPGRADES);

// CORRECTION: zombieManager créé après roomManager pour avoir accès à checkWallCollision
const zombieManager = new ZombieManager(
  gameState,
  CONFIG,
  ZOMBIE_TYPES,
  (x, y, size) => roomManager.checkWallCollision(x, y, size),
  io
);

// ===============================================
// RATE LIMITING SYSTEM
// ===============================================
const rateLimits = new Map();

const RATE_LIMIT_CONFIG = {
  'shoot': { maxRequests: 50, windowMs: 1000 },
  'playerMove': { maxRequests: 100, windowMs: 1000 }, // Balanced for 60 FPS server with 30 FPS client updates
  'setNickname': { maxRequests: 3, windowMs: 10000 },
  'selectUpgrade': { maxRequests: 10, windowMs: 5000 },
  'buyItem': { maxRequests: 20, windowMs: 5000 },
};

function checkRateLimit(socketId, eventName) {
  const config = RATE_LIMIT_CONFIG[eventName];
  if (!config) return true;

  const now = Date.now();

  if (!rateLimits.has(socketId)) {
    rateLimits.set(socketId, {});
  }

  const socketLimits = rateLimits.get(socketId);

  if (!socketLimits[eventName] || now > socketLimits[eventName].resetTime) {
    socketLimits[eventName] = {
      count: 1,
      resetTime: now + config.windowMs
    };
    return true;
  }

  socketLimits[eventName].count++;

  if (socketLimits[eventName].count > config.maxRequests) {
    console.warn(`[RATE LIMIT] Player ${socketId} exceeded rate limit for ${eventName}`);
    return false;
  }

  return true;
}

function cleanupRateLimits(socketId) {
  rateLimits.delete(socketId);
}

// ===============================================
// UTILITY FUNCTIONS
// ===============================================

// Fonction utilitaire pour calculer la distance
function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// CORRECTION: Fonction partagée pour nettoyer les balles d'un joueur
function cleanupPlayerBullets(playerId) {
  for (let bulletId in gameState.bullets) {
    const bullet = gameState.bullets[bulletId];
    if (bullet.playerId === playerId) {
      entityManager.destroyBullet(bulletId);
    }
  }
}

// Générer 3 choix d'upgrades aléatoires avec pondération par rareté
function generateUpgradeChoices() {
  const upgradeKeys = Object.keys(LEVEL_UP_UPGRADES);
  const choices = [];
  const selectedKeys = new Set();

  // Pondération par rareté : common: 60%, rare: 30%, legendary: 10%
  while (choices.length < 3 && selectedKeys.size < upgradeKeys.length) {
    const rand = Math.random();
    let targetRarity;

    if (rand < 0.60) {
      targetRarity = 'common';
    } else if (rand < 0.90) {
      targetRarity = 'rare';
    } else {
      targetRarity = 'legendary';
    }

    // Trouver un upgrade de cette rareté qui n'a pas déjà été sélectionné
    const availableUpgrades = upgradeKeys.filter(key =>
      LEVEL_UP_UPGRADES[key].rarity === targetRarity && !selectedKeys.has(key)
    );

    if (availableUpgrades.length > 0) {
      const selectedKey = availableUpgrades[Math.floor(Math.random() * availableUpgrades.length)];
      selectedKeys.add(selectedKey);
      choices.push({
        id: selectedKey,
        name: LEVEL_UP_UPGRADES[selectedKey].name,
        description: LEVEL_UP_UPGRADES[selectedKey].description,
        rarity: LEVEL_UP_UPGRADES[selectedKey].rarity
      });
    }
  }

  // Si on n'a pas réussi à avoir 3 choix avec la pondération, compléter avec n'importe quoi
  while (choices.length < 3 && selectedKeys.size < upgradeKeys.length) {
    const availableUpgrades = upgradeKeys.filter(key => !selectedKeys.has(key));
    if (availableUpgrades.length > 0) {
      const selectedKey = availableUpgrades[Math.floor(Math.random() * availableUpgrades.length)];
      selectedKeys.add(selectedKey);
      choices.push({
        id: selectedKey,
        name: LEVEL_UP_UPGRADES[selectedKey].name,
        description: LEVEL_UP_UPGRADES[selectedKey].description,
        rarity: LEVEL_UP_UPGRADES[selectedKey].rarity
      });
    } else {
      break;
    }
  }

  return choices;
}

// Génération procédurale de salle (Rogue-like)
function generateRoom() {
  const room = {
    width: CONFIG.ROOM_WIDTH,
    height: CONFIG.ROOM_HEIGHT,
    walls: [],
    obstacles: [],
    doors: []
  };

  const w = CONFIG.WALL_THICKNESS;

  // Murs extérieurs
  room.walls.push(
    { x: 0, y: 0, width: room.width, height: w }, // Haut
    { x: 0, y: room.height - w, width: room.width, height: w }, // Bas
    { x: 0, y: 0, width: w, height: room.height }, // Gauche
    { x: room.width - w, y: 0, width: w, height: room.height } // Droite
  );

  // Porte en haut (pour passer à la salle suivante)
  const doorX = (room.width - CONFIG.DOOR_WIDTH) / 2;
  room.doors.push({
    x: doorX,
    y: 0,
    width: CONFIG.DOOR_WIDTH,
    height: w,
    active: false // S'active quand tous les zombies sont morts
  });

  // Obstacles aléatoires (piliers, caisses)
  const numObstacles = Math.floor(Math.random() * 5) + 3;
  for (let i = 0; i < numObstacles; i++) {
    const obsWidth = 40 + Math.random() * 40;
    const obsHeight = 40 + Math.random() * 40;
    const obsX = 100 + Math.random() * (room.width - 200 - obsWidth);
    const obsY = 100 + Math.random() * (room.height - 200 - obsHeight);

    room.obstacles.push({
      x: obsX,
      y: obsY,
      width: obsWidth,
      height: obsHeight
    });
  }

  return room;
}

// Initialiser les salles
function initializeRooms() {
  gameState.rooms = [];
  gameState.walls = [];
  gameState.currentRoom = 0;

  for (let i = 0; i < CONFIG.ROOMS_PER_RUN; i++) {
    const room = generateRoom();
    gameState.rooms.push(room);
  }

  // Charger les murs de la première salle
  loadRoom(0);
}

// Charger une salle spécifique
function loadRoom(roomIndex) {
  roomManager.loadRoom(roomIndex);
}

// CORRECTION: Suppression de la fonction checkWallCollision dupliquée
// Utiliser roomManager.checkWallCollision() à la place

// Calculer l'XP nécessaire pour le niveau suivant (Courbe améliorée plus progressive)
function getXPForLevel(level) {
  // Courbe plus douce : les premiers niveaux sont rapides, puis ralentit progressivement
  if (level <= 5) {
    return 50 + (level - 1) * 30; // Niveaux 1-5 : 50, 80, 110, 140, 170
  } else if (level <= 10) {
    return 200 + (level - 5) * 50; // Niveaux 6-10 : 200, 250, 300, 350, 400
  } else if (level <= 20) {
    return 400 + (level - 10) * 75; // Niveaux 11-20 : 475, 550, 625...
  } else {
    return Math.floor(1000 + (level - 20) * 100); // Niveaux 20+ : 1100, 1200, 1300...
  }
}

// CORRECTION: Code déplacé dans ZombieManager - utiliser zombieManager.spawnZombie() à la place

// Spawn des power-ups
function spawnPowerup() {
  // Limite de power-ups selon le mode performance
  const powerupCount = Object.keys(gameState.powerups).length;
  if (!perfIntegration.canSpawnPowerup(powerupCount)) {
    return;
  }

  const types = Object.keys(POWERUP_TYPES);
  const type = types[Math.floor(Math.random() * types.length)];

  let x, y;
  let attempts = 0;
  do {
    x = 100 + Math.random() * (CONFIG.ROOM_WIDTH - 200);
    y = 100 + Math.random() * (CONFIG.ROOM_HEIGHT - 200);
    attempts++;
  } while (roomManager.checkWallCollision(x, y, CONFIG.POWERUP_SIZE) && attempts < 50);

  if (attempts >= 50) return;

  const powerupId = gameState.nextPowerupId++;
  gameState.powerups[powerupId] = {
    id: powerupId,
    type: type,
    x: x,
    y: y,
    lifetime: Date.now() + 20000 // 20 secondes
  };

  // Tracker le spawn
  metricsCollector.incrementPowerupsSpawned();
}

// Créer du loot (pièces d'or)
function createLoot(x, y, goldAmount, xpAmount) {
  const lootId = gameState.nextLootId++;
  gameState.loot[lootId] = {
    id: lootId,
    x: x,
    y: y,
    gold: goldAmount,
    xp: xpAmount,
    lifetime: Date.now() + 30000 // 30 secondes
  };
}

// Créer des particules
function createParticles(x, y, color, count = 10) {
  // Utiliser EntityManager avec Object Pool
  entityManager.createParticles(x, y, color, count);
}

// Créer une explosion visuelle
function createExplosion(x, y, radius, isRocket = false) {
  // Utiliser EntityManager avec Object Pool
  entityManager.createExplosion({
    x, y, radius, isRocket,
    createdAt: Date.now(),
    duration: 400
  });
}

// ===============================================
// RACE CONDITION PROTECTION
// ===============================================
let gameLoopRunning = false;

// Mise à jour de la logique du jeu
function gameLoop() {
  // Incrémenter le compteur de tick pour la gestion de performance
  perfIntegration.incrementTick();

  // Protection contre race conditions
  if (gameLoopRunning) {
    console.warn('[RACE] Game loop already running, skipping frame');
    return;
  }

  gameLoopRunning = true;

  let frameStart = Date.now();

  try {
    const now = frameStart;

    // Mettre à jour les métriques de base
    metricsCollector.updatePlayers(gameState);
    metricsCollector.updateZombies(gameState);
    metricsCollector.updatePowerups(gameState);
    metricsCollector.updateBullets(gameState);
    metricsCollector.updateGame(gameState);

    // Reconstruire le Quadtree pour les collisions optimisées
    collisionManager.rebuildQuadtree();

  // Mise à jour des joueurs (power-ups temporaires)
  for (let playerId in gameState.players) {
    const player = gameState.players[playerId];

    if (!player.alive) continue;

    // Vérifier l'expiration de la protection de spawn
    if (player.spawnProtection && now > player.spawnProtectionEndTime) {
      player.spawnProtection = false;
    }

    // Vérifier l'expiration de l'invisibilité après upgrade
    if (player.invisible && now > player.invisibleEndTime) {
      player.invisible = false;
    }

    // Retour au pistolet si l'arme spéciale a expiré
    if (player.weaponTimer && now > player.weaponTimer) {
      player.weapon = 'pistol';
      player.weaponTimer = null;
    }

    // Retour à la vitesse normale si le boost a expiré
    if (player.speedBoost && now > player.speedBoost) {
      player.speedBoost = null;
    }

    // Réinitialiser le combo si le timeout est dépassé
    const COMBO_TIMEOUT = 5000; // 5 secondes
    if (player.combo > 0 && player.comboTimer > 0 && now - player.comboTimer > COMBO_TIMEOUT) {
      player.combo = 0;
      player.comboTimer = 0;
      // Notifier le client que le combo est terminé
      io.to(playerId).emit('comboReset');
    }

    // Régénération de vie
    if (player.regeneration > 0) {
      if (!player.lastRegenTick || now - player.lastRegenTick >= 1000) {
        player.health = Math.min(player.health + player.regeneration, player.maxHealth);
        player.lastRegenTick = now;
      }
    }

    // Tourelles automatiques
    if (player.autoTurrets > 0 && player.hasNickname && !player.spawnProtection) {
      // Cooldown : 600ms par tourelle (plus on a de tourelles, plus on tire vite)
      const autoFireCooldown = 600 / player.autoTurrets;

      if (now - player.lastAutoShot >= autoFireCooldown) {
        // Trouver le zombie le plus proche (OPTIMISÉ avec Quadtree)
        const autoTurretRange = 500;
        const closestZombie = collisionManager.findClosestZombie(player.x, player.y, autoTurretRange);

        // Tirer sur le zombie le plus proche
        if (closestZombie) {
          const angle = Math.atan2(closestZombie.y - player.y, closestZombie.x - player.x);

          // Les tourelles font 60% des dégâts normaux
          const baseDamage = CONFIG.BULLET_DAMAGE * 0.6;
          const damage = baseDamage * (player.damageMultiplier || 1);

          // Créer la balle (OPTIMISÉ avec Object Pool)
          entityManager.createBullet({
            x: player.x,
            y: player.y,
            vx: MathUtils.fastCos(angle) * CONFIG.BULLET_SPEED,
            vy: MathUtils.fastSin(angle) * CONFIG.BULLET_SPEED,
            playerId: playerId,
            damage: damage,
            color: '#00ffaa',
            piercing: 0,
            explosiveRounds: false,
            explosionRadius: 0,
            explosionDamagePercent: 0,
            isAutoTurret: true
          });

          player.lastAutoShot = now;

          // Créer des particules pour indiquer le tir
          createParticles(player.x, player.y, '#00ffaa', 3);
        }
      }
    }
  }

  // Mise à jour des flaques toxiques (boss "L'Infect" et "Omega")
  if (!gameState.toxicPools) gameState.toxicPools = [];

  // Nettoyer les flaques expirées
  gameState.toxicPools = gameState.toxicPools.filter(pool => {
    return (now - pool.createdAt) < pool.duration;
  });

  // Appliquer les dégâts aux joueurs dans les flaques
  for (let pool of gameState.toxicPools) {
    for (let playerId in gameState.players) {
      const player = gameState.players[playerId];
      if (!player.alive) continue;

      // Vérifier si le joueur est dans la flaque
      const dist = distance(player.x, player.y, pool.x, pool.y);
      if (dist < pool.radius) {
        // Dégâts toutes les 0.5 secondes
        if (!pool.lastDamage) pool.lastDamage = {};
        if (!pool.lastDamage[playerId] || now - pool.lastDamage[playerId] >= 500) {
          pool.lastDamage[playerId] = now;

          // Appliquer les dégâts
          player.health -= pool.damage;

          // Créer des particules toxiques
          createParticles(player.x, player.y, '#00ff00', 5);

          // Vérifier la mort
          if (player.health <= 0) {
            player.alive = false;
            player.health = 0;
            createParticles(player.x, player.y, '#ff0000', 30);
          }
        }
      }
    }
  }

  // Mise à jour des zombies - ils chassent le joueur le plus proche
  for (let zombieId in gameState.zombies) {
    const zombie = gameState.zombies[zombieId];

    // Capacité spéciale : Zombie Soigneur (OPTIMISÉ avec Quadtree)
    if (zombie.type === 'healer') {
      const healerType = ZOMBIE_TYPES.healer;
      if (!zombie.lastHeal || now - zombie.lastHeal >= healerType.healCooldown) {
        zombie.lastHeal = now;

        // Soigner les zombies autour (OPTIMISÉ)
        const nearbyZombies = collisionManager.findZombiesInRadius(
          zombie.x, zombie.y, healerType.healRadius, zombieId
        );

        for (let other of nearbyZombies) {
          if (other.health < other.maxHealth) {
            other.health = Math.min(other.health + healerType.healAmount, other.maxHealth);
            // Créer des particules de soin
            createParticles(other.x, other.y, '#00ffff', 5);
          }
        }
      }
    }

    // Capacité spéciale : Zombie Ralentisseur (OPTIMISÉ avec Quadtree)
    if (zombie.type === 'slower') {
      const slowerType = ZOMBIE_TYPES.slower;

      // Ralentir les joueurs dans le rayon (OPTIMISÉ)
      const nearbyPlayers = collisionManager.findPlayersInRadius(
        zombie.x, zombie.y, slowerType.slowRadius
      );

      for (let player of nearbyPlayers) {
        // Appliquer l'effet de ralentissement
        player.slowedUntil = now + slowerType.slowDuration;
        player.slowAmount = slowerType.slowAmount;
      }
    }

    // Capacité spéciale : Zombie Tireur (OPTIMISÉ avec Quadtree)
    if (zombie.type === 'shooter') {
      const shooterType = ZOMBIE_TYPES.shooter;

      // Vérifier le cooldown de tir
      if (!zombie.lastShot || now - zombie.lastShot >= shooterType.shootCooldown) {
        // Trouver le joueur le plus proche dans la portée (OPTIMISÉ)
        const targetPlayer = collisionManager.findClosestPlayer(
          zombie.x, zombie.y, shooterType.shootRange,
          { ignoreSpawnProtection: true, ignoreInvisible: true }
        );

        // Tirer sur le joueur cible
        if (targetPlayer) {
          zombie.lastShot = now;
          const angle = Math.atan2(targetPlayer.y - zombie.y, targetPlayer.x - zombie.x);

          // Créer une balle de zombie (OPTIMISÉ avec Object Pool)
          entityManager.createBullet({
            x: zombie.x,
            y: zombie.y,
            vx: MathUtils.fastCos(angle) * shooterType.bulletSpeed,
            vy: MathUtils.fastSin(angle) * shooterType.bulletSpeed,
            zombieId: zombieId,
            damage: zombie.damage,
            color: shooterType.bulletColor,
            isZombieBullet: true, // Marquer comme balle de zombie
            piercing: 0,
            piercedZombies: [],
            explosiveRounds: false,
            explosionRadius: 0,
            explosionDamagePercent: 0
          });

          // Créer des particules de tir
          createParticles(zombie.x, zombie.y, shooterType.bulletColor, 5);
        }
      }
    }

    // Capacité spéciale : Zombie Poison - laisse une traînée de poison
    if (zombie.type === 'poison') {
      const poisonType = ZOMBIE_TYPES.poison;

      // Vérifier le cooldown pour laisser une traînée
      if (!zombie.lastPoisonTrail || now - zombie.lastPoisonTrail >= poisonType.poisonTrailInterval) {
        zombie.lastPoisonTrail = now;

        // Créer une nouvelle traînée de poison
        const trailId = gameState.nextPoisonTrailId++;
        gameState.poisonTrails[trailId] = {
          id: trailId,
          x: zombie.x,
          y: zombie.y,
          radius: poisonType.poisonRadius,
          damage: poisonType.poisonDamage,
          createdAt: now,
          duration: poisonType.poisonDuration
        };

        // Créer des particules vertes pour l'effet visuel
        createParticles(zombie.x, zombie.y, poisonType.color, 3);
      }
    }

    // Capacité spéciale : Zombie Téléporteur - se téléporte près du joueur
    if (zombie.type === 'teleporter') {
      const teleporterType = ZOMBIE_TYPES.teleporter;

      if (!zombie.lastTeleport || now - zombie.lastTeleport >= teleporterType.teleportCooldown) {
        const closestPlayer = collisionManager.findClosestPlayer(
          zombie.x, zombie.y, Infinity,
          { ignoreSpawnProtection: true, ignoreInvisible: true }
        );

        if (closestPlayer) {
          const distToPlayer = distance(zombie.x, zombie.y, closestPlayer.x, closestPlayer.y);

          // Se téléporter uniquement si assez loin du joueur
          if (distToPlayer > teleporterType.teleportRange) {
            zombie.lastTeleport = now;

            // Angle vers le joueur
            const angleToPlayer = Math.atan2(closestPlayer.y - zombie.y, closestPlayer.x - zombie.x);

            // Distance aléatoire entre min et max range
            const teleportDistance = teleporterType.teleportMinRange +
              Math.random() * (teleporterType.teleportRange - teleporterType.teleportMinRange);

            // Nouvelle position près du joueur
            const newX = closestPlayer.x - Math.cos(angleToPlayer) * teleportDistance;
            const newY = closestPlayer.y - Math.sin(angleToPlayer) * teleportDistance;

            // Vérifier collision avec murs
            if (!roomManager.checkWallCollision(newX, newY, zombie.size)) {
              // Créer particules à l'ancienne position
              createParticles(zombie.x, zombie.y, teleporterType.color, 15);

              // Téléporter
              zombie.x = newX;
              zombie.y = newY;

              // Créer particules à la nouvelle position
              createParticles(zombie.x, zombie.y, teleporterType.color, 15);
            }
          }
        }
      }
    }

    // Capacité spéciale : Zombie Invocateur - invoque des mini-zombies
    if (zombie.type === 'summoner') {
      const summonerType = ZOMBIE_TYPES.summoner;

      // Compter les minions actuels de cet invocateur
      let currentMinions = 0;
      for (let zId in gameState.zombies) {
        const z = gameState.zombies[zId];
        if (z.summonerId === zombieId) {
          currentMinions++;
        }
      }
      zombie.minionCount = currentMinions;

      // Invoquer si cooldown passé et pas trop de minions
      if (currentMinions < summonerType.maxMinions &&
          (!zombie.lastSummon || now - zombie.lastSummon >= summonerType.summonCooldown)) {
        zombie.lastSummon = now;

        // Invoquer plusieurs minions
        const minionsToSpawn = Math.min(
          summonerType.minionsPerSummon,
          summonerType.maxMinions - currentMinions
        );

        for (let i = 0; i < minionsToSpawn; i++) {
          const spawned = zombieManager.spawnMinion(zombieId, zombie.x, zombie.y);
          if (spawned) {
            zombie.minionCount++;
          }
        }

        // Effet visuel d'invocation
        if (minionsToSpawn > 0) {
          createParticles(zombie.x, zombie.y, summonerType.color, 20);
        }
      }
    }

    // ========== BOSS SPÉCIAUX ==========

    // Boss "Le Charnier" - Spawne des zombies en combat
    if (zombie.type === 'bossCharnier') {
      const bossType = ZOMBIE_TYPES.bossCharnier;
      if (!zombie.lastSpawn || now - zombie.lastSpawn >= bossType.spawnCooldown) {
        zombie.lastSpawn = now;

        // Spawner plusieurs zombies autour du boss (avec limite performance)
        for (let i = 0; i < bossType.spawnCount; i++) {
          const zombieCount = Object.keys(gameState.zombies).length;
          if (perfIntegration.canSpawnZombie(zombieCount) && zombieManager.spawnSingleZombie()) {
            createParticles(zombie.x, zombie.y, bossType.color, 15);
          }
        }
      }
    }

    // Boss "L'Infect" - Crée des flaques toxiques
    if (zombie.type === 'bossInfect') {
      const bossType = ZOMBIE_TYPES.bossInfect;
      if (!zombie.lastToxicPool || now - zombie.lastToxicPool >= bossType.toxicPoolCooldown) {
        zombie.lastToxicPool = now;

        // Créer une flaque toxique à la position actuelle
        gameState.toxicPools = gameState.toxicPools || [];
        gameState.toxicPools.push({
          id: `toxic_${now}_${Math.random()}`,
          x: zombie.x,
          y: zombie.y,
          radius: bossType.toxicPoolRadius,
          damage: bossType.toxicPoolDamage,
          createdAt: now,
          duration: bossType.toxicPoolDuration
        });

        createParticles(zombie.x, zombie.y, bossType.color, 25);
      }
    }

    // Boss "Le Colosse" - S'enrage à 30% HP
    if (zombie.type === 'bossColosse') {
      const bossType = ZOMBIE_TYPES.bossColosse;
      const healthPercent = zombie.health / zombie.maxHealth;

      if (!zombie.isEnraged && healthPercent <= bossType.enrageThreshold) {
        zombie.isEnraged = true;
        zombie.speed *= bossType.enrageSpeedMultiplier;
        zombie.damage = Math.floor(zombie.damage * bossType.enrageDamageMultiplier);

        // Effet visuel d'enrage
        createParticles(zombie.x, zombie.y, '#ff0000', 50);
        io.emit('bossEnraged', {
          bossId: zombieId,
          message: 'LE COLOSSE EST ENRAGÉ!'
        });
      }
    }

    // Boss "Roi Zombie" - Multi-phases avec patterns
    if (zombie.type === 'bossRoi') {
      const bossType = ZOMBIE_TYPES.bossRoi;
      const healthPercent = zombie.health / zombie.maxHealth;

      // Détection de phase
      let currentPhase = 1;
      if (healthPercent <= bossType.phase3Threshold) {
        currentPhase = 3;
      } else if (healthPercent <= bossType.phase2Threshold) {
        currentPhase = 2;
      }

      // Changement de phase
      if (currentPhase > zombie.phase) {
        zombie.phase = currentPhase;
        io.emit('bossPhaseChange', {
          bossId: zombieId,
          phase: currentPhase,
          message: `ROI ZOMBIE - PHASE ${currentPhase}!`
        });
        createParticles(zombie.x, zombie.y, bossType.color, 60);
      }

      // Téléportation (Phase 2+)
      if (zombie.phase >= 2 && (!zombie.lastTeleport || now - zombie.lastTeleport >= bossType.teleportCooldown)) {
        zombie.lastTeleport = now;

        // Téléportation aléatoire dans la salle
        const newX = 200 + Math.random() * (CONFIG.ROOM_WIDTH - 400);
        const newY = 200 + Math.random() * (CONFIG.ROOM_HEIGHT - 400);

        if (!roomManager.checkWallCollision(newX, newY, zombie.size)) {
          createParticles(zombie.x, zombie.y, bossType.color, 30);
          zombie.x = newX;
          zombie.y = newY;
          createParticles(zombie.x, zombie.y, bossType.color, 30);
        }
      }

      // Invocation (Phase 3)
      if (zombie.phase >= 3 && (!zombie.lastSummon || now - zombie.lastSummon >= bossType.summonCooldown)) {
        zombie.lastSummon = now;

        // Invoquer 5 zombies normaux (avec limite performance)
        for (let i = 0; i < 5; i++) {
          const zombieCount = Object.keys(gameState.zombies).length;
          if (perfIntegration.canSpawnZombie(zombieCount)) {
            zombieManager.spawnSingleZombie();
          }
        }
        createParticles(zombie.x, zombie.y, bossType.color, 40);
      }
    }

    // Boss "Omega" - Boss final ultime (combine toutes les capacités)
    if (zombie.type === 'bossOmega') {
      const bossType = ZOMBIE_TYPES.bossOmega;
      const healthPercent = zombie.health / zombie.maxHealth;

      // Détection de phase (4 phases)
      let currentPhase = 1;
      if (healthPercent <= bossType.phase4Threshold) {
        currentPhase = 4;
      } else if (healthPercent <= bossType.phase3Threshold) {
        currentPhase = 3;
      } else if (healthPercent <= bossType.phase2Threshold) {
        currentPhase = 2;
      }

      // Changement de phase
      if (currentPhase > zombie.phase) {
        zombie.phase = currentPhase;
        io.emit('bossPhaseChange', {
          bossId: zombieId,
          phase: currentPhase,
          message: `OMEGA - PHASE ${currentPhase}!`
        });
        createParticles(zombie.x, zombie.y, bossType.color, 80);
      }

      // Téléportation (toutes phases)
      if (!zombie.lastTeleport || now - zombie.lastTeleport >= bossType.teleportCooldown) {
        zombie.lastTeleport = now;
        const newX = 200 + Math.random() * (CONFIG.ROOM_WIDTH - 400);
        const newY = 200 + Math.random() * (CONFIG.ROOM_HEIGHT - 400);
        if (!roomManager.checkWallCollision(newX, newY, zombie.size)) {
          createParticles(zombie.x, zombie.y, bossType.color, 40);
          zombie.x = newX;
          zombie.y = newY;
          createParticles(zombie.x, zombie.y, bossType.color, 40);
        }
      }

      // Flaques toxiques (Phase 2+)
      if (zombie.phase >= 2 && (!zombie.lastToxicPool || now - zombie.lastToxicPool >= bossType.toxicPoolCooldown)) {
        zombie.lastToxicPool = now;
        gameState.toxicPools = gameState.toxicPools || [];
        gameState.toxicPools.push({
          id: `toxic_${now}_${Math.random()}`,
          x: zombie.x,
          y: zombie.y,
          radius: 70,
          damage: 20,
          createdAt: now,
          duration: 10000
        });
        createParticles(zombie.x, zombie.y, '#00ff00', 30);
      }

      // Invocation (Phase 3+)
      if (zombie.phase >= 3 && (!zombie.lastSummon || now - zombie.lastSummon >= bossType.summonCooldown)) {
        zombie.lastSummon = now;
        for (let i = 0; i < 8; i++) {
          const zombieCount = Object.keys(gameState.zombies).length;
          if (perfIntegration.canSpawnZombie(zombieCount)) {
            zombieManager.spawnSingleZombie();
          }
        }
        createParticles(zombie.x, zombie.y, bossType.color, 50);
      }
    }

    // ========== FIN BOSS SPÉCIAUX ==========

    // Trouver le joueur le plus proche (OPTIMISÉ avec Quadtree)
    const closestPlayer = collisionManager.findClosestPlayer(
      zombie.x, zombie.y, Infinity,
      { ignoreSpawnProtection: true, ignoreInvisible: true }
    );

    // Déplacer le zombie vers le joueur ou de manière aléatoire
    if (closestPlayer) {
      const angle = Math.atan2(closestPlayer.y - zombie.y, closestPlayer.x - zombie.x);

      // Mettre à jour l'angle de facing pour le Zombie Bouclier
      if (zombie.type === 'shielded') {
        zombie.facingAngle = angle;
      }

      const newX = zombie.x + MathUtils.fastCos(angle) * zombie.speed;
      const newY = zombie.y + MathUtils.fastSin(angle) * zombie.speed;

      // Vérifier collision avec les murs - avec système de glissement
      let finalX = zombie.x;
      let finalY = zombie.y;

      // Essayer de se déplacer dans les deux directions
      if (!roomManager.checkWallCollision(newX, newY, zombie.size)) {
        // Pas de collision, mouvement libre
        finalX = newX;
        finalY = newY;
      } else {
        // Collision détectée, essayer de glisser le long des murs
        // Essayer uniquement l'axe X
        if (!roomManager.checkWallCollision(newX, zombie.y, zombie.size)) {
          finalX = newX;
        }
        // Essayer uniquement l'axe Y
        if (!roomManager.checkWallCollision(zombie.x, newY, zombie.size)) {
          finalY = newY;
        }
      }

      // Appliquer la nouvelle position
      zombie.x = finalX;
      zombie.y = finalY;

      // OPTIMISATION: Utilisation du Quadtree pour trouver les joueurs proches
      const nearbyPlayers = collisionManager.findPlayersInRadius(
        zombie.x,
        zombie.y,
        zombie.size + CONFIG.PLAYER_SIZE
      );

      // Vérifier collision avec les joueurs proches uniquement
      for (let player of nearbyPlayers) {
        // Ignorer les joueurs avec protection de spawn ou invisibles
        if (player.spawnProtection || player.invisible) {
          continue;
        }

        if (distance(zombie.x, zombie.y, player.x, player.y) < zombie.size) {
          // Esquive
          if (Math.random() < (player.dodgeChance || 0)) {
            continue; // Esquive réussie
          }

          // CORRECTION: Dégâts basés sur le temps plutôt que sur les frames
          if (!player.lastDamageTime) player.lastDamageTime = {};
          const lastDamage = player.lastDamageTime[zombieId] || 0;
          const DAMAGE_INTERVAL = 100; // 100ms entre chaque tick de dégâts

          if (now - lastDamage >= DAMAGE_INTERVAL) {
            // Dégâts par seconde convertis en dégâts par tick
            const damageDealt = zombie.damage * (DAMAGE_INTERVAL / 1000);
            player.health -= damageDealt;
            player.lastDamageTime[zombieId] = now;

            // Épines (renvoyer des dégâts)
            if (player.thorns > 0) {
              const thornsDamage = damageDealt * player.thorns;
              zombie.health -= thornsDamage;
            }

            if (player.health <= 0) {
              player.health = 0;
              player.alive = false;
            }
          }
        }
      }
    } else {
      // Aucun joueur visible - mouvement aléatoire
      // Changer de direction aléatoire toutes les 2 secondes
      if (!zombie.randomMoveTimer || now - zombie.randomMoveTimer > 2000) {
        zombie.randomAngle = Math.random() * Math.PI * 2;
        zombie.randomMoveTimer = now;
      }

      const newX = zombie.x + Math.cos(zombie.randomAngle) * zombie.speed;
      const newY = zombie.y + Math.sin(zombie.randomAngle) * zombie.speed;

      // Vérifier collision avec les murs - avec système de glissement
      let finalX = zombie.x;
      let finalY = zombie.y;

      // Essayer de se déplacer dans les deux directions
      if (!roomManager.checkWallCollision(newX, newY, zombie.size)) {
        // Pas de collision, mouvement libre
        finalX = newX;
        finalY = newY;
      } else {
        // Collision détectée, changer de direction aléatoire
        zombie.randomAngle = Math.random() * Math.PI * 2;
      }

      // Appliquer la nouvelle position
      zombie.x = finalX;
      zombie.y = finalY;
    }
  }

  // Mise à jour des traînées de poison
  for (let trailId in gameState.poisonTrails) {
    const trail = gameState.poisonTrails[trailId];

    // CORRECTION: Le nettoyage des traînées expirées est maintenant géré par EntityManager.cleanupExpiredEntities()
    // Pas besoin de le faire ici

    // OPTIMISATION: Utiliser le Quadtree pour trouver les joueurs proches
    const nearbyPlayers = collisionManager.findPlayersInRadius(
      trail.x, trail.y, trail.radius + 10
    );

    // Appliquer les dégâts aux joueurs qui marchent sur les traînées
    for (let player of nearbyPlayers) {
      // Ignorer les joueurs morts, sans pseudo, avec protection de spawn, ou invisibles
      if (!player.alive || !player.hasNickname || player.spawnProtection || player.invisible) {
        continue;
      }

      const dist = distance(player.x, player.y, trail.x, trail.y);
      if (dist < trail.radius) {
        // CORRECTION: Tracking de dégâts par trail pour permettre le stacking
        if (!player.lastPoisonDamageByTrail) player.lastPoisonDamageByTrail = {};
        const lastTrailDamage = player.lastPoisonDamageByTrail[trailId] || 0;

        // Appliquer les dégâts de poison toutes les 500ms PAR TRAIL
        if (now - lastTrailDamage >= 500) {
          player.health -= trail.damage;
          player.lastPoisonDamageByTrail[trailId] = now;

          // Créer des particules pour l'effet visuel
          createParticles(player.x, player.y, '#22ff22', 2);

          // Vérifier si le joueur est mort
          if (player.health <= 0) {
            player.health = 0;
            player.alive = false;
          }
        }
      }
    }
  }

  // Mise à jour des balles
  for (let bulletId in gameState.bullets) {
    const bullet = gameState.bullets[bulletId];

    bullet.x += bullet.vx;
    bullet.y += bullet.vy;

    // Appliquer la gravité pour les grenades
    if (bullet.gravity && bullet.gravity > 0) {
      bullet.vy += bullet.gravity;
    }

    // Vérifier le lifetime pour les flammes et autres armes à durée limitée
    if (bullet.lifetime && now > bullet.lifetime) {
      entityManager.destroyBullet(bulletId);
      continue;
    }

    // Retirer les balles hors de la salle ou qui touchent un mur
    if (bullet.x < 0 || bullet.x > CONFIG.ROOM_WIDTH ||
        bullet.y < 0 || bullet.y > CONFIG.ROOM_HEIGHT ||
        roomManager.checkWallCollision(bullet.x, bullet.y, CONFIG.BULLET_SIZE)) {
      entityManager.destroyBullet(bulletId);
      continue;
    }

    // Si c'est une balle de zombie, vérifier collision avec les joueurs
    if (bullet.isZombieBullet) {
      for (let playerId in gameState.players) {
        const player = gameState.players[playerId];

        // Ignorer les joueurs morts, sans pseudo, avec protection de spawn, ou invisibles
        if (!player.alive || !player.hasNickname || player.spawnProtection || player.invisible) {
          continue;
        }

        if (distance(bullet.x, bullet.y, player.x, player.y) < CONFIG.PLAYER_SIZE) {
          // Esquive
          if (Math.random() < (player.dodgeChance || 0)) {
            entityManager.destroyBullet(bulletId);
            break; // Esquive réussie, balle disparaît
          }

          // Infliger les dégâts
          player.health -= bullet.damage;

          if (player.health <= 0) {
            player.health = 0;
            player.alive = false;
          }

          // Créer des particules de sang
          createParticles(player.x, player.y, '#ff0000', 8);

          entityManager.destroyBullet(bulletId);
          break;
        }
      }
      continue; // Passer à la prochaine balle, ne pas vérifier les zombies
    }

    // Vérifier collision avec zombies (seulement pour les balles de joueurs)
    // OPTIMISATION: Utilisation du Quadtree au lieu de boucle O(n*m)
    const hitZombies = collisionManager.checkBulletZombieCollisions(bullet);

    for (let {id: zombieId, zombie} of hitZombies) {
      // Vérifier si ce zombie a déjà été percé par cette balle
      if (bullet.piercedZombies && bullet.piercedZombies.includes(zombieId)) {
        continue;
      }

      // Calculer les dégâts avec réduction pour Zombie Bouclier
      let finalDamage = bullet.damage;

      if (zombie.type === 'shielded' && zombie.facingAngle !== null) {
        const shieldedType = ZOMBIE_TYPES.shielded;

        // Angle de la balle par rapport au zombie
        const bulletAngle = Math.atan2(bullet.vy, bullet.vx);

        // Différence d'angle (normalisée entre -PI et PI)
        let angleDiff = bulletAngle - zombie.facingAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // Si la balle vient de face (dans l'angle du bouclier)
        if (Math.abs(angleDiff) < shieldedType.shieldAngle) {
          // Réduire les dégâts
          finalDamage *= shieldedType.frontDamageReduction;

          // Effet visuel de bouclier (particules cyan)
          createParticles(zombie.x, zombie.y, '#00ffff', 10);
        }
      }

      zombie.health -= finalDamage;

      // Vol de vie pour le joueur
      if (bullet.playerId) {
        const shooter = gameState.players[bullet.playerId];
        if (shooter && shooter.lifeSteal > 0) {
          const lifeStolen = bullet.damage * shooter.lifeSteal;
          shooter.health = Math.min(shooter.health + lifeStolen, shooter.maxHealth);
        }
      }

      // Balles perforantes
      if (bullet.piercing > 0 && bullet.piercedZombies) {
        bullet.piercedZombies.push(zombieId);
        if (bullet.piercedZombies.length > bullet.piercing) {
          entityManager.destroyBullet(bulletId);
        }
      } else {
        entityManager.destroyBullet(bulletId);
      }

      // Balles explosives
      if (bullet.explosiveRounds && bullet.explosionRadius > 0) {
        // Créer l'effet visuel d'explosion
        createExplosion(zombie.x, zombie.y, bullet.explosionRadius, bullet.isRocket);

        // Créer explosion - plus intense pour les roquettes
        const explosionColor = bullet.isRocket ? '#ff0000' : '#ff8800';
        const particleCount = bullet.isRocket ? 40 : 20;
        createParticles(zombie.x, zombie.y, explosionColor, particleCount);

        // Pour les roquettes, créer aussi des particules orange et jaunes
        if (bullet.isRocket) {
          createParticles(zombie.x, zombie.y, '#ff8800', 30);
          createParticles(zombie.x, zombie.y, '#ffff00', 20);
        }

        // Infliger dégâts dans le rayon
        for (let otherId in gameState.zombies) {
          if (otherId !== zombieId) {
            const other = gameState.zombies[otherId];
            const dist = distance(zombie.x, zombie.y, other.x, other.y);
            if (dist < bullet.explosionRadius) {
              // CORRECTION: Vérifier null/undefined au lieu de > 0
              const explosionDmg = (bullet.rocketExplosionDamage !== null && bullet.rocketExplosionDamage !== undefined) ?
                bullet.rocketExplosionDamage :
                (bullet.damage * bullet.explosionDamagePercent);
              other.health -= explosionDmg;
              // Créer des particules sur les zombies touchés
              createParticles(other.x, other.y, other.color, 8);
            }
          }
        }
      }

      // Créer des particules de sang
      createParticles(zombie.x, zombie.y, zombie.color, 5);

      if (zombie.health <= 0) {
        // Créer plus de particules pour la mort
        createParticles(zombie.x, zombie.y, zombie.color, 15);

        // Effet spécial : Zombie Explosif
        if (zombie.type === 'explosive') {
          const explosionType = ZOMBIE_TYPES.explosive;
          // Créer une énorme explosion de particules
          createParticles(zombie.x, zombie.y, '#ff00ff', 30);
          createParticles(zombie.x, zombie.y, '#ff8800', 20);

          // Infliger des dégâts à tous les joueurs dans le rayon
          for (let playerId in gameState.players) {
            const player = gameState.players[playerId];
            // Ignorer les joueurs morts, sans pseudo, avec protection de spawn, ou invisibles
            if (player.alive && player.hasNickname && !player.spawnProtection && !player.invisible) {
              const dist = distance(zombie.x, zombie.y, player.x, player.y);
              if (dist < explosionType.explosionRadius) {
                player.health -= explosionType.explosionDamage;
                if (player.health <= 0) {
                  player.health = 0;
                  player.alive = false;
                }
              }
            }
          }

          // NOUVEAU : Infliger des dégâts aux autres zombies dans le rayon
          for (let otherId in gameState.zombies) {
            if (otherId !== zombieId) {
              const other = gameState.zombies[otherId];
              const dist = distance(zombie.x, zombie.y, other.x, other.y);
              if (dist < explosionType.explosionRadius) {
                // L'explosion tue instantanément les zombies normaux, blesse les autres
                const explosionDamage = explosionType.explosionDamage * 1.5; // 50% plus de dégâts aux zombies
                other.health -= explosionDamage;
                // Créer des particules pour montrer l'impact
                createParticles(other.x, other.y, other.color, 8);
              }
            }
          }
        }

        // Créer du loot avec bonus de combo
        let goldBonus = zombie.goldDrop;
        let xpBonus = zombie.xpDrop;

        // Mettre à jour le combo et le score du joueur
        if (bullet.playerId) {
          const shooter = gameState.players[bullet.playerId];
          if (shooter && shooter.alive) {
            const now = Date.now();
            const COMBO_TIMEOUT = 5000; // 5 secondes pour maintenir le combo

            // Reset ou continue le combo
            if (shooter.comboTimer > 0 && now - shooter.comboTimer < COMBO_TIMEOUT) {
              shooter.combo++;
            } else {
              shooter.combo = 1;
            }

            shooter.comboTimer = now;
            shooter.kills++;
            shooter.zombiesKilled++;

            // Mettre à jour le meilleur combo
            if (shooter.combo > shooter.highestCombo) {
              shooter.highestCombo = shooter.combo;
            }

            // Calculer le multiplicateur de combo
            let comboMultiplier = 1;
            if (shooter.combo >= 50) comboMultiplier = 10;
            else if (shooter.combo >= 30) comboMultiplier = 5;
            else if (shooter.combo >= 15) comboMultiplier = 3;
            else if (shooter.combo >= 5) comboMultiplier = 2;

            // Appliquer le bonus de combo sur l'or et l'XP
            goldBonus = Math.floor(zombie.goldDrop * comboMultiplier);
            xpBonus = Math.floor(zombie.xpDrop * comboMultiplier);

            // Calculer le score (base + combo bonus)
            const baseScore = zombie.goldDrop + zombie.xpDrop;
            const comboScore = baseScore * (comboMultiplier - 1);
            shooter.totalScore += baseScore + comboScore;

            // Émettre l'événement de combo pour l'affichage visuel
            io.to(bullet.playerId).emit('comboUpdate', {
              combo: shooter.combo,
              multiplier: comboMultiplier,
              score: shooter.totalScore,
              goldBonus: goldBonus - zombie.goldDrop,
              xpBonus: xpBonus - zombie.xpDrop
            });
          }
        }

        createLoot(zombie.x, zombie.y, goldBonus, xpBonus);

        // CORRECTION: Nettoyer le tracking de dégâts pour ce zombie dans tous les joueurs
        for (let playerId in gameState.players) {
          const p = gameState.players[playerId];
          if (p.lastDamageTime && p.lastDamageTime[zombieId]) {
            delete p.lastDamageTime[zombieId];
          }
        }

        // Supprimer le zombie
        delete gameState.zombies[zombieId];

        gameState.zombiesKilledThisWave++;

        // Si c'était le boss, lancer une nouvelle vague (MODE INFINI)
        if (zombie.isBoss) {
          // Nouvelle vague !
          gameState.wave++;
          gameState.bossSpawned = false;
          gameState.zombiesKilledThisWave = 0;
          gameState.zombiesSpawnedThisWave = 0;

          // Accélérer le spawn pour la nouvelle vague
          zombieManager.restartZombieSpawner();

          // Notifier tous les joueurs de la nouvelle vague
          // CORRECTION: Plafonner le calcul pour éviter surcharge à hautes vagues
          const effectiveWave = Math.min(gameState.wave, 130);
          io.emit('newWave', {
            wave: gameState.wave,
            zombiesCount: CONFIG.ZOMBIES_PER_ROOM + (effectiveWave - 1) * 7
          });

          // Bonus de santé pour les joueurs survivants
          for (let playerId in gameState.players) {
            const player = gameState.players[playerId];
            if (player.alive) {
              player.health = Math.min(player.health + 50, player.maxHealth);
              player.gold += 50; // Bonus d'or pour avoir survécu à la vague
            }
          }
        }
      }
      break;
    }
  }

  // Mise à jour des particules
  for (let particleId in gameState.particles) {
    const particle = gameState.particles[particleId];
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.1; // Gravité
  }

  // Nettoyer les entités expirées (OPTIMISÉ avec Object Pools)
  entityManager.cleanupExpiredEntities(now);

  // Mise à jour des power-ups
  for (let powerupId in gameState.powerups) {
    const powerup = gameState.powerups[powerupId];

    // Retirer les power-ups expirés
    if (now > powerup.lifetime) {
      delete gameState.powerups[powerupId];
      continue;
    }

    // Vérifier collision avec joueurs
    for (let playerId in gameState.players) {
      const player = gameState.players[playerId];
      // Seuls les joueurs avec pseudo peuvent collecter des power-ups
      if (player.alive && player.hasNickname && distance(powerup.x, powerup.y, player.x, player.y) < CONFIG.PLAYER_SIZE + CONFIG.POWERUP_SIZE) {
        // Appliquer l'effet du power-up
        POWERUP_TYPES[powerup.type].effect(player);
        delete gameState.powerups[powerupId];

        // Créer des particules
        createParticles(powerup.x, powerup.y, POWERUP_TYPES[powerup.type].color, 12);
        break;
      }
    }
  }

  // Mise à jour du loot (Rogue-like)
  for (let lootId in gameState.loot) {
    const loot = gameState.loot[lootId];

    // Retirer le loot expiré
    if (now > loot.lifetime) {
      delete gameState.loot[lootId];
      continue;
    }

    // Vérifier collision avec joueurs
    for (let playerId in gameState.players) {
      const player = gameState.players[playerId];
      const collectRadius = CONFIG.PLAYER_SIZE + CONFIG.LOOT_SIZE + (player.goldMagnetRadius || 0);
      // Seuls les joueurs avec pseudo peuvent collecter du loot
      if (player.alive && player.hasNickname && distance(loot.x, loot.y, player.x, player.y) < collectRadius) {
        // Donner l'or et l'XP
        player.gold += loot.gold;
        player.xp += loot.xp;

        // Créer des particules dorées
        createParticles(loot.x, loot.y, '#ffff00', 10);

        delete gameState.loot[lootId];

        // Level up si assez d'XP
        while (player.xp >= getXPForLevel(player.level)) {
          player.xp -= getXPForLevel(player.level);
          player.level++;

          // PALIERS DE NIVEAU - Bonus automatiques tous les 5 niveaux
          let milestoneBonus = null;
          if (player.level % 5 === 0) {
            // Bonus spéciaux par palier
            if (player.level === 5) {
              player.maxHealth += 50;
              player.health = Math.min(player.health + 50, player.maxHealth);
              milestoneBonus = {
                title: '🎖️ PALIER 5 !',
                description: '+50 PV max et régénération complète',
                icon: '❤️'
              };
            } else if (player.level === 10) {
              player.damageMultiplier = (player.damageMultiplier || 1) * 1.25;
              player.speedMultiplier = (player.speedMultiplier || 1) * 1.20;
              milestoneBonus = {
                title: '🎖️ PALIER 10 !',
                description: '+25% dégâts et +20% vitesse permanents',
                icon: '⚔️'
              };
            } else if (player.level === 15) {
              player.fireRateMultiplier = (player.fireRateMultiplier || 1) * 0.75;
              player.criticalChance = (player.criticalChance || 0) + 0.15;
              milestoneBonus = {
                title: '🎖️ PALIER 15 !',
                description: '-25% cooldown et +15% coup critique',
                icon: '🔫'
              };
            } else if (player.level === 20) {
              player.maxHealth += 100;
              player.health = player.maxHealth; // Heal complet
              player.lifeSteal = (player.lifeSteal || 0) + 0.10;
              milestoneBonus = {
                title: '🎖️ PALIER 20 !',
                description: '+100 PV max, heal complet et +10% vol de vie',
                icon: '💪'
              };
            } else {
              // Paliers 25, 30, 35, etc. - Bonus génériques
              const tier = Math.floor(player.level / 5);
              player.maxHealth += 30;
              player.health = Math.min(player.health + 30, player.maxHealth);
              player.damageMultiplier = (player.damageMultiplier || 1) * 1.10;
              milestoneBonus = {
                title: `🎖️ PALIER ${player.level} !`,
                description: '+30 PV max et +10% dégâts',
                icon: '🌟'
              };
            }
          }

          // Générer 3 choix d'upgrades
          const upgradeChoices = generateUpgradeChoices();

          // Activer l'invisibilité - le joueur devient invisible tant qu'il n'a pas choisi d'amélioration
          player.invisible = true;
          player.invisibleEndTime = Infinity; // Invisible jusqu'à ce qu'il choisisse une amélioration

          io.to(playerId).emit('levelUp', {
            newLevel: player.level,
            upgradeChoices: upgradeChoices,
            milestoneBonus: milestoneBonus // Envoyer le bonus de palier s'il existe
          });
        }

        break;
      }
    }
  }
  } catch (error) {
    logger.error('Game loop error', { error: error.message, stack: error.stack });
  } finally {
    // Enregistrer le temps du frame pour calcul FPS
    const frameTime = Date.now() - frameStart;
    metricsCollector.recordFrameTime(frameTime);

    gameLoopRunning = false;
  }
}

// CORRECTION: Démarrer le spawner de zombies via ZombieManager
zombieManager.startZombieSpawner();

// Spawn automatique des power-ups
let powerupSpawnTimer = setInterval(spawnPowerup, CONFIG.POWERUP_SPAWN_INTERVAL);

// Initialiser le jeu au démarrage
initializeRooms();

// ===============================================
// DELTA COMPRESSION SYSTEM - Réduction de 80-90% de la bande passante
// ===============================================

// Delta compression géré par NetworkManager (voir lib/server/NetworkManager.js)

// Game loop avec tick rate adaptatif selon PERFORMANCE_MODE
// Modes disponibles: high (60 FPS), balanced (45 FPS), low-memory (30 FPS), minimal (20 FPS)
// Configuré via env: PERFORMANCE_MODE=low-memory pour serveurs avec peu de RAM
let gameLoopTimer = setInterval(() => {
  gameLoop();

  // Broadcast conditionnel selon le mode performance (réduit la charge réseau)
  if (perfIntegration.shouldBroadcast()) {
    networkManager.emitGameState();
  }
}, perfIntegration.getTickInterval());

// Vérification périodique de l'inactivité des joueurs
let heartbeatTimer = setInterval(() => {
  const now = Date.now();

  for (let playerId in gameState.players) {
    const player = gameState.players[playerId];

    // Vérifier si le joueur est inactif depuis trop longtemps
    if (player.lastActivityTime && (now - player.lastActivityTime) > INACTIVITY_TIMEOUT) {
      logger.info('Player timeout', {
        player: player.nickname || playerId,
        inactiveSecs: Math.round((now - player.lastActivityTime) / 1000)
      });

      // Émettre un event de timeout au client
      io.to(playerId).emit('sessionTimeout', {
        reason: 'Inactivité détectée - Vous avez été déconnecté après 2 minutes sans activité'
      });

      // Nettoyer les balles orphelines appartenant à ce joueur
      cleanupPlayerBullets(playerId);

      // CORRECTION: Nettoyer les rate limits
      cleanupRateLimits(playerId);

      // Supprimer le joueur
      delete gameState.players[playerId];
    }
  }
}, HEARTBEAT_CHECK_INTERVAL);

// ===============================================
// INPUT VALIDATION UTILITIES
// ===============================================

/**
 * Valide que la valeur est un nombre fini et valide
 * @param {*} value - Valeur à valider
 * @param {number} min - Valeur minimale (optionnel)
 * @param {number} max - Valeur maximale (optionnel)
 * @returns {boolean}
 */
function isValidNumber(value, min = -Infinity, max = Infinity) {
  return typeof value === 'number' && isFinite(value) && value >= min && value <= max;
}

/**
 * Valide que la valeur est une chaîne non vide et sécurisée
 * @param {*} value - Valeur à valider
 * @param {number} maxLength - Longueur maximale
 * @returns {boolean}
 */
function isValidString(value, maxLength = 1000) {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

/**
 * Valide et sanitize un objet de données de mouvement
 * @param {*} data - Données du mouvement
 * @returns {Object|null} Données validées ou null si invalides
 */
function validateMovementData(data) {
  if (!data || typeof data !== 'object') return null;

  // Valider x, y, angle comme nombres valides
  if (!isValidNumber(data.x, 0, CONFIG.ROOM_WIDTH) ||
      !isValidNumber(data.y, 0, CONFIG.ROOM_HEIGHT) ||
      !isValidNumber(data.angle, -Math.PI * 2, Math.PI * 2)) {
    return null;
  }

  return {
    x: data.x,
    y: data.y,
    angle: data.angle
  };
}

/**
 * Valide les données d'un tir
 * @param {*} data - Données du tir
 * @returns {Object|null}
 */
function validateShootData(data) {
  if (!data || typeof data !== 'object') return null;

  if (!isValidNumber(data.angle, -Math.PI * 2, Math.PI * 2)) {
    return null;
  }

  return { angle: data.angle };
}

/**
 * Valide les données de sélection d'upgrade
 * @param {*} data - Données de l'upgrade
 * @returns {Object|null}
 */
function validateUpgradeData(data) {
  if (!data || typeof data !== 'object') return null;

  if (!isValidString(data.upgradeId, 100)) {
    return null;
  }

  // Vérifier que l'upgrade existe dans la configuration
  if (!LEVEL_UP_UPGRADES[data.upgradeId]) {
    return null;
  }

  return { upgradeId: data.upgradeId };
}

/**
 * Valide les données d'achat d'item
 * @param {*} data - Données de l'achat
 * @returns {Object|null}
 */
function validateBuyItemData(data) {
  if (!data || typeof data !== 'object') return null;

  if (!isValidString(data.itemId, 100) || !isValidString(data.category, 50)) {
    return null;
  }

  // Vérifier que la catégorie est valide
  if (data.category !== 'permanent' && data.category !== 'temporary') {
    return null;
  }

  // Vérifier que l'item existe dans la configuration
  if (!SHOP_ITEMS[data.category] || !SHOP_ITEMS[data.category][data.itemId]) {
    return null;
  }

  return {
    itemId: data.itemId,
    category: data.category
  };
}

// ===============================================
// SAFE SOCKET HANDLER WRAPPER - Gestion d'erreurs
// ===============================================

/**
 * Wrapper pour les handlers Socket.IO qui capture les erreurs
 * @param {string} handlerName - Nom du handler pour le logging
 * @param {Function} handler - Fonction handler à wrapper
 * @returns {Function} Handler wrappé avec gestion d'erreurs
 */
function safeHandler(handlerName, handler) {
  return function(...args) {
    try {
      handler.apply(this, args);
    } catch (error) {
      logger.error('Socket handler error', { handler: handlerName, socketId: this.id, error: error.message });
      // Optionnellement notifier le client
      this.emit('error', {
        message: 'Une erreur est survenue sur le serveur',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}

// ===============================================
// SESSION RECOVERY SYSTEM - Reconnection state management
// ===============================================

/**
 * Map to store disconnected player states for recovery
 * Key: sessionId, Value: { playerState, disconnectedAt, previousSocketId }
 * States are kept for 5 minutes after disconnection
 */
const disconnectedPlayers = new Map();
const SESSION_RECOVERY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Periodically clean up expired session recovery states
 */
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [sessionId, data] of disconnectedPlayers.entries()) {
    if (now - data.disconnectedAt > SESSION_RECOVERY_TIMEOUT) {
      disconnectedPlayers.delete(sessionId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`[SESSION RECOVERY] Cleaned ${cleanedCount} expired session(s)`);
  }
}, 60000); // Check every minute

// Gestion des connexions Socket.IO
io.on('connection', (socket) => {
  const sessionId = socket.handshake.auth?.sessionId;

  logger.info('Player connected', { socketId: socket.id, sessionId: sessionId || 'none' });

  // RECOVERY: Check if this session has a saved state
  let playerRecovered = false;
  if (sessionId && disconnectedPlayers.has(sessionId)) {
    const savedData = disconnectedPlayers.get(sessionId);
    const timeSinceDisconnect = Date.now() - savedData.disconnectedAt;

    logger.info('Session recovery found', {
      sessionId,
      disconnectedSecs: Math.round(timeSinceDisconnect / 1000)
    });

    // Restore player state with new socket ID
    const restoredPlayer = {
      ...savedData.playerState,
      id: socket.id, // Update to new socket ID
      lastActivityTime: Date.now() // Reset activity timer
    };

    gameState.players[socket.id] = restoredPlayer;
    disconnectedPlayers.delete(sessionId);
    playerRecovered = true;

    console.log(`[SESSION RECOVERY] Restored player ${restoredPlayer.nickname || 'Unknown'} (Level ${restoredPlayer.level}, ${restoredPlayer.health}/${restoredPlayer.maxHealth} HP, ${restoredPlayer.gold} gold)`);
  }

  // Create new player if no recovery happened
  if (!playerRecovered) {
    console.log(`[SESSION] Creating new player for ${socket.id}`);

    // Vérifier la limite de joueurs selon le mode performance
    const playerCount = Object.keys(gameState.players).length;
    if (!perfIntegration.canAcceptPlayer(playerCount)) {
      logger.warn('Player connection rejected - server full', {
        currentPlayers: playerCount,
        maxPlayers: perfIntegration.perfConfig.current.maxPlayers
      });
      socket.emit('serverFull', {
        message: 'Serveur complet. Réessayez plus tard.',
        currentPlayers: playerCount
      });
      socket.disconnect();
      return;
    }

    // Créer un nouveau joueur (Rogue-like)
    gameState.players[socket.id] = {
    id: socket.id,
    nickname: null, // Pseudo non défini au départ
    hasNickname: false, // Le joueur n'a pas encore choisi de pseudo
    spawnProtection: false, // Protection de spawn inactive
    spawnProtectionEndTime: 0, // Fin de la protection
    invisible: false, // Invisibilité après upgrade ou lors du level up
    invisibleEndTime: 0, // Fin de l'invisibilité
    lastActivityTime: Date.now(), // Pour détecter l'inactivité
    x: CONFIG.ROOM_WIDTH / 2,
    y: CONFIG.ROOM_HEIGHT - 100,
    health: CONFIG.PLAYER_MAX_HEALTH,
    maxHealth: CONFIG.PLAYER_MAX_HEALTH,
    level: 1,
    xp: 0,
    gold: 0,
    score: 0,
    alive: true,
    angle: 0,
    weapon: 'pistol',
    lastShot: 0,
    speedBoost: null,
    weaponTimer: null,
    // Système de combos et score
    kills: 0,
    zombiesKilled: 0,
    combo: 0,
    comboTimer: 0,
    highestCombo: 0,
    totalScore: 0,
    survivalTime: Date.now(),
    // Upgrades permanents (shop)
    upgrades: {
      maxHealth: 0,
      damage: 0,
      speed: 0,
      fireRate: 0
    },
    damageMultiplier: 1,
    speedMultiplier: 1,
    fireRateMultiplier: 1,
    // Stats des upgrades de level-up
    regeneration: 0,
    bulletPiercing: 0,
    lifeSteal: 0,
    criticalChance: 0,
    goldMagnetRadius: 0,
    dodgeChance: 0,
    explosiveRounds: 0,
    explosionRadius: 0,
    explosionDamagePercent: 0,
    extraBullets: 0,
    thorns: 0,
    lastRegenTick: Date.now(),
    autoTurrets: 0,
    lastAutoShot: Date.now()
  };
  }

  // Tracker la nouvelle connexion
  if (!playerRecovered) {
    metricsCollector.incrementTotalPlayers();
  }

  // Envoyer la configuration au client
  socket.emit('init', {
    playerId: socket.id,
    config: CONFIG,
    weapons: WEAPONS,
    powerupTypes: POWERUP_TYPES,
    zombieTypes: ZOMBIE_TYPES,
    shopItems: SHOP_ITEMS,
    walls: gameState.walls,
    rooms: gameState.rooms.length,
    currentRoom: gameState.currentRoom,
    recovered: playerRecovered // Indicate if state was recovered
  });

  // Mouvement du joueur (Rogue-like avec collision)
  socket.on('playerMove', safeHandler('playerMove', function(data) {
    // JWT Authentication check
    if (!socket.userId) {
      return; // Silent fail for unauthenticated players
    }

    // VALIDATION: Vérifier et sanitize les données d'entrée
    const validatedData = validateMovementData(data);
    if (!validatedData) {
      console.warn(`[VALIDATION] Invalid movement data from ${socket.id}:`, data);
      return;
    }

    // Rate limiting
    if (!checkRateLimit(socket.id, 'playerMove')) return;

    const player = gameState.players[socket.id];
    if (!player || !player.alive || !player.hasNickname) return; // Pas de mouvement sans pseudo

    // Clamp position to map boundaries, accounting for player size to prevent leaving map
    const halfSize = CONFIG.PLAYER_SIZE / 2;
    const newX = Math.max(halfSize, Math.min(CONFIG.ROOM_WIDTH - halfSize, validatedData.x));
    const newY = Math.max(halfSize, Math.min(CONFIG.ROOM_HEIGHT - halfSize, validatedData.y));

    // VALIDATION: Vérifier la distance parcourue pour éviter la téléportation
    const distance = Math.sqrt(
      Math.pow(newX - player.x, 2) + Math.pow(newY - player.y, 2)
    );

    // ANTI-CHEAT: Valider que speedMultiplier n'est pas suspect
    if (player.speedMultiplier > 5) {
      console.warn(`[ANTI-CHEAT] Player ${player.nickname || socket.id} has suspicious speedMultiplier: ${player.speedMultiplier}, resetting to 1`);
      player.speedMultiplier = 1;
    }

    // Calculer la vitesse maximale autorisée
    const speedMultiplier = player.speedMultiplier || 1;
    const hasSpeedBoost = player.speedBoost && Date.now() < player.speedBoost;
    const boostMultiplier = hasSpeedBoost ? 2 : 1;

    // Distance max par update (client sends at 30 FPS, server at 60 FPS)
    // Account for 2 server ticks between client updates (33ms = 2 * 16.67ms)
    // Add tolerance for network latency and frame timing variations
    const ABSOLUTE_MAX_DISTANCE = 800; // pixels per client update (high tolerance for latency + speed boosts)
    const calculatedMax = CONFIG.PLAYER_SPEED * speedMultiplier * boostMultiplier * 7.0; // Increased tolerance for network latency
    const MAX_DISTANCE_PER_FRAME = Math.min(calculatedMax, ABSOLUTE_MAX_DISTANCE);

    // Rejeter le mouvement si distance trop importante (tentative de téléportation)
    if (distance > MAX_DISTANCE_PER_FRAME) {
      console.warn(`[ANTI-CHEAT] Player ${player.nickname || socket.id} attempted teleport: ${Math.round(distance)}px (max: ${Math.round(MAX_DISTANCE_PER_FRAME)}px)`);
      // Corriger la position du client
      socket.emit('positionCorrection', { x: player.x, y: player.y });
      return;
    }

    // Vérifier collision avec les murs
    if (!roomManager.checkWallCollision(newX, newY, CONFIG.PLAYER_SIZE)) {
      player.x = newX;
      player.y = newY;
    } else {
      // Collision detected - send position correction to client to keep them in sync
      // Only send if the client position is significantly different (> 5px)
      const clientDistance = Math.sqrt(
        Math.pow(newX - player.x, 2) + Math.pow(newY - player.y, 2)
      );
      if (clientDistance > 5) {
        socket.emit('positionCorrection', { x: player.x, y: player.y });
      }
    }

    player.angle = validatedData.angle;

    // Mettre à jour le timestamp d'activité
    player.lastActivityTime = Date.now();

    // MODE INFINI - Pas de portes ni de changements de salle
  }));

  // Tir du joueur
  socket.on('shoot', safeHandler('shoot', function(data) {
    // VALIDATION: Vérifier et sanitize les données d'entrée
    const validatedData = validateShootData(data);
    if (!validatedData) {
      console.warn(`[VALIDATION] Invalid shoot data from ${socket.id}:`, data);
      return;
    }

    // Rate limiting
    if (!checkRateLimit(socket.id, 'shoot')) return;

    const player = gameState.players[socket.id];
    if (!player || !player.alive || !player.hasNickname) return; // Pas de tir sans pseudo

    const now = Date.now();
    player.lastActivityTime = now; // Mettre à jour l'activité

    const weapon = WEAPONS[player.weapon] || WEAPONS.pistol;

    // Appliquer le multiplicateur de cadence de tir
    const fireRate = weapon.fireRate * (player.fireRateMultiplier || 1);

    // Vérifier le cooldown de l'arme
    if (now - player.lastShot < fireRate) return;

    player.lastShot = now;

    // Nombre total de balles (arme + extra bullets)
    const totalBullets = weapon.bulletCount + (player.extraBullets || 0);

    // ANTI-CHEAT: Limiter le nombre total de balles pour éviter l'exploitation
    const MAX_TOTAL_BULLETS = 50;
    if (totalBullets > MAX_TOTAL_BULLETS) {
      console.warn(`[ANTI-CHEAT] Player ${player.nickname || socket.id} has suspicious bullet count: ${totalBullets}, capping to ${MAX_TOTAL_BULLETS}`);
    }
    const safeBulletCount = Math.min(totalBullets, MAX_TOTAL_BULLETS);

    // Créer les balles selon l'arme (OPTIMISÉ avec Object Pool)
    for (let i = 0; i < safeBulletCount; i++) {
      const spreadAngle = validatedData.angle + (Math.random() - 0.5) * weapon.spread;

      // Appliquer le multiplicateur de dégâts
      let damage = weapon.damage * (player.damageMultiplier || 1);

      // Critique (chance de base + chance de l'arme)
      const totalCritChance = (player.criticalChance || 0) + (weapon.criticalChance || 0);
      const isCritical = Math.random() < totalCritChance;
      if (isCritical) {
        const critMultiplier = weapon.criticalMultiplier || 2;
        damage *= critMultiplier;
      }

      // Piercing (de base + piercing de l'arme)
      const totalPiercing = (player.bulletPiercing || 0) + (weapon.piercing || 0);

      // CORRECTION: Utilisation du pool d'objets au lieu de création manuelle
      entityManager.createBullet({
        x: player.x,
        y: player.y,
        vx: Math.cos(spreadAngle) * weapon.bulletSpeed,
        vy: Math.sin(spreadAngle) * weapon.bulletSpeed,
        playerId: socket.id,
        damage: damage,
        color: isCritical ? '#ff0000' : weapon.color,
        size: weapon.bulletSize || CONFIG.BULLET_SIZE,
        piercing: totalPiercing,
        explosiveRounds: player.explosiveRounds || weapon.hasExplosion || false,
        explosionRadius: weapon.hasExplosion ? weapon.explosionRadius : (player.explosionRadius || 0),
        explosionDamagePercent: weapon.hasExplosion ? 1 : (player.explosionDamagePercent || 0),
        rocketExplosionDamage: weapon.hasExplosion ? weapon.explosionDamage : 0,
        isRocket: weapon.hasExplosion && !weapon.isGrenade || false,
        isFlame: weapon.isFlame || false,
        isLaser: weapon.isLaser || false,
        isGrenade: weapon.isGrenade || false,
        isCrossbow: weapon.isCrossbow || false,
        gravity: weapon.gravity || 0,
        lifetime: weapon.lifetime ? now + weapon.lifetime : null,
        createdAt: now
      });
    }
  }));

  // Respawn du joueur (Rogue-like - nouveau run)
  socket.on('respawn', safeHandler('respawn', function() {
    const player = gameState.players[socket.id];
    if (player) {
      player.lastActivityTime = Date.now(); // Mettre à jour l'activité

      // Sauvegarder les upgrades permanents
      const savedUpgrades = { ...player.upgrades };
      const savedMultipliers = {
        damage: player.damageMultiplier,
        speed: player.speedMultiplier,
        fireRate: player.fireRateMultiplier
      };

      // Calculer la vie maximale avec les upgrades
      const baseMaxHealth = CONFIG.PLAYER_MAX_HEALTH;
      const upgradeHealth = (savedUpgrades.maxHealth || 0) * 20;
      const totalMaxHealth = baseMaxHealth + upgradeHealth;

      // Réinitialiser le run (Permadeath mais garde les upgrades permanents)
      player.nickname = null; // Réinitialiser le pseudo
      player.hasNickname = false;

      // CORRECTION: Nettoyer les balles de la vie précédente
      cleanupPlayerBullets(socket.id);

      player.spawnProtection = false;
      player.spawnProtectionEndTime = 0;
      player.invisible = false;
      player.invisibleEndTime = 0;
      player.x = CONFIG.ROOM_WIDTH / 2;
      player.y = CONFIG.ROOM_HEIGHT - 100;
      player.health = totalMaxHealth;
      player.maxHealth = totalMaxHealth;
      player.alive = true;
      player.level = 1;
      player.xp = 0;
      player.gold = 0; // L'or est perdu au respawn
      player.score = 0;
      player.weapon = 'pistol';
      player.speedBoost = null;
      player.weaponTimer = null;
      player.lastShot = 0;

      // CORRECTION: Réinitialiser les statistiques de run
      player.zombiesKilled = 0;
      player.kills = 0;
      player.combo = 0;
      player.comboTimer = 0;
      player.highestCombo = 0;
      player.totalScore = 0;

      // CORRECTION: Réinitialiser toutes les stats de level-up (ne pas conserver entre les runs)
      player.regeneration = 0;
      player.bulletPiercing = 0;
      player.lifeSteal = 0;
      player.criticalChance = 0;
      player.goldMagnetRadius = 0;
      player.dodgeChance = 0;
      player.explosiveRounds = 0;
      player.explosionRadius = 0;
      player.explosionDamagePercent = 0;
      player.extraBullets = 0;
      player.thorns = 0;
      player.autoTurrets = 0;
      player.lastRegenTick = Date.now();
      player.lastAutoShot = Date.now();

      // Restaurer les upgrades permanents
      player.upgrades = savedUpgrades;
      player.damageMultiplier = savedMultipliers.damage;
      player.speedMultiplier = savedMultipliers.speed;
      player.fireRateMultiplier = savedMultipliers.fireRate;

      // Recharger depuis la première salle
      loadRoom(0);
    }
  }));

  // Sélectionner un upgrade au level up
  socket.on('selectUpgrade', safeHandler('selectUpgrade', function(data) {
    // VALIDATION: Vérifier et sanitize les données d'entrée
    const validatedData = validateUpgradeData(data);
    if (!validatedData) {
      console.warn(`[VALIDATION] Invalid upgrade data from ${socket.id}:`, data);
      socket.emit('error', {
        message: 'Upgrade invalide',
        code: 'INVALID_UPGRADE'
      });
      return;
    }

    // Rate limiting
    if (!checkRateLimit(socket.id, 'selectUpgrade')) return;

    const player = gameState.players[socket.id];
    if (!player || !player.alive) return;

    player.lastActivityTime = Date.now(); // Mettre à jour l'activité

    const upgrade = LEVEL_UP_UPGRADES[validatedData.upgradeId];

    // Double vérification (déjà fait dans validateUpgradeData, mais par sécurité)
    if (!upgrade) {
      logger.error('Upgrade validation failed', { upgradeId: validatedData.upgradeId });
      return;
    }

    // Appliquer l'effet de l'upgrade
    upgrade.effect(player);

    // Désactiver l'invisibilité - le joueur redevient visible dès qu'il choisit une amélioration
    player.invisible = false;
    player.invisibleEndTime = 0;

    socket.emit('upgradeSelected', { success: true, upgradeId });
  }));

  // Acheter un item dans le shop
  socket.on('buyItem', safeHandler('buyItem', function(data) {
    // VALIDATION: Vérifier et sanitize les données d'entrée
    const validatedData = validateBuyItemData(data);
    if (!validatedData) {
      console.warn(`[VALIDATION] Invalid buy item data from ${socket.id}:`, data);
      socket.emit('shopUpdate', {
        success: false,
        message: 'Item invalide'
      });
      return;
    }

    // Rate limiting
    if (!checkRateLimit(socket.id, 'buyItem')) return;

    const player = gameState.players[socket.id];
    if (!player || !player.alive) return;

    player.lastActivityTime = Date.now(); // Mettre à jour l'activité

    const { itemId, category } = validatedData;

    if (category === 'permanent') {
      const item = SHOP_ITEMS.permanent[itemId];
      // Double vérification (déjà fait dans validateBuyItemData, mais par sécurité)
      if (!item) {
        logger.error('Item validation failed', { itemId, category });
        return;
      }

      const currentLevel = player.upgrades[itemId] || 0;

      // Vérifier si déjà au max
      if (currentLevel >= item.maxLevel) {
        socket.emit('shopUpdate', { success: false, message: 'Niveau maximum atteint' });
        return;
      }

      // Calculer le coût
      const cost = item.baseCost + (currentLevel * item.costIncrease);

      // Vérifier si le joueur a assez d'or
      if (player.gold < cost) {
        socket.emit('shopUpdate', { success: false, message: 'Or insuffisant' });
        return;
      }

      // Déduire l'or
      player.gold -= cost;

      // Augmenter le niveau de l'upgrade
      player.upgrades[itemId] = currentLevel + 1;

      // Appliquer l'effet
      item.effect(player);

      socket.emit('shopUpdate', { success: true, itemId, category });

    } else if (category === 'temporary') {
      const item = SHOP_ITEMS.temporary[itemId];
      // Double vérification (déjà fait dans validateBuyItemData, mais par sécurité)
      if (!item) {
        logger.error('Temporary item validation failed', { itemId, category });
        return;
      }

      // Vérifier si le joueur a assez d'or
      if (player.gold < item.cost) {
        socket.emit('shopUpdate', { success: false, message: 'Or insuffisant' });
        return;
      }

      // Déduire l'or
      player.gold -= item.cost;

      // Appliquer l'effet
      item.effect(player);

      socket.emit('shopUpdate', { success: true, itemId, category });
    }
  }));

  // Définir le pseudo du joueur
  socket.on('setNickname', safeHandler('setNickname', function(data) {
    const player = gameState.players[socket.id];
    if (!player) return;

    // JWT Authentication check
    if (!socket.userId || !socket.username) {
      logger.warn('setNickname called without JWT authentication', {
        socketId: socket.id
      });
      socket.emit('nicknameRejected', {
        reason: 'Authentication required'
      });
      return;
    }

    // CORRECTION CRITIQUE: Vérifier si le joueur a déjà un pseudo AVANT rate limiting
    if (player.hasNickname) {
      socket.emit('nicknameRejected', {
        reason: 'Vous avez déjà choisi un pseudo'
      });
      return;
    }

    // Rate limiting
    if (!checkRateLimit(socket.id, 'setNickname')) {
      socket.emit('nicknameRejected', {
        reason: 'Trop de tentatives. Attendez quelques secondes.'
      });
      return;
    }

    player.lastActivityTime = Date.now(); // Mettre à jour l'activité

    // VALIDATION STRICTE DU PSEUDO
    let nickname = data.nickname ? data.nickname.trim() : '';

    // JWT validation: nickname must match authenticated username
    if (nickname.toLowerCase() !== socket.username.toLowerCase()) {
      logger.warn('Nickname mismatch with JWT', {
        provided: nickname,
        expected: socket.username,
        socketId: socket.id
      });
      socket.emit('nicknameRejected', {
        reason: 'Le pseudo doit correspondre à votre compte'
      });
      return;
    }

    // Filtrer caractères non autorisés (lettres, chiffres, espaces, tirets, underscores)
    nickname = nickname.replace(/[^a-zA-Z0-9\s\-_]/g, '');

    // Limiter à 15 caractères max
    nickname = nickname.substring(0, 15);

    // Vérifier longueur minimale
    if (nickname.length < 2) {
      socket.emit('nicknameRejected', {
        reason: 'Le pseudo doit contenir au moins 2 caractères alphanumériques'
      });
      return;
    }

    // Vérifier si le pseudo n'est pas déjà pris par un autre joueur
    const isDuplicate = Object.values(gameState.players).some(
      p => p.id !== socket.id && p.nickname && p.nickname.toLowerCase() === nickname.toLowerCase()
    );

    if (isDuplicate) {
      socket.emit('nicknameRejected', {
        reason: 'Ce pseudo est déjà utilisé par un autre joueur'
      });
      return;
    }

    player.nickname = nickname;
    player.hasNickname = true;
    player.spawnProtection = true;
    player.spawnProtectionEndTime = Date.now() + 3000; // 3 secondes de protection

    console.log(`${socket.id} a choisi le pseudo: ${nickname}`);

    // Notifier tous les joueurs
    io.emit('playerNicknameSet', {
      playerId: socket.id,
      nickname: nickname
    });
  }));

  // Fin de la protection de spawn
  socket.on('endSpawnProtection', safeHandler('endSpawnProtection', function() {
    const player = gameState.players[socket.id];
    if (!player) return;

    player.lastActivityTime = Date.now(); // Mettre à jour l'activité

    player.spawnProtection = false;
    console.log(`${player.nickname || socket.id} n'a plus de protection de spawn`);
  }));

  // Ouverture du shop - activer l'invisibilité
  socket.on('shopOpened', safeHandler('shopOpened', function() {
    const player = gameState.players[socket.id];
    if (!player) return;

    player.lastActivityTime = Date.now(); // Mettre à jour l'activité

    player.invisible = true;
    player.invisibleEndTime = Infinity; // Invisibilité sans limite de temps
    console.log(`${player.nickname || socket.id} est invisible (shop ouvert)`);
  }));

  // Fermeture du shop - désactiver l'invisibilité
  socket.on('shopClosed', safeHandler('shopClosed', function() {
    const player = gameState.players[socket.id];
    if (!player) return;

    player.lastActivityTime = Date.now(); // Mettre à jour l'activité

    player.invisible = false;
    player.invisibleEndTime = 0;
    console.log(`${player.nickname || socket.id} n'est plus invisible (shop fermé)`);
  }));

  // Déconnexion du joueur
  socket.on('disconnect', safeHandler('disconnect', function() {
    const player = gameState.players[socket.id];
    const sessionId = socket.handshake.auth?.sessionId;

    logger.info('Player disconnected', { socketId: socket.id, sessionId: sessionId || 'none' });

    // SESSION RECOVERY: Save player state for recovery if session exists
    if (sessionId && player) {
      // Only save state if player has actually started playing (has nickname)
      if (player.hasNickname && player.alive) {
        // Create a deep copy of player state
        const playerStateCopy = JSON.parse(JSON.stringify(player));

        disconnectedPlayers.set(sessionId, {
          playerState: playerStateCopy,
          disconnectedAt: Date.now(),
          previousSocketId: socket.id
        });

        logger.info('Session state saved', {
          player: player.nickname || 'Unknown',
          level: player.level,
          health: `${player.health}/${player.maxHealth}`,
          gold: player.gold,
          recoveryTimeout: SESSION_RECOVERY_TIMEOUT / 1000
        });
      }
    }

    // Nettoyer les balles orphelines appartenant à ce joueur
    cleanupPlayerBullets(socket.id);

    // Remove from active players
    delete gameState.players[socket.id];

    // Nettoyer les rate limits
    cleanupRateLimits(socket.id);
  }));
});

// Gestion des erreurs 404 (Route non trouvée)
app.use((req, res, next) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>404 - Page non trouvée</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 50px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        h1 { font-size: 72px; margin: 0; }
        p { font-size: 24px; }
        a { color: #ffeb3b; text-decoration: none; font-weight: bold; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <h1>404</h1>
      <p>🧟 Page non trouvée</p>
      <p><a href="/">← Retour au jeu</a></p>
    </body>
    </html>
  `);
});

// Gestion des erreurs serveur (500, 503, etc.)
app.use((err, req, res, next) => {
  logger.error('Server error', { status: err.status || 500, stack: err.stack });
  res.status(err.status || 500).send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Erreur serveur</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 50px;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
        }
        h1 { font-size: 72px; margin: 0; }
        p { font-size: 24px; }
        a { color: #ffeb3b; text-decoration: none; font-weight: bold; }
        a:hover { text-decoration: underline; }
        .error-code { opacity: 0.7; font-size: 18px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <h1>${err.status || 500}</h1>
      <p>💥 Une erreur serveur s'est produite</p>
      <p><a href="/">← Retour au jeu</a></p>
      <div class="error-code">Code d'erreur: ${err.status || 500}</div>
    </body>
    </html>
  `);
});

// ===============================================
// SERVER CLEANUP - Prévention fuite mémoire
// ===============================================

function cleanupServer() {
  console.log('[CLEANUP] Nettoyage des ressources serveur...');

  // Arrêter tous les timers
  zombieManager.stopZombieSpawner();
  console.log('[CLEANUP] Zombie spawn timer arrêté');

  if (powerupSpawnTimer) {
    clearInterval(powerupSpawnTimer);
    console.log('[CLEANUP] Powerup spawn timer arrêté');
  }
  if (gameLoopTimer) {
    clearInterval(gameLoopTimer);
    console.log('[CLEANUP] Game loop timer arrêté');
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    console.log('[CLEANUP] Heartbeat timer arrêté');
  }

  // Fermer toutes les connexions socket
  io.close(() => {
    console.log('[CLEANUP] Toutes les connexions Socket.IO fermées');
  });

  // Fermer le serveur HTTP
  http.close(() => {
    console.log('[CLEANUP] Serveur HTTP fermé');
    process.exit(0);
  });

  // Force exit après 5 secondes si le serveur ne se ferme pas
  setTimeout(() => {
    console.log('[CLEANUP] Fermeture forcée après timeout');
    process.exit(1);
  }, 5000);
}

// Gérer les signaux d'arrêt
process.on('SIGTERM', () => {
  console.log('[SIGNAL] SIGTERM reçu');
  cleanupServer();
});

process.on('SIGINT', () => {
  console.log('[SIGNAL] SIGINT reçu (Ctrl+C)');
  cleanupServer();
});

// Gérer les erreurs non capturées
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  cleanupServer();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', { reason: reason?.message || reason });
  cleanupServer();
});

http.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    url: `http://localhost:${PORT}`,
    nodeEnv: process.env.NODE_ENV || 'development'
  });
});
