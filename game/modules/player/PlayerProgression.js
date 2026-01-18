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
  if (!shooter || !shooter.alive) {
    return null;
  }

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
  if (combo >= 50) {
    return 10;
  }
  if (combo >= 30) {
    return 5;
  }
  if (combo >= 15) {
    return 3;
  }
  if (combo >= 5) {
    return 2;
  }
  return 1;
}

/**
 * Calculate gold and XP bonuses
 * BUG FIX: Added validation for zombie drop values
 */
function calculateBonuses(zombie, comboMultiplier) {
  // BUG FIX: Validate zombie drop values
  const goldDrop = typeof zombie.goldDrop === 'number' && isFinite(zombie.goldDrop) ? zombie.goldDrop : 0;
  const xpDrop = typeof zombie.xpDrop === 'number' && isFinite(zombie.xpDrop) ? zombie.xpDrop : 0;
  const multiplier = typeof comboMultiplier === 'number' && isFinite(comboMultiplier) ? comboMultiplier : 1;

  return {
    goldBonus: Math.floor(goldDrop * multiplier),
    xpBonus: Math.floor(xpDrop * multiplier)
  };
}

/**
 * Update player score
 */
function updatePlayerScore(shooter, zombie, comboMultiplier) {
  const goldDrop = typeof zombie.goldDrop === 'number' && isFinite(zombie.goldDrop) ? zombie.goldDrop : 0;
  const xpDrop = typeof zombie.xpDrop === 'number' && isFinite(zombie.xpDrop) ? zombie.xpDrop : 0;
  const multiplier = typeof comboMultiplier === 'number' && isFinite(comboMultiplier) ? comboMultiplier : 1;
  const baseScore = goldDrop + xpDrop;
  const comboScore = baseScore * (multiplier - 1);
  shooter.totalScore += baseScore + comboScore;
}

/**
 * Emit combo update event
 */
function emitComboUpdate(shooter, playerId, comboMultiplier, goldBonus, xpBonus, zombie, io) {
  const goldDrop = typeof zombie.goldDrop === 'number' && isFinite(zombie.goldDrop) ? zombie.goldDrop : 0;
  const xpDrop = typeof zombie.xpDrop === 'number' && isFinite(zombie.xpDrop) ? zombie.xpDrop : 0;
  io.to(playerId).emit('comboUpdate', {
    combo: shooter.combo,
    multiplier: comboMultiplier,
    score: shooter.totalScore,
    goldBonus: goldBonus - goldDrop,
    xpBonus: xpBonus - xpDrop
  });
}

/**
 * Handle player level up
 * BUG FIX: Added validation for player and XP values
 */
function handlePlayerLevelUp(player, playerId, io) {
  // BUG FIX: Validate player object
  if (!player || typeof player !== 'object') {
    return;
  }

  // BUG FIX: Initialize missing values
  if (typeof player.xp !== 'number' || !isFinite(player.xp)) {
    player.xp = 0;
    return;
  }

  if (typeof player.level !== 'number' || player.level < 1) {
    player.level = 1;
  }

  // BUG FIX: Limit level up iterations to prevent infinite loop
  let levelUps = 0;
  const MAX_LEVEL_UPS = 100;

  while (player.xp >= getXPForLevel(player.level) && levelUps < MAX_LEVEL_UPS) {
    player.xp -= getXPForLevel(player.level);
    player.level++;
    levelUps++;

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
