/**
 * SKILL EFFECTS APPLICATOR
 * Applies skill bonuses to player stats
 * @version 1.0.0
 */

const logger = require('../infrastructure/Logger');

class SkillEffectsApplicator {
  /**
   * Apply skill bonuses to a player object
   * @param {Object} player - Player object
   * @param {Object} skillBonuses - Skill bonuses from AccountProgressionService
   * @param {Object} CONFIG - Game config
   * @returns {Object} - Modified player
   */
  static applySkillBonuses(player, skillBonuses, _CONFIG) {
    if (!player || !skillBonuses) {
      return player;
    }

    try {
      // Apply flat stat bonuses
      if (skillBonuses.maxHealthBonus) {
        player.maxHealth += skillBonuses.maxHealthBonus;
        player.health += skillBonuses.maxHealthBonus; // Also increase current health
      }

      if (skillBonuses.startingGold) {
        player.gold = (player.gold || 0) + skillBonuses.startingGold;
      }

      if (skillBonuses.regeneration) {
        player.regeneration = (player.regeneration || 0) + skillBonuses.regeneration;
      }

      if (skillBonuses.piercing) {
        player.piercing = (player.piercing || 0) + skillBonuses.piercing;
      }

      if (skillBonuses.autoTurrets) {
        player.autoTurrets = (player.autoTurrets || 0) + skillBonuses.autoTurrets;
      }

      if (skillBonuses.maxShield) {
        player.maxShield = skillBonuses.maxShield;
        player.shield = skillBonuses.maxShield;
        player.shieldRegen = skillBonuses.shieldRegen || 0;
      }

      // Apply multipliers
      if (skillBonuses.damageMultiplier) {
        player.damageMultiplier = (player.damageMultiplier || 1.0) + skillBonuses.damageMultiplier;
      }

      if (skillBonuses.speedMultiplier) {
        player.speedMultiplier = (player.speedMultiplier || 1.0) + skillBonuses.speedMultiplier;
      }

      if (skillBonuses.fireRateMultiplier) {
        // Negative means faster
        player.fireRateMultiplier = (player.fireRateMultiplier || 1.0) + skillBonuses.fireRateMultiplier;
      }

      if (skillBonuses.xpMultiplier) {
        player.xpMultiplier = (player.xpMultiplier || 1.0) + skillBonuses.xpMultiplier;
      }

      if (skillBonuses.goldMultiplier) {
        player.goldMultiplier = (player.goldMultiplier || 1.0) + skillBonuses.goldMultiplier;
      }

      // Apply percentages
      if (skillBonuses.critChance) {
        player.critChance = (player.critChance || 0) + skillBonuses.critChance;
      }

      if (skillBonuses.critMultiplier && skillBonuses.critMultiplier > 1.0) {
        player.critMultiplier = skillBonuses.critMultiplier;
      }

      if (skillBonuses.dodgeChance) {
        player.dodgeChance = (player.dodgeChance || 0) + skillBonuses.dodgeChance;
      }

      if (skillBonuses.lifeSteal) {
        player.lifeSteal = (player.lifeSteal || 0) + skillBonuses.lifeSteal;
      }

      if (skillBonuses.thornsDamage) {
        player.thornsDamage = (player.thornsDamage || 0) + skillBonuses.thornsDamage;
      }

      // Apply boolean flags
      if (skillBonuses.explosiveRounds) {
        player.explosiveRounds = true;
        player.explosionRadius = player.explosionRadius || 100;
        player.explosionDamagePercent = player.explosionDamagePercent || 0.5;
      }

      if (skillBonuses.damageImmunity) {
        player.hasDamageImmunity = true;
        player.immunityCooldown = skillBonuses.immunityCooldown || 15000;
      }

      if (skillBonuses.secondChance) {
        player.hasSecondChance = true;
        player.secondChanceUsed = false;
      }

      // Apply special skills
      if (skillBonuses.multishotCount) {
        player.multishotCount = (player.multishotCount || 0) + skillBonuses.multishotCount;
      }

      // Berserker skill
      if (skillBonuses.berserkerDamage) {
        player.berserkerDamage = skillBonuses.berserkerDamage;
        player.berserkerSpeed = skillBonuses.berserkerSpeed;
        player.berserkerThreshold = skillBonuses.berserkerThreshold;
      }

      logger.debug('Applied skill bonuses to player', {
        playerId: player.id,
        bonusesApplied: Object.keys(skillBonuses).filter(k => skillBonuses[k] && skillBonuses[k] !== 0)
      });

      return player;
    } catch (error) {
      logger.error('Failed to apply skill bonuses', {
        playerId: player.id,
        error: error.message,
        stack: error.stack
      });
      return player;
    }
  }

  /**
   * Check and apply berserker bonus if conditions are met
   * @param {Object} player - Player object
   * @returns {Boolean} - Whether berserker is active
   */
  static checkBerserkerMode(player) {
    if (!player.berserkerDamage || !player.berserkerThreshold) {
      return false;
    }

    const healthPercent = player.health / player.maxHealth;

    if (healthPercent <= player.berserkerThreshold) {
      if (!player.berserkerActive) {
        player.berserkerActive = true;
        logger.info('Berserker mode activated', {
          playerId: player.id,
          healthPercent: (healthPercent * 100).toFixed(1) + '%'
        });
      }
      return true;
    } else {
      if (player.berserkerActive) {
        player.berserkerActive = false;
        logger.info('Berserker mode deactivated', {
          playerId: player.id
        });
      }
      return false;
    }
  }

  /**
   * Apply berserker bonuses to damage calculation
   * @param {Number} baseDamage - Base damage
   * @param {Object} player - Player object
   * @returns {Number} - Modified damage
   */
  static applyBerserkerDamage(baseDamage, player) {
    if (this.checkBerserkerMode(player) && player.berserkerDamage) {
      return baseDamage * (1 + player.berserkerDamage);
    }
    return baseDamage;
  }

  /**
   * Apply berserker bonuses to speed calculation
   * @param {Number} baseSpeed - Base speed
   * @param {Object} player - Player object
   * @returns {Number} - Modified speed
   */
  static applyBerserkerSpeed(baseSpeed, player) {
    if (this.checkBerserkerMode(player) && player.berserkerSpeed) {
      return baseSpeed * (1 + player.berserkerSpeed);
    }
    return baseSpeed;
  }

  /**
   * Handle player taking damage with skill effects
   * @param {Object} player - Player object
   * @param {Number} damage - Incoming damage
   * @param {Object} attacker - Attacker (optional)
   * @returns {Object} - { actualDamage, blocked, reflected }
   */
  static handleIncomingDamage(player, damage, attacker = null) {
    let actualDamage = damage;
    let blocked = false;
    let reflected = 0;

    // Check dodge
    if (player.dodgeChance && Math.random() < player.dodgeChance) {
      blocked = true;
      actualDamage = 0;
      logger.debug('Attack dodged', { playerId: player.id });
    }

    // Check damage immunity
    if (!blocked && player.hasDamageImmunity && player.lastDamageTime) {
      const timeSinceLastDamage = Date.now() - player.lastDamageTime;
      if (timeSinceLastDamage < 2000) { // 2s immunity after hit
        const cooldownReady = Date.now() - (player.lastImmunityActivation || 0) >= player.immunityCooldown;
        if (cooldownReady) {
          blocked = true;
          actualDamage = 0;
          player.lastImmunityActivation = Date.now();
          logger.debug('Damage immunity activated', { playerId: player.id });
        }
      }
    }

    // Apply damage to shield first
    if (!blocked && player.shield && player.shield > 0) {
      if (actualDamage <= player.shield) {
        player.shield -= actualDamage;
        actualDamage = 0;
        blocked = true;
      } else {
        actualDamage -= player.shield;
        player.shield = 0;
      }
    }

    // Check thorns damage
    if (!blocked && player.thornsDamage && attacker) {
      reflected = Math.floor(actualDamage * player.thornsDamage);
      if (attacker.health) {
        attacker.health -= reflected;
      }
    }

    // Update last damage time
    if (!blocked) {
      player.lastDamageTime = Date.now();
    }

    return {
      actualDamage,
      blocked,
      reflected
    };
  }

  /**
   * Check second chance (revive)
   * @param {Object} player - Player object
   * @returns {Boolean} - Whether player was revived
   */
  static checkSecondChance(player) {
    if (player.hasSecondChance && !player.secondChanceUsed && player.health <= 0) {
      player.health = Math.floor(player.maxHealth * 0.5);
      player.secondChanceUsed = true;
      logger.info('Second chance activated', {
        playerId: player.id,
        revivedHealth: player.health
      });
      return true;
    }
    return false;
  }
}

module.exports = SkillEffectsApplicator;
