/**
 * EVENT LISTENER MANAGER
 * Gestion centralisée des event listeners pour prévenir les memory leaks
 * @version 1.0.0
 */

class EventListenerManager {
  constructor() {
    this.listeners = new Map();
    this.listenerCounter = 0;
  }

  /**
   * Ajoute un event listener et le track pour cleanup
   * @param {Element|Window|Document} target - L'élément cible
   * @param {string} event - Le type d'événement
   * @param {Function} handler - Le gestionnaire d'événement
   * @param {Object} options - Options de l'événement
   * @returns {number} L'ID du listener pour suppression ultérieure
   */
  add(target, event, handler, options = {}) {
    if (!target || !event || !handler) {
      console.warn('[EventListenerManager] Invalid parameters:', { target, event, handler });
      return null;
    }

    const id = ++this.listenerCounter;

    // Wrapper pour capturer le contexte
    const wrappedHandler = (e) => {
      try {
        handler(e);
      } catch (error) {
        console.error('[EventListenerManager] Error in handler:', error);
      }
    };

    // Ajouter l'event listener
    target.addEventListener(event, wrappedHandler, options);

    // Stocker les infos pour cleanup
    this.listeners.set(id, {
      target,
      event,
      handler: wrappedHandler,
      options,
      originalHandler: handler,
      addedAt: Date.now()
    });

    return id;
  }

  /**
   * Supprime un event listener par son ID
   * @param {number} id - L'ID du listener
   * @returns {boolean} True si supprimé avec succès
   */
  remove(id) {
    const listener = this.listeners.get(id);
    if (!listener) {
      return false;
    }

    try {
      listener.target.removeEventListener(
        listener.event,
        listener.handler,
        listener.options
      );
      this.listeners.delete(id);
      return true;
    } catch (error) {
      console.error('[EventListenerManager] Error removing listener:', error);
      return false;
    }
  }

  /**
   * Supprime tous les listeners d'une cible spécifique
   * @param {Element|Window|Document} target - La cible
   * @returns {number} Nombre de listeners supprimés
   */
  removeByTarget(target) {
    let removed = 0;
    for (const [id, listener] of this.listeners.entries()) {
      if (listener.target === target) {
        if (this.remove(id)) {
          removed++;
        }
      }
    }
    return removed;
  }

  /**
   * Supprime tous les listeners d'un type d'événement
   * @param {string} event - Le type d'événement
   * @returns {number} Nombre de listeners supprimés
   */
  removeByEvent(event) {
    let removed = 0;
    for (const [id, listener] of this.listeners.entries()) {
      if (listener.event === event) {
        if (this.remove(id)) {
          removed++;
        }
      }
    }
    return removed;
  }

  /**
   * Supprime tous les listeners
   * @returns {number} Nombre de listeners supprimés
   */
  removeAll() {
    const count = this.listeners.size;
    for (const [id] of this.listeners.entries()) {
      this.remove(id);
    }
    return count;
  }

  /**
   * Récupère le nombre de listeners actifs
   * @returns {number}
   */
  getActiveCount() {
    return this.listeners.size;
  }

  /**
   * Récupère les statistiques des listeners
   * @returns {Object}
   */
  getStats() {
    const stats = {
      total: this.listeners.size,
      byEvent: {},
      byTarget: {},
      oldest: null,
      newest: null
    };

    let oldestTime = Infinity;
    let newestTime = 0;

    for (const listener of this.listeners.values()) {
      // Par événement
      stats.byEvent[listener.event] = (stats.byEvent[listener.event] || 0) + 1;

      // Par type de target
      const targetType = listener.target === window ? 'window' :
        listener.target === document ? 'document' :
          listener.target?.tagName || 'unknown';
      stats.byTarget[targetType] = (stats.byTarget[targetType] || 0) + 1;

      // Plus ancien/récent
      if (listener.addedAt < oldestTime) {
        oldestTime = listener.addedAt;
        stats.oldest = listener.addedAt;
      }
      if (listener.addedAt > newestTime) {
        newestTime = listener.addedAt;
        stats.newest = listener.addedAt;
      }
    }

    return stats;
  }

  /**
   * Log les statistiques dans la console
   */
  logStats() {
    const stats = this.getStats();
    console.group('[EventListenerManager] Statistics');
    console.log('Total active listeners:', stats.total);
    console.log('By event type:', stats.byEvent);
    console.log('By target type:', stats.byTarget);
    if (stats.oldest) {
      console.log('Oldest listener age:', Math.round((Date.now() - stats.oldest) / 1000) + 's');
    }
    console.groupEnd();
  }

  /**
   * Détecte les listeners qui pourraient être des leaks
   * @param {number} maxAge - Âge maximum en millisecondes (défaut: 5 minutes)
   * @returns {Array} Liste des listeners suspects
   */
  detectLeaks(maxAge = 5 * 60 * 1000) {
    const now = Date.now();
    const suspects = [];

    for (const [id, listener] of this.listeners.entries()) {
      const age = now - listener.addedAt;
      if (age > maxAge) {
        suspects.push({
          id,
          event: listener.event,
          age: Math.round(age / 1000) + 's',
          target: listener.target === window ? 'window' :
            listener.target === document ? 'document' :
              listener.target?.tagName || 'unknown'
        });
      }
    }

    if (suspects.length > 0) {
      console.warn('[EventListenerManager] Potential leaks detected:', suspects);
    }

    return suspects;
  }
}

// Singleton global
if (!window.eventListenerManager) {
  window.eventListenerManager = new EventListenerManager();
}

// Helper functions pour backward compatibility
window.addManagedListener = (target, event, handler, options) => {
  return window.eventListenerManager.add(target, event, handler, options);
};

window.removeManagedListener = (id) => {
  return window.eventListenerManager.remove(id);
};
