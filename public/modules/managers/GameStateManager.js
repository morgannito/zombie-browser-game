/**
 * GAME STATE MANAGER
 * Manages global game state, entity tracking, and debug features
 * @module GameStateManager
 * @author Claude Code
 * @version 2.0.0
 */

class GameStateManager {
  constructor() {
    this.playerId = null;
    this.state = {
      players: {},
      zombies: {},
      bullets: {},
      powerups: {},
      particles: {},
      loot: {},
      walls: [],
      currentRoom: 0,
      totalRooms: 5,
      doors: []
    };
    this.config = {
      ROOM_WIDTH: 3000,
      ROOM_HEIGHT: 2400,
      PLAYER_SIZE: 20,
      ZOMBIE_SIZE: 25,
      POWERUP_SIZE: 15,
      LOOT_SIZE: 10
    };
    this.weapons = {};
    this.powerupTypes = {};
    this.zombieTypes = {};
    this.shopItems = {};

    // Visual interpolation system for smooth movement
    this.interpolation = {
      enabled: true,
      factor: 0.15, // Interpolation speed (0 = instant, 1 = no interpolation) - Reduced for snappier movement
      previousPositions: {
        zombies: {},
        players: {},
        bullets: {}
      }
    };

    // Timestamp for state updates (to detect stale states)
    this.lastUpdateTimestamp = Date.now();

    // Debug mode (toggle with 'D' key)
    this.debugMode = false;
    this.debugStats = {
      entitiesCount: {},
      networkLatency: 0,
      lastUpdate: 0
    };
  }

  updateState(newState) {
    this.state = newState;
    this.lastUpdateTimestamp = Date.now();
  }

  getPlayer() {
    return this.state.players[this.playerId];
  }

  initialize(data) {
    this.playerId = data.playerId;
    this.config = data.config;
    this.weapons = data.weapons;
    this.powerupTypes = data.powerupTypes;
    this.zombieTypes = data.zombieTypes;
    this.shopItems = data.shopItems;
  }

  /**
   * Apply visual interpolation to entities for smooth movement
   * Call this in the render loop, not in network handlers
   */
  applyInterpolation() {
    if (!this.interpolation.enabled) return;

    const factor = this.interpolation.factor;
    const prev = this.interpolation.previousPositions;

    // Interpolate zombies (not local player)
    for (const [id, zombie] of Object.entries(this.state.zombies)) {
      if (prev.zombies[id]) {
        // Smooth interpolation
        zombie.x += (prev.zombies[id].x - zombie.x) * factor;
        zombie.y += (prev.zombies[id].y - zombie.y) * factor;
      }
      prev.zombies[id] = { x: zombie.x, y: zombie.y };
    }

    // Interpolate other players (not local player)
    for (const [id, player] of Object.entries(this.state.players)) {
      if (id !== this.playerId && prev.players[id]) {
        player.x += (prev.players[id].x - player.x) * factor;
        player.y += (prev.players[id].y - player.y) * factor;
      }
      prev.players[id] = { x: player.x, y: player.y };
    }

    // Bullets move too fast for interpolation, skip them
  }

  /**
   * Clean up orphaned entities that no longer exist on server
   * Entities that haven't been updated in > 3 seconds are removed
   */
  cleanupOrphanedEntities() {
    const now = Date.now();
    const ORPHAN_TIMEOUT = 3000; // 3 seconds

    // Mark entities with last seen timestamp
    ['zombies', 'bullets', 'particles', 'powerups', 'loot', 'explosions', 'poisonTrails'].forEach(type => {
      if (!this.state[type]) return;

      for (const [id, entity] of Object.entries(this.state[type])) {
        if (!entity._lastSeen) {
          entity._lastSeen = now;
        }

        // Remove if not updated recently
        if (now - entity._lastSeen > ORPHAN_TIMEOUT) {
          console.log(`[CLEANUP] Removing orphaned ${type} entity:`, id);
          delete this.state[type][id];

          // Clean interpolation cache
          if (this.interpolation.previousPositions[type]) {
            delete this.interpolation.previousPositions[type][id];
          }
        }
      }
    });
  }

  /**
   * Mark entity as seen (called when receiving server update)
   */
  markEntitySeen(type, id) {
    if (this.state[type] && this.state[type][id]) {
      this.state[type][id]._lastSeen = Date.now();
    }
  }

  /**
   * Update debug statistics
   */
  updateDebugStats() {
    this.debugStats.entitiesCount = {
      players: Object.keys(this.state.players).length,
      zombies: Object.keys(this.state.zombies).length,
      bullets: Object.keys(this.state.bullets).length,
      particles: Object.keys(this.state.particles || {}).length,
      powerups: Object.keys(this.state.powerups || {}).length,
      loot: Object.keys(this.state.loot || {}).length
    };
    this.debugStats.lastUpdate = Date.now() - this.lastUpdateTimestamp;
  }

  /**
   * Toggle debug mode
   */
  toggleDebug() {
    this.debugMode = !this.debugMode;
    console.log('[DEBUG] Debug mode:', this.debugMode ? 'ENABLED' : 'DISABLED');
  }
}

// Export to window
window.GameStateManager = GameStateManager;
