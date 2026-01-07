/**
 * ENTITY MANAGER - Gestion des entités avec Object Pooling
 * Gère la création et destruction d'entités en utilisant les pools d'objets
 * Gain: -50-60% garbage collection
 * @version 1.0.0
 */

const ObjectPool = require('../ObjectPool');

class EntityManager {
  constructor(gameState, config) {
    this.gameState = gameState;
    this.config = config;

    // Initialiser les Object Pools
    this.bulletPool = new ObjectPool(
      () => ({
        id: 0,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        playerId: null,
        zombieId: null,
        damage: 0,
        color: '#ffff00',
        piercing: 0,
        piercedZombies: [],
        explosiveRounds: false,
        explosionRadius: 0,
        explosionDamagePercent: 0,
        rocketExplosionDamage: 0,
        isAutoTurret: false,
        isRocket: false,
        isZombieBullet: false,
        isFlame: false,
        isLaser: false,
        isGrenade: false,
        isCrossbow: false,
        gravity: 0,
        lifetime: null
      }),
      (bullet) => {
        bullet.vx = 0;
        bullet.vy = 0;
        bullet.playerId = null;
        bullet.zombieId = null;
        bullet.damage = 0;
        bullet.piercing = 0;
        // Vider le tableau piercedZombies
        if (bullet.piercedZombies) {
          bullet.piercedZombies.length = 0;
        }
        bullet.explosiveRounds = false;
        bullet.explosionRadius = 0;
        bullet.explosionDamagePercent = 0;
        bullet.rocketExplosionDamage = 0;
        bullet.isAutoTurret = false;
        bullet.isRocket = false;
        bullet.isZombieBullet = false;
        bullet.isFlame = false;
        bullet.isLaser = false;
        bullet.isGrenade = false;
        bullet.isCrossbow = false;
        bullet.gravity = 0;
        bullet.lifetime = null;
      },
      200 // Taille initiale
    );

    this.particlePool = new ObjectPool(
      () => ({
        id: 0,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        color: '#ffffff',
        lifetime: 0,
        size: 3
      }),
      (particle) => {
        particle.vx = 0;
        particle.vy = 0;
        particle.lifetime = 0;
      },
      500 // Beaucoup de particules
    );

    this.poisonTrailPool = new ObjectPool(
      () => ({
        id: 0,
        x: 0,
        y: 0,
        radius: 0,
        damage: 0,
        duration: 0,
        createdAt: 0
      }),
      (trail) => {
        trail.radius = 0;
        trail.damage = 0;
      },
      100
    );

    this.explosionPool = new ObjectPool(
      () => ({
        id: 0,
        x: 0,
        y: 0,
        radius: 0,
        isRocket: false,
        createdAt: 0,
        duration: 400
      }),
      (explosion) => {
        explosion.radius = 0;
        explosion.isRocket = false;
      },
      50
    );
  }

  /**
   * Créer une balle avec le pool
   * @param {Object} params - Paramètres de la balle
   * @returns {Object} La balle créée
   */
  createBullet(params) {
    const bullet = this.bulletPool.acquire();
    bullet.id = this.gameState.nextBulletId++;
    bullet.x = params.x;
    bullet.y = params.y;
    bullet.vx = params.vx;
    bullet.vy = params.vy;
    bullet.playerId = params.playerId || null;
    bullet.zombieId = params.zombieId || null;
    bullet.damage = params.damage;
    bullet.color = params.color || '#ffff00';
    bullet.size = params.size || this.config.BULLET_SIZE;
    bullet.piercing = params.piercing || 0;
    // OPTIMISATION: Vider le tableau existant au lieu d'en créer un nouveau
    if (!bullet.piercedZombies) {
      bullet.piercedZombies = [];
    } else {
      bullet.piercedZombies.length = 0;
    }
    bullet.explosiveRounds = params.explosiveRounds || false;
    bullet.explosionRadius = params.explosionRadius || 0;
    bullet.explosionDamagePercent = params.explosionDamagePercent || 0;
    bullet.rocketExplosionDamage = params.rocketExplosionDamage || 0;
    bullet.isAutoTurret = params.isAutoTurret || false;
    bullet.isRocket = params.isRocket || false;
    bullet.isZombieBullet = params.isZombieBullet || false;

    // Propriétés spéciales des armes
    bullet.isFlame = params.isFlame || false;
    bullet.isLaser = params.isLaser || false;
    bullet.isGrenade = params.isGrenade || false;
    bullet.isCrossbow = params.isCrossbow || false;
    bullet.gravity = params.gravity || 0;
    bullet.lifetime = params.lifetime || null;
    bullet.createdAt = params.createdAt || Date.now();

    this.gameState.bullets[bullet.id] = bullet;
    return bullet;
  }

  /**
   * Détruire une balle et la remettre dans le pool
   * @param {number|string} bulletId
   */
  destroyBullet(bulletId) {
    const bullet = this.gameState.bullets[bulletId];
    if (bullet) {
      this.bulletPool.release(bullet);
      delete this.gameState.bullets[bulletId];
    }
  }

  /**
   * Créer des particules avec le pool
   * @param {number} x
   * @param {number} y
   * @param {string} color
   * @param {number} count
   */
  createParticles(x, y, color, count = 10) {
    // PERFORMANCE: Limite hard à 200 particules actives max
    const currentParticleCount = Object.keys(this.gameState.particles).length;
    const MAX_PARTICLES = 200;

    if (currentParticleCount >= MAX_PARTICLES) {
      // Détruire les particules les plus anciennes
      const particleIds = Object.keys(this.gameState.particles);
      const oldestId = particleIds[0];
      if (oldestId) {
        this.destroyParticle(oldestId);
      }
    }

    // Réduire count si nécessaire
    const allowedCount = Math.min(count, MAX_PARTICLES - currentParticleCount);

    for (let i = 0; i < allowedCount; i++) {
      const particle = this.particlePool.acquire();
      particle.id = this.gameState.nextParticleId++;
      particle.x = x;
      particle.y = y;

      // Vélocité aléatoire
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed;

      particle.color = color;
      particle.lifetime = Date.now() + 500; // Expire après 500ms
      particle.size = Math.random() * 3 + 2;

      this.gameState.particles[particle.id] = particle;
    }
  }

  /**
   * Détruire une particule et la remettre dans le pool
   * @param {number|string} particleId
   */
  destroyParticle(particleId) {
    const particle = this.gameState.particles[particleId];
    if (particle) {
      this.particlePool.release(particle);
      delete this.gameState.particles[particleId];
    }
  }

  /**
   * Créer une traînée de poison avec le pool
   * @param {Object} params
   * @returns {Object} La traînée créée
   */
  createPoisonTrail(params) {
    const trail = this.poisonTrailPool.acquire();
    trail.id = this.gameState.nextPoisonTrailId++;
    trail.x = params.x;
    trail.y = params.y;
    trail.radius = params.radius;
    trail.damage = params.damage;
    trail.duration = params.duration;
    trail.createdAt = params.createdAt;

    this.gameState.poisonTrails[trail.id] = trail;
    return trail;
  }

  /**
   * Détruire une traînée de poison
   * CORRECTION: Nettoyer aussi le tracking des dégâts dans les joueurs
   * @param {number|string} trailId
   */
  destroyPoisonTrail(trailId) {
    const trail = this.gameState.poisonTrails[trailId];
    if (trail) {
      // CORRECTION: Nettoyer le tracking de dégâts pour cette trail dans tous les joueurs
      for (let playerId in this.gameState.players) {
        const player = this.gameState.players[playerId];
        if (player.lastPoisonDamageByTrail && player.lastPoisonDamageByTrail[trailId]) {
          delete player.lastPoisonDamageByTrail[trailId];
        }
      }

      this.poisonTrailPool.release(trail);
      delete this.gameState.poisonTrails[trailId];
    }
  }

  /**
   * Créer une explosion avec le pool
   * @param {Object} params
   * @returns {Object} L'explosion créée
   */
  createExplosion(params) {
    const explosion = this.explosionPool.acquire();
    explosion.id = this.gameState.nextExplosionId++;
    explosion.x = params.x;
    explosion.y = params.y;
    explosion.radius = params.radius;
    explosion.isRocket = params.isRocket || false;
    explosion.createdAt = params.createdAt;
    explosion.duration = params.duration || 400;

    this.gameState.explosions[explosion.id] = explosion;
    return explosion;
  }

  /**
   * Détruire une explosion
   * @param {number|string} explosionId
   */
  destroyExplosion(explosionId) {
    const explosion = this.gameState.explosions[explosionId];
    if (explosion) {
      this.explosionPool.release(explosion);
      delete this.gameState.explosions[explosionId];
    }
  }

  /**
   * Nettoyer les entités expirées
   * @param {number} now - Timestamp actuel
   */
  cleanupExpiredEntities(now) {
    // Nettoyer les particules expirées
    for (let particleId in this.gameState.particles) {
      const particle = this.gameState.particles[particleId];
      if (now > particle.lifetime) {
        this.destroyParticle(particleId);
      }
    }

    // Nettoyer les explosions expirées
    for (let explosionId in this.gameState.explosions) {
      const explosion = this.gameState.explosions[explosionId];
      if (now - explosion.createdAt > explosion.duration) {
        this.destroyExplosion(explosionId);
      }
    }

    // Nettoyer les traînées de poison expirées
    for (let trailId in this.gameState.poisonTrails) {
      const trail = this.gameState.poisonTrails[trailId];
      if (now - trail.createdAt > trail.duration) {
        this.destroyPoisonTrail(trailId);
      }
    }
  }

  /**
   * Obtenir les stats des pools
   * @returns {Object} Stats de tous les pools
   */
  getPoolStats() {
    return {
      bullets: this.bulletPool.getStats(),
      particles: this.particlePool.getStats(),
      poisonTrails: this.poisonTrailPool.getStats(),
      explosions: this.explosionPool.getStats()
    };
  }
}

module.exports = EntityManager;
