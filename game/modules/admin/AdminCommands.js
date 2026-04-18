/**
 * @fileoverview Admin Commands System
 * @description Debug and testing commands for zombie/boss spawning.
 *   All commands require the caller's socket.userId to be listed in the
 *   ADMIN_USER_IDS environment variable (comma-separated UUIDs).
 *   The admin user list is resolved once at construction time.
 */

const ConfigManager = require('../../../lib/server/ConfigManager');
const { ZOMBIE_TYPES } = ConfigManager;
const perfIntegration = require('../../../lib/server/PerformanceIntegration');
const { SOCKET_EVENTS } = require('../../../transport/websocket/events');

/** Maximum zombies that can be spawned in a single /spawn call. */
const MAX_SPAWN_COUNT = 50;

class AdminCommands {
  /**
   * @param {import('socket.io').Server} io
   * @param {object} gameState - Shared mutable game state.
   * @param {object|null} zombieManager - Optional zombie manager instance.
   */
  constructor(io, gameState, zombieManager) {
    this.io = io;
    this.gameState = gameState;
    this.zombieManager = zombieManager;

    // Resolve admin IDs once at construction — avoids re-parsing env on every request.
    this._adminIds = new Set(
      (process.env.ADMIN_USER_IDS || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean)
    );
  }

  /**
   * Register admin command handlers for a connected socket.
   * @param {import('socket.io').Socket} socket
   */
  registerCommands(socket) {
    socket.on(SOCKET_EVENTS.CLIENT.ADMIN_COMMAND, data => {
      this.handleCommand(socket, data);
    });
  }

  /**
   * Dispatch an incoming admin command after authorization.
   * @param {import('socket.io').Socket} socket
   * @param {object} data
   * @param {string} data.command - Command name.
   * @param {string[]} [data.args] - Command arguments.
   */
  handleCommand(socket, data) {
    if (!data || typeof data !== 'object') {
      return;
    }

    const command = typeof data.command === 'string' ? data.command : '';
    const args = Array.isArray(data.args) ? data.args : [];

    if (!this.isAdmin(socket.userId)) {
      socket.emit(SOCKET_EVENTS.SERVER.ADMIN_RESPONSE,{ success: false, message: 'Not authorized' });
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
        socket.emit(SOCKET_EVENTS.SERVER.ADMIN_RESPONSE,{
          success: false,
          message: `Unknown command: ${command}`
        });
    }
  }

  /**
   * Spawn specific zombie type near the admin player.
   * @param {import('socket.io').Socket} socket
   * @param {string[]} args - [type, count?]
   * Usage: /spawn <type> [count]
   */
  handleSpawn(socket, args) {
    const type = String(args[0] || '');
    const count = Math.max(1, parseInt(args[1]) || 1);

    if (!ZOMBIE_TYPES[type]) {
      socket.emit(SOCKET_EVENTS.SERVER.ADMIN_RESPONSE,{
        success: false,
        message: `Invalid zombie type: ${type}. Use /list to see all types.`
      });
      return;
    }

    let spawned = 0;
    for (let i = 0; i < Math.min(count, MAX_SPAWN_COUNT); i++) {
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

    socket.emit(SOCKET_EVENTS.SERVER.ADMIN_RESPONSE,{
      success: true,
      message: `Spawned ${spawned}x ${type}`
    });
  }

  /**
   * Jump to a specific wave number.
   * @param {import('socket.io').Socket} socket
   * @param {string[]} args - [waveNumber]
   * Usage: /wave <number>
   */
  handleWave(socket, args) {
    const [waveStr] = args;
    const wave = parseInt(waveStr);

    if (isNaN(wave) || wave < 1 || wave > 250) {
      socket.emit(SOCKET_EVENTS.SERVER.ADMIN_RESPONSE,{
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
   * Clear all zombies and spawn a single boss at the room centre.
   * @param {import('socket.io').Socket} socket
   * @param {string[]} args - [bossType?] defaults to 'boss'
   * Usage: /boss <type>
   */
  handleBoss(socket, args) {
    const bossType = String(args[0] || 'boss');

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
      socket.emit(SOCKET_EVENTS.SERVER.ADMIN_RESPONSE,{
        success: false,
        message: `Invalid boss type. Valid: ${validBosses.join(', ')}`
      });
      return;
    }

    const type = ZOMBIE_TYPES[bossType];
    if (!type) {
      socket.emit(SOCKET_EVENTS.SERVER.ADMIN_RESPONSE,{ success: false, message: `Boss type '${bossType}' not found in ZOMBIE_TYPES` });
      return;
    }

    // Clear existing zombies
    this.gameState.zombies = {};

    // Spawn boss at center
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
   * List all available zombie types, optionally filtered by name prefix.
   * @param {import('socket.io').Socket} socket
   * @param {string[]} args - [filter?]
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

    socket.emit(SOCKET_EVENTS.SERVER.ADMIN_RESPONSE,{
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

    socket.emit(SOCKET_EVENTS.SERVER.ADMIN_RESPONSE,{
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

    socket.emit(SOCKET_EVENTS.SERVER.ADMIN_RESPONSE,{
      success: true,
      message: `Zombies: ${zombieCount}, Players: ${playerCount}, Wave: ${this.gameState.wave}`
    });
  }

  /**
   * Teleport the admin player to the given coordinates (clamped to room bounds).
   * @param {import('socket.io').Socket} socket
   * @param {string[]} args - [x, y]
   * Usage: /teleport <x> <y>
   */
  handleTeleport(socket, args) {
    const x = parseFloat(args[0]);
    const y = parseFloat(args[1]);
    if (isNaN(x) || isNaN(y)) {
      socket.emit(SOCKET_EVENTS.SERVER.ADMIN_RESPONSE,{ success: false, message: 'Usage: /teleport <x> <y>' });
      return;
    }
    const player = this.gameState.players[socket.userId] || this.gameState.players[socket.id];
    if (!player) {
      socket.emit(SOCKET_EVENTS.SERVER.ADMIN_RESPONSE,{ success: false, message: 'Player not found' });
      return;
    }
    const cfg = this.gameState.config;
    // Use explicit null-check instead of || to avoid bypassing a 0-valued dimension.
    const maxX = cfg.ROOM_WIDTH != null ? cfg.ROOM_WIDTH : x;
    const maxY = cfg.ROOM_HEIGHT != null ? cfg.ROOM_HEIGHT : y;
    player.x = Math.max(0, Math.min(x, maxX));
    player.y = Math.max(0, Math.min(y, maxY));
    socket.emit(SOCKET_EVENTS.SERVER.ADMIN_RESPONSE,{ success: true, message: `Teleported to (${player.x}, ${player.y})` });
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
    socket.emit(SOCKET_EVENTS.SERVER.ADMIN_RESPONSE,{ success: true, message });
  }

  /**
   * Check whether a given userId has admin privileges.
   * Resolves against the ADMIN_USER_IDS env var parsed at construction time.
   * @param {string|undefined} userId
   * @returns {boolean}
   */
  isAdmin(userId) {
    return typeof userId === 'string' && userId.length > 0 && this._adminIds.has(userId);
  }
}

module.exports = AdminCommands;
