/**
 * Destructible Obstacles System
 * Crates, barrels, and other breakable environment objects
 */

class DestructibleObstaclesSystem {
  constructor() {
    this.obstacles = new Map(); // Map of obstacle ID to obstacle object
    this.nextId = 1;

    // Obstacle type definitions
    this.obstacleTypes = {
      crate: {
        name: 'Caisse en Bois',
        health: 50,
        width: 40,
        height: 40,
        color: '#8B4513',
        icon: '📦',
        lootChance: 0.6,
        lootTable: ['health', 'gold', 'ammo'],
        destructionParticles: 10,
        particleColor: '#A0522D'
      },
      barrel: {
        name: 'Tonneau',
        health: 75,
        width: 35,
        height: 45,
        color: '#4A4A4A',
        icon: '🛢️',
        lootChance: 0.4,
        lootTable: ['gold', 'explosive'],
        explosive: true,
        explosionRadius: 100,
        explosionDamage: 50,
        destructionParticles: 15,
        particleColor: '#FF6600'
      },
      metalCrate: {
        name: 'Caisse Métallique',
        health: 150,
        width: 45,
        height: 45,
        color: '#708090',
        icon: '🗃️',
        lootChance: 0.8,
        lootTable: ['weapon', 'gold', 'ammo'],
        destructionParticles: 12,
        particleColor: '#A9A9A9'
      },
      vase: {
        name: 'Vase',
        health: 20,
        width: 25,
        height: 30,
        color: '#CD853F',
        icon: '🏺',
        lootChance: 0.3,
        lootTable: ['gold'],
        destructionParticles: 8,
        particleColor: '#DAA520'
      },
      tire: {
        name: 'Pneu',
        health: 40,
        width: 35,
        height: 15,
        color: '#1A1A1A',
        icon: '⭕',
        lootChance: 0.2,
        lootTable: ['gold'],
        destructionParticles: 6,
        particleColor: '#000000'
      }
    };
  }

  /**
   * Spawn obstacles on the map
   * @param {number} mapWidth - Map width
   * @param {number} mapHeight - Map height
   * @param {number} count - Number of obstacles to spawn
   */
  spawnObstacles(mapWidth, mapHeight, count = 50) {
    const types = Object.keys(this.obstacleTypes);
    const margin = 100;

    for (let i = 0; i < count; i++) {
      const typeKey = types[Math.floor(Math.random() * types.length)];
      const type = this.obstacleTypes[typeKey];

      // Random position, avoiding center spawn area
      let x, y;
      do {
        x = margin + Math.random() * (mapWidth - margin * 2);
        y = margin + Math.random() * (mapHeight - margin * 2);
      } while (this.isNearCenter(x, y, mapWidth, mapHeight, 200));

      this.createObstacle(typeKey, x, y);
    }
  }

  isNearCenter(x, y, mapWidth, mapHeight, radius) {
    const centerX = mapWidth / 2;
    const centerY = mapHeight / 2;
    const dx = x - centerX;
    const dy = y - centerY;
    return Math.sqrt(dx * dx + dy * dy) < radius;
  }

  /**
   * Create an obstacle
   * @param {string} typeKey - Type of obstacle
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {object} Created obstacle
   */
  createObstacle(typeKey, x, y) {
    const type = this.obstacleTypes[typeKey];
    if (!type) return null;

    const obstacle = {
      id: this.nextId++,
      type: typeKey,
      x,
      y,
      width: type.width,
      height: type.height,
      health: type.health,
      maxHealth: type.health,
      destroyed: false,
      ...type
    };

    this.obstacles.set(obstacle.id, obstacle);
    return obstacle;
  }

  /**
   * Handle bullet collision with obstacles
   * @param {object} bullet - Bullet object
   * @returns {object|null} Hit obstacle if any
   */
  checkBulletCollision(bullet) {
    for (const [id, obstacle] of this.obstacles) {
      if (obstacle.destroyed) continue;

      // Simple AABB collision
      if (
        bullet.x >= obstacle.x - obstacle.width / 2 &&
        bullet.x <= obstacle.x + obstacle.width / 2 &&
        bullet.y >= obstacle.y - obstacle.height / 2 &&
        bullet.y <= obstacle.y + obstacle.height / 2
      ) {
        return obstacle;
      }
    }
    return null;
  }

  /**
   * Damage an obstacle
   * @param {number} obstacleId - Obstacle ID
   * @param {number} damage - Damage amount
   * @returns {object|null} Destruction result if obstacle destroyed
   */
  damageObstacle(obstacleId, damage) {
    const obstacle = this.obstacles.get(obstacleId);
    if (!obstacle || obstacle.destroyed) return null;

    obstacle.health -= damage;

    if (obstacle.health <= 0) {
      return this.destroyObstacle(obstacleId);
    }

    return null;
  }

  /**
   * Destroy an obstacle
   * @param {number} obstacleId - Obstacle ID
   * @returns {object} Destruction result with particles, loot, explosion
   */
  destroyObstacle(obstacleId) {
    const obstacle = this.obstacles.get(obstacleId);
    if (!obstacle || obstacle.destroyed) return null;

    obstacle.destroyed = true;

    const result = {
      x: obstacle.x,
      y: obstacle.y,
      particles: this.generateDestructionParticles(obstacle),
      loot: this.generateLoot(obstacle),
      explosion: obstacle.explosive ? {
        x: obstacle.x,
        y: obstacle.y,
        radius: obstacle.explosionRadius,
        damage: obstacle.explosionDamage
      } : null
    };

    // Remove from active obstacles after a delay (for visual effects)
    setTimeout(() => {
      this.obstacles.delete(obstacleId);
    }, 1000);

    return result;
  }

  generateDestructionParticles(obstacle) {
    const particles = [];
    const count = obstacle.destructionParticles || 10;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: obstacle.x + (Math.random() - 0.5) * obstacle.width,
        y: obstacle.y + (Math.random() - 0.5) * obstacle.height,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        color: obstacle.particleColor || '#666',
        size: 2 + Math.random() * 3,
        lifetime: 30 + Math.random() * 30
      });
    }

    return particles;
  }

  generateLoot(obstacle) {
    if (Math.random() > obstacle.lootChance) return null;

    const lootTable = obstacle.lootTable || [];
    if (lootTable.length === 0) return null;

    const lootType = lootTable[Math.floor(Math.random() * lootTable.length)];

    return {
      type: lootType,
      x: obstacle.x,
      y: obstacle.y
    };
  }

  /**
   * Get all active obstacles
   * @returns {Array} Array of obstacles
   */
  getObstacles() {
    return Array.from(this.obstacles.values()).filter(o => !o.destroyed);
  }

  /**
   * Get obstacle by ID
   * @param {number} id - Obstacle ID
   * @returns {object|null} Obstacle object
   */
  getObstacle(id) {
    return this.obstacles.get(id) || null;
  }

  /**
   * Check if position collides with any obstacle
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} radius - Collision radius
   * @returns {boolean} True if collision
   */
  checkCollision(x, y, radius = 0) {
    for (const obstacle of this.obstacles.values()) {
      if (obstacle.destroyed) continue;

      const dx = x - obstacle.x;
      const dy = y - obstacle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < (obstacle.width / 2 + radius)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Clear all obstacles
   */
  clear() {
    this.obstacles.clear();
    this.nextId = 1;
  }

  /**
   * Reset system
   */
  reset() {
    this.clear();
  }
}

// Export for use in game engine
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DestructibleObstaclesSystem;
}

// Auto-initialize for browser
if (typeof window !== 'undefined') {
  window.DestructibleObstaclesSystem = DestructibleObstaclesSystem;
}
