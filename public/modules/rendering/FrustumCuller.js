/**
 * FRUSTUM CULLER
 * Optimise le rendering en n'affichant que les entités visibles à l'écran
 * @module FrustumCuller
 * @version 1.0.0
 */

class FrustumCuller {
  constructor() {
    this.margin = 100; // Marge autour de l'écran pour smooth transitions
  }

  /**
   * Vérifie si un point est visible dans la caméra
   * @param {number} x - Position X
   * @param {number} y - Position Y
   * @param {Object} camera - Camera {x, y, width, height}
   * @returns {boolean}
   */
  isPointVisible(x, y, camera) {
    return (
      x >= camera.x - this.margin &&
      x <= camera.x + camera.width + this.margin &&
      y >= camera.y - this.margin &&
      y <= camera.y + camera.height + this.margin
    );
  }

  /**
   * Vérifie si un rectangle est visible
   * @param {Object} entity - {x, y, width, height}
   * @param {Object} camera - Camera position
   * @returns {boolean}
   */
  isRectVisible(entity, camera) {
    const entityRight = entity.x + (entity.width || 0);
    const entityBottom = entity.y + (entity.height || 0);
    const cameraRight = camera.x + camera.width;
    const cameraBottom = camera.y + camera.height;

    return !(
      entityRight < camera.x - this.margin ||
      entity.x > cameraRight + this.margin ||
      entityBottom < camera.y - this.margin ||
      entity.y > cameraBottom + this.margin
    );
  }

  /**
   * Filtre les entités visibles
   * @param {Array} entities - Liste d'entités
   * @param {Object} camera - Camera position
   * @returns {Array} Entités visibles
   */
  filterVisible(entities, camera) {
    if (!Array.isArray(entities)) {
      entities = Object.values(entities);
    }

    return entities.filter(entity => {
      if (!entity || typeof entity.x !== 'number' || typeof entity.y !== 'number') {
        return false;
      }

      // Pour les entités avec size/radius
      if (entity.size || entity.radius) {
        const size = entity.size || entity.radius * 2;
        return this.isRectVisible(
          { x: entity.x - size / 2, y: entity.y - size / 2, width: size, height: size },
          camera
        );
      }

      // Pour les entités avec width/height
      if (entity.width || entity.height) {
        return this.isRectVisible(entity, camera);
      }

      // Point simple
      return this.isPointVisible(entity.x, entity.y, camera);
    });
  }

  /**
   * Compte les entités visibles vs total
   * @param {Array} entities
   * @param {Object} camera
   * @returns {Object} {visible, total, culled}
   */
  getStats(entities, camera) {
    const total = Array.isArray(entities) ? entities.length : Object.keys(entities).length;
    const visible = this.filterVisible(entities, camera).length;

    return {
      visible,
      total,
      culled: total - visible,
      cullRate: total > 0 ? ((total - visible) / total * 100).toFixed(1) : 0
    };
  }
}

// Export pour utilisation globale
if (typeof window !== 'undefined') {
  window.FrustumCuller = FrustumCuller;
}
