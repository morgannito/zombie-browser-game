/**
 * ZOMBIE MANAGER - Orchestration du spawn et de la logique des zombies
 * Gère le spawn timing, les vagues, l'escalade de difficulté
 * Délègue la création à ZombieFactory et le lifecycle à ZombieLifecycle
 *
 * CORRECTION CRITIQUE (vague 160+):
 * - Plafonnement à la vague 130 pour les calculs de difficulté
 * - Empêche les valeurs démesurées qui causent des crashs serveur
 * - Au-delà de la vague 130, la difficulté reste constante (très difficile)
 * - Stats vague 130 : Boss 53,600 HP, Tank 6,105 HP, 928 zombies/vague
 *
 * @version 3.0.0 - ZombieFactory + ZombieLifecycle extraction
 */

const ZombieSpawnManager = require('./modules/ZombieSpawnManager');
const ZombieFactory = require('./ZombieFactory');
const ZombieLifecycle = require('./ZombieLifecycle');
const { getMutatorEffect } = require('./utils');

class ZombieManager {
  constructor(gameState, config, zombieTypes, checkWallCollision, io = null) {
    this.gameState = gameState;
    this.config = config;
    this.zombieTypes = zombieTypes;
    this.checkWallCollision = checkWallCollision;
    this.io = io;
    this.zombieSpawnTimer = null;
    this.spawnManager = new ZombieSpawnManager();

    this.factory = new ZombieFactory(gameState, config, zombieTypes, checkWallCollision, this.spawnManager);
    this.lifecycle = new ZombieLifecycle(gameState);
  }

  getMutatorEffect(key, fallback = 1) {
    return getMutatorEffect(this.gameState, key, fallback);
  }

  /**
   * Nombre de joueurs actifs (connectés et vivants)
   */
  getActivePlayerCount() {
    let count = 0;
    for (const id in this.gameState.players) {
      if (this.gameState.players[id].alive !== false) {
count++;
}
    }
    return Math.max(1, count);
  }

  /**
   * Charge serveur estimée : ratio zombies actifs / cap
   * @returns {number} 0.0 à 1.0
   */
  getServerLoad() {
    let zombieCount = 0;
    for (const _ in this.gameState.zombies) {
zombieCount++;
}
    return zombieCount / this.config.MAX_ZOMBIES;
  }

  /**
   * Cap dynamique : MAX_ZOMBIES × sqrt(playerCount) pour scaler avec l'équipe
   */
  getDynamicZombieCap() {
    const base = this.config.MAX_ZOMBIES;
    const players = this.getActivePlayerCount();
    return Math.floor(base * Math.sqrt(players));
  }

  /**
   * Calculate how many zombies to spawn per batch based on current wave
   * @returns {number} Number of zombies to spawn simultaneously
   */
  getZombiesPerBatch() {
    const wave = this.gameState.wave;
    let base;
    if (wave <= 2)       {
base = 2;
} else if (wave <= 5)  {
base = 3;
} else if (wave <= 8)  {
base = 5;
} else if (wave <= 12) {
base = 7;
} else                 {
base = 10;
}

    const load = this.getServerLoad();
    if (load >= 0.75) {
return Math.max(1, Math.floor(base * 0.5));
}

    const players = this.getActivePlayerCount();
    return Math.min(base + Math.floor(players / 2), base * 2);
  }

  // ─── Délégation vers ZombieFactory ───────────────────────────────────────

  spawnSingleZombie() {
    return this.factory.spawnSingleZombie();
  }

  spawnSpecificZombie(typeKey, x, y) {
    return this.factory.spawnSpecificZombie(typeKey, x, y);
  }

  spawnMinion(summonerId, summonerX, summonerY) {
    return this.factory.spawnMinion(summonerId, summonerX, summonerY);
  }

  spawnBoss() {
    return this.factory.spawnBoss(this.io);
  }

  // ─── Délégation vers ZombieLifecycle ─────────────────────────────────────

  removeZombie(zombieId) {
    return this.lifecycle.removeZombie(zombieId);
  }

  cleanupDeadZombies() {
    return this.lifecycle.cleanupDeadZombies();
  }

  // ─── Orchestration du spawn timing ───────────────────────────────────────

  /**
   * Spawn zombies in batches for current wave (main spawning logic)
   */
  spawnZombie() {
    // PERF: count once, reuse — avoids 3× Object.keys() array allocations per call
    let zombieCount = 0;
    for (const _ in this.gameState.zombies) {
zombieCount++;
}

    const dynamicCap = this.getDynamicZombieCap();
    if (zombieCount >= dynamicCap) {
return;
}

    const effectiveWave = Math.min(this.gameState.wave, 130);
    const zombiesForThisWave = this.config.ZOMBIES_PER_ROOM + (effectiveWave - 1) * 7;
    const spawnCountMultiplier = this.getMutatorEffect('spawnCountMultiplier', 1);
    const adjustedZombiesForThisWave = Math.max(1, Math.floor(zombiesForThisWave * spawnCountMultiplier));

    if (this.gameState.zombiesSpawnedThisWave >= adjustedZombiesForThisWave) {
      if (!this.gameState.bossSpawned && zombieCount === 0) {
        this.spawnBoss();
      }
      return;
    }

    // Burst de début de wave : spawn 30% des zombies d'un coup dès le 1er appel
    const isWaveStart = this.gameState.zombiesSpawnedThisWave === 0;
    const burstSize = isWaveStart
      ? Math.max(this.getZombiesPerBatch(), Math.floor(adjustedZombiesForThisWave * 0.30))
      : this.getZombiesPerBatch();

    for (let i = 0; i < burstSize; i++) {
      if (zombieCount >= dynamicCap) {
break;
}
      if (this.gameState.zombiesSpawnedThisWave >= adjustedZombiesForThisWave) {
break;
}
      if (this.spawnSingleZombie()) {
zombieCount++;
}
    }
  }

  /**
   * Calculate zombie spawn interval based on current wave (faster spawns at higher waves)
   * @returns {number} Spawn interval in milliseconds
   */
  getSpawnInterval() {
    const baseInterval = this.config.ZOMBIE_SPAWN_INTERVAL;
    const reduction = Math.min((this.gameState.wave - 1) * 50, 600);
    let interval = Math.max(baseInterval - reduction, 400);

    const load = this.getServerLoad();
    if (load >= 0.80) {
interval = Math.floor(interval * 1.5);
}

    const players = this.getActivePlayerCount();
    if (players >= 3) {
interval = Math.floor(interval * 0.85);
}

    const spawnIntervalMultiplier = this.getMutatorEffect('spawnIntervalMultiplier', 1);
    return Math.max(Math.floor(interval * spawnIntervalMultiplier), 350);
  }

  /** Start the zombie spawner interval. Clears any existing timer first. */
  startZombieSpawner() {
    if (this.zombieSpawnTimer) {
      clearInterval(this.zombieSpawnTimer);
    }
    this.zombieSpawnTimer = setInterval(() => {
      this.spawnZombie();
    }, this.getSpawnInterval());
  }

  /** Restart the zombie spawner (recalculates interval for current wave). */
  restartZombieSpawner() {
    this.startZombieSpawner();
  }

  /** Stop the zombie spawner interval and clear the timer reference. */
  stopZombieSpawner() {
    if (this.zombieSpawnTimer) {
      clearInterval(this.zombieSpawnTimer);
      this.zombieSpawnTimer = null;
    }
  }
}

module.exports = ZombieManager;
