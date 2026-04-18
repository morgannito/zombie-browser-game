/**
 * @fileoverview Admin Commands System
 * @description Debug and testing commands for zombie/boss spawning
 */

const ConfigManager = require('../../../lib/server/ConfigManager');
const { ZOMBIE_TYPES } = ConfigManager;
const perfIntegration = require('../../../lib/server/PerformanceIntegration');

class AdminCommands {
  constructor(io, gameState, zombieManager) {
    this.io = io;
    this.gameState = gameState;
    this.zombieManager = zombieManager;
    this.adminUsers = new Set(); // Track admin users
  }

  /**
   * Register admin command handlers
   */
  registerCommands(socket) {
    socket.on('adminCommand', data => {
      this.handleCommand(socket, data);
    });
  }

  /**
   * Handle admin command
   */
  handleCommand(socket, data) {
    const { command, args } = data;

    // Simple auth - check if socket.playerId is in adminUsers
    // In production, use proper auth
    if (!this.isAdmin(socket.userId)) {
      socket.emit('adminResponse', {
        success: false,
        message: 'Not authorized'
      });
      return;
    }

    switch (command) {
      case 'spawn':
        this.handleSpawn(socket, args);
        break;
      case 'wave':
        this.handleWave(socket, args);
        break;
      case 'boss':
        this.handleBoss(socket, args);
        break;
      case 'list':
        this.handleList(socket, args);
        break;
      case 'clear':
        this.handleClear(socket);
        break;
      case 'fps':
        this.handleFPS(socket);
        break;
      case 'teleport':
        this.handleTeleport(socket, args);
        break;
      case 'stats':
        this.handleStats(socket);
        break;
      default:
        socket.emit('adminResponse', {
          success: false,
          message: `Unknown command: ${command}`
        });
    }
  }

  /**
   * Spawn specific zombie type
   * Usage: /spawn <type> [count]
   */
  handleSpawn(socket, args) {
    const [type, countStr] = args;
    const count = parseInt(countStr) || 1;

    if (!ZOMBIE_TYPES[type]) {
      socket.emit('adminResponse', {
        success: false,
        message: `Invalid zombie type: ${type}. Use /list to see all types.`
      });
      return;
    }

    let spawned = 0;
    for (let i = 0; i < Math.min(count, 50); i++) {
      // Spawn at player position
      const player = this.gameState.players[socket.userId] || this.gameState.players[socket.id];
      if (!player) {
        break;
      }

      const angle = Math.random() * Math.PI * 2;
      const distance = 100 + Math.random() * 100;
      const x = player.x + Math.cos(angle) * distance;
      const y = player.y + Math.sin(angle) * distance;

      const zombieType = ZOMBIE_TYPES[type];
      const zombieId = this.gameState.getNextId('nextZombieId');

      this.gameState.zombies[zombieId] = {
        id: zombieId,
        type: type,
        x: x,
        y: y,
        health: zombieType.health,
        maxHealth: zombieType.health,
        speed: zombieType.speed,
        damage: zombieType.damage,
        color: zombieType.color,
        size: zombieType.size,
        goldDrop: zombieType.gold || zombieType.goldDrop || 0,
        xpDrop: zombieType.xp || zombieType.xpDrop || 0,
        isBoss: zombieType.isBoss || false,
        isElite: zombieType.isElite || false
      };

      spawned++;
    }

    socket.emit('adminResponse', {
      success: true,
      message: `Spawned ${spawned}x ${type}`
    });
  }

  /**
   * Set current wave
   * Usage: /wave <number>
   */
  handleWave(socket, args) {
    const [waveStr] = args;
    const wave = parseInt(waveStr);

    if (isNaN(wave) || wave < 1 || wave > 250) {
      socket.emit('adminResponse', {
        success: false,
        message: 'Wave must be between 1-250'
      });
      return;
    }

    this.gameState.wave = wave;
    this.gameState.zombiesSpawnedThisWave = 0;
    this.gameState.bossSpawned = false;
    if (this.gameState.mutatorManager) {
      this.gameState.mutatorManager.handleWaveChange(wave);
    }
    if (this.zombieManager) {
      this.zombieManager.restartZombieSpawner();
    }

    this.io.emit('adminResponse', {
      success: true,
      message: `Wave set to ${wave}`
    });
  }

  /**
   * Spawn specific boss
   * Usage: /boss <type>
   */
  handleBoss(socket, args) {
    const [bossType] = args || ['boss'];

    const validBosses = [
      'boss',
      'bossCharnier',
      'bossInfect',
      'bossColosse',
      'bossRoi',
      'bossOmega',
      'bossInfernal',
      'bossCryos',
      'bossVortex',
      'bossNexus',
      'bossApocalypse'
    ];

    if (!validBosses.includes(bossType)) {
      socket.emit('adminResponse', {
        success: false,
        message: `Invalid boss type. Valid: ${validBosses.join(', ')}`
      });
      return;
    }

    // Clear existing zombies
    this.gameState.zombies = {};

    // Spawn boss at center
    const type = ZOMBIE_TYPES[bossType];
    const zombieId = this.gameState.getNextId('nextZombieId');

    this.gameState.zombies[zombieId] = {
      id: zombieId,
      type: bossType,
      x: this.gameState.config.ROOM_WIDTH / 2,
      y: this.gameState.config.ROOM_HEIGHT / 2,
      health: type.health,
      maxHealth: type.health,
      speed: type.speed,
      damage: type.damage,
      color: type.color,
      size: type.size,
      goldDrop: type.gold,
      xpDrop: type.xp,
      isBoss: true,
      phase: 1
    };

    this.io.emit('adminResponse', {
      success: true,
      message: `Spawned boss: ${type.name}`
    });
  }

  /**
   * List all zombie types
   * Usage: /list [filter]
   */
  handleList(socket, args) {
    const [filter] = args || [''];

    const types = Object.keys(ZOMBIE_TYPES)
      .filter(key => key.toLowerCase().includes(filter.toLowerCase()))
      .sort();

    const bosses = types.filter(t => ZOMBIE_TYPES[t].isBoss);
    const elites = types.filter(t => ZOMBIE_TYPES[t].isElite && !ZOMBIE_TYPES[t].isBoss);
    const normals = types.filter(t => !ZOMBIE_TYPES[t].isBoss && !ZOMBIE_TYPES[t].isElite);

    let message = `**Zombie Types (${types.length})**\n`;
    if (bosses.length > 0) {
      message += `\nBosses (${bosses.length}): ${bosses.join(', ')}`;
    }
    if (elites.length > 0) {
      message += `\nElites (${elites.length}): ${elites.join(', ')}`;
    }
    if (normals.length > 0) {
      message += `\nNormal (${normals.length}): ${normals.join(', ')}`;
    }

    socket.emit('adminResponse', {
      success: true,
      message: message
    });
  }

  /**
   * Clear all zombies
   * Usage: /clear
   */
  handleClear(socket) {
    const count = Object.keys(this.gameState.zombies).length;
    this.gameState.zombies = {};

    socket.emit('adminResponse', {
      success: true,
      message: `Cleared ${count} zombies`
    });
  }

  /**
   * Show FPS and performance stats
   * Usage: /fps
   */
  handleFPS(socket) {
    const zombieCount = Object.keys(this.gameState.zombies).length;
    const playerCount = Object.keys(this.gameState.players).length;

    socket.emit('adminResponse', {
      success: true,
      message: `Zombies: ${zombieCount}, Players: ${playerCount}, Wave: ${this.gameState.wave}`
    });
  }

  /**
   * Teleport player to coordinates
   * Usage: /teleport <x> <y>
   */
  handleTeleport(socket, args) {
    const x = parseFloat(args[0]);
    const y = parseFloat(args[1]);
    if (isNaN(x) || isNaN(y)) {
      socket.emit('adminResponse', { success: false, message: 'Usage: /teleport <x> <y>' });
      return;
    }
    const player = this.gameState.players[socket.userId] || this.gameState.players[socket.id];
    if (!player) {
      socket.emit('adminResponse', { success: false, message: 'Player not found' });
      return;
    }
    const cfg = this.gameState.config;
    player.x = Math.max(0, Math.min(x, cfg.ROOM_WIDTH || x));
    player.y = Math.max(0, Math.min(y, cfg.ROOM_HEIGHT || y));
    socket.emit('adminResponse', { success: true, message: `Teleported to (${player.x}, ${player.y})` });
  }

  /**
   * Dump server-side metrics
   * Usage: /stats
   */
  handleStats(socket) {
    const mem = process.memoryUsage();
    const toMB = b => (b / 1048576).toFixed(1);
    const zombieCount = Object.keys(this.gameState.zombies).length;
    const playerCount = Object.keys(this.gameState.players).length;
    const perfCfg = perfIntegration.perfConfig;
    const message = [
      `[Stats] Wave: ${this.gameState.wave} | Zombies: ${zombieCount} | Players: ${playerCount}`,
      `[Tick] Mode: ${perfCfg.mode} | Rate: ${perfCfg.current.tickRate}Hz | Counter: ${perfIntegration.tickCounter}`,
      `[Perf] Broadcast: ${perfCfg.current.broadcastRate}Hz | Pathfind every: ${perfCfg.current.zombiePathfindingRate} ticks`,
      `[Mem] Heap: ${toMB(mem.heapUsed)}/${toMB(mem.heapTotal)} MB | RSS: ${toMB(mem.rss)} MB | Ext: ${toMB(mem.external)} MB`
    ].join('\n');
    socket.emit('adminResponse', { success: true, message });
  }

  /**
   * Check if user is admin.
   * Requires ADMIN_USER_IDS env var (comma-separated UUIDs).
   * No admin access without explicit configuration.
   */
  isAdmin(userId) {
    if (!userId) {
      return false;
    }
    const adminIds = process.env.ADMIN_USER_IDS
      ? process.env.ADMIN_USER_IDS.split(',')
          .map(id => id.trim())
          .filter(Boolean)
      : [];
    return adminIds.includes(userId);
  }

  /**
   * Enable admin for specific user
   */
  enableAdmin(playerId) {
    this.adminUsers.add(playerId);
  }

  /**
   * Disable admin for specific user
   */
  disableAdmin(playerId) {
    this.adminUsers.delete(playerId);
  }
}

module.exports = AdminCommands;
