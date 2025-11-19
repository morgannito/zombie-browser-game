/**
 * COLLISION MANAGER - Gestion des collisions avec Quadtree
 * Utilise le spatial partitioning pour optimiser les recherches
 * Gain: -60-70% calculs de collision (de O(n²) à O(n log n))
 * @version 1.0.0
 */

const Quadtree = require('../Quadtree');
const MathUtils = require('../MathUtils');

class CollisionManager {
  constructor(gameState, config) {
    this.gameState = gameState;
    this.config = config;
    this.quadtree = null;
  }

  /**
   * Reconstruire le quadtree avec toutes les entités
   * À appeler au début de chaque frame
   */
  rebuildQuadtree() {
    // Créer un nouveau quadtree
    this.quadtree = new Quadtree(
      {
        x: 0,
        y: 0,
        width: this.config.ROOM_WIDTH,
        height: this.config.ROOM_HEIGHT
      },
      4, // capacity
      8  // maxDepth
    );

    // Insérer tous les joueurs vivants
    for (let playerId in this.gameState.players) {
      const player = this.gameState.players[playerId];
      if (player.alive && player.hasNickname) {
        this.quadtree.insert({
          ...player,
          type: 'player',
          entityId: playerId
        });
      }
    }

    // Insérer tous les zombies
    for (let zombieId in this.gameState.zombies) {
      const zombie = this.gameState.zombies[zombieId];
      this.quadtree.insert({
        ...zombie,
        type: 'zombie',
        entityId: zombieId
      });
    }
  }

  /**
   * Trouver le zombie le plus proche d'un point (pour tourelles)
   * CORRECTION: Vérifier que le quadtree existe
   * @param {number} x
   * @param {number} y
   * @param {number} maxRange - Portée maximale
   * @returns {Object|null} Le zombie le plus proche ou null
   */
  findClosestZombie(x, y, maxRange = 500) {
    // CORRECTION: Vérifier que le quadtree existe
    if (!this.quadtree) return null;

    const candidates = this.quadtree.queryRadius(x, y, maxRange);

    let closestZombie = null;
    let closestDistanceSq = maxRange * maxRange;

    for (let entity of candidates) {
      if (entity.type === 'zombie') {
        const distSq = MathUtils.distanceSquared(x, y, entity.x, entity.y);
        if (distSq < closestDistanceSq) {
          closestDistanceSq = distSq;
          closestZombie = this.gameState.zombies[entity.entityId];
        }
      }
    }

    return closestZombie;
  }

  /**
   * Trouver le joueur le plus proche d'un zombie
   * CORRECTION: Vérifier que le quadtree existe
   * @param {number} x
   * @param {number} y
   * @param {number} maxRange - Portée maximale (optionnelle)
   * @param {Object} options - Options de filtrage
   * @returns {Object|null} Le joueur le plus proche ou null
   */
  findClosestPlayer(x, y, maxRange = Infinity, options = {}) {
    // CORRECTION: Vérifier que le quadtree existe
    if (!this.quadtree) return null;

    const searchRadius = maxRange === Infinity ?
      Math.max(this.config.ROOM_WIDTH, this.config.ROOM_HEIGHT) :
      maxRange;

    const candidates = this.quadtree.queryRadius(x, y, searchRadius);

    let closestPlayer = null;
    let closestDistanceSq = maxRange * maxRange;

    for (let entity of candidates) {
      if (entity.type === 'player') {
        const player = this.gameState.players[entity.entityId];

        // Filtres optionnels
        // If ignoreSpawnProtection is FALSE/undefined, skip players WITH spawn protection
        // If ignoreSpawnProtection is TRUE, include all players (don't skip)
        if (!options.ignoreSpawnProtection && player.spawnProtection) continue;
        if (!options.ignoreInvisible && player.invisible) continue;
        if (!player.alive || !player.hasNickname) continue;

        const distSq = MathUtils.distanceSquared(x, y, entity.x, entity.y);
        if (distSq < closestDistanceSq) {
          closestDistanceSq = distSq;
          closestPlayer = player;
        }
      }
    }

    return closestPlayer;
  }

  /**
   * Trouver tous les zombies dans un rayon (pour soigneur)
   * CORRECTION: Vérifier que le quadtree existe
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {string} excludeId - ID du zombie à exclure
   * @returns {Array} Liste des zombies dans le rayon
   */
  findZombiesInRadius(x, y, radius, excludeId = null) {
    // CORRECTION: Vérifier que le quadtree existe
    if (!this.quadtree) return [];

    const candidates = this.quadtree.queryRadius(x, y, radius);
    const zombies = [];

    for (let entity of candidates) {
      if (entity.type === 'zombie' && entity.entityId !== excludeId) {
        zombies.push(this.gameState.zombies[entity.entityId]);
      }
    }

    return zombies;
  }

  /**
   * Trouver tous les joueurs dans un rayon (pour ralentisseur)
   * CORRECTION: Vérifier que le quadtree existe
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @returns {Array} Liste des joueurs dans le rayon
   */
  findPlayersInRadius(x, y, radius) {
    // CORRECTION: Vérifier que le quadtree existe
    if (!this.quadtree) return [];

    const candidates = this.quadtree.queryRadius(x, y, radius);
    const players = [];

    for (let entity of candidates) {
      if (entity.type === 'player') {
        const player = this.gameState.players[entity.entityId];
        if (player.alive) {
          players.push(player);
        }
      }
    }

    return players;
  }

  /**
   * Détecter les collisions balles-zombies (optimisé)
   * CORRECTION: Vérifier que le quadtree existe
   * @param {Object} bullet
   * @returns {Array} Zombies touchés avec leur ID: [{id, zombie}]
   */
  checkBulletZombieCollisions(bullet) {
    // CORRECTION: Vérifier que le quadtree existe
    if (!this.quadtree) return [];

    const candidates = this.quadtree.queryRadius(
      bullet.x,
      bullet.y,
      this.config.ZOMBIE_SIZE + this.config.BULLET_SIZE
    );

    const hitZombies = [];

    for (let entity of candidates) {
      if (entity.type === 'zombie') {
        const zombie = this.gameState.zombies[entity.entityId];

        // CORRECTION: Vérifier que le zombie existe toujours (peut avoir été supprimé)
        if (!zombie) continue;

        // Vérifier collision avec distance carrée
        if (MathUtils.circleCollision(
          bullet.x, bullet.y, this.config.BULLET_SIZE,
          zombie.x, zombie.y, this.config.ZOMBIE_SIZE
        )) {
          hitZombies.push({ id: entity.entityId, zombie });
        }
      }
    }

    return hitZombies;
  }

  /**
   * Détecter les collisions zombie-joueurs (optimisé)
   * @returns {Array} Tableau de {zombie, player} pour chaque collision
   */
  checkZombiePlayerCollisions() {
    const collisions = [];

    for (let zombieId in this.gameState.zombies) {
      const zombie = this.gameState.zombies[zombieId];

      // Chercher les joueurs proches
      const nearbyPlayers = this.findPlayersInRadius(
        zombie.x,
        zombie.y,
        this.config.ZOMBIE_SIZE + this.config.PLAYER_SIZE + 5
      );

      for (let player of nearbyPlayers) {
        // Ignorer si protection active
        if (player.spawnProtection || player.invisible) continue;

        // Vérifier collision exacte
        if (MathUtils.circleCollision(
          zombie.x, zombie.y, this.config.ZOMBIE_SIZE,
          player.x, player.y, this.config.PLAYER_SIZE
        )) {
          collisions.push({ zombie, player });
        }
      }
    }

    return collisions;
  }

  /**
   * Vérifier si un point est hors des limites
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isOutOfBounds(x, y) {
    const wallThickness = this.config.WALL_THICKNESS;
    return (
      x < wallThickness ||
      x > this.config.ROOM_WIDTH - wallThickness ||
      y < wallThickness ||
      y > this.config.ROOM_HEIGHT - wallThickness
    );
  }

  /**
   * Obtenir les stats du quadtree
   * @returns {Object}
   */
  getQuadtreeStats() {
    return {
      size: this.quadtree ? this.quadtree.size() : 0,
      bounds: this.quadtree ? this.quadtree.bounds : null
    };
  }
}

module.exports = CollisionManager;
