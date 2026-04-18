/**
 * COLLISION MANAGER - Gestion des collisions avec Quadtree + SpatialGrid
 * Utilise le spatial partitioning pour optimiser les recherches
 * Gain: -60-70% calculs de collision (de O(n²) à O(n log n))
 * SpatialGrid offre O(k) pour les lookups zombie-only (bullet↔zombie, zombie↔player)
 * @version 1.1.0
 */

const Quadtree = require('../../lib/Quadtree');
const MathUtils = require('../../lib/MathUtils');
const { SpatialGrid } = require('../zombie/SpatialGrid');

class CollisionManager {
  constructor(gameState, config) {
    this.gameState = gameState;
    this.config = config;
    this.quadtree = null;

    // SSSS OPTIMIZATION: Pathfinding cache (invalidation every 5-10 frames)
    this.pathfindingCache = new Map(); // zombieId -> {playerId, frame}
    this.cacheInvalidationInterval = 5; // Frames between cache refresh
    this.currentFrame = 0;

    // Pool of lightweight wrappers for quadtree inserts — avoids mutating game entities
    // and leaking internal `type`/`entityId` fields to clients via broadcasts.
    this._wrapperPool = [];
    this._wrapperCount = 0;

    // Uniform spatial grid for zombie-only lookups (bullet↔zombie, zombie↔player).
    // Rebuilt once per tick alongside the quadtree. Cell size 100 px (tunable in SpatialGrid.js).
    this._zombieGrid = new SpatialGrid();

    // Preallocated result buffers — reused each call to avoid [] alloc per tick.
    // Safe because JS is single-threaded and callers iterate before the next call.
    this._zombieResultBuf = [];
    this._playerResultBuf = [];

    // Object pool for checkBulletZombieCollisions hit records {id, zombie, distSq}.
    // _hitPool stores pre-allocated objects; _hitResultBuf is the view returned to callers.
    this._hitPool = [];
    this._hitPoolSize = 0;
    this._hitResultBuf = [];

    // Cache for dynamically computed maxZombieSize (invalidated each tick).
    this._maxZombieSizeCache = null;
    this._maxZombieSizeTick = -1;
  }

  /**
   * Returns the maximum zombie size from gameState.zombies, cached per tick.
   * Falls back to 40 if no zombies are present.
   */
  _getMaxZombieSize() {
    const tick = this.currentFrame;
    if (this._maxZombieSizeCache !== null && this._maxZombieSizeTick === tick) {
      return this._maxZombieSizeCache;
    }
    const zombies = this.gameState.zombies;
    let max = 0;
    if (zombies) {
      for (const id in zombies) {
        const z = zombies[id];
        if (z && z.size > max) { max = z.size; }
      }
    }
    this._maxZombieSizeCache = max > 0 ? max : 40;
    this._maxZombieSizeTick = tick;
    return this._maxZombieSizeCache;
  }

  /** Acquire a hit record from the pool (or allocate if exhausted). */
  _acquireHit(id, zombie, distSq) {
    let h;
    if (this._hitPoolSize < this._hitPool.length) {
      h = this._hitPool[this._hitPoolSize];
    } else {
      h = { id: null, zombie: null, distSq: 0 };
      this._hitPool.push(h);
    }
    h.id = id;
    h.zombie = zombie;
    h.distSq = distSq;
    this._hitResultBuf[this._hitPoolSize] = h;
    this._hitPoolSize++;
  }

  /** Release all hit records back to the pool. */
  _releaseHits() {
    this._hitPoolSize = 0;
    this._hitResultBuf.length = 0;
  }

  _acquireWrapper(x, y, type, entityId) {
    if (this._wrapperCount < this._wrapperPool.length) {
      const w = this._wrapperPool[this._wrapperCount++];
      w.x = x;
      w.y = y;
      w.type = type;
      w.entityId = entityId;
      return w;
    }
    const w = { x, y, type, entityId };
    this._wrapperPool.push(w);
    this._wrapperCount++;
    return w;
  }

  /**
   * Reconstruit le quadtree + SpatialGrid depuis l'état courant. À appeler en début de tick.
   */
  rebuildQuadtree() {
    // PERF: reuse root Quadtree instance via clear() instead of allocating a
    // fresh tree every tick. Saves ~85 node allocations (10 KB) per tick.
    if (!this.quadtree) {
      this.quadtree = new Quadtree(
        { x: 0, y: 0, width: this.config.ROOM_WIDTH, height: this.config.ROOM_HEIGHT },
        4,
        8
      );
    } else {
      this.quadtree.clear();
    }

    // Reset wrapper pool for this frame — reuses objects to avoid GC pressure.
    this._wrapperCount = 0;

    // Insérer tous les joueurs vivants
    for (const playerId in this.gameState.players) {
      const player = this.gameState.players[playerId];
      if (player.alive) {
        this.quadtree.insert(this._acquireWrapper(player.x, player.y, 'player', playerId));
      }
    }

    // Insérer tous les zombies (quadtree + spatial grid)
    this._zombieGrid.clear();
    for (const zombieId in this.gameState.zombies) {
      const zombie = this.gameState.zombies[zombieId];
      const wrapper = this._acquireWrapper(zombie.x, zombie.y, 'zombie', zombieId);
      this.quadtree.insert(wrapper);
      this._zombieGrid.insert(wrapper);
    }

    // SSSS OPTIMIZATION: Increment frame counter for cache invalidation
    this.currentFrame++;

    // Invalidate cache every N frames
    if (this.currentFrame % this.cacheInvalidationInterval === 0) {
      this.pathfindingCache.clear();
    }
  }

  /**
   * Remove a single zombie's pathfinding cache entry on death.
   * Prevents the Map from retaining references to despawned zombie IDs between
   * periodic full-clears (every cacheInvalidationInterval frames).
   * @param {string} zombieId
   */
  invalidatePathfindingCache(zombieId) {
    this.pathfindingCache.delete(zombieId);
  }

  /**
   * Retourne le zombie le plus proche dans un rayon donné.
   * @param {number} x
   * @param {number} y
   * @param {number} [maxRange=500]
   * @returns {Object|null}
   */
  findClosestZombie(x, y, maxRange = 500) {
    // CORRECTION: Vérifier que le quadtree existe
    if (!this.quadtree) {
      return null;
    }

    const candidates = this.quadtree.queryRadius(x, y, maxRange);

    let closestZombie = null;
    let closestDistanceSq = maxRange * maxRange;

    for (const entity of candidates) {
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
   * Retourne le joueur vivant le plus proche, en excluant par défaut les protégés/invisibles.
   * @param {number} x
   * @param {number} y
   * @param {number} [maxRange=Infinity]
   * @param {Object} [options={}]
   * @param {boolean} [options.ignoreSpawnProtection=false]
   * @param {boolean} [options.ignoreInvisible=false]
   * @returns {Object|null}
   */
  findClosestPlayer(x, y, maxRange = Infinity, options = {}) {
    // CORRECTION: Vérifier que le quadtree existe
    if (!this.quadtree) {
      return null;
    }

    const searchRadius =
      maxRange === Infinity ? Math.max(this.config.ROOM_WIDTH, this.config.ROOM_HEIGHT) : maxRange;

    const candidates = this.quadtree.queryRadius(x, y, searchRadius);

    let closestPlayer = null;
    let closestDistanceSq = maxRange * maxRange;

    for (const entity of candidates) {
      if (entity.type === 'player') {
        const player = this.gameState.players[entity.entityId];

        // Player may have disconnected between quadtree rebuild and query
        if (!player) {
          continue;
        }

        // Filtres optionnels
        // If ignoreSpawnProtection is FALSE/undefined, skip players WITH spawn protection
        // If ignoreSpawnProtection is TRUE, include all players (don't skip)
        if (!options.ignoreSpawnProtection && player.spawnProtection) {
          continue;
        }
        if (!options.ignoreInvisible && player.invisible) {
          continue;
        }
        if (!player.alive) {
          continue;
        }

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
   * Version cachée de findClosestPlayer (cache ~5 frames, +5-10 FPS en late game).
   * @param {string} zombieId
   * @param {number} x
   * @param {number} y
   * @param {number} [maxRange=Infinity]
   * @param {Object} [options={}]
   * @returns {Object|null}
   */
  findClosestPlayerCached(zombieId, x, y, maxRange = Infinity, options = {}) {
    // Include options in cache key to avoid returning stale results when options differ
    // (e.g. ignoreSpawnProtection changes which players are eligible)
    const optionsSuffix = options.ignoreSpawnProtection ? '_ignoreSP' : '';
    const cacheKey = `${zombieId}${optionsSuffix}`;

    // Check cache first
    const cached = this.pathfindingCache.get(cacheKey);
    if (cached && cached.frame >= this.currentFrame - this.cacheInvalidationInterval) {
      const player = this.gameState.players[cached.playerId];
      // BUG FIX: respect options flags instead of hardcoded checks
      const spawnOk = options.ignoreSpawnProtection || !player?.spawnProtection;
      const invisOk = options.ignoreInvisible || !player?.invisible;
      if (player && player.alive && spawnOk && invisOk) {
        return player;
      }
    }

    // Cache miss or invalid - perform full search
    const closestPlayer = this.findClosestPlayer(x, y, maxRange, options);

    // Store in cache
    if (closestPlayer && closestPlayer.id) {
      this.pathfindingCache.set(cacheKey, {
        playerId: closestPlayer.id,
        frame: this.currentFrame
      });
    }

    return closestPlayer;
  }

  /**
   * Retourne tous les zombies dans un rayon, en excluant optionnellement un ID (ex: self).
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {string|null} [excludeId=null]
   * @returns {Array<Object>}
   */
  findZombiesInRadius(x, y, radius, excludeId = null) {
    // CORRECTION: Vérifier que le quadtree existe
    if (!this.quadtree) {
      return [];
    }

    const candidates = this.quadtree.queryRadius(x, y, radius);
    const zombies = this._zombieResultBuf;
    zombies.length = 0;

    for (const entity of candidates) {
      if (entity.type === 'zombie' && entity.entityId !== excludeId) {
        zombies.push(this.gameState.zombies[entity.entityId]);
      }
    }

    return zombies;
  }

  /**
   * Retourne tous les joueurs vivants dans un rayon.
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @returns {Array<Object>}
   */
  findPlayersInRadius(x, y, radius) {
    // CORRECTION: Vérifier que le quadtree existe
    if (!this.quadtree) {
      return [];
    }

    const candidates = this.quadtree.queryRadius(x, y, radius);
    const players = this._playerResultBuf;
    players.length = 0;

    for (const entity of candidates) {
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
   * Détecte les zombies touchés par une balle (broadphase SpatialGrid + circle check exact).
   * Résultats triés par distance croissante.
   * @param {Object} bullet - Entité balle avec {x, y}
   * @returns {Array<{id: string, zombie: Object, distSq: number}>}
   */
  checkBulletZombieCollisions(bullet) {
    // CORRECTION: Vérifier que le quadtree existe
    if (!this.quadtree) {
      return [];
    }

    // Use spatial grid for zombie-candidate lookup (O(k), k = zombies in nearby cells).
    // BUG FIX: Utiliser une taille max pour le rayon de recherche
    // car les zombies ont des tailles variables (boss = 120px, normal = 25px)
    // NOTE: gameState.maxZombieSize is not currently tracked at runtime.
    // Using hardcoded 120 (boss size) as safe upper bound for broadphase.
    // For non-boss zombies this over-queries slightly but correctness is preserved.
    const maxZombieSize = this._getMaxZombieSize();
    // BULLET_HIT_TOLERANCE=8 accounts for network lag; must be included in broadphase
    const hitTolerance = this.config.BULLET_HIT_TOLERANCE || 8;
    const candidates = this._zombieGrid.nearby(
      bullet.x,
      bullet.y,
      maxZombieSize + this.config.BULLET_SIZE + hitTolerance
    );

    this._releaseHits();

    for (const entity of candidates) {
      const zombie = this.gameState.zombies[entity.entityId];

      // CORRECTION: Vérifier que le zombie existe toujours (peut avoir été supprimé)
      if (!zombie) {
        continue;
      }

      // BUG FIX: Utiliser zombie.size au lieu de config.ZOMBIE_SIZE
      // car les zombies ont des tailles variables
      const zombieSize = zombie.size || this.config.ZOMBIE_SIZE;
      if (
        MathUtils.circleCollision(
          bullet.x,
          bullet.y,
          this.config.BULLET_SIZE,
          zombie.x,
          zombie.y,
          zombieSize
        )
      ) {
        const distSq = MathUtils.distanceSquared(bullet.x, bullet.y, zombie.x, zombie.y);
        this._acquireHit(entity.entityId, zombie, distSq);
      }
    }

    // Return the result buffer (same array ref each call, populated via _acquireHit).
    const hitZombies = this._hitResultBuf;

    // Sort by distance so the closest zombie is processed first (avoids skipping near hits)
    if (hitZombies.length > 1) {
      hitZombies.sort((a, b) => a.distSq - b.distSq);
    }

    return hitZombies;
  }

  /**
   * Retourne true si le point est dans un mur (hors zone jouable).
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
   * Retourne les stats de diagnostic du quadtree ({size, bounds}).
   * @returns {{size: number, bounds: Object|null}}
   */
  getQuadtreeStats() {
    return {
      size: this.quadtree ? this.quadtree.size() : 0,
      bounds: this.quadtree ? this.quadtree.bounds : null
    };
  }
}

module.exports = CollisionManager;
