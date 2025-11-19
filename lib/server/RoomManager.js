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
   * Génération procédurale d'une salle
   * @returns {Object} Objet salle avec walls, obstacles, doors
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
    const numObstacles = Math.floor(Math.random() * 5) + 3;
    for (let i = 0; i < numObstacles; i++) {
      const obsWidth = 40 + Math.random() * 40;
      const obsHeight = 40 + Math.random() * 40;
      const obsX = 100 + Math.random() * (room.width - 200 - obsWidth);
      const obsY = 100 + Math.random() * (room.height - 200 - obsHeight);

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
   * Initialiser toutes les salles au démarrage
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
   * Charger une salle spécifique
   * CORRECTION: Vérifier que la room existe avant de l'utiliser
   * @param {number} roomIndex - Index de la salle à charger
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
   * Vérifier collision avec les murs
   * @param {number} x - Position X
   * @param {number} y - Position Y
   * @param {number} size - Taille de l'entité
   * @returns {boolean} True si collision
   */
  checkWallCollision(x, y, size) {
    for (let wall of this.gameState.walls) {
      if (x + size > wall.x &&
        x - size < wall.x + wall.width &&
        y + size > wall.y &&
        y - size < wall.y + wall.height) {
        return true;
      }
    }
    return false;
  }
}

module.exports = RoomManager;
