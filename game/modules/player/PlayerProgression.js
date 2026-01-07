/**
 * @fileoverview Player progression logic
 * @description Handles level ups, combos, and milestone bonuses
 */

const { getXPForLevel, generateUpgradeChoices } = require('../../utilityFunctions');

/**
 * Update player combo on zombie kill
 */
function updatePlayerCombo(playerId, zombie, gameState, io) {
  const shooter = gameState.players[playerId];
  if (!shooter || !shooter.alive) return null;

  const now = Date.now();
  const COMBO_TIMEOUT = 5000;

  updateComboCounter(shooter, now, COMBO_TIMEOUT);
  const comboMultiplier = calculateComboMultiplier(shooter.combo);
  const { goldBonus, xpBonus } = calculateBonuses(zombie, comboMultiplier);
  updatePlayerScore(shooter, zombie, comboMultiplier);

  emitComboUpdate(shooter, playerId, comboMultiplier, goldBonus, xpBonus, zombie, io);

  return { goldBonus, xpBonus };
}

/**
 * Update combo counter
 */
function updateComboCounter(shooter, now, COMBO_TIMEOUT) {
  if (shooter.comboTimer > 0 && now - shooter.comboTimer < COMBO_TIMEOUT) {
    shooter.combo++;
  } else {
    shooter.combo = 1;
  }

  shooter.comboTimer = now;
  shooter.kills++;
  shooter.zombiesKilled++;

  if (shooter.combo > shooter.highestCombo) {
    shooter.highestCombo = shooter.combo;
  }
}

/**
 * Calculate combo multiplier
 */
function calculateComboMultiplier(combo) {
  if (combo >= 50) return 10;
  if (combo >= 30) return 5;
  if (combo >= 15) return 3;
  if (combo >= 5) return 2;
  return 1;
}

/**
 * Calculate gold and XP bonuses
 */
function calculateBonuses(zombie, comboMultiplier) {
  return {
    goldBonus: Math.floor(zombie.goldDrop * comboMultiplier),
    xpBonus: Math.floor(zombie.xpDrop * comboMultiplier)
  };
}

/**
 * Update player score
 */
function updatePlayerScore(shooter, zombie, comboMultiplier) {
  const baseScore = zombie.goldDrop + zombie.xpDrop;
  const comboScore = baseScore * (comboMultiplier - 1);
  shooter.totalScore += baseScore + comboScore;
}

/**
 * Emit combo update event
 */
function emitComboUpdate(shooter, playerId, comboMultiplier, goldBonus, xpBonus, zombie, io) {
  io.to(playerId).emit('comboUpdate', {
    combo: shooter.combo,
    multiplier: comboMultiplier,
    score: shooter.totalScore,
    goldBonus: goldBonus - zombie.goldDrop,
    xpBonus: xpBonus - zombie.xpDrop
  });
}

/**
 * Handle player level up
 */
function handlePlayerLevelUp(player, playerId, io) {
  while (player.xp >= getXPForLevel(player.level)) {
    player.xp -= getXPForLevel(player.level);
    player.level++;

    const milestoneBonus = checkMilestoneBonus(player);
    const upgradeChoices = generateUpgradeChoices();

    setInvisibilityForUpgrade(player);
    emitLevelUpEvent(player, playerId, upgradeChoices, milestoneBonus, io);
  }
}

/**
 * Check and apply milestone bonus
 */
function checkMilestoneBonus(player) {
  if (player.level % 5 === 0) {
    const { applyMilestoneBonus } = require('./PlayerEffects');
    return applyMilestoneBonus(player);
  }
  return null;
}

/**
 * Set invisibility for upgrade choice
 */
function setInvisibilityForUpgrade(player) {
  player.invisible = true;
  player.invisibleEndTime = Infinity;
}

/**
 * Emit level up event
 */
function emitLevelUpEvent(player, playerId, upgradeChoices, milestoneBonus, io) {
  io.to(playerId).emit('levelUp', {
    newLevel: player.level,
    upgradeChoices: upgradeChoices,
    milestoneBonus: milestoneBonus
  });
}

module.exports = {
  updatePlayerCombo,
  handlePlayerLevelUp
};
