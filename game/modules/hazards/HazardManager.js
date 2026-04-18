/**
 * @fileoverview Hazard Management System
 * @description Gère les zones de danger (lava, meteors, ice spikes, lightning, toxic pools)
 */

const { createParticles } = require('../../lootFunctions');
const { distance } = require('../../utilityFunctions');

// Max simultaneous hazards to cap memory (6: total cap across both lists)
const MAX_HAZARDS = 20;
const MAX_TOXIC_POOLS = 10;

// Deterministic stacking priority (higher index = overrides lower)
const HAZARD_PRIORITY = { iceSpike: 0, lavaPool: 1, voidRift: 2, meteor: 3, lightning: 4 };

class HazardManager {
  constructor(gameState, entityManager) {
    this.gameState = gameState;
    this.entityManager = entityManager;
  }

  /** Initialize hazards arrays */
  initialize() {
    this.gameState.hazards = this.gameState.hazards || [];
    this.gameState.toxicPools = this.gameState.toxicPools || [];
  }

  /** Update all hazards (apply damage, cleanup expired) */
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
      return true;
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

  /** Get hazard color based on type */
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
   * Create hazard zone — enforces MAX_HAZARDS cap + deterministic stacking.
   * If cap reached: evicts the lowest-priority hazard of the same type, or skips.
   */
  createHazard(type, x, y, radius, damage, duration) {
    this.gameState.hazards = this.gameState.hazards || [];

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
