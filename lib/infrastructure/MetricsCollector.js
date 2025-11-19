/**
 * METRICS COLLECTOR
 * Collecte des métriques temps réel pour monitoring et observabilité
 * @version 1.0.0
 */

const os = require('os');
const logger = require('./Logger');

class MetricsCollector {
  constructor() {
    this.startTime = Date.now();

    // Compteurs de base
    this.metrics = {
      players: {
        current: 0,
        total: 0,
        peak: 0
      },
      zombies: {
        current: 0,
        spawned: 0,
        killed: 0
      },
      powerups: {
        current: 0,
        spawned: 0,
        collected: 0
      },
      bullets: {
        current: 0,
        fired: 0
      },
      performance: {
        tickRate: 0,
        actualFPS: 0,
        targetFPS: 0,
        avgFrameTime: 0,
        maxFrameTime: 0
      },
      network: {
        bytesIn: 0,
        bytesOut: 0,
        messagesIn: 0,
        messagesOut: 0
      },
      game: {
        currentWave: 0,
        highestWave: 0,
        activeGames: 0
      }
    };

    // Historique pour calculs de moyenne
    this.frameTimes = [];
    this.maxFrameTimeSamples = 60; // Garder 60 derniers frames

    // Sample pour FPS
    this.lastFpsSample = Date.now();
    this.frameCount = 0;
  }

  /**
   * Mettre à jour les métriques de joueurs
   */
  updatePlayers(gameState) {
    const currentPlayers = Object.keys(gameState.players || {}).length;

    this.metrics.players.current = currentPlayers;
    this.metrics.players.peak = Math.max(this.metrics.players.peak, currentPlayers);
  }

  /**
   * Incrémenter le compteur total de joueurs
   */
  incrementTotalPlayers() {
    this.metrics.players.total++;
  }

  /**
   * Mettre à jour les métriques de zombies
   */
  updateZombies(gameState) {
    this.metrics.zombies.current = Object.keys(gameState.zombies || {}).length;
  }

  /**
   * Incrémenter le compteur de zombies spawned
   */
  incrementZombiesSpawned(count = 1) {
    this.metrics.zombies.spawned += count;
  }

  /**
   * Incrémenter le compteur de zombies killed
   */
  incrementZombiesKilled() {
    this.metrics.zombies.killed++;
  }

  /**
   * Mettre à jour les métriques de power-ups
   */
  updatePowerups(gameState) {
    this.metrics.powerups.current = Object.keys(gameState.powerups || {}).length;
  }

  /**
   * Incrémenter power-ups spawned
   */
  incrementPowerupsSpawned() {
    this.metrics.powerups.spawned++;
  }

  /**
   * Incrémenter power-ups collected
   */
  incrementPowerupsCollected() {
    this.metrics.powerups.collected++;
  }

  /**
   * Mettre à jour les métriques de balles
   */
  updateBullets(gameState) {
    this.metrics.bullets.current = Object.keys(gameState.bullets || {}).length;
  }

  /**
   * Incrémenter balles tirées
   */
  incrementBulletsFired(count = 1) {
    this.metrics.bullets.fired += count;
  }

  /**
   * Enregistrer le temps d'un frame
   */
  recordFrameTime(frameTime) {
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.maxFrameTimeSamples) {
      this.frameTimes.shift();
    }

    // Calculer FPS réel
    this.frameCount++;
    const now = Date.now();
    const elapsed = now - this.lastFpsSample;

    if (elapsed >= 1000) {
      this.metrics.performance.actualFPS = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastFpsSample = now;
    }

    // Calculer moyennes
    const sum = this.frameTimes.reduce((a, b) => a + b, 0);
    this.metrics.performance.avgFrameTime = sum / this.frameTimes.length;
    this.metrics.performance.maxFrameTime = Math.max(...this.frameTimes);
  }

  /**
   * Mettre à jour le tick rate cible
   */
  setTargetFPS(fps) {
    this.metrics.performance.targetFPS = fps;
  }

  /**
   * Mettre à jour les métriques réseau
   */
  recordNetworkIn(bytes) {
    this.metrics.network.bytesIn += bytes;
    this.metrics.network.messagesIn++;
  }

  recordNetworkOut(bytes) {
    this.metrics.network.bytesOut += bytes;
    this.metrics.network.messagesOut++;
  }

  /**
   * Mettre à jour les métriques de jeu
   */
  updateGame(gameState) {
    this.metrics.game.currentWave = gameState.wave || 0;
    this.metrics.game.highestWave = Math.max(this.metrics.game.highestWave, this.metrics.game.currentWave);

    // Active games = nombre de joueurs avec hasNickname
    const activePlayers = Object.values(gameState.players || {})
      .filter(p => p.hasNickname)
      .length;
    this.metrics.game.activeGames = activePlayers;
  }

  /**
   * Récupérer les métriques système
   */
  getSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      processUptime: Math.floor(process.uptime()),
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        external: memUsage.external,
        heapUsedMB: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
        heapTotalMB: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
        rssMB: (memUsage.rss / 1024 / 1024).toFixed(2)
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      system: {
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        totalMemoryMB: (os.totalmem() / 1024 / 1024).toFixed(2),
        freeMemoryMB: (os.freemem() / 1024 / 1024).toFixed(2),
        memoryUsagePercent: ((1 - os.freemem() / os.totalmem()) * 100).toFixed(2),
        loadAverage: os.loadavg(),
        cpus: os.cpus().length,
        platform: os.platform(),
        arch: os.arch()
      }
    };
  }

  /**
   * Récupérer toutes les métriques
   */
  getMetrics() {
    return {
      ...this.metrics,
      system: this.getSystemMetrics()
    };
  }

  /**
   * Format Prometheus pour /metrics
   */
  getPrometheusMetrics() {
    const metrics = this.getMetrics();
    const lines = [];

    // Players
    lines.push('# HELP zombie_players_current Current number of connected players');
    lines.push('# TYPE zombie_players_current gauge');
    lines.push(`zombie_players_current ${metrics.players.current}`);

    lines.push('# HELP zombie_players_total Total number of players that connected');
    lines.push('# TYPE zombie_players_total counter');
    lines.push(`zombie_players_total ${metrics.players.total}`);

    lines.push('# HELP zombie_players_peak Peak number of concurrent players');
    lines.push('# TYPE zombie_players_peak gauge');
    lines.push(`zombie_players_peak ${metrics.players.peak}`);

    // Zombies
    lines.push('# HELP zombie_zombies_current Current number of active zombies');
    lines.push('# TYPE zombie_zombies_current gauge');
    lines.push(`zombie_zombies_current ${metrics.zombies.current}`);

    lines.push('# HELP zombie_zombies_spawned Total zombies spawned');
    lines.push('# TYPE zombie_zombies_spawned counter');
    lines.push(`zombie_zombies_spawned ${metrics.zombies.spawned}`);

    lines.push('# HELP zombie_zombies_killed Total zombies killed');
    lines.push('# TYPE zombie_zombies_killed counter');
    lines.push(`zombie_zombies_killed ${metrics.zombies.killed}`);

    // Performance
    lines.push('# HELP zombie_fps_actual Actual server FPS');
    lines.push('# TYPE zombie_fps_actual gauge');
    lines.push(`zombie_fps_actual ${metrics.performance.actualFPS}`);

    lines.push('# HELP zombie_fps_target Target server FPS');
    lines.push('# TYPE zombie_fps_target gauge');
    lines.push(`zombie_fps_target ${metrics.performance.targetFPS}`);

    lines.push('# HELP zombie_frame_time_avg Average frame time in ms');
    lines.push('# TYPE zombie_frame_time_avg gauge');
    lines.push(`zombie_frame_time_avg ${metrics.performance.avgFrameTime.toFixed(2)}`);

    lines.push('# HELP zombie_frame_time_max Maximum frame time in ms');
    lines.push('# TYPE zombie_frame_time_max gauge');
    lines.push(`zombie_frame_time_max ${metrics.performance.maxFrameTime.toFixed(2)}`);

    // Memory
    lines.push('# HELP zombie_memory_heap_used Heap memory used in bytes');
    lines.push('# TYPE zombie_memory_heap_used gauge');
    lines.push(`zombie_memory_heap_used ${metrics.system.memory.heapUsed}`);

    lines.push('# HELP zombie_memory_rss Resident Set Size in bytes');
    lines.push('# TYPE zombie_memory_rss gauge');
    lines.push(`zombie_memory_rss ${metrics.system.memory.rss}`);

    // Game
    lines.push('# HELP zombie_wave_current Current wave number');
    lines.push('# TYPE zombie_wave_current gauge');
    lines.push(`zombie_wave_current ${metrics.game.currentWave}`);

    lines.push('# HELP zombie_wave_highest Highest wave reached');
    lines.push('# TYPE zombie_wave_highest gauge');
    lines.push(`zombie_wave_highest ${metrics.game.highestWave}`);

    // Uptime
    lines.push('# HELP zombie_uptime_seconds Server uptime in seconds');
    lines.push('# TYPE zombie_uptime_seconds counter');
    lines.push(`zombie_uptime_seconds ${metrics.system.uptime}`);

    return lines.join('\n') + '\n';
  }

  /**
   * Logger périodique des métriques importantes
   */
  logMetrics() {
    const metrics = this.getMetrics();

    logger.info('Server metrics', {
      players: metrics.players.current,
      zombies: metrics.zombies.current,
      fps: `${metrics.performance.actualFPS}/${metrics.performance.targetFPS}`,
      memoryMB: metrics.system.memory.rssMB,
      wave: metrics.game.currentWave
    });
  }

  /**
   * Reset des compteurs (pour tests)
   */
  reset() {
    this.metrics.players.total = 0;
    this.metrics.zombies.spawned = 0;
    this.metrics.zombies.killed = 0;
    this.metrics.powerups.spawned = 0;
    this.metrics.powerups.collected = 0;
    this.metrics.bullets.fired = 0;
    this.metrics.network.bytesIn = 0;
    this.metrics.network.bytesOut = 0;
    this.metrics.network.messagesIn = 0;
    this.metrics.network.messagesOut = 0;
  }
}

// Singleton
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new MetricsCollector();
    }
    return instance;
  }
};
