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
   * Calculer l'XP nécessaire pour le niveau suivant
   * @param {number} level - Niveau actuel
   * @returns {number} XP requis
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
   * Générer 3 choix d'upgrades aléatoires avec pondération par rareté
   * @returns {Array} Tableau de 3 choix d'upgrades
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
   * Appliquer un upgrade à un joueur
   * @param {Object} player - Le joueur
   * @param {string} upgradeId - L'ID de l'upgrade
   */
  applyUpgrade(player, upgradeId) {
    const upgrade = this.levelUpgrades[upgradeId];
    if (upgrade && upgrade.effect) {
      upgrade.effect(player);
    }
  }

  /**
   * Ajouter de l'XP à un joueur et gérer les montées de niveau
   * @param {Object} player - Le joueur
   * @param {number} xpAmount - Quantité d'XP à ajouter
   * @param {Function} onLevelUp - Callback appelé lors d'une montée de niveau
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
   * Créer un nouveau joueur avec les stats de base
   * CORRECTION: Ajouter toutes les propriétés manquantes
   * @param {string} socketId - ID du socket du joueur
   * @returns {Object} Nouvel objet joueur
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
