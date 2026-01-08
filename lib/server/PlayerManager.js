/**
 * PLAYER MANAGER - Gestion des joueurs, XP, niveaux et upgrades
 * Gère la progression des joueurs et les améliorations
 * @version 1.0.0
 */

class PlayerManager {
  constructor(gameState, config, levelUpgrades) {
    this.gameState = gameState;
    this.config = config;
    this.levelUpgrades = levelUpgrades;
  }

  /**
   * Calculate XP required to reach the next level with progressive scaling
   *
   * @param {number} level - Current player level
   * @returns {number} XP required for next level
   *
   * @description
   * Computes XP threshold for leveling up with gentler late-game curve:
   * - Levels 1-5: 50 base + 30 per level (50, 80, 110, 140, 170)
   * - Levels 6-10: 200 base + 50 per level (200, 250, 300, 350, 400)
   * - Levels 11-20: 400 base + 75 per level (475, 550, 625...)
   * - Levels 21+: 1000 base + 60 per level (1060, 1120, 1180...)
   *
   * Design rationale:
   * - Early levels: Quick progression for engagement
   * - Mid levels: Moderate scaling
   * - Late levels: SOFTENED curve (60 instead of 100)
   * - Prevents excessive grind at high levels
   * - Maintains rewarding progression feel
   *
   * Example progression:
   * - Level 1→2: 50 XP
   * - Level 10→11: 400 XP
   * - Level 20→21: 1000 XP
   * - Level 30→31: 1600 XP
   *
   * @example
   *   // Check XP for level 15
   *   const xpNeeded = playerManager.getXPForLevel(15);
   *   // Returns: 775 (400 + 75×5)
   *
   * @example
   *   // Display progress bar
   *   const xpForNext = playerManager.getXPForLevel(player.level);
   *   const progress = player.xp / xpForNext * 100;
   */
  getXPForLevel(level) {
    if (level <= 5) {
      return 50 + (level - 1) * 30; // Niveaux 1-5 : 50, 80, 110, 140, 170
    } else if (level <= 10) {
      return 200 + (level - 5) * 50; // Niveaux 6-10 : 200, 250, 300, 350, 400
    } else if (level <= 20) {
      return 400 + (level - 10) * 75; // Niveaux 11-20 : 475, 550, 625...
    } else {
      // Courbe adoucie après level 20 : 1000 + 60 par niveau au lieu de 100
      return Math.floor(1000 + (level - 20) * 60); // Niveaux 20+ : 1060, 1120, 1180...
    }
  }

  /**
   * Generate 3 random upgrade choices weighted by rarity for level-up selection
   *
   * @returns {Array<Object>} Array of 3 upgrade choice objects
   * @returns {string} returns[].id - Upgrade identifier key
   * @returns {string} returns[].name - Display name for upgrade
   * @returns {string} returns[].description - Upgrade effect description
   * @returns {string} returns[].rarity - Rarity tier (common/rare/legendary)
   *
   * @description
   * Creates random upgrade selection for player level-up:
   * - Generates 3 unique choices (no duplicates)
   * - Weighted by rarity: 60% common, 30% rare, 10% legendary
   * - Falls back to any rarity if not enough of target type
   * - Returns partial choices if fewer than 3 total upgrades exist
   *
   * Rarity weighting:
   * - Common (60%): Reliable useful upgrades
   * - Rare (30%): Powerful specialized upgrades
   * - Legendary (10%): Game-changing upgrades
   *
   * Selection algorithm:
   * 1. Roll random (0-1) to determine target rarity
   * 2. Find available upgrades of that rarity (not yet selected)
   * 3. Pick random upgrade from filtered list
   * 4. Repeat until 3 choices or exhausted
   * 5. Fill remaining slots with any rarity if needed
   *
   * Returned upgrade format:
   * - id: Key from levelUpgrades object
   * - name: Display name shown to player
   * - description: Effect explanation
   * - rarity: Visual styling/color coding
   *
   * @example
   *   // Player levels up
   *   const choices = playerManager.generateUpgradeChoices();
   *   // Returns: [
   *   //   { id: 'damage1', name: 'Sharp Bullets', rarity: 'common', ... },
   *   //   { id: 'piercing', name: 'Piercing Rounds', rarity: 'rare', ... },
   *   //   { id: 'maxHealth1', name: 'Vitality', rarity: 'common', ... }
   *   // ]
   *
   * @example
   *   // Send to client for selection
   *   io.to(player.id).emit('levelUp', {
   *     level: player.level,
   *     choices: playerManager.generateUpgradeChoices()
   *   });
   */
  generateUpgradeChoices() {
    const upgradeKeys = Object.keys(this.levelUpgrades);
    const choices = [];
    const selectedKeys = new Set();

    // Pondération : 60% common, 30% rare, 10% legendary
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
        this.levelUpgrades[key].rarity === targetRarity && !selectedKeys.has(key)
      );

      if (availableUpgrades.length > 0) {
        const selectedKey = availableUpgrades[Math.floor(Math.random() * availableUpgrades.length)];
        selectedKeys.add(selectedKey);
        choices.push({
          id: selectedKey,
          name: this.levelUpgrades[selectedKey].name,
          description: this.levelUpgrades[selectedKey].description,
          rarity: this.levelUpgrades[selectedKey].rarity
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
          name: this.levelUpgrades[selectedKey].name,
          description: this.levelUpgrades[selectedKey].description,
          rarity: this.levelUpgrades[selectedKey].rarity
        });
      } else {
        break;
      }
    }

    return choices;
  }

  /**
   * Apply a selected upgrade effect to a player
   *
   * @param {Object} player - Player object to receive upgrade
   * @param {string} upgradeId - Upgrade identifier from levelUpgrades
   * @returns {void}
   *
   * @description
   * Executes the effect function of a chosen upgrade:
   * - Looks up upgrade definition from levelUpgrades by ID
   * - Calls upgrade.effect(player) to modify player stats
   * - Upgrade effect directly mutates player object
   * - No return value (side effects on player)
   *
   * Upgrade effects typically modify:
   * - damageMultiplier, speedMultiplier, fireRateMultiplier
   * - maxHealth (and heal to new max)
   * - Special abilities: autoTurrets, regeneration, bulletPiercing
   * - Combat stats: lifeSteal, criticalChance, dodgeChance
   * - AOE abilities: explosiveRounds, thorns
   *
   * Safety:
   * - Validates upgrade exists before calling effect
   * - Validates effect function exists
   * - Silently does nothing if invalid
   *
   * @example
   *   // Player selects damage upgrade
   *   playerManager.applyUpgrade(player, 'damage1');
   *   // player.damageMultiplier increased by upgrade effect
   *
   * @example
   *   // Handle upgrade selection from client
   *   socket.on('selectUpgrade', (upgradeId) => {
   *     playerManager.applyUpgrade(player, upgradeId);
   *     socket.emit('upgradeApplied', upgradeId);
   *   });
   */
  applyUpgrade(player, upgradeId) {
    const upgrade = this.levelUpgrades[upgradeId];
    if (upgrade && upgrade.effect) {
      upgrade.effect(player);
    }
  }

  /**
   * Add XP to player and handle automatic level-up progression with upgrade choices
   *
   * @param {Object} player - Player object to gain XP
   * @param {number} xpAmount - Amount of XP to add
   * @param {Function} [onLevelUp] - Callback invoked on each level up
   * @param {Object} onLevelUp.player - The player who leveled up
   * @param {Array<Object>} onLevelUp.upgradeChoices - Generated upgrade choices
   * @returns {void}
   *
   * @description
   * Adds XP and processes level-ups with upgrade selection:
   * - Adds xpAmount to player.xp
   * - Checks if player has enough XP for next level
   * - Handles multiple level-ups in single call (rare but possible)
   * - Deducts required XP per level (carries over excess)
   * - Increments player.level for each level gained
   * - Generates upgrade choices and calls callback
   *
   * Level-up flow per level:
   * 1. Check player.xp >= getXPForLevel(player.level)
   * 2. Subtract XP threshold from player.xp
   * 3. Increment player.level
   * 4. Generate 3 random upgrade choices
   * 5. Call onLevelUp(player, upgradeChoices) if provided
   * 6. Repeat if still enough XP (multi-level up)
   *
   * XP handling:
   * - XP requirements increase with level (see getXPForLevel)
   * - Excess XP carries over to next level
   * - Multiple levels possible in one call (e.g., boss kill)
   *
   * Callback usage:
   * - Typically emits level-up event to client
   * - Sends upgrade choices for player selection
   * - Pauses game until player chooses upgrade
   *
   * @example
   *   // Zombie killed, award XP
   *   playerManager.addXP(player, zombie.xpDrop, (player, choices) => {
   *     io.to(player.id).emit('levelUp', {
   *       level: player.level,
   *       upgradeChoices: choices
   *     });
   *   });
   *
   * @example
   *   // Boss kill with high XP (may multi-level)
   *   playerManager.addXP(player, 500, (player, choices) => {
   *     console.log(`Player reached level ${player.level}!`);
   *   });
   */
  addXP(player, xpAmount, onLevelUp) {
    player.xp += xpAmount;

    // Vérifier si le joueur a assez d'XP pour monter de niveau
    while (player.xp >= this.getXPForLevel(player.level)) {
      player.xp -= this.getXPForLevel(player.level);
      player.level++;

      // Callback pour le level up
      if (onLevelUp) {
        const upgradeChoices = this.generateUpgradeChoices();
        onLevelUp(player, upgradeChoices);
      }
    }
  }

  /**
   * Create a new player entity with complete initial stats and properties
   *
   * @param {string} socketId - Socket.IO connection ID for this player
   * @returns {Object} Fully initialized player object
   *
   * @description
   * Constructs a complete player object with all necessary properties:
   * - Basic identity: id, nickname, hasNickname
   * - Position: Spawns at bottom-center of room
   * - Health: Full health from PLAYER_MAX_HEALTH config
   * - Progression: Level 1, 0 XP, 0 gold
   * - Combat: Basic weapon (pistol), no buffs
   * - Upgrades: All permanent upgrade stats at 0
   * - Special abilities: All level-up abilities initialized
   * - Tracking: Kills, combo, score, survival time
   *
   * Initial spawn position:
   * - X: ROOM_WIDTH / 2 (horizontal center)
   * - Y: ROOM_HEIGHT - 100 (near bottom, safe from spawns)
   *
   * Protection features:
   * - spawnProtection: false initially (set after spawn)
   * - invisible: false
   * - alive: true
   *
   * Upgrade system properties:
   * - Shop upgrades: maxHealth, damage, speed, fireRate
   * - Multipliers: damageMultiplier, speedMultiplier, fireRateMultiplier
   * - Special abilities: autoTurrets, regeneration, bulletPiercing
   * - Combat abilities: lifeSteal, criticalChance, dodgeChance
   * - AOE abilities: explosiveRounds, thorns
   *
   * Tracking properties (CORRECTION v1.0.1):
   * - kills, zombiesKilled: Kill counters
   * - combo, comboTimer, highestCombo: Combo system
   * - totalScore, score: Scoring system
   * - survivalTime: Session duration tracking
   *
   * @example
   *   // New player connects
   *   socket.on('connect', () => {
   *     const player = playerManager.createPlayer(socket.id);
   *     gameState.players[socket.id] = player;
   *   });
   *
   * @example
   *   // Player respawn after death
   *   const newPlayer = playerManager.createPlayer(oldPlayer.id);
   *   newPlayer.nickname = oldPlayer.nickname; // Preserve nickname
   *   gameState.players[oldPlayer.id] = newPlayer;
   */
  createPlayer(socketId) {
    return {
      id: socketId,
      nickname: null,
      hasNickname: false,
      spawnProtection: false,
      spawnProtectionEndTime: 0,
      invisible: false,
      invisibleEndTime: 0,
      lastActivityTime: Date.now(),
      x: this.config.ROOM_WIDTH / 2,
      y: this.config.ROOM_HEIGHT - 100,
      health: this.config.PLAYER_MAX_HEALTH,
      maxHealth: this.config.PLAYER_MAX_HEALTH,
      level: 1,
      xp: 0,
      gold: 0,
      alive: true,
      angle: 0,
      weapon: 'pistol',
      weaponTimer: null,
      speedBoost: null,
      lastShot: 0,
      // CORRECTION: Ajout des propriétés manquantes pour le système de combo
      kills: 0,
      zombiesKilled: 0,
      combo: 0,
      comboTimer: 0,
      highestCombo: 0,
      totalScore: 0,
      survivalTime: Date.now(),
      score: 0,
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
      // CORRECTION: Stats des upgrades de level-up
      autoTurrets: 0,
      lastAutoShot: Date.now(),
      regeneration: 0,
      lastRegenTick: Date.now(),
      bulletPiercing: 0,
      lifeSteal: 0,
      criticalChance: 0,
      goldMagnetRadius: 0,
      dodgeChance: 0,
      explosiveRounds: 0,
      explosionRadius: 0,
      explosionDamagePercent: 0,
      extraBullets: 0,
      thorns: 0
    };
  }
}

module.exports = PlayerManager;
