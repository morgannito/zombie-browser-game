/**
 * ROOM MANAGER - Gestion de la génération procédurale des salles
 * Génère et gère les salles Rogue-like avec obstacles et portes
 * @version 1.0.0
 */

class RoomManager {
  constructor(gameState, config, io) {
    this.gameState = gameState;
    this.config = config;
    this.io = io;
  }

  /**
   * Generate a procedural rogue-like room with walls, obstacles, and exit door
   *
   * @returns {Object} Room object with complete layout
   * @returns {number} returns.width - Room width from config
   * @returns {number} returns.height - Room height from config
   * @returns {Array<Object>} returns.walls - Outer wall rectangles
   * @returns {Array<Object>} returns.obstacles - Interior obstacle rectangles
   * @returns {Array<Object>} returns.doors - Exit door rectangles with activation state
   *
   * @description
   * Creates a procedurally generated room layout:
   * - Outer walls with door opening at top center
   * - Random interior obstacles (pillars/crates)
   * - Exit door that activates when wave cleared
   * - Each element defined as {x, y, width, height}
   *
   * Wall structure:
   * - Top: Split into two segments with gap for door
   * - Bottom, Left, Right: Full walls
   * - Thickness: WALL_THICKNESS from config
   *
   * Door configuration:
   * - Position: Top wall center
   * - Width: DOOR_WIDTH from config
   * - active: false (set true when zombies cleared)
   *
   * Obstacle generation:
   * - Count: Random 3-8 obstacles per room
   * - Size: Random 40-80 pixels (width and height)
   * - Position: Random within safe zone (100px margin from walls)
   * - Creates varied tactical environments
   *
   * Design rationale:
   * - Procedural generation: Each room feels unique
   * - Obstacles create cover and strategic positioning
   * - Door forces progression (must clear wave)
   * - Random layout prevents repetitive gameplay
   *
   * @example
   *   // Generate a new room
   *   const room = roomManager.generateRoom();
   *   console.log(`Room has ${room.obstacles.length} obstacles`);
   *   // Room has 5 obstacles
   *
   * @example
   *   // Use generated room
   *   const room = roomManager.generateRoom();
   *   gameState.walls = [...room.walls, ...room.obstacles];
   *   sendToClients('roomData', room);
   */
  generateRoom() {
    const room = {
      width: this.config.ROOM_WIDTH,
      height: this.config.ROOM_HEIGHT,
      walls: [],
      obstacles: [],
      doors: []
    };

    const w = this.config.WALL_THICKNESS;

    // Murs extérieurs
    const doorWidth = this.config.DOOR_WIDTH;
    const doorX = (room.width - doorWidth) / 2;

    room.walls.push(
      // Haut (avec ouverture pour la porte)
      { x: 0, y: 0, width: doorX, height: w }, // Mur haut gauche
      { x: doorX + doorWidth, y: 0, width: room.width - (doorX + doorWidth), height: w }, // Mur haut droit

      { x: 0, y: room.height - w, width: room.width, height: w }, // Bas
      { x: 0, y: 0, width: w, height: room.height }, // Gauche
      { x: room.width - w, y: 0, width: w, height: room.height } // Droite
    );

    // Porte en haut (pour passer à la salle suivante)
    room.doors.push({
      x: doorX,
      y: 0,
      width: doorWidth,
      height: w,
      active: false // S'active quand tous les zombies sont morts
    });

    // Obstacles aléatoires (piliers, caisses)
    // Safe margin: wall thickness + buffer to avoid spawning on walls
    const obstacleMargin = w + 60; // 60px buffer from wall interior

    const numObstacles = Math.floor(Math.random() * 5) + 3;
    for (let i = 0; i < numObstacles; i++) {
      const obsWidth = 40 + Math.random() * 40;
      const obsHeight = 40 + Math.random() * 40;
      const obsX = obstacleMargin + Math.random() * (room.width - obstacleMargin * 2 - obsWidth);
      const obsY = obstacleMargin + Math.random() * (room.height - obstacleMargin * 2 - obsHeight);

      room.obstacles.push({
        x: obsX,
        y: obsY,
        width: obsWidth,
        height: obsHeight
      });
    }

    return room;
  }

  /**
   * Initialize all rooms for the game run and load the first room
   *
   * @returns {void}
   *
   * @description
   * Pre-generates all rooms for the current game session:
   * - Creates ROOMS_PER_RUN rooms (from config)
   * - Each room procedurally generated with generateRoom()
   * - Stores rooms in gameState.rooms array
   * - Initializes walls array for collision detection
   * - Sets currentRoom to 0 (first room)
   * - Loads first room into active game state
   *
   * Initialization sequence:
   * 1. Reset gameState.rooms to empty array
   * 2. Reset gameState.walls to empty array
   * 3. Set gameState.currentRoom to 0
   * 4. Generate all rooms in loop (ROOMS_PER_RUN count)
   * 5. Load first room (index 0)
   *
   * Design rationale:
   * - Pre-generation ensures consistent room set per run
   * - All rooms generated at start (no mid-game lag)
   * - Allows for room preview or mini-map (if implemented)
   * - Predictable number of rooms per session
   *
   * Called:
   * - Game server startup
   * - New game session start
   * - Game reset after all players die
   *
   * @example
   *   // Start new game
   *   roomManager.initializeRooms();
   *   console.log(`Generated ${gameState.rooms.length} rooms`);
   *   zombieManager.startZombieSpawner();
   */
  initializeRooms() {
    this.gameState.rooms = [];
    this.gameState.walls = [];
    this.gameState.currentRoom = 0;

    for (let i = 0; i < this.config.ROOMS_PER_RUN; i++) {
      const room = this.generateRoom();
      this.gameState.rooms.push(room);
    }

    // Charger les murs de la première salle
    this.loadRoom(0);
  }

  /**
   * Load a specific room into active game state and reset wave progress
   *
   * @param {number} roomIndex - Index of room to load from gameState.rooms array
   * @returns {void}
   *
   * @description
   * Activates a room for gameplay with complete state reset:
   * - Validates roomIndex is within valid range
   * - Sets gameState.currentRoom to roomIndex
   * - Loads room walls and obstacles into gameState.walls
   * - Clears all existing zombies
   * - Resets boss and wave progress counters
   * - Emits 'roomChanged' event to all clients
   *
   * State reset on room load:
   * - gameState.walls: Replaced with new room's walls + obstacles
   * - gameState.zombies: Cleared to empty object
   * - gameState.bossSpawned: Reset to false
   * - gameState.zombiesKilledThisWave: Reset to 0
   *
   * Safety checks (CORRECTION v1.0.1):
   * - Validates roomIndex >= 0 and < rooms.length
   * - Checks room exists at index
   * - Logs error and aborts if validation fails
   * - Prevents crashes from invalid room access
   *
   * Client notification:
   * - Emits 'roomChanged' with room data
   * - Includes: roomIndex, totalRooms, walls, doors
   * - Clients update rendering and collision
   *
   * Called when:
   * - Game initialization (room 0)
   * - Player enters door to next room
   * - Room progression in rogue-like mode
   *
   * @example
   *   // Load next room after boss defeated
   *   if (bossDefeated && doorActivated) {
   *     gameState.wave++;
   *     roomManager.loadRoom(gameState.currentRoom + 1);
   *   }
   *
   * @example
   *   // Reset to first room
   *   roomManager.loadRoom(0);
   */
  loadRoom(roomIndex) {
    // CORRECTION: Vérifier que l'index est valide
    if (roomIndex < 0 || roomIndex >= this.gameState.rooms.length) {
      console.error(`[ROOM MANAGER] Invalid room index: ${roomIndex}`);
      return;
    }

    const room = this.gameState.rooms[roomIndex];

    // CORRECTION: Vérifier que la room existe
    if (!room) {
      console.error(`[ROOM MANAGER] Room ${roomIndex} does not exist`);
      return;
    }

    this.gameState.currentRoom = roomIndex;
    this.gameState.walls = [];
    this.gameState.bossSpawned = false;
    this.gameState.zombiesKilledThisWave = 0;

    // Charger tous les murs (extérieurs + obstacles)
    this.gameState.walls = [...room.walls, ...room.obstacles];

    // Nettoyer les zombies existants
    this.gameState.zombies = {};

    this.io.emit('roomChanged', {
      roomIndex: roomIndex,
      totalRooms: this.config.ROOMS_PER_RUN,
      walls: this.gameState.walls,
      doors: room.doors
    });
  }

  /**
   * Check if an entity at position collides with any wall or obstacle
   *
   * @param {number} x - Entity center X coordinate
   * @param {number} y - Entity center Y coordinate
   * @param {number} size - Entity radius/half-size
   * @returns {boolean} True if collision detected, false if clear
   *
   * @description
   * Performs rectangle-circle collision detection for walls:
   * - Treats entity as circle with radius=size
   * - Treats walls/obstacles as axis-aligned rectangles
   * - Checks all walls in gameState.walls array
   * - Returns true on first collision found (early exit)
   * - Returns false if no collisions
   *
   * Collision algorithm:
   * - Entity bounding box: (x-size, y-size) to (x+size, y+size)
   * - Wall rectangle: wall.x, wall.y, wall.width, wall.height
   * - Collision if boxes overlap on both X and Y axes
   *
   * Collision conditions:
   * - X overlap: (x + size > wall.x) AND (x - size < wall.x + wall.width)
   * - Y overlap: (y + size > wall.y) AND (y - size < wall.y + wall.height)
   * - Collision: X overlap AND Y overlap
   *
   * Use cases:
   * - Zombie spawn position validation
   * - Player movement validation
   * - Pathfinding obstacle avoidance
   * - Projectile wall bouncing
   *
   * Performance:
   * - Early exit on first collision (O(n) worst case)
   * - Typically fast due to small number of walls
   * - Called frequently, so kept simple
   *
   * @example
   *   // Check zombie spawn position
   *   const x = Math.random() * roomWidth;
   *   const y = Math.random() * roomHeight;
   *   if (!roomManager.checkWallCollision(x, y, zombieSize)) {
   *     spawnZombie(x, y);
   *   }
   *
   * @example
   *   // Player movement validation
   *   const newX = player.x + velocityX;
   *   const newY = player.y + velocityY;
   *   if (!roomManager.checkWallCollision(newX, newY, playerSize)) {
   *     player.x = newX;
   *     player.y = newY;
   *   }
   */
  checkWallCollision(x, y, size) {
    for (const wall of this.gameState.walls) {
      if (x + size > wall.x &&
        x - size < wall.x + wall.width &&
        y + size > wall.y &&
        y - size < wall.y + wall.height) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get detailed collision info with penetration depth and push direction
   *
   * @param {number} x - Entity center X
   * @param {number} y - Entity center Y
   * @param {number} size - Entity radius
   * @returns {Object} Collision info with push vector
   *
   * @description
   * Returns detailed collision data for wall sliding and unstuck:
   * - colliding: boolean if any collision detected
   * - pushX, pushY: accumulated push direction to resolve overlap
   * - penetration: maximum penetration depth
   * - wallCount: number of walls being touched (for corner detection)
   */
  getWallCollisionInfo(x, y, size) {
    let colliding = false;
    let pushX = 0;
    let pushY = 0;
    let maxPenetration = 0;
    let wallCount = 0;

    for (const wall of this.gameState.walls) {
      // Find closest point on wall rectangle to entity center
      const closestX = Math.max(wall.x, Math.min(x, wall.x + wall.width));
      const closestY = Math.max(wall.y, Math.min(y, wall.y + wall.height));

      // Distance from entity center to closest point
      const dx = x - closestX;
      const dy = y - closestY;
      const distSq = dx * dx + dy * dy;

      // Check collision (circle vs rectangle)
      if (distSq < size * size) {
        colliding = true;
        wallCount++;

        const dist = Math.sqrt(distSq);
        const penetration = size - dist;

        if (penetration > maxPenetration) {
          maxPenetration = penetration;
        }

        // Calculate push direction
        if (dist > 0.001) {
          // Normal case: push away from closest point
          pushX += (dx / dist) * penetration;
          pushY += (dy / dist) * penetration;
        } else {
          // Entity center is inside wall - push toward room center
          const roomCenterX = this.config.ROOM_WIDTH / 2;
          const roomCenterY = this.config.ROOM_HEIGHT / 2;
          const toCenterX = roomCenterX - x;
          const toCenterY = roomCenterY - y;
          const toCenterDist = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY);
          if (toCenterDist > 0.001) {
            pushX += (toCenterX / toCenterDist) * size;
            pushY += (toCenterY / toCenterDist) * size;
          }
        }
      }
    }

    return {
      colliding,
      pushX,
      pushY,
      penetration: maxPenetration,
      wallCount
    };
  }
}

module.exports = RoomManager;
