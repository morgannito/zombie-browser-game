/**
 * @fileoverview Hazard Management System
 * @description Gère les zones de danger (lava, meteors, ice spikes, lightning, toxic pools)
 */

const { createParticles } = require('../../lootFunctions');
const { distance } = require('../../utilityFunctions');

class HazardManager {
  constructor(gameState, entityManager) {
    this.gameState = gameState;
    this.entityManager = entityManager;
  }

  /**
   * Initialize hazards arrays
   */
  initialize() {
    this.gameState.hazards = this.gameState.hazards || [];
    this.gameState.toxicPools = this.gameState.toxicPools || [];
  }

  /**
   * Update all hazards (apply damage, cleanup expired)
   */
  update(now) {
    this.updateHazards(now);
    this.updateToxicPools(now);
  }

  /**
   * Update generic hazards (meteors, ice spikes, lightning, etc.)
   */
  updateHazards(now) {
    if (!this.gameState.hazards) return;

    // Apply damage to players in hazard zones
    for (let i = this.gameState.hazards.length - 1; i >= 0; i--) {
      const hazard = this.gameState.hazards[i];

      // Check if hazard expired
      if (now >= hazard.createdAt + hazard.duration) {
        this.gameState.hazards.splice(i, 1);
        continue;
      }

      // Apply damage to players in radius
      for (let playerId in this.gameState.players) {
        const player = this.gameState.players[playerId];
        if (!player.alive || player.spawnProtection || player.invisible) continue;

        const dist = distance(hazard.x, hazard.y, player.x, player.y);
        if (dist < hazard.radius) {
          // Damage based on hazard type
          const damageInterval = hazard.damageInterval || 500;

          if (!hazard.lastDamageTick || now - hazard.lastDamageTick >= damageInterval) {
            hazard.lastDamageTick = now;

            player.health -= hazard.damage;

            // Visual feedback
            const color = this.getHazardColor(hazard.type);
            createParticles(player.x, player.y, color, 5, this.entityManager);

            if (player.health <= 0) {
              player.alive = false;
              player.deaths++;
            }
          }
        }
      }

      // Visual effects for hazard
      if (!hazard.lastParticle || now - hazard.lastParticle >= 200) {
        hazard.lastParticle = now;
        const color = this.getHazardColor(hazard.type);
        createParticles(hazard.x, hazard.y, color, 3, this.entityManager);
      }
    }
  }

  /**
   * Update toxic pools (boss abilities)
   */
  updateToxicPools(now) {
    if (!this.gameState.toxicPools) return;

    for (let i = this.gameState.toxicPools.length - 1; i >= 0; i--) {
      const pool = this.gameState.toxicPools[i];

      // Check if pool expired
      if (now >= pool.createdAt + pool.duration) {
        this.gameState.toxicPools.splice(i, 1);
        continue;
      }

      // Apply damage to players
      for (let playerId in this.gameState.players) {
        const player = this.gameState.players[playerId];
        if (!player.alive || player.spawnProtection || player.invisible) continue;

        const dist = distance(pool.x, pool.y, player.x, player.y);
        if (dist < pool.radius) {
          if (!pool.lastDamageTick || now - pool.lastDamageTick >= 500) {
            pool.lastDamageTick = now;

            player.health -= pool.damage / 2; // Damage every 0.5s

            createParticles(player.x, player.y, '#00ff00', 4, this.entityManager);

            if (player.health <= 0) {
              player.alive = false;
              player.deaths++;
            }
          }
        }
      }

      // Visual effects
      if (!pool.lastParticle || now - pool.lastParticle >= 300) {
        pool.lastParticle = now;
        createParticles(pool.x, pool.y, '#00ff00', 5, this.entityManager);
      }
    }
  }

  /**
   * Get hazard color based on type
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
   * Create hazard zone
   */
  createHazard(type, x, y, radius, damage, duration) {
    this.gameState.hazards = this.gameState.hazards || [];

    const hazard = {
      type: type,
      x: x,
      y: y,
      radius: radius,
      damage: damage,
      createdAt: Date.now(),
      duration: duration,
      damageInterval: 500 // Default 0.5s damage tick
    };

    this.gameState.hazards.push(hazard);

    // Visual spawn effect
    const color = this.getHazardColor(type);
    createParticles(x, y, color, 20, this.entityManager);

    return hazard;
  }

  /**
   * Create toxic pool
   */
  createToxicPool(x, y, radius, damage, duration) {
    this.gameState.toxicPools = this.gameState.toxicPools || [];

    const pool = {
      id: `toxic_${Date.now()}_${Math.random()}`,
      x: x,
      y: y,
      radius: radius,
      damage: damage,
      createdAt: Date.now(),
      duration: duration
    };

    this.gameState.toxicPools.push(pool);

    createParticles(x, y, '#00ff00', 25, this.entityManager);

    return pool;
  }

  /**
   * Clear all hazards
   */
  clearAll() {
    this.gameState.hazards = [];
    this.gameState.toxicPools = [];
  }

  /**
   * Get hazard count
   */
  getCount() {
    const hazards = (this.gameState.hazards || []).length;
    const pools = (this.gameState.toxicPools || []).length;
    return { hazards, pools, total: hazards + pools };
  }
}

module.exports = HazardManager;
