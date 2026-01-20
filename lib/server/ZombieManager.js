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
 * @version 2.0.0 - Intelligent spawn system integration
 */

const ZombieSpawnManager = require('../../game/modules/zombie/ZombieSpawnManager');

class ZombieManager {
  constructor(gameState, config, zombieTypes, checkWallCollision, io = null) {
    this.gameState = gameState;
    this.config = config;
    this.zombieTypes = zombieTypes;
    this.checkWallCollision = checkWallCollision;
    this.io = io;
    this.zombieSpawnTimer = null;
    this.spawnManager = new ZombieSpawnManager();
  }

  getMutatorEffect(key, fallback = 1) {
    const effects = this.gameState.mutatorEffects || {};
    const value = effects[key];
    return typeof value === 'number' ? value : fallback;
  }

  /**
   * Calculate how many zombies to spawn per batch based on current wave
   *
   * @returns {number} Number of zombies to spawn simultaneously
   *
   * @description
   * Determines batch spawn size for progressive difficulty scaling:
   * - Wave 1-2: 2 zombies per batch (gentle start)
   * - Wave 3-5: 3 zombies per batch
   * - Wave 6-8: 5 zombies per batch
   * - Wave 9-12: 7 zombies per batch
   * - Wave 13+: 10 zombies per batch (CHAOS mode)
   *
   * Spawning strategy:
   * - Batch spawning creates intense waves instead of trickle
   * - Higher batches create more pressure on players
   * - Encourages teamwork and area control
   * - Prevents camping strategies
   *
   * @example
   *   // Wave 15 spawning
   *   const batchSize = zombieManager.getZombiesPerBatch();
   *   // Returns: 10 (chaos mode)
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
   * Spawn a single zombie with intelligent type selection and wave scaling
   *
   * @returns {boolean} True if spawn succeeded, false if no valid position found
   *
   * @description
   * Spawns one zombie using the intelligent spawn system:
   * - Finds random valid spawn position (avoiding walls)
   * - Uses ZombieSpawnManager for AI-driven type selection
   * - Applies wave difficulty multipliers to stats
   * - 5% chance for Elite zombies (2× stats, 3× gold) after wave 5
   * - Adds zombie to gameState.zombies
   * - Increments zombiesSpawnedThisWave counter
   *
   * Spawn position logic:
   * - Random X: 100 to ROOM_WIDTH-200
   * - Random Y: 100 to ROOM_HEIGHT-200
   * - Max 50 attempts to avoid wall collision
   * - Logs warning if spawn fails after 50 attempts
   *
   * Wave scaling (capped at wave 130):
   * - Health: base × (1 + (wave-1) × 0.15)
   * - Damage: base × (1 + (wave-1) × 0.15)
   * - Speed: base × (1 + (wave-1) × 0.04), max 1.8× base
   * - Gold: base × wave multiplier × (3× for elite)
   * - XP: base × wave multiplier × elite multiplier
   *
   * Elite zombie bonuses (5% spawn rate after wave 5):
   * - 2× health and damage
   * - 3× gold reward
   * - 2× XP reward
   * - Visual distinction on client
   *
   * CRITICAL: Wave 130 cap prevents server crash from excessive stats
   *
   * @example
   *   // Spawn batch of zombies
   *   for (let i = 0; i < batchSize; i++) {
   *     if (!zombieManager.spawnSingleZombie()) {
   *       console.warn('Failed to spawn zombie - room full');
   *       break;
   *     }
   *   }
   */
  spawnSingleZombie() {
    // Sélectionner le type AVANT de calculer la position (pour connaître la taille)
    const typeKey = this.spawnManager.selectZombieType(this.gameState.wave);
    const type = this.zombieTypes[typeKey];

    // Vérifier si le type existe
    if (!type) {
      console.warn('[ZOMBIE SPAWN] Type invalide:', typeKey, 'wave:', this.gameState.wave);
      return false;
    }

    // Calculer la marge de sécurité: taille du zombie + épaisseur du mur + buffer
    const zombieSize = type.size || this.config.ZOMBIE_SIZE;
    const safetyMargin = zombieSize + this.config.WALL_THICKNESS + 10;

    // Position aléatoire dans la salle avec marge de sécurité adaptée
    let x, y;
    let attempts = 0;
    const maxAttempts = 50;

    do {
      x = safetyMargin + Math.random() * (this.config.ROOM_WIDTH - 2 * safetyMargin);
      y = safetyMargin + Math.random() * (this.config.ROOM_HEIGHT - 2 * safetyMargin);
      attempts++;
    } while (this.checkWallCollision(x, y, zombieSize) && attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      console.warn('[ZOMBIE SPAWN] Failed to find valid spawn position after', maxAttempts, 'attempts (wave', this.gameState.wave, ', type:', typeKey, ', size:', zombieSize, ')');
      return false; // Pas de place disponible
    }

    // Spawn Elite Zombie (5% de chance après vague 5 - multiplicateur de stats, pas les vrais élites)
    const isElite = this.gameState.wave >= 5 && Math.random() < 0.05;

    const zombieId = this.gameState.nextZombieId++;

    // Multiplicateur de difficulté selon la vague avec PLAFOND pour éviter crash
    // CORRECTION: Plafonner l'escalade à la vague 130 pour éviter les valeurs démesurées
    const effectiveWave = Math.min(this.gameState.wave, 130);
    const waveMultiplier = 1 + (effectiveWave - 1) * 0.15;

    // Elite Zombie: x2 stats et bonus gold
    const eliteMultiplier = isElite ? 2.0 : 1.0;

    const healthMultiplier = this.getMutatorEffect('zombieHealthMultiplier', 1);
    const damageMultiplier = this.getMutatorEffect('zombieDamageMultiplier', 1);
    const speedMultiplier = this.getMutatorEffect('zombieSpeedMultiplier', 1);

    const zombieHealth = Math.floor(type.health * waveMultiplier * eliteMultiplier * healthMultiplier);
    const zombieDamage = Math.floor(type.damage * waveMultiplier * eliteMultiplier * damageMultiplier);
    const zombieSpeed = Math.min(type.speed * (1 + (effectiveWave - 1) * 0.04), type.speed * 1.8) * speedMultiplier;
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
      baseSpeed: zombieSpeed, // FIX: Store base speed for freeze/slow effect restoration
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
   * Spawn a specific zombie type at exact coordinates (summoned/boss minions)
   *
   * @param {string} typeKey - Zombie type identifier (e.g., 'normal', 'tank', 'minion')
   * @param {number} x - Spawn X coordinate
   * @param {number} y - Spawn Y coordinate
   * @returns {boolean} True if spawn succeeded, false if invalid type or wall collision
   *
   * @description
   * Creates a zombie of specific type at precise location:
   * - Used for summoner abilities and boss-spawned minions
   * - Validates zombie type exists in zombieTypes
   * - Checks wall collision before spawning
   * - Applies wave difficulty scaling
   * - Does NOT count toward zombiesSpawnedThisWave
   * - Marks zombie with isSummoned flag
   *
   * Wave scaling (capped at wave 130):
   * - Same multipliers as spawnSingleZombie()
   * - Health, damage, speed scaled by wave
   * - Gold/XP use base values (no elite bonuses)
   *
   * Use cases:
   * - Summoner zombie spawning minions
   * - Boss zombie spawning adds
   * - Necromancer resurrecting zombies
   * - Event-triggered spawns
   *
   * @example
   *   // Summoner spawning minion
   *   const success = zombieManager.spawnSpecificZombie(
   *     'minion',
   *     summoner.x + 50,
   *     summoner.y
   *   );
   *
   * @example
   *   // Boss spawning tank adds
   *   zombieManager.spawnSpecificZombie('tank', bossX - 100, bossY);
   *   zombieManager.spawnSpecificZombie('tank', bossX + 100, bossY);
   */
  spawnSpecificZombie(typeKey, x, y) {
    const type = this.zombieTypes[typeKey];
    if (!type) {
      console.warn('[ZOMBIE SPAWN] Type invalide:', typeKey);
      return false;
    }

    const zombieSize = type.size || this.config.ZOMBIE_SIZE;
    const safetyBuffer = zombieSize + this.config.WALL_THICKNESS + 5;

    // Clamper la position dans les limites sécurisées de la salle
    let spawnX = Math.max(safetyBuffer, Math.min(x, this.config.ROOM_WIDTH - safetyBuffer));
    let spawnY = Math.max(safetyBuffer, Math.min(y, this.config.ROOM_HEIGHT - safetyBuffer));

    // Vérifier collision avec murs, si collision essayer des positions alternatives
    if (this.checkWallCollision(spawnX, spawnY, zombieSize)) {
      // Essayer des positions alternatives autour de la position demandée
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

    // Multiplicateur de difficulté selon la vague
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
      baseSpeed: zombieSpeed, // FIX: Store base speed for freeze/slow effect restoration
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
   *
   * @param {number} summonerId - ID of the summoner zombie
   * @param {number} summonerX - Summoner X coordinate
   * @param {number} summonerY - Summoner Y coordinate
   * @returns {boolean} True if spawn succeeded, false if wall collision or invalid type
   *
   * @description
   * Creates a minion zombie near summoner position:
   * - Spawns at random position 50-100 pixels from summoner
   * - Uses 'minion' zombie type from zombieTypes
   * - NOT affected by wave multipliers (intentionally weak)
   * - Links minion to summoner via summonerId property
   * - Checks wall collision before spawning
   * - Marks with isMinion=true, summonerId=summonerId
   *
   * Spawn positioning:
   * - Random angle (0 to 2π radians)
   * - Random distance (50-100 pixels)
   * - Calculates position: summoner + (distance × angle vector)
   *
   * Minion characteristics:
   * - Base stats only (no wave scaling)
   * - Low health, damage, speed
   * - Minimal gold/XP drops
   * - Dies when summoner dies (handled elsewhere)
   *
   * Use case:
   * - Summoner zombie ability creates swarm of weak minions
   * - Provides distraction and area denial
   * - Not meant to scale with wave difficulty
   *
   * @example
   *   // Summoner spawning 3 minions
   *   for (let i = 0; i < 3; i++) {
   *     zombieManager.spawnMinion(
   *       summonerZombie.id,
   *       summonerZombie.x,
   *       summonerZombie.y
   *     );
   *   }
   */
  spawnMinion(summonerId, summonerX, summonerY) {
    const type = this.zombieTypes.minion;
    if (!type) {
      return false;
    }

    // Marge de sécurité pour éviter spawn dans les murs
    const minionSize = type.size || this.config.ZOMBIE_SIZE;
    const safetyBuffer = minionSize + 5;

    // Position aléatoire autour de l'invocateur avec retry
    let x, y;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      const angle = Math.random() * Math.PI * 2;
      const distance = 50 + Math.random() * 50;
      x = summonerX + Math.cos(angle) * distance;
      y = summonerY + Math.sin(angle) * distance;

      // Vérifier les limites de la salle avec marge de sécurité
      x = Math.max(safetyBuffer + this.config.WALL_THICKNESS, Math.min(x, this.config.ROOM_WIDTH - safetyBuffer - this.config.WALL_THICKNESS));
      y = Math.max(safetyBuffer + this.config.WALL_THICKNESS, Math.min(y, this.config.ROOM_HEIGHT - safetyBuffer - this.config.WALL_THICKNESS));

      attempts++;
    } while (this.checkWallCollision(x, y, minionSize) && attempts < maxAttempts);

    // Si toujours en collision après tous les essais, abandonner
    if (this.checkWallCollision(x, y, minionSize)) {
      return false;
    }

    const zombieId = this.gameState.nextZombieId++;

    // Les minions ne sont PAS affectés par le wave multiplier (volontairement faibles)
    const healthMultiplier = this.getMutatorEffect('zombieHealthMultiplier', 1);
    const damageMultiplier = this.getMutatorEffect('zombieDamageMultiplier', 1);
    const speedMultiplier = this.getMutatorEffect('zombieSpeedMultiplier', 1);

    this.gameState.zombies[zombieId] = {
      id: zombieId,
      type: 'minion',
      x: x,
      y: y,
      health: Math.floor(type.health * healthMultiplier),
      maxHealth: Math.floor(type.health * healthMultiplier),
      speed: type.speed * speedMultiplier,
      baseSpeed: type.speed * speedMultiplier, // FIX: Store base speed for freeze/slow effect restoration
      damage: Math.floor(type.damage * damageMultiplier),
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
   * Spawn zombies in batches for current wave (main spawning logic)
   *
   * @returns {void}
   *
   * @description
   * Coordinates batch zombie spawning for wave-based gameplay:
   * - Checks MAX_ZOMBIES cap (prevents server overload)
   * - Calculates zombies needed for current wave
   * - Spawns batch of zombies (size from getZombiesPerBatch())
   * - Spawns boss when regular zombies exhausted
   * - Increments zombiesSpawnedThisWave counter
   *
   * Wave zombie calculation (capped at wave 130):
   * - Base: ZOMBIES_PER_ROOM from config
   * - Formula: base + (effectiveWave - 1) × 7
   * - Example: Wave 1 = base, Wave 10 = base + 63
   *
   * Spawning flow:
   * 1. Check if MAX_ZOMBIES reached → abort
   * 2. Check if wave quota reached → spawn boss if ready
   * 3. Otherwise: spawn batch of regular zombies
   * 4. Batch size increases with wave (2 to 10 zombies)
   *
   * Boss spawning condition:
   * - All regular zombies for wave spawned
   * - All spawned zombies killed
   * - Boss not yet spawned for this wave
   *
   * Called by:
   * - Timer interval (getSpawnInterval() ms)
   * - Runs continuously during wave
   *
   * @example
   *   // Spawner calls this automatically
   *   setInterval(() => {
   *     zombieManager.spawnZombie();
   *   }, zombieManager.getSpawnInterval());
   */
  spawnZombie() {
    if (Object.keys(this.gameState.zombies).length >= this.config.MAX_ZOMBIES) {
      return;
    }

    // Limiter le spawn selon la vague actuelle
    // CORRECTION: Plafonner le nombre de zombies par vague pour éviter surcharge
    const effectiveWave = Math.min(this.gameState.wave, 130);
    const zombiesForThisWave = this.config.ZOMBIES_PER_ROOM + (effectiveWave - 1) * 7;
    const spawnCountMultiplier = this.getMutatorEffect('spawnCountMultiplier', 1);
    const adjustedZombiesForThisWave = Math.max(1, Math.floor(zombiesForThisWave * spawnCountMultiplier));

    if (this.gameState.zombiesSpawnedThisWave >= adjustedZombiesForThisWave) {
      // Spawner le boss si pas encore fait
      if (!this.gameState.bossSpawned && Object.keys(this.gameState.zombies).length === 0) {
        this.spawnBoss();
      }
      return;
    }

    // Spawner plusieurs zombies à la fois (batch spawning)
    const batchSize = this.getZombiesPerBatch();

    for (let i = 0; i < batchSize; i++) {
      if (Object.keys(this.gameState.zombies).length >= this.config.MAX_ZOMBIES) {
        break;
      }
      if (this.gameState.zombiesSpawnedThisWave >= adjustedZombiesForThisWave) {
        break;
      }

      this.spawnSingleZombie();
    }
  }

  /**
   * Spawn a boss zombie at room center with wave scaling and special abilities
   *
   * @returns {void}
   *
   * @description
   * Creates a powerful boss zombie to end the current wave:
   * - Uses ZombieSpawnManager to select boss type based on wave
   * - Spawns at exact room center for dramatic entrance
   * - Applies wave difficulty multipliers (capped at wave 130)
   * - Initializes boss-specific ability timers
   * - Emits 'bossSpawned' event to all clients
   * - Sets gameState.bossSpawned = true
   *
   * Boss types (wave-dependent):
   * - Standard boss: Default boss for early waves
   * - bossCharnier: Spawns zombie adds periodically
   * - bossInfect: Creates toxic pools
   * - bossColosse: Enrages at low health
   * - bossRoi: Multi-phase with teleportation
   * - bossOmega: Ultimate boss with all abilities
   *
   * Wave scaling (20% multiplier vs 15% for regular):
   * - Health: base × (1 + (wave-1) × 0.20)
   * - Damage: base × (1 + (wave-1) × 0.20)
   * - Gold: base × wave multiplier
   * - XP: base × wave multiplier
   * - Speed: Uses base speed (not scaled)
   *
   * Boss-specific initialization:
   * - bossCharnier: lastSpawn timestamp
   * - bossInfect: lastToxicPool timestamp
   * - bossColosse: isEnraged = false
   * - bossRoi: phase = 1, lastTeleport, lastSummon
   * - bossOmega: All ability timers + phase system
   *
   * Client notification:
   * - Emits boss name, health, wave number
   * - Triggers boss health bar UI
   * - Plays boss music/sound effects
   *
   * @example
   *   // Called automatically when wave zombies cleared
   *   if (allZombiesKilled && !gameState.bossSpawned) {
   *     zombieManager.spawnBoss();
   *   }
   */
  spawnBoss() {
    // Utiliser le spawn manager pour déterminer le boss
    const bossType = this.spawnManager.getBossType(this.gameState.wave) || 'boss';
    const type = this.zombieTypes[bossType] || this.zombieTypes.boss;
    const isSpecialBoss = bossType !== 'boss';

    // Boss spéciaux: scaling progressif avec leurs stats de base
    const effectiveWave = Math.min(this.gameState.wave, 130);
    const waveMultiplier = 1 + (effectiveWave - 1) * 0.20;
    const healthMultiplier = this.getMutatorEffect('zombieHealthMultiplier', 1);
    const damageMultiplier = this.getMutatorEffect('zombieDamageMultiplier', 1);
    const speedMultiplier = this.getMutatorEffect('zombieSpeedMultiplier', 1);

    const bossHealth = Math.floor(type.health * waveMultiplier * healthMultiplier);
    const bossDamage = Math.floor(type.damage * waveMultiplier * damageMultiplier);
    const bossGold = Math.floor(type.gold * waveMultiplier);
    const bossXP = Math.floor(type.xp * waveMultiplier);

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
      speed: type.speed * speedMultiplier,
      baseSpeed: type.speed * speedMultiplier, // FIX: Store base speed for freeze/slow effect restoration
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
   * Calculate zombie spawn interval based on current wave (faster spawns at higher waves)
   *
   * @returns {number} Spawn interval in milliseconds
   *
   * @description
   * Determines how fast zombies spawn as difficulty increases:
   * - Base interval: ZOMBIE_SPAWN_INTERVAL from config
   * - Reduction: (wave - 1) × 50ms per wave
   * - Maximum reduction: 600ms
   * - Minimum interval: 400ms (hard floor)
   *
   * Spawn speed progression:
   * - Wave 1: Base interval (typically 1000ms)
   * - Wave 10: Base - 450ms
   * - Wave 13+: Base - 600ms (capped)
   * - Minimum: 400ms (prevents server overload)
   *
   * Design rationale:
   * - Early waves: Slow spawns allow learning
   * - Mid waves: Accelerating pace increases tension
   * - Late waves: Fast spawns + large batches = intense combat
   * - Cap prevents spawning faster than players can react
   *
   * @example
   *   // Wave 1: 1000ms interval
   *   const interval = zombieManager.getSpawnInterval(); // 1000
   *
   * @example
   *   // Wave 15: 400ms interval (at minimum)
   *   gameState.wave = 15;
   *   const interval = zombieManager.getSpawnInterval(); // 400
   */
  getSpawnInterval() {
    const baseInterval = this.config.ZOMBIE_SPAWN_INTERVAL;
    const reduction = Math.min((this.gameState.wave - 1) * 50, 600);
    const interval = Math.max(baseInterval - reduction, 400);
    const spawnIntervalMultiplier = this.getMutatorEffect('spawnIntervalMultiplier', 1);
    return Math.max(Math.floor(interval * spawnIntervalMultiplier), 350);
  }

  /**
   * Start the automatic zombie spawning timer for the current wave
   *
   * @returns {void}
   *
   * @description
   * Initializes the zombie spawn interval timer:
   * - Clears any existing timer (prevents duplicates)
   * - Creates new interval calling spawnZombie()
   * - Interval duration from getSpawnInterval() (wave-dependent)
   * - Timer stored in this.zombieSpawnTimer
   *
   * Called when:
   * - Game starts (first wave begins)
   * - Should only be called once at game initialization
   * - Use restartZombieSpawner() for new waves
   *
   * @example
   *   // Start spawning for wave 1
   *   zombieManager.startZombieSpawner();
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
   * Restart the zombie spawner with updated interval for new wave
   *
   * @returns {void}
   *
   * @description
   * Restarts the spawn timer with recalculated interval:
   * - Clears existing timer
   * - Creates new interval with current wave's spawn rate
   * - CRITICAL: Must be called when new wave starts
   * - Ensures spawn speed matches current difficulty
   *
   * Why needed:
   * - CORRECTION v1.0.1: Previously didn't update interval
   * - Each wave has different spawn speed (getSpawnInterval())
   * - Without restart, old interval continues
   * - Results in incorrect spawn rate for new wave
   *
   * Called when:
   * - New wave begins (boss defeated)
   * - Wave counter increments
   * - Ensures progressively faster spawns
   *
   * @example
   *   // Start next wave
   *   gameState.wave++;
   *   gameState.zombiesSpawnedThisWave = 0;
   *   gameState.bossSpawned = false;
   *   zombieManager.restartZombieSpawner(); // Update spawn speed
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
   * Stop the zombie spawning timer (game over or pause)
   *
   * @returns {void}
   *
   * @description
   * Stops automatic zombie spawning:
   * - Clears the spawn interval timer
   * - Sets zombieSpawnTimer to null
   * - No more zombies will spawn automatically
   * - Does not affect existing zombies
   *
   * Called when:
   * - Game ends (all players dead)
   * - Server shutdown
   * - Manual game pause (if implemented)
   *
   * @example
   *   // Game over
   *   zombieManager.stopZombieSpawner();
   *   console.log('Zombie spawning stopped');
   */
  stopZombieSpawner() {
    if (this.zombieSpawnTimer) {
      clearInterval(this.zombieSpawnTimer);
      this.zombieSpawnTimer = null;
    }
  }
}

module.exports = ZombieManager;
