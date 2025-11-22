/**
 * ZOMBIE MANAGER - Gestion du spawn et de la logique des zombies
 * Gère le spawn, les vagues, les boss et l'escalade de difficulté
 *
 * CORRECTION CRITIQUE (vague 160+):
 * - Plafonnement à la vague 130 pour les calculs de difficulté
 * - Empêche les valeurs démesurées qui causent des crashs serveur
 * - Au-delà de la vague 130, la difficulté reste constante (très difficile)
 * - Stats vague 130 : Boss 53,600 HP, Tank 6,105 HP, 928 zombies/vague
 *
 * @version 1.2.0
 */

const logger = require('../infrastructure/Logger');

class ZombieManager {
  constructor(gameState, config, zombieTypes, checkWallCollision, io = null) {
    this.gameState = gameState;
    this.config = config;
    this.zombieTypes = zombieTypes;
    this.checkWallCollision = checkWallCollision;
    this.io = io;
    this.zombieSpawnTimer = null;
  }

  /**
   * Calculer le nombre de zombies à spawner par batch selon la vague
   * @returns {number}
   */
  getZombiesPerBatch() {
    if (this.gameState.wave <= 2) {
      return 2; // Vagues 1-2 : 2 zombies à la fois
    } else if (this.gameState.wave <= 5) {
      return 3; // Vagues 3-5 : 3 zombies à la fois
    } else if (this.gameState.wave <= 8) {
      return 5; // Vagues 6-8 : 5 zombies à la fois
    } else if (this.gameState.wave <= 12) {
      return 7; // Vagues 9-12 : 7 zombies à la fois
    } else {
      return 10; // Vagues 13+ : 10 zombies à la fois (CHAOS!)
    }
  }

  /**
   * Spawner un seul zombie (fonction utilitaire)
   * @returns {boolean} true si le spawn a réussi
   */
  spawnSingleZombie() {
    // Position aléatoire dans la salle (éviter les murs)
    let x, y;
    let attempts = 0;
    do {
      x = 100 + Math.random() * (this.config.ROOM_WIDTH - 200);
      y = 100 + Math.random() * (this.config.ROOM_HEIGHT - 200);
      attempts++;
    } while (this.checkWallCollision(x, y, this.config.ZOMBIE_SIZE) && attempts < 50);

    if (attempts >= 50) {
      // CORRECTION: Log warning when spawn fails to help with debugging
      logger.warn('Failed to find valid zombie spawn position', { wave: this.gameState.wave, attempts });
      return false; // Pas de place disponible
    }

    // Choisir un type de zombie avec pondération progressive selon la vague
    let types;
    if (this.gameState.wave <= 2) {
      types = ['normal', 'normal', 'normal', 'normal', 'fast', 'fast', 'tank'];
    } else if (this.gameState.wave <= 5) {
      types = ['normal', 'normal', 'fast', 'fast', 'tank', 'tank', 'healer', 'slower', 'poison', 'shooter', 'teleporter', 'berserker'];
    } else if (this.gameState.wave <= 10) {
      types = ['normal', 'fast', 'fast', 'tank', 'tank', 'healer', 'slower', 'slower', 'poison', 'poison', 'shooter', 'shooter', 'teleporter', 'teleporter', 'summoner', 'shielded', 'berserker', 'berserker', 'necromancer', 'brute', 'mimic', 'splitter'];
    } else {
      types = ['fast', 'fast', 'tank', 'tank', 'tank', 'healer', 'healer', 'slower', 'slower', 'poison', 'poison', 'shooter', 'shooter', 'shooter', 'teleporter', 'teleporter', 'summoner', 'summoner', 'shielded', 'shielded', 'berserker', 'berserker', 'berserker', 'necromancer', 'necromancer', 'brute', 'brute', 'mimic', 'mimic', 'splitter', 'splitter'];
    }

    // Spawn Elite Zombie (5% de chance après vague 5 - multiplicateur de stats, pas les vrais élites)
    const isElite = this.gameState.wave >= 5 && Math.random() < 0.05;

    const typeKey = types[Math.floor(Math.random() * types.length)];
    const type = this.zombieTypes[typeKey];

    const zombieId = this.gameState.nextZombieId++;

    // Multiplicateur de difficulté selon la vague avec PLAFOND pour éviter crash
    // CORRECTION: Plafonner l'escalade à la vague 130 pour éviter les valeurs démesurées
    const effectiveWave = Math.min(this.gameState.wave, 130);
    const waveMultiplier = 1 + (effectiveWave - 1) * 0.15;

    // Elite Zombie: x2 stats et bonus gold
    const eliteMultiplier = isElite ? 2.0 : 1.0;

    const zombieHealth = Math.floor(type.health * waveMultiplier * eliteMultiplier);
    const zombieDamage = Math.floor(type.damage * waveMultiplier * eliteMultiplier);
    const zombieSpeed = Math.min(type.speed * (1 + (effectiveWave - 1) * 0.04), type.speed * 1.8);
    const zombieGold = Math.floor(type.gold * waveMultiplier * (isElite ? 3.0 : 1.0)); // x3 gold pour elite
    const zombieXP = Math.floor(type.xp * waveMultiplier * eliteMultiplier);

    this.gameState.zombies[zombieId] = {
      id: zombieId,
      type: typeKey,
      x: x,
      y: y,
      health: zombieHealth,
      maxHealth: zombieHealth,
      speed: zombieSpeed,
      damage: zombieDamage,
      color: type.color,
      size: type.size,
      goldDrop: zombieGold,
      xpDrop: zombieXP,
      isElite: isElite,
      // Attributs spéciaux (existants)
      lastHeal: typeKey === 'healer' ? Date.now() : null,
      lastShot: typeKey === 'shooter' ? Date.now() : null,
      lastPoisonTrail: typeKey === 'poison' ? Date.now() : null,
      // Nouveaux attributs spéciaux
      lastTeleport: typeKey === 'teleporter' ? Date.now() : null,
      lastSummon: typeKey === 'summoner' ? Date.now() : null,
      minionCount: typeKey === 'summoner' ? 0 : null,
      summonerId: null, // Pour les minions, ID de leur invocateur
      facingAngle: typeKey === 'shielded' ? 0 : null, // Direction du bouclier
      // Berserker attributes
      isRaged: typeKey === 'berserker' ? false : null,
      isExtremeRaged: typeKey === 'berserker' ? false : null,
      lastDash: typeKey === 'berserker' ? 0 : null,
      isDashing: typeKey === 'berserker' ? false : null,
      dashEndTime: typeKey === 'berserker' ? 0 : null,
      // Necromancer attributes
      lastResurrect: typeKey === 'necromancer' ? Date.now() : null,
      // Brute attributes
      lastCharge: typeKey === 'brute' ? 0 : null,
      isCharging: typeKey === 'brute' ? false : null,
      chargeEndTime: typeKey === 'brute' ? 0 : null,
      chargeAngle: typeKey === 'brute' ? 0 : null,
      // Mimic attributes (initialisés dynamiquement dans updateMimicZombie)
      isRevealed: typeKey === 'mimic' ? undefined : null,
      disguised: typeKey === 'mimic' ? undefined : null,
      firstAttack: typeKey === 'mimic' ? undefined : null
    };

    this.gameState.zombiesSpawnedThisWave++;
    return true;
  }

  /**
   * Spawner un minion (petit zombie invoqué par un Summoner)
   * @param {number} summonerId - ID du zombie invocateur
   * @param {number} summonerX - Position X de l'invocateur
   * @param {number} summonerY - Position Y de l'invocateur
   * @returns {boolean} true si le spawn a réussi
   */
  spawnMinion(summonerId, summonerX, summonerY) {
    const type = this.zombieTypes.minion;
    if (!type) return false;

    // Position aléatoire autour de l'invocateur
    const angle = Math.random() * Math.PI * 2;
    const distance = 50 + Math.random() * 50;
    const x = summonerX + Math.cos(angle) * distance;
    const y = summonerY + Math.sin(angle) * distance;

    // Vérifier collision avec murs
    if (this.checkWallCollision(x, y, type.size)) {
      return false;
    }

    const zombieId = this.gameState.nextZombieId++;

    // Les minions ne sont PAS affectés par le wave multiplier (volontairement faibles)
    this.gameState.zombies[zombieId] = {
      id: zombieId,
      type: 'minion',
      x: x,
      y: y,
      health: type.health,
      maxHealth: type.health,
      speed: type.speed,
      damage: type.damage,
      color: type.color,
      size: type.size,
      goldDrop: type.gold,
      xpDrop: type.xp,
      isElite: false,
      isMinion: true,
      summonerId: summonerId,
      lastHeal: null,
      lastShot: null,
      lastPoisonTrail: null,
      lastTeleport: null,
      lastSummon: null,
      minionCount: null,
      facingAngle: null
    };

    return true;
  }

  /**
   * Spawn des zombies en groupes (MODE INFINI avec vagues)
   */
  spawnZombie() {
    if (Object.keys(this.gameState.zombies).length >= this.config.MAX_ZOMBIES) {
      return;
    }

    // Limiter le spawn selon la vague actuelle
    // CORRECTION: Plafonner le nombre de zombies par vague pour éviter surcharge
    const effectiveWave = Math.min(this.gameState.wave, 130);
    const zombiesForThisWave = this.config.ZOMBIES_PER_ROOM + (effectiveWave - 1) * 7;

    if (this.gameState.zombiesSpawnedThisWave >= zombiesForThisWave) {
      // Spawner le boss si pas encore fait
      if (!this.gameState.bossSpawned && Object.keys(this.gameState.zombies).length === 0) {
        this.spawnBoss();
      }
      return;
    }

    // Spawner plusieurs zombies à la fois (batch spawning)
    const batchSize = this.getZombiesPerBatch();
    let spawned = 0;

    for (let i = 0; i < batchSize; i++) {
      if (Object.keys(this.gameState.zombies).length >= this.config.MAX_ZOMBIES) break;
      if (this.gameState.zombiesSpawnedThisWave >= zombiesForThisWave) break;

      if (this.spawnSingleZombie()) {
        spawned++;
      }
    }
  }

  /**
   * Spawner un boss zombie
   */
  spawnBoss() {
    // Boss spéciaux cycliques à CHAQUE vague
    let type = this.zombieTypes.boss;
    let bossType = 'boss';
    let isSpecialBoss = true; // Toujours des boss spéciaux

    // Cycle des 5 boss spéciaux qui se répète infiniment
    const bossIndex = (this.gameState.wave - 1) % 5;

    switch (bossIndex) {
      case 0: // Vagues 1, 6, 11, 16, 21, etc.
        type = this.zombieTypes.bossCharnier;
        bossType = 'bossCharnier';
        break;
      case 1: // Vagues 2, 7, 12, 17, 22, etc.
        type = this.zombieTypes.bossInfect;
        bossType = 'bossInfect';
        break;
      case 2: // Vagues 3, 8, 13, 18, 23, etc.
        type = this.zombieTypes.bossColosse;
        bossType = 'bossColosse';
        break;
      case 3: // Vagues 4, 9, 14, 19, 24, etc.
        type = this.zombieTypes.bossRoi;
        bossType = 'bossRoi';
        break;
      case 4: // Vagues 5, 10, 15, 20, 25, etc.
        type = this.zombieTypes.bossOmega;
        bossType = 'bossOmega';
        break;
    }

    // Boss spéciaux: scaling progressif avec leurs stats de base
    let bossHealth, bossDamage, bossGold, bossXP;

    // Tous les boss ont maintenant un scaling avec la vague
    const effectiveWave = Math.min(this.gameState.wave, 130);
    const waveMultiplier = 1 + (effectiveWave - 1) * 0.20;

    bossHealth = Math.floor(type.health * waveMultiplier);
    bossDamage = Math.floor(type.damage * waveMultiplier);
    bossGold = Math.floor(type.gold * waveMultiplier);
    bossXP = Math.floor(type.xp * waveMultiplier);

    // Centre de la salle
    const x = this.config.ROOM_WIDTH / 2;
    const y = this.config.ROOM_HEIGHT / 2;

    const zombieId = this.gameState.nextZombieId++;

    const bossData = {
      id: zombieId,
      type: bossType,
      x: x,
      y: y,
      health: bossHealth,
      maxHealth: bossHealth,
      speed: type.speed,
      damage: bossDamage,
      color: type.color,
      size: type.size,
      goldDrop: bossGold,
      xpDrop: bossXP,
      isBoss: true
    };

    // Attributs spéciaux pour chaque boss
    if (bossType === 'bossCharnier') {
      bossData.lastSpawn = Date.now();
    } else if (bossType === 'bossInfect') {
      bossData.lastToxicPool = Date.now();
    } else if (bossType === 'bossColosse') {
      bossData.isEnraged = false;
    } else if (bossType === 'bossRoi') {
      bossData.phase = 1;
      bossData.lastTeleport = Date.now();
      bossData.lastSummon = Date.now();
    } else if (bossType === 'bossOmega') {
      bossData.phase = 1;
      bossData.lastTeleport = Date.now();
      bossData.lastSummon = Date.now();
      bossData.lastToxicPool = Date.now();
      bossData.lastLaser = Date.now();
    }

    this.gameState.zombies[zombieId] = bossData;
    this.gameState.bossSpawned = true;

    // Émettre l'événement de boss spawned si io est disponible
    if (this.io) {
      this.io.emit('bossSpawned', {
        bossName: `${type.name} (Vague ${this.gameState.wave})`,
        bossHealth: bossHealth,
        wave: this.gameState.wave,
        isSpecialBoss: isSpecialBoss
      });
    }
  }

  /**
   * Calculer l'intervalle de spawn selon la vague
   * @returns {number} Intervalle en ms
   */
  getSpawnInterval() {
    const baseInterval = this.config.ZOMBIE_SPAWN_INTERVAL;
    const reduction = Math.min((this.gameState.wave - 1) * 50, 600);
    return Math.max(baseInterval - reduction, 400);
  }

  /**
   * Démarrer le spawner de zombies
   */
  startZombieSpawner() {
    if (this.zombieSpawnTimer) {
      clearInterval(this.zombieSpawnTimer);
    }
    this.zombieSpawnTimer = setInterval(() => {
      this.spawnZombie();
    }, this.getSpawnInterval());
  }

  /**
   * Relancer le timer quand une nouvelle vague commence
   * CORRECTION: Recalculer l'intervalle avec la nouvelle vague
   */
  restartZombieSpawner() {
    if (this.zombieSpawnTimer) {
      clearInterval(this.zombieSpawnTimer);
    }
    // Recalculer l'intervalle selon la vague actuelle
    this.zombieSpawnTimer = setInterval(() => {
      this.spawnZombie();
    }, this.getSpawnInterval());
  }

  /**
   * Arrêter le spawner
   */
  stopZombieSpawner() {
    if (this.zombieSpawnTimer) {
      clearInterval(this.zombieSpawnTimer);
      this.zombieSpawnTimer = null;
    }
  }
}

module.exports = ZombieManager;
