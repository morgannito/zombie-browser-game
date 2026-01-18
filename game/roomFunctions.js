/**
 * @fileoverview Room generation and management functions
 * @description Provides functions for:
 * - Procedural room generation (Rogue-like)
 * - Room initialization
 * - Room loading
 */

const ConfigManager = require('../lib/server/ConfigManager');
const { CONFIG } = ConfigManager;

/**
 * Génération procédurale de salle (Rogue-like)
 * @returns {Object} Generated room object
 */
function generateRoom() {
  const room = {
    width: CONFIG.ROOM_WIDTH,
    height: CONFIG.ROOM_HEIGHT,
    walls: [],
    obstacles: [],
    doors: []
  };

  const w = CONFIG.WALL_THICKNESS;

  // Calcul de la position de la porte (centre du mur du haut)
  const doorWidth = CONFIG.DOOR_WIDTH;
  const doorX = (room.width - doorWidth) / 2;

  // Murs extérieurs (AVEC ouverture pour la porte en haut)
  room.walls.push(
    // Haut: deux segments avec ouverture pour la porte
    { x: 0, y: 0, width: doorX, height: w }, // Mur haut gauche
    { x: doorX + doorWidth, y: 0, width: room.width - (doorX + doorWidth), height: w }, // Mur haut droit
    // Bas, Gauche, Droite: murs complets
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
 * Initialiser les salles
 * @param {Object} gameState - Game state object
 * @param {Object} config - Game configuration
 */
function initializeRooms(gameState, config) {
  gameState.rooms = [];
  gameState.walls = [];
  gameState.currentRoom = 0;

  for (let i = 0; i < config.ROOMS_PER_RUN; i++) {
    const room = generateRoom();
    gameState.rooms.push(room);
  }
}

/**
 * Charger une salle spécifique (wrapper pour roomManager)
 * NOTE: Cette fonction doit être appelée avec roomManager initialisé
 * @param {number} roomIndex - Index of room to load
 * @param {Object} roomManager - Room manager instance
 */
function loadRoom(roomIndex, roomManager) {
  if (roomManager && roomManager.loadRoom) {
    roomManager.loadRoom(roomIndex);
  } else {
    console.error('[ROOM] roomManager.loadRoom is not available');
  }
}

module.exports = {
  generateRoom,
  initializeRooms,
  loadRoom
};
