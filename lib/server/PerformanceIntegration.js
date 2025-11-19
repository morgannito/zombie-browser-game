/**
 * PERFORMANCE INTEGRATION
 * Intégration du PerformanceConfig dans le game loop
 * @version 1.0.0
 */

const PerformanceConfig = require('./PerformanceConfig');

class PerformanceIntegration {
  constructor() {
    this.tickCounter = 0;
    this.gcTimer = null;
    this.perfConfig = PerformanceConfig;
    
    // Log la config au démarrage
    this.perfConfig.logConfig();
    
    // Setup GC timer
    this.setupGCTimer();
  }
  
  /**
   * Setup du timer de garbage collection
   */
  setupGCTimer() {
    if (this.gcTimer) clearInterval(this.gcTimer);
    
    this.gcTimer = setInterval(() => {
      this.perfConfig.forceGC();
    }, this.perfConfig.getGCInterval());
  }
  
  /**
   * Incrémente le tick counter
   */
  incrementTick() {
    this.tickCounter++;
    if (this.tickCounter > 1000000) this.tickCounter = 0;
  }
  
  /**
   * Récupère l'intervalle du game loop
   */
  getTickInterval() {
    return this.perfConfig.tickInterval;
  }
  
  /**
   * Vérifie si on doit broadcaster ce tick
   */
  shouldBroadcast() {
    return this.perfConfig.shouldBroadcast(this.tickCounter);
  }
  
  /**
   * Vérifie si on doit update le pathfinding
   */
  shouldUpdatePathfinding() {
    return this.perfConfig.shouldUpdatePathfinding(this.tickCounter);
  }
  
  /**
   * Limite le spawn de zombies
   */
  canSpawnZombie(currentCount) {
    return this.perfConfig.canSpawnZombie(currentCount);
  }
  
  /**
   * Limite les connexions joueurs
   */
  canAcceptPlayer(currentCount) {
    return this.perfConfig.canAcceptPlayer(currentCount);
  }
  
  /**
   * Limite les power-ups
   */
  canSpawnPowerup(currentCount) {
    return this.perfConfig.canSpawnPowerup(currentCount);
  }
  
  /**
   * Récupère le multiplicateur de spawn
   */
  getSpawnMultiplier() {
    return this.perfConfig.getSpawnMultiplier();
  }
  
  /**
   * Cleanup
   */
  cleanup() {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
    }
  }
}

module.exports = new PerformanceIntegration();
