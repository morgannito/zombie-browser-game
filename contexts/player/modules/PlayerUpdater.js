/**
 * @fileoverview Player update logic - timers, regeneration, and per-frame updates
 */

const { GAMEPLAY_CONSTANTS } = require('../../../lib/server/ConfigManager');
const { updateAutoTurrets } = require('./AutoTurretHandler');
const { updateTeslaCoil } = require('./TeslaCoilHandler');

/**
 * Update all alive players each game loop tick
 */
function updatePlayers(
  gameState,
  now,
  io,
  collisionManager,
  entityManager,
  deltaMultiplier = 1,
  zombieManager = null
) {

  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (!player.alive) {
      continue;
    }

    updatePlayerTimers(player, now, io, playerId);
    updatePlayerRegeneration(player, now, deltaMultiplier);
    updateAutoTurrets(player, playerId, now, collisionManager, entityManager, gameState);
    updateTeslaCoil(
      player,
      playerId,
      now,
      collisionManager,
      entityManager,
      gameState,
      io,
      zombieManager
    );
  }
}

/**
 * Update player timers and effects (weapon expiry, buffs, combo)
 */
function updatePlayerTimers(player, now, io, playerId) {
  if (player.spawnProtection && now > player.spawnProtectionEndTime) {
    player.spawnProtection = false;
  }

  if (player.invisible && now > player.invisibleEndTime) {
    player.invisible = false;
  }

  if (player.weaponTimer && now > player.weaponTimer) {
    player.weapon = 'pistol';
    player.weaponTimer = null;
  }

  if (player.speedBoost && now > player.speedBoost) {
    player.speedBoost = null;
  }

  _updateComboTimer(player, now, io, playerId);
}

/**
 * Update combo timer and emit reset event if timed out
 */
function _updateComboTimer(player, now, io, playerId) {
  if (player.combo <= 0) {
    return;
  }

  if (!player.comboTimer || typeof player.comboTimer !== 'number') {
    player.comboTimer = now;
    return;
  }

  if (now - player.comboTimer > GAMEPLAY_CONSTANTS.COMBO_TIMEOUT) {
    const oldCombo = player.combo;
    player.combo = 0;
    player.comboTimer = 0;

    if (oldCombo > (player.highestCombo || 0)) {
      player.highestCombo = oldCombo;
    }

    io.to(playerId).emit('comboReset', {
      previousCombo: oldCombo,
      wasHighest: oldCombo === player.highestCombo
    });
  }
}

/**
 * Update player health regeneration with lag compensation (max 3 missed ticks)
 */
function updatePlayerRegeneration(player, now, _deltaMultiplier = 1) {
  if (player.regeneration <= 0) {
    return;
  }

  if (!player.lastRegenTick) {
    player.lastRegenTick = now;
  }

  const timeSinceLastRegen = now - player.lastRegenTick;
  if (timeSinceLastRegen < GAMEPLAY_CONSTANTS.REGENERATION_TICK_INTERVAL) {
    return;
  }

  const missedTicks = Math.floor(
    timeSinceLastRegen / GAMEPLAY_CONSTANTS.REGENERATION_TICK_INTERVAL
  );
  const ticksToApply = Math.min(missedTicks, 3);
  const healAmount = player.regeneration * ticksToApply;

  player.health = Math.min(player.health + healAmount, player.maxHealth);
  player.lastRegenTick = now;
}

module.exports = { updatePlayers, updatePlayerTimers, updatePlayerRegeneration };
