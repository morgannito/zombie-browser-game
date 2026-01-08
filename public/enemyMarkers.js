/**
 * Enemy Markers System
 * Visual markers for elite zombies and bosses (on-screen and off-screen indicators)
 */

class EnemyMarkers {
  constructor() {
    this.markers = new Map(); // Map of entity ID to marker element
    this.indicators = new Map(); // Map of entity ID to off-screen indicator
    this.indicatorsContainer = null;

    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    this.indicatorsContainer = document.getElementById('enemy-indicators');
  }

  /**
   * Update markers for all elite/boss entities
   * @param {Array} entities - Array of entity objects with {id, type, x, y, health, maxHealth, screenX, screenY, isVisible}
   * @param {Object} camera - Camera object with {x, y}
   * @param {Object} viewport - Viewport size {width, height}
   */
  update(entities, camera, viewport) {
    if (!entities || !Array.isArray(entities)) {
      this.clear();
      return;
    }

    const activeIds = new Set();

    entities.forEach(entity => {
      if (!entity || (!entity.isElite && !entity.isBoss)) {
        return;
      }

      activeIds.add(entity.id);

      if (entity.isVisible) {
        // Show on-screen marker
        this.updateOnScreenMarker(entity);
        this.hideOffScreenIndicator(entity.id);
      } else {
        // Show off-screen indicator
        this.hideOnScreenMarker(entity.id);
        this.updateOffScreenIndicator(entity, camera, viewport);
      }
    });

    // Remove markers for entities that no longer exist
    this.markers.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        this.hideOnScreenMarker(id);
      }
    });

    this.indicators.forEach((indicator, id) => {
      if (!activeIds.has(id)) {
        this.hideOffScreenIndicator(id);
      }
    });
  }

  updateOnScreenMarker(entity) {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
      return;
    }

    let marker = this.markers.get(entity.id);

    if (!marker) {
      marker = this.createOnScreenMarker(entity);
      this.markers.set(entity.id, marker);
      canvas.parentElement.appendChild(marker);
    }

    // Update position (screenX, screenY are canvas coordinates)
    const canvasRect = canvas.getBoundingClientRect();
    marker.style.left = `${canvasRect.left + (entity.screenX || 0)}px`;
    marker.style.top = `${canvasRect.top + (entity.screenY || 0)}px`;

    // Update health bar if elite
    if (entity.isElite && entity.health !== undefined) {
      const healthBar = marker.querySelector('.elite-health-fill');
      if (healthBar) {
        const healthPercent = (entity.health / (entity.maxHealth || 100)) * 100;
        healthBar.style.width = `${Math.max(0, healthPercent)}%`;
      }
    }

    marker.style.display = 'block';
  }

  createOnScreenMarker(entity) {
    const marker = document.createElement('div');
    marker.className = entity.isBoss ? 'boss-marker' : 'elite-marker';

    const ring = document.createElement('div');
    ring.className = entity.isBoss ? 'boss-marker-ring' : 'elite-marker-ring';

    const icon = document.createElement('div');
    icon.className = entity.isBoss ? 'boss-marker-icon' : 'elite-marker-icon';
    icon.textContent = entity.isBoss ? '👑' : '⭐';

    marker.appendChild(ring);
    marker.appendChild(icon);

    // Add health bar for elites
    if (entity.isElite) {
      const healthBar = document.createElement('div');
      healthBar.className = 'elite-health-bar';

      const healthFill = document.createElement('div');
      healthFill.className = 'elite-health-fill';

      healthBar.appendChild(healthFill);
      marker.appendChild(healthBar);
    }

    return marker;
  }

  hideOnScreenMarker(entityId) {
    const marker = this.markers.get(entityId);
    if (marker) {
      marker.style.display = 'none';
      marker.remove();
      this.markers.delete(entityId);
    }
  }

  updateOffScreenIndicator(entity, camera, viewport) {
    if (!this.indicatorsContainer) {
      return;
    }

    let indicator = this.indicators.get(entity.id);

    if (!indicator) {
      indicator = this.createOffScreenIndicator(entity);
      this.indicators.set(entity.id, indicator);
      this.indicatorsContainer.appendChild(indicator);
    }

    // Calculate position on screen edge
    const { x, y, direction } = this.calculateIndicatorPosition(entity, camera, viewport);

    indicator.style.left = `${x}px`;
    indicator.style.top = `${y}px`;

    // Update direction class
    indicator.className = entity.isBoss ? 'boss-indicator' : 'elite-indicator';
    indicator.classList.add(direction);

    // Update distance
    const distance = this.calculateDistance(entity, camera);
    const distanceEl = indicator.querySelector('.indicator-distance');
    if (distanceEl) {
      distanceEl.textContent = `${Math.round(distance)}m`;
    }

    indicator.style.display = 'flex';
  }

  createOffScreenIndicator(entity) {
    const indicator = document.createElement('div');
    indicator.className = entity.isBoss ? 'boss-indicator' : 'elite-indicator';

    const icon = document.createElement('div');
    icon.textContent = entity.isBoss ? '👑' : '⭐';

    const distance = document.createElement('div');
    distance.className = 'indicator-distance';
    distance.textContent = '0m';

    indicator.appendChild(icon);
    indicator.appendChild(distance);

    // Click to focus camera on entity
    indicator.addEventListener('click', () => {
      if (window.gameEngine && window.gameEngine.focusOnEntity) {
        window.gameEngine.focusOnEntity(entity.id);
      }
    });

    return indicator;
  }

  hideOffScreenIndicator(entityId) {
    const indicator = this.indicators.get(entityId);
    if (indicator) {
      indicator.style.display = 'none';
      indicator.remove();
      this.indicators.delete(entityId);
    }
  }

  calculateIndicatorPosition(entity, camera, viewport) {
    const margin = 50; // Distance from edge
    const vw = viewport.width || window.innerWidth;
    const vh = viewport.height || window.innerHeight;

    // Get angle from camera to entity
    const dx = entity.x - camera.x;
    const dy = entity.y - camera.y;
    const angle = Math.atan2(dy, dx);

    // Calculate position on edge
    let x, y, direction;

    // Determine which edge the indicator should be on
    const absAngle = Math.abs(angle);
    const cornerAngle = Math.atan2(vh / 2 - margin, vw / 2 - margin);

    if (absAngle < cornerAngle) {
      // Right edge
      x = vw - margin;
      y = vh / 2 + Math.tan(angle) * (vw / 2 - margin);
      direction = 'right';
    } else if (absAngle > Math.PI - cornerAngle) {
      // Left edge
      x = margin;
      y = vh / 2 - Math.tan(angle) * (vw / 2 - margin);
      direction = 'left';
    } else if (angle > 0) {
      // Bottom edge
      y = vh - margin;
      x = vw / 2 + (vh / 2 - margin) / Math.tan(angle);
      direction = 'bottom';
    } else {
      // Top edge
      y = margin;
      x = vw / 2 - (vh / 2 - margin) / Math.tan(angle);
      direction = 'top';
    }

    // Clamp to viewport
    x = Math.max(margin, Math.min(vw - margin, x));
    y = Math.max(margin, Math.min(vh - margin, y));

    return { x, y, direction };
  }

  calculateDistance(entity, camera) {
    const dx = entity.x - camera.x;
    const dy = entity.y - camera.y;
    return Math.sqrt(dx * dx + dy * dy) / 50; // Convert pixels to meters (arbitrary scale)
  }

  clear() {
    // Remove all markers
    this.markers.forEach(marker => marker.remove());
    this.markers.clear();

    // Remove all indicators
    this.indicators.forEach(indicator => indicator.remove());
    this.indicators.clear();
  }

  reset() {
    this.clear();
  }
}

// Auto-initialize
if (typeof window !== 'undefined') {
  window.enemyMarkers = new EnemyMarkers();
}
