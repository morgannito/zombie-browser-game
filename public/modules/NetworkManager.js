/**
 * NETWORK MANAGER CLIENT - Gestion des deltas côté client
 * Gère la réception et l'application des deltas de l'état du jeu
 * Gain: -80-90% bande passante
 * @version 1.0.0
 */

class ClientNetworkManager {
  constructor(socket) {
    this.socket = socket;
    this.gameState = {
      players: {},
      zombies: {},
      bullets: {},
      particles: {},
      poisonTrails: {},
      explosions: {},
      powerups: {},
      loot: {},
      wave: 1,
      walls: [],
      currentRoom: 0,
      bossSpawned: false
    };

    this.setupHandlers();
  }

  /**
   * Configurer les handlers pour les événements réseau
   */
  setupHandlers() {
    // Handler pour l'état complet
    this.socket.on('gameState', (data) => {
      this.handleFullState(data);
    });

    // Handler pour les deltas
    this.socket.on('gameStateDelta', (delta) => {
      this.handleDelta(delta);
    });
  }

  /**
   * Gérer la réception d'un état complet
   * @param {Object} data - État complet du jeu
   */
  handleFullState(data) {
    // Remplacer entièrement l'état
    this.gameState.players = data.players || {};
    this.gameState.zombies = data.zombies || {};
    this.gameState.bullets = data.bullets || {};
    this.gameState.particles = data.particles || {};
    this.gameState.poisonTrails = data.poisonTrails || {};
    this.gameState.explosions = data.explosions || {};
    this.gameState.powerups = data.powerups || {};
    this.gameState.loot = data.loot || {};
    this.gameState.wave = data.wave;
    this.gameState.walls = data.walls;
    this.gameState.currentRoom = data.currentRoom;
    this.gameState.bossSpawned = data.bossSpawned;
  }

  /**
   * Gérer la réception d'un delta
   * @param {Object} delta - Delta contenant {updated, removed, meta}
   */
  handleDelta(delta) {
    // Appliquer les mises à jour
    if (delta.updated) {
      Object.entries(delta.updated).forEach(([type, entities]) => {
        if (!this.gameState[type]) {
          this.gameState[type] = {};
        }

        Object.entries(entities).forEach(([id, entity]) => {
          this.gameState[type][id] = entity;
        });
      });
    }

    // Supprimer les entités disparues
    if (delta.removed) {
      Object.entries(delta.removed).forEach(([type, ids]) => {
        if (this.gameState[type]) {
          ids.forEach(id => {
            delete this.gameState[type][id];
          });
        }
      });
    }

    // Mettre à jour les meta-données
    if (delta.meta) {
      if (delta.meta.wave !== undefined) {
        this.gameState.wave = delta.meta.wave;
      }
      if (delta.meta.walls !== undefined) {
        this.gameState.walls = delta.meta.walls;
      }
      if (delta.meta.currentRoom !== undefined) {
        this.gameState.currentRoom = delta.meta.currentRoom;
      }
      if (delta.meta.bossSpawned !== undefined) {
        this.gameState.bossSpawned = delta.meta.bossSpawned;
      }
    }
  }

  /**
   * Obtenir l'état actuel du jeu
   * @returns {Object} État du jeu
   */
  getGameState() {
    return this.gameState;
  }

  /**
   * Émettre un événement au serveur
   * @param {string} event - Nom de l'événement
   * @param {*} data - Données à envoyer
   */
  emit(event, data) {
    this.socket.emit(event, data);
  }

  /**
   * Enregistrer un listener sur un événement
   * @param {string} event - Nom de l'événement
   * @param {Function} callback - Fonction de callback
   */
  on(event, callback) {
    this.socket.on(event, callback);
  }
}

// Export global
if (typeof window !== 'undefined') {
  window.ClientNetworkManager = ClientNetworkManager;
}
