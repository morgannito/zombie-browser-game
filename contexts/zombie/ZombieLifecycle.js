/**
 * ZOMBIE LIFECYCLE - Gestion de la fin de vie des zombies
 * Centralise la suppression et le nettoyage des zombies morts
 *
 * États lifecycle : alive → dying → dead → removed
 *
 * @version 1.0.0 - Extrait de ZombieManager v2.0.0
 */

class ZombieLifecycle {
  constructor(gameState) {
    this.gameState = gameState;
  }

  /**
   * Supprime un zombie par son ID et met à jour maxZombieSize tracking
   * @param {number|string} zombieId - ID du zombie à supprimer
   * @returns {boolean} True si le zombie existait et a été supprimé
   */
  removeZombie(zombieId) {
    if (!this.gameState.zombies[zombieId]) {
return false;
}

    delete this.gameState.zombies[zombieId];
    return true;
  }

  /**
   * Nettoie tous les zombies dont health <= 0 (état dead non encore supprimés)
   * @returns {number} Nombre de zombies supprimés
   */
  cleanupDeadZombies() {
    const zombies = this.gameState.zombies;
    let removed = 0;

    for (const zombieId in zombies) {
      const zombie = zombies[zombieId];
      if (zombie && zombie.health !== undefined && zombie.health <= 0) {
        delete zombies[zombieId];
        removed++;
      }
    }

    return removed;
  }

  /**
   * Supprime tous les minions liés à un invocateur donné
   * @param {number|string} summonerId - ID de l'invocateur
   * @returns {number} Nombre de minions supprimés
   */
  removeMinionsOf(summonerId) {
    const zombies = this.gameState.zombies;
    let removed = 0;

    for (const zombieId in zombies) {
      if (zombies[zombieId] && zombies[zombieId].summonerId === summonerId) {
        delete zombies[zombieId];
        removed++;
      }
    }

    return removed;
  }

  /**
   * Vide tous les zombies de la partie (fin de vague / game over)
   * Préserve gameState.maxZombieSize
   */
  clearAllZombies() {
    const zombies = this.gameState.zombies;
    let count = 0;
    for (const _ in zombies) {
count++;
}

    // Mettre à jour maxZombieSize avant de vider
    if (count > (this.gameState.maxZombieSize || 0)) {
      this.gameState.maxZombieSize = count;
    }

    for (const zombieId in zombies) {
      delete zombies[zombieId];
    }
  }
}

module.exports = ZombieLifecycle;
