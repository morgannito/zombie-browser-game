/**
 * PERFORMANCE CONFIGURATION
 * Optimisations pour serveurs low-resource
 * @version 1.0.0
 */

const logger = require('../infrastructure/Logger');

class PerformanceConfig {
  constructor() {
    // Mode performance depuis env
    this.mode = process.env.PERFORMANCE_MODE || 'balanced';
    
    // Configs par mode
    this.configs = {
      high: {
        tickRate: 60,          // 60 FPS
        maxZombies: 200,
        maxPlayers: 50,
        maxPowerups: 20,
        broadcastRate: 60,     // Broadcast à chaque tick
        spawnMultiplier: 1.0,
        gcInterval: 60000,     // GC toutes les 60s
        enableDeltaCompression: true,
        enableObjectPools: true,
        zombiePathfindingRate: 10  // Update pathfinding tous les 10 ticks
      },
      
      balanced: {
        tickRate: 45,          // 45 FPS (22ms)
        maxZombies: 150,
        maxPlayers: 30,
        maxPowerups: 15,
        broadcastRate: 45,
        spawnMultiplier: 0.9,
        gcInterval: 45000,
        enableDeltaCompression: true,
        enableObjectPools: true,
        zombiePathfindingRate: 15
      },
      
      'low-memory': {
        tickRate: 30,          // 30 FPS (33ms)
        maxZombies: 100,       // Limite stricte zombies
        maxPlayers: 20,        // Limite joueurs
        maxPowerups: 10,       // Limite power-ups
        broadcastRate: 30,
        spawnMultiplier: 0.7,  // Spawn 30% plus lent
        gcInterval: 30000,     // GC agressif toutes les 30s
        enableDeltaCompression: true,
        enableObjectPools: true,
        zombiePathfindingRate: 20  // Update pathfinding moins fréquent
      },
      
      minimal: {
        tickRate: 20,          // 20 FPS (50ms)
        maxZombies: 50,
        maxPlayers: 10,
        maxPowerups: 5,
        broadcastRate: 20,
        spawnMultiplier: 0.5,
        gcInterval: 20000,
        enableDeltaCompression: true,
        enableObjectPools: true,
        zombiePathfindingRate: 30
      }
    };
    
    this.current = this.configs[this.mode] || this.configs.balanced;
  }
  
  /**
   * Intervalle du game loop (ms)
   */
  get tickInterval() {
    return 1000 / this.current.tickRate;
  }
  
  /**
   * Peut spawner un zombie supplémentaire?
   */
  canSpawnZombie(currentCount) {
    return currentCount < this.current.maxZombies;
  }
  
  /**
   * Peut accepter un joueur supplémentaire?
   */
  canAcceptPlayer(currentCount) {
    return currentCount < this.current.maxPlayers;
  }
  
  /**
   * Peut spawner un power-up supplémentaire?
   */
  canSpawnPowerup(currentCount) {
    return currentCount < this.current.maxPowerups;
  }
  
  /**
   * Doit broadcaster ce tick?
   */
  shouldBroadcast(tickCounter) {
    // Broadcast à la fréquence configurée
    const broadcastEveryNTicks = Math.ceil(this.current.tickRate / this.current.broadcastRate);
    return tickCounter % broadcastEveryNTicks === 0;
  }
  
  /**
   * Doit update le pathfinding ce tick?
   */
  shouldUpdatePathfinding(tickCounter) {
    return tickCounter % this.current.zombiePathfindingRate === 0;
  }
  
  /**
   * Force garbage collection si disponible
   */
  forceGC() {
    if (global.gc && this.mode === 'low-memory') {
      try {
        global.gc();
        logger.info('Forced garbage collection');
      } catch (e) {
        // GC not available (need --expose-gc flag)
      }
    }
  }

  /**
   * Affiche la config actuelle
   */
  logConfig() {
    logger.info('Performance configuration', {
      mode: this.mode,
      tickRate: `${this.current.tickRate} FPS (${this.tickInterval}ms)`,
      maxZombies: this.current.maxZombies,
      maxPlayers: this.current.maxPlayers,
      spawnMultiplier: `${this.current.spawnMultiplier}x`,
      gcInterval: `${this.current.gcInterval}ms`
    });
  }
  
  /**
   * Récupère le multiplicateur de spawn
   */
  getSpawnMultiplier() {
    return this.current.spawnMultiplier;
  }
  
  /**
   * Récupère l'intervalle de GC
   */
  getGCInterval() {
    return this.current.gcInterval;
  }
}

module.exports = new PerformanceConfig();
