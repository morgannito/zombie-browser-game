/**
 * @fileoverview Hazard Management System
 * @description Gère les zones de danger (lava, meteors, ice spikes, lightning, toxic pools)
 */

const { createParticles } = require('../../lootFunctions');
const { distance } = require('../../utilityFunctions');
const ConfigManager = require('../../../lib/server/ConfigManager');

const { CONFIG } = ConfigManager;

// Max simultaneous hazards to cap memory (6: total cap across both lists)
const MAX_HAZARDS = 20;
const MAX_TOXIC_POOLS = 10;

// Deterministic stacking priority (higher index = overrides lower)
const HAZARD_PRIORITY = { iceSpike: 0, lavaPool: 1, voidRift: 2, meteor: 3, lightning: 4 };

/**
 * @typedef {'meteor'|'iceSpike'|'lightning'|'lavaPool'|'voidRift'} HazardType
 */

/**
 * @typedef {Object} Hazard
 * @property {HazardType} type - Hazard type identifier
 * @property {number} x - Center X position (clamped to arena)
 * @property {number} y - Center Y position (clamped to arena)
 * @property {number} radius - Damage radius in pixels
 * @property {number} damage - Damage per tick
 * @property {number} createdAt - Epoch ms of creation
 * @property {number} duration - Lifetime in ms
 * @property {number} damageInterval - Min ms between damage ticks (default 500)
 * @property {number} [lastDamageTick] - Epoch ms of last damage application
 * @property {number} [lastParticle] - Epoch ms of last particle emission
 */

/**
 * @typedef {Object} ToxicPool
 * @property {string} id - Unique pool ID (`toxic_<ts>_<rand>`)
 * @property {number} x - Center X position
 * @property {number} y - Center Y position
 * @property {number} radius - Damage radius
 * @property {number} damage - Full damage value (actual tick damage = damage/2)
 * @property {number} createdAt - Epoch ms of creation
 * @property {number} duration - Lifetime in ms
 */

class HazardManager {
  /**
   * @param {Object} gameState - Shared game state
   * @param {Object} entityManager - Entity manager for particle creation
   */
  constructor(gameState, entityManager) {
    this.gameState = gameState;
    this.entityManager = entityManager;
  }

  /** Initialize hazards arrays */
  initialize() {
    this.gameState.hazards = this.gameState.hazards || [];
    this.gameState.toxicPools = this.gameState.toxicPools || [];
  }

  /**
   * Update all hazards — apply damage and clean up expired entries.
   * @param {number} now - Current epoch ms (Date.now())
   */
  update(now) {
    this.updateHazards(now);
    this.updateToxicPools(now);
  }

  /** Quick check: any players or zombies alive in the arena */
  _hasActiveEntities() {
    const players = this.gameState.players;
    for (const id in players) {
      if (players[id].alive) {
        return true;
      }
    }
    const zombies = this.gameState.zombies;
    for (const id in zombies) {
      if (zombies[id].alive) {
        return true;
      }
    }
    return false;
  }

  /** Collect alive players as array (single allocation per hazard tick) */
  _alivePlayers() {
    const result = [];
    const players = this.gameState.players;
    for (const id in players) {
      const p = players[id];
      if (p.alive && !p.spawnProtection && !p.invisible) {
result.push(p);
}
    }
    return result;
  }

  /** Update generic hazards (meteors, ice spikes, lightning, etc.) */
  updateHazards(now) {
    if (!this.gameState.hazards) {
return;
}

    // Batch: collect alive players once (skip damage pass if empty)
    const hasEntities = this._hasActiveEntities();
    const alivePlayers = hasEntities ? this._alivePlayers() : [];

    for (let i = this.gameState.hazards.length - 1; i >= 0; i--) {
      const hazard = this.gameState.hazards[i];

      if (now >= hazard.createdAt + hazard.duration) {
        this.gameState.hazards.splice(i, 1);
        continue;
      }

      if (!hasEntities) {
continue;
} // skip damage/particle work, expiry already handled

      const damageInterval = hazard.damageInterval || 500;
      const canDamage = !hazard.lastDamageTick || now - hazard.lastDamageTick >= damageInterval;
      const color = this.getHazardColor(hazard.type);

      // Single pass: all affected players in one loop
      if (canDamage) {
        let hit = false;
        for (const player of alivePlayers) {
          if (!player.alive) continue; // skip players killed earlier this frame
          if (distance(hazard.x, hazard.y, player.x, player.y) < hazard.radius) {
            player.lastKillerType = hazard.type || 'hazard';
            player.health -= hazard.damage;
            createParticles(player.x, player.y, color, 5, this.entityManager);
            if (player.health <= 0) {
              player.alive = false; player.deaths++;
            }
            hit = true;
          }
        }
        if (hit) {
hazard.lastDamageTick = now;
}
      }

      if (!hazard.lastParticle || now - hazard.lastParticle >= 200) {
        hazard.lastParticle = now;
        createParticles(hazard.x, hazard.y, color, 3, this.entityManager);
      }
    }
  }

  /** Update toxic pools (boss abilities) */
  updateToxicPools(now) {
    if (!this.gameState.toxicPools) {
return;
}

    const hasEntities = this._hasActiveEntities();
    const alivePlayers = hasEntities ? this._alivePlayers() : [];

    for (let i = this.gameState.toxicPools.length - 1; i >= 0; i--) {
      const pool = this.gameState.toxicPools[i];

      if (now >= pool.createdAt + pool.duration) {
        this.gameState.toxicPools.splice(i, 1);
        continue;
      }

      if (!hasEntities) {
continue;
}

      const canDamage = !pool.lastDamageTick || now - pool.lastDamageTick >= 500;

      if (canDamage) {
        let hit = false;
        for (const player of alivePlayers) {
          if (!player.alive) continue; // skip players killed earlier this frame
          if (distance(pool.x, pool.y, player.x, player.y) < pool.radius) {
            player.lastKillerType = 'hazard';
            player.health -= pool.damage / 2;
            createParticles(player.x, player.y, '#00ff00', 4, this.entityManager);
            if (player.health <= 0) {
              player.alive = false; player.deaths++;
            }
            hit = true;
          }
        }
        if (hit) {
pool.lastDamageTick = now;
}
      }

      if (!pool.lastParticle || now - pool.lastParticle >= 300) {
        pool.lastParticle = now;
        createParticles(pool.x, pool.y, '#00ff00', 5, this.entityManager);
      }
    }
  }

  /**
   * Get the particle color for a hazard type.
   * @param {HazardType} type
   * @returns {string} CSS hex color string
   */
  getHazardColor(type) {
    const colors = {
      meteor: '#ff0000',
      iceSpike: '#00bfff',
      lightning: '#ffff00',
      lavaPool: '#ff4500',
      voidRift: '#9400d3'
    };
    return colors[type] || '#ffffff';
  }

  /**
   * Clamp a spawn position to arena bounds with a margin equal to the radius.
   * Prevents hazards from spawning partially or fully inside walls.
   * @param {number} x - Raw X coordinate
   * @param {number} y - Raw Y coordinate
   * @param {number} margin - Exclusion margin (typically the hazard radius)
   * @returns {{x: number, y: number}} Clamped position
   */
  _clampSpawn(x, y, margin) {
    const w = CONFIG.ROOM_WIDTH || 2000;
    const h = CONFIG.ROOM_HEIGHT || 2000;
    return {
      x: Math.max(margin, Math.min(x, w - margin)),
      y: Math.max(margin, Math.min(y, h - margin))
    };
  }

  /**
   * Create a hazard zone, enforcing MAX_HAZARDS cap with priority-based eviction.
   * Position is clamped to arena bounds to prevent wall-spawn bugs.
   * @param {HazardType} type
   * @param {number} x - Requested X (will be clamped)
   * @param {number} y - Requested Y (will be clamped)
   * @param {number} radius - Hazard radius in px
   * @param {number} damage - Damage per tick
   * @param {number} duration - Lifetime in ms
   * @returns {Hazard|null} Created hazard, or null if eviction was impossible
   */
  createHazard(type, x, y, radius, damage, duration) {
    this.gameState.hazards = this.gameState.hazards || [];
    const clamped = this._clampSpawn(x, y, radius);
    x = clamped.x;
    y = clamped.y;

    if (this.gameState.hazards.length >= MAX_HAZARDS) {
      // Evict oldest lowest-priority hazard to make room
      const incomingPrio = HAZARD_PRIORITY[type] ?? -1;
      let evictIdx = -1;
      let lowestPrio = incomingPrio;
      for (let i = 0; i < this.gameState.hazards.length; i++) {
        const p = HAZARD_PRIORITY[this.gameState.hazards[i].type] ?? -1;
        if (p <= lowestPrio) {
 lowestPrio = p; evictIdx = i;
}
      }
      if (evictIdx === -1) {
return null;
} // all existing are higher priority, skip
      this.gameState.hazards.splice(evictIdx, 1);
    }

    const hazard = {
      type, x, y, radius, damage,
      createdAt: Date.now(),
      duration,
      damageInterval: 500
    };
    this.gameState.hazards.push(hazard);
    createParticles(x, y, this.getHazardColor(type), 20, this.entityManager);
    return hazard;
  }

  /** Create toxic pool — enforces MAX_TOXIC_POOLS cap */
  createToxicPool(x, y, radius, damage, duration) {
    this.gameState.toxicPools = this.gameState.toxicPools || [];
    const clamped = this._clampSpawn(x, y, radius);
    x = clamped.x;
    y = clamped.y;

    if (this.gameState.toxicPools.length >= MAX_TOXIC_POOLS) {
      // Evict oldest (index 0 is oldest since we push to end)
      this.gameState.toxicPools.shift();
    }

    const pool = {
      id: `toxic_${Date.now()}_${Math.random()}`,
      x, y, radius, damage,
      createdAt: Date.now(),
      duration
    };
    this.gameState.toxicPools.push(pool);
    createParticles(x, y, '#00ff00', 25, this.entityManager);
    return pool;
  }

  /** Clear all hazards */
  clearAll() {
    this.gameState.hazards = [];
    this.gameState.toxicPools = [];
  }

  /** Get hazard count */
  getCount() {
    const hazards = (this.gameState.hazards || []).length;
    const pools = (this.gameState.toxicPools || []).length;
    return { hazards, pools, total: hazards + pools };
  }
}

module.exports = HazardManager;
