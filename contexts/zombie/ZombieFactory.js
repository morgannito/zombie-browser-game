/**
 * ZOMBIE FACTORY - Création et initialisation des zombies
 * Responsable de la construction des entités zombie (normal, minion, boss)
 *
 * @version 1.0.0 - Extrait de ZombieManager v2.0.0
 */

const { getMutatorEffect } = require('./utils');

class ZombieFactory {
  constructor(gameState, config, zombieTypes, checkWallCollision, spawnManager) {
    this.gameState = gameState;
    this.config = config;
    this.zombieTypes = zombieTypes;
    this.checkWallCollision = checkWallCollision;
    this.spawnManager = spawnManager;
  }

  getMutatorEffect(key, fallback = 1) {
    return getMutatorEffect(this.gameState, key, fallback);
  }

  /**
   * Spawn a single zombie with intelligent type selection and wave scaling
   * @returns {boolean} True if spawn succeeded
   */
  spawnSingleZombie() {
    const typeKey = this.spawnManager.selectZombieType(this.gameState.wave);
    const type = this.zombieTypes[typeKey];

    if (!type) {
      console.warn('[ZOMBIE FACTORY] Type invalide:', typeKey, 'wave:', this.gameState.wave);
      return false;
    }

    const zombieSize = type.size || this.config.ZOMBIE_SIZE;
    const safetyMargin = zombieSize + this.config.WALL_THICKNESS + 10;
    const MIN_PLAYER_DIST = 200;
    let x, y;
    let attempts = 0;
    const maxAttempts = 50;

    do {
      x = safetyMargin + Math.random() * (this.config.ROOM_WIDTH - 2 * safetyMargin);
      y = safetyMargin + Math.random() * (this.config.ROOM_HEIGHT - 2 * safetyMargin);
      attempts++;

      if (this.checkWallCollision(x, y, zombieSize)) {
continue;
}

      let tooClose = false;
      for (const pid in this.gameState.players) {
        const p = this.gameState.players[pid];
        if (!p.alive && p.alive !== undefined) {
continue;
}
        const dx = p.x - x, dy = p.y - y;
        if (dx * dx + dy * dy < MIN_PLAYER_DIST * MIN_PLAYER_DIST) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) {
break;
}
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      if (this.checkWallCollision(x, y, zombieSize)) {
        console.warn('[ZOMBIE FACTORY] Failed to find valid spawn position after', maxAttempts, 'attempts (wave', this.gameState.wave, ', type:', typeKey, ')');
        return false;
      }
    }

    const isElite = this.gameState.wave >= 5 && Math.random() < 0.05;
    const zombieId = this.gameState.nextZombieId++;

    // CORRECTION: Plafonner l'escalade à la vague 130 pour éviter les valeurs démesurées
    const effectiveWave = Math.min(this.gameState.wave, 130);
    const waveMultiplier = 1 + (effectiveWave - 1) * 0.15;
    const eliteMultiplier = isElite ? 2.0 : 1.0;

    const healthMultiplier = this.getMutatorEffect('zombieHealthMultiplier', 1);
    const damageMultiplier = this.getMutatorEffect('zombieDamageMultiplier', 1);
    const speedMultiplier = this.getMutatorEffect('zombieSpeedMultiplier', 1);

    const zombieHealth = Math.floor(type.health * waveMultiplier * eliteMultiplier * healthMultiplier);
    const zombieDamage = Math.floor(type.damage * waveMultiplier * eliteMultiplier * damageMultiplier);
    const zombieSpeed = Math.min(type.speed * (1 + (effectiveWave - 1) * 0.04), type.speed * 1.8) * speedMultiplier;
    const zombieGold = Math.floor(type.gold * waveMultiplier * (isElite ? 3.0 : 1.0));
    const zombieXP = Math.floor(type.xp * waveMultiplier * eliteMultiplier);

    this.gameState.zombies[zombieId] = {
      id: zombieId,
      type: typeKey,
      x,
      y,
      health: zombieHealth,
      maxHealth: zombieHealth,
      speed: zombieSpeed,
      baseSpeed: zombieSpeed,
      damage: zombieDamage,
      color: type.color,
      size: type.size,
      goldDrop: zombieGold,
      xpDrop: zombieXP,
      isElite,
      ...(typeKey === 'healer'     ? { lastHeal: Date.now() } : {}),
      ...(typeKey === 'shooter'    ? { lastShot: Date.now() } : {}),
      ...(typeKey === 'poison'     ? { lastPoisonTrail: Date.now() } : {}),
      ...(typeKey === 'teleporter' ? { lastTeleport: Date.now() } : {}),
      ...(typeKey === 'summoner'   ? { lastSummon: Date.now(), minionCount: 0 } : {}),
      ...(typeKey === 'shielded'   ? { facingAngle: 0 } : {}),
      ...(typeKey === 'berserker'  ? { isRaged: false, isExtremeRaged: false, lastDash: 0, isDashing: false, dashEndTime: 0 } : {}),
      ...(typeKey === 'necromancer'? { lastResurrect: Date.now() } : {}),
      ...(typeKey === 'brute'      ? { lastCharge: 0, isCharging: false, chargeEndTime: 0, chargeAngle: 0 } : {}),
      ...(typeKey === 'mimic'      ? { isRevealed: undefined, disguised: undefined, firstAttack: undefined } : {})
    };

    this.gameState.zombiesSpawnedThisWave++;
    return true;
  }

  /**
   * Spawn a specific zombie type at exact coordinates (summoned/boss minions)
   * @param {string} typeKey - Zombie type identifier
   * @param {number} x - Spawn X coordinate
   * @param {number} y - Spawn Y coordinate
   * @returns {boolean} True if spawn succeeded
   */
  spawnSpecificZombie(typeKey, x, y) {
    const type = this.zombieTypes[typeKey];
    if (!type) {
      console.warn('[ZOMBIE FACTORY] Type invalide:', typeKey);
      return false;
    }

    const zombieSize = type.size || this.config.ZOMBIE_SIZE;
    const safetyBuffer = zombieSize + this.config.WALL_THICKNESS + 5;

    let spawnX = Math.max(safetyBuffer, Math.min(x, this.config.ROOM_WIDTH - safetyBuffer));
    let spawnY = Math.max(safetyBuffer, Math.min(y, this.config.ROOM_HEIGHT - safetyBuffer));

    if (this.checkWallCollision(spawnX, spawnY, zombieSize)) {
      const offsets = [
        { dx: 0, dy: -50 }, { dx: 0, dy: 50 },
        { dx: -50, dy: 0 }, { dx: 50, dy: 0 },
        { dx: -50, dy: -50 }, { dx: 50, dy: -50 },
        { dx: -50, dy: 50 }, { dx: 50, dy: 50 }
      ];

      let found = false;
      for (const offset of offsets) {
        const testX = Math.max(safetyBuffer, Math.min(spawnX + offset.dx, this.config.ROOM_WIDTH - safetyBuffer));
        const testY = Math.max(safetyBuffer, Math.min(spawnY + offset.dy, this.config.ROOM_HEIGHT - safetyBuffer));

        if (!this.checkWallCollision(testX, testY, zombieSize)) {
          spawnX = testX;
          spawnY = testY;
          found = true;
          break;
        }
      }

      if (!found) {
return false;
}
    }

    const zombieId = this.gameState.nextZombieId++;
    const effectiveWave = Math.min(this.gameState.wave, 130);
    const waveMultiplier = 1 + (effectiveWave - 1) * 0.15;

    const healthMultiplier = this.getMutatorEffect('zombieHealthMultiplier', 1);
    const damageMultiplier = this.getMutatorEffect('zombieDamageMultiplier', 1);
    const speedMultiplier = this.getMutatorEffect('zombieSpeedMultiplier', 1);

    const zombieHealth = Math.floor(type.health * waveMultiplier * healthMultiplier);
    const zombieDamage = Math.floor(type.damage * waveMultiplier * damageMultiplier);
    const zombieSpeed = Math.min(type.speed * (1 + (effectiveWave - 1) * 0.04), type.speed * 1.8) * speedMultiplier;

    this.gameState.zombies[zombieId] = {
      id: zombieId,
      type: typeKey,
      x: spawnX,
      y: spawnY,
      health: zombieHealth,
      maxHealth: zombieHealth,
      speed: zombieSpeed,
      baseSpeed: zombieSpeed,
      damage: zombieDamage,
      color: type.color,
      size: type.size,
      goldDrop: type.gold,
      xpDrop: type.xp,
      isElite: type.isElite || false,
      isSummoned: true
    };

    return true;
  }

  /**
   * Spawn a weak minion zombie around a Summoner zombie (not wave-scaled)
   * @param {number} summonerId - ID of the summoner zombie
   * @param {number} summonerX - Summoner X coordinate
   * @param {number} summonerY - Summoner Y coordinate
   * @returns {boolean} True if spawn succeeded
   */
  spawnMinion(summonerId, summonerX, summonerY) {
    const type = this.zombieTypes.minion;
    if (!type) {
return false;
}

    const minionSize = type.size || this.config.ZOMBIE_SIZE;
    const safetyBuffer = minionSize + 5;

    let x, y;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      const angle = Math.random() * Math.PI * 2;
      const distance = 50 + Math.random() * 50;
      x = summonerX + Math.cos(angle) * distance;
      y = summonerY + Math.sin(angle) * distance;

      x = Math.max(safetyBuffer + this.config.WALL_THICKNESS, Math.min(x, this.config.ROOM_WIDTH - safetyBuffer - this.config.WALL_THICKNESS));
      y = Math.max(safetyBuffer + this.config.WALL_THICKNESS, Math.min(y, this.config.ROOM_HEIGHT - safetyBuffer - this.config.WALL_THICKNESS));

      attempts++;
    } while (this.checkWallCollision(x, y, minionSize) && attempts < maxAttempts);

    if (this.checkWallCollision(x, y, minionSize)) {
return false;
}

    const zombieId = this.gameState.nextZombieId++;

    const healthMultiplier = this.getMutatorEffect('zombieHealthMultiplier', 1);
    const damageMultiplier = this.getMutatorEffect('zombieDamageMultiplier', 1);
    const speedMultiplier = this.getMutatorEffect('zombieSpeedMultiplier', 1);

    this.gameState.zombies[zombieId] = {
      id: zombieId,
      type: 'minion',
      x,
      y,
      health: Math.floor(type.health * healthMultiplier),
      maxHealth: Math.floor(type.health * healthMultiplier),
      speed: type.speed * speedMultiplier,
      baseSpeed: type.speed * speedMultiplier,
      damage: Math.floor(type.damage * damageMultiplier),
      color: type.color,
      size: type.size,
      goldDrop: type.gold,
      xpDrop: type.xp,
      isElite: false,
      isMinion: true,
      summonerId
    };

    return true;
  }

  /**
   * Spawn a boss zombie at room center with wave scaling and special abilities
   * @param {object} io - Socket.io instance for client notifications
   * @returns {void}
   */
  spawnBoss(io = null) {
    const bossType = this.spawnManager.getBossType(this.gameState.wave) || 'boss';
    const type = this.zombieTypes[bossType] || this.zombieTypes.boss;
    const isSpecialBoss = bossType !== 'boss';

    const effectiveWave = Math.min(this.gameState.wave, 130);
    const waveMultiplier = 1 + (effectiveWave - 1) * 0.20;
    const healthMultiplier = this.getMutatorEffect('zombieHealthMultiplier', 1);
    const damageMultiplier = this.getMutatorEffect('zombieDamageMultiplier', 1);
    const speedMultiplier = this.getMutatorEffect('zombieSpeedMultiplier', 1);

    const bossHealth = Math.floor(type.health * waveMultiplier * healthMultiplier);
    const bossDamage = Math.floor(type.damage * waveMultiplier * damageMultiplier);
    const bossGold = Math.floor(type.gold * waveMultiplier);
    const bossXP = Math.floor(type.xp * waveMultiplier);

    const x = this.config.ROOM_WIDTH / 2;
    const y = this.config.ROOM_HEIGHT / 2;
    const zombieId = this.gameState.nextZombieId++;

    const bossData = {
      id: zombieId,
      type: bossType,
      x,
      y,
      health: bossHealth,
      maxHealth: bossHealth,
      speed: type.speed * speedMultiplier,
      baseSpeed: type.speed * speedMultiplier,
      damage: bossDamage,
      color: type.color,
      size: type.size,
      goldDrop: bossGold,
      xpDrop: bossXP,
      isBoss: true
    };

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

    if (io) {
      io.emit('bossSpawned', {
        bossName: `${type.name} (Vague ${this.gameState.wave})`,
        bossHealth,
        wave: this.gameState.wave,
        isSpecialBoss
      });
    }
  }
}

module.exports = ZombieFactory;
