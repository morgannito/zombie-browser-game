/**
 * @fileoverview Player utility functions
 * @description Common player state checks and utility functions to reduce code duplication
 */

/**
 * Check if a player is vulnerable to attacks
 * @param {Object} player - Player object
 * @returns {boolean} True if player can be attacked
 */
function isPlayerVulnerable(player) {
  return (
    player &&
    player.alive &&
    player.hasNickname &&
    !player.spawnProtection &&
    !player.invisible
  );
}

/**
 * Check if a player is active and has a nickname
 * @param {Object} player - Player object
 * @returns {boolean} True if player is active
 */
function isPlayerActive(player) {
  return player && player.alive && player.hasNickname;
}

/**
 * Check if a player can perform actions
 * @param {Object} player - Player object
 * @returns {boolean} True if player can act
 */
function canPlayerAct(player) {
  return player && player.alive && player.hasNickname && !player.invisible;
}

/**
 * Update player's last activity timestamp
 * @param {Object} player - Player object
 */
function updatePlayerActivity(player) {
  if (player) {
    player.lastActivityTime = Date.now();
  }
}

/**
 * Get player identifier (nickname or socket ID)
 * @param {Object} player - Player object
 * @param {string} socketId - Socket ID fallback
 * @returns {string} Player identifier
 */
function getPlayerIdentifier(player, socketId) {
  return player?.nickname || socketId || 'Unknown';
}

/**
 * Check if player has enough gold for a purchase
 * @param {Object} player - Player object
 * @param {number} cost - Cost of the item
 * @returns {boolean} True if player can afford
 */
function canAfford(player, cost) {
  return player && player.gold >= cost;
}

/**
 * Deduct gold from player
 * @param {Object} player - Player object
 * @param {number} amount - Amount to deduct
 * @returns {boolean} True if deduction was successful
 */
function deductGold(player, amount) {
  if (canAfford(player, amount)) {
    player.gold -= amount;
    return true;
  }
  return false;
}

/**
 * Add gold to player
 * @param {Object} player - Player object
 * @param {number} amount - Amount to add
 */
function addGold(player, amount) {
  if (player && amount > 0) {
    player.gold = (player.gold || 0) + amount;
  }
}

module.exports = {
  isPlayerVulnerable,
  isPlayerActive,
  canPlayerAct,
  updatePlayerActivity,
  getPlayerIdentifier,
  canAfford,
  deductGold,
  addGold
};
