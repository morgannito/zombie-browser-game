/**
 * ZOMBIE INTERPOLATOR - Client-side zombie position interpolation
 * Smooths zombie movement between server updates
 * Uses dead-reckoning for predictive movement
 * @version 1.0.0
 */

class ZombieInterpolator {
  constructor() {
    this.interpolationDelay = 100; // 100ms delay for smooth interpolation
    this.zombieStates = new Map(); // Store zombie interpolation states
  }

  /**
   * Update zombie interpolation state from server
   * @param {Object} zombies - Zombies from server gameState
   */
  updateFromServer(zombies) {
    const now = Date.now();

    for (const zombieId in zombies) {
      const serverZombie = zombies[zombieId];

      if (!this.zombieStates.has(zombieId)) {
        // New zombie - initialize state
        this.zombieStates.set(zombieId, {
          currentX: serverZombie.x,
          currentY: serverZombie.y,
          targetX: serverZombie.x,
          targetY: serverZombie.y,
          vx: 0,
          vy: 0,
          lastServerUpdate: now,
          serverUpdateInterval: 100 // Assume 100ms between updates
        });
      } else {
        const state = this.zombieStates.get(zombieId);

        // Calculate velocity from position delta
        const timeDelta = now - state.lastServerUpdate;
        if (timeDelta > 0) {
          const dx = serverZombie.x - state.targetX;
          const dy = serverZombie.y - state.targetY;
          state.vx = dx / (timeDelta / 1000); // pixels per second
          state.vy = dy / (timeDelta / 1000);
          state.serverUpdateInterval = timeDelta;
        }

        // Update target position
        state.targetX = serverZombie.x;
        state.targetY = serverZombie.y;
        state.lastServerUpdate = now;
      }
    }

    // Clean up removed zombies
    const serverZombieIds = new Set(Object.keys(zombies));
    for (const [zombieId] of this.zombieStates) {
      if (!serverZombieIds.has(zombieId)) {
        this.zombieStates.delete(zombieId);
      }
    }
  }

  /**
   * Interpolate zombie positions based on time
   * @param {Object} zombies - Current zombie state to update
   * @returns {Object} Updated zombies with interpolated positions
   */
  interpolate(zombies) {
    const now = Date.now();

    for (const zombieId in zombies) {
      const zombie = zombies[zombieId];
      const state = this.zombieStates.get(zombieId);

      if (!state) {
        continue; // No interpolation state yet
      }

      // Calculate interpolation factor based on time since last server update
      const timeSinceUpdate = now - state.lastServerUpdate;
      const interpolationFactor = Math.min(timeSinceUpdate / this.interpolationDelay, 1.0);

      // Dead-reckoning: extrapolate position using velocity
      if (timeSinceUpdate < 500) { // Only extrapolate for up to 500ms
        const predictedX = state.targetX + (state.vx * (timeSinceUpdate / 1000));
        const predictedY = state.targetY + (state.vy * (timeSinceUpdate / 1000));

        // Smooth interpolation between current and predicted position
        zombie.x = state.currentX + (predictedX - state.currentX) * interpolationFactor;
        zombie.y = state.currentY + (predictedY - state.currentY) * interpolationFactor;

        // Update current position for next frame
        state.currentX = zombie.x;
        state.currentY = zombie.y;
      } else {
        // Too long since update - snap to target position
        zombie.x = state.targetX;
        zombie.y = state.targetY;
        state.currentX = state.targetX;
        state.currentY = state.targetY;
      }
    }

    return zombies;
  }

  /**
   * Clear all interpolation states
   */
  clear() {
    this.zombieStates.clear();
  }

  /**
   * Get interpolation stats for debugging
   */
  getStats() {
    return {
      zombieCount: this.zombieStates.size,
      interpolationDelay: this.interpolationDelay
    };
  }
}

// Export to window
window.ZombieInterpolator = ZombieInterpolator;
