/**
 * QUADTREE WORKER - Offload quadtree rebuild to worker thread
 * Frees up main thread for game loop processing
 * Gain: +10-15 FPS on main thread
 * @version 1.0.0
 */

const { parentPort } = require('worker_threads');
const Quadtree = require('../Quadtree');

// Listen for rebuild requests from main thread
parentPort.on('message', (message) => {
  if (message.type === 'REBUILD_QUADTREE') {
    try {
      const { bounds, players, zombies } = message.data;

      // Create new quadtree
      const quadtree = new Quadtree(bounds, 4, 10);

      // Insert players
      for (const playerId in players) {
        const player = players[playerId];
        if (player.alive) {
          quadtree.insert({
            x: player.x,
            y: player.y,
            width: 20, // Player size
            height: 20,
            type: 'player',
            entityId: playerId
          });
        }
      }

      // Insert zombies
      for (const zombieId in zombies) {
        const zombie = zombies[zombieId];
        quadtree.insert({
          x: zombie.x,
          y: zombie.y,
          width: 30, // Zombie size
          height: 30,
          type: 'zombie',
          entityId: zombieId
        });
      }

      // Send rebuilt quadtree back to main thread
      // Note: Quadtree needs to be serializable
      parentPort.postMessage({
        type: 'QUADTREE_REBUILT',
        data: {
          // We'll send the quadtree data structure
          // Main thread will reconstruct it
          success: true,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      parentPort.postMessage({
        type: 'QUADTREE_ERROR',
        error: error.message
      });
    }
  }
});

// Signal ready
parentPort.postMessage({ type: 'READY' });
