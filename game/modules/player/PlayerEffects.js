/**
 * @fileoverview Player effects and bonuses
 * @description Handles milestone bonuses and other player effects
 */

/**
 * Apply milestone bonus at level 5, 10, 15, 20, etc.
 */
function applyMilestoneBonus(player) {
  const level = player.level;

  if (level === 5) {
    return applyLevel5Bonus(player);
  } else if (level === 10) {
    return applyLevel10Bonus(player);
  } else if (level === 15) {
    return applyLevel15Bonus(player);
  } else if (level === 20) {
    return applyLevel20Bonus(player);
  } else {
    return applyGenericMilestoneBonus(player, level);
  }
}

/**
 * Apply level 5 milestone bonus
 */
function applyLevel5Bonus(player) {
  player.maxHealth += 50;
  player.health = Math.min(player.health + 50, player.maxHealth);

  return {
    title: '🎖️ PALIER 5 !',
    description: '+50 PV max et régénération complète',
    icon: '❤️'
  };
}

/**
 * Apply level 10 milestone bonus
 */
function applyLevel10Bonus(player) {
  player.damageMultiplier = (player.damageMultiplier || 1) * 1.25;
  player.speedMultiplier = (player.speedMultiplier || 1) * 1.20;

  return {
    title: '🎖️ PALIER 10 !',
    description: '+25% dégâts et +20% vitesse permanents',
    icon: '⚔️'
  };
}

/**
 * Apply level 15 milestone bonus
 */
function applyLevel15Bonus(player) {
  player.fireRateMultiplier = (player.fireRateMultiplier || 1) * 0.75;
  player.criticalChance = (player.criticalChance || 0) + 0.15;

  return {
    title: '🎖️ PALIER 15 !',
    description: '-25% cooldown et +15% coup critique',
    icon: '🔫'
  };
}

/**
 * Apply level 20 milestone bonus
 */
function applyLevel20Bonus(player) {
  player.maxHealth += 100;
  player.health = player.maxHealth;
  player.lifeSteal = (player.lifeSteal || 0) + 0.10;

  return {
    title: '🎖️ PALIER 20 !',
    description: '+100 PV max, heal complet et +10% vol de vie',
    icon: '💪'
  };
}

/**
 * Apply generic milestone bonus for levels 25, 30, 35, etc.
 */
function applyGenericMilestoneBonus(player, level) {
  player.maxHealth += 30;
  player.health = Math.min(player.health + 30, player.maxHealth);
  player.damageMultiplier = (player.damageMultiplier || 1) * 1.10;

  return {
    title: `🎖️ PALIER ${level} !`,
    description: '+30 PV max et +10% dégâts',
    icon: '🌟'
  };
}

module.exports = {
  applyMilestoneBonus
};
