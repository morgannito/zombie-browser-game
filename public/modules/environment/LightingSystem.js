/**
 * Dynamic Lighting System
 * Real-time shadow casting, torch lights, and ambient lighting
 */

class LightingSystem {
  constructor() {
    this.lights = new Map();
    this.nextId = 1;

    // Global ambient settings
    this.ambientLight = 1.0; // 0-1 (affected by day/night)
    this.shadowIntensity = 0.3; // 0-1

    // Light types configuration
    this.lightTypes = {
      torch: {
        radius: 120,
        intensity: 0.8,
        color: 'rgba(255, 150, 50, 0.6)',
        flicker: true,
        flickerSpeed: 0.05,
        flickerAmount: 0.15
      },
      fire: {
        radius: 100,
        intensity: 0.7,
        color: 'rgba(255, 100, 30, 0.5)',
        flicker: true,
        flickerSpeed: 0.08,
        flickerAmount: 0.25
      },
      lamp: {
        radius: 150,
        intensity: 0.6,
        color: 'rgba(255, 255, 200, 0.4)',
        flicker: false
      },
      player: {
        radius: 80,
        intensity: 0.4,
        color: 'rgba(200, 200, 255, 0.3)',
        flicker: false
      },
      muzzleFlash: {
        radius: 60,
        intensity: 1.0,
        color: 'rgba(255, 200, 100, 0.8)',
        flicker: false,
        duration: 100 // ms
      },
      explosion: {
        radius: 200,
        intensity: 1.0,
        color: 'rgba(255, 150, 50, 0.9)',
        flicker: false,
        duration: 300 // ms
      },
      powerup: {
        radius: 70,
        intensity: 0.5,
        color: 'rgba(100, 255, 100, 0.4)',
        flicker: true,
        flickerSpeed: 0.03,
        flickerAmount: 0.2
      }
    };

    this.frameCount = 0;
  }

  /**
   * Create a new light source
   */
  createLight(type, x, y, options = {}) {
    const config = this.lightTypes[type];
    if (!config) {
      console.warn(`Unknown light type: ${type}`);
      return null;
    }

    const light = {
      id: this.nextId++,
      type,
      x,
      y,
      radius: options.radius || config.radius,
      intensity: options.intensity || config.intensity,
      color: options.color || config.color,
      flicker: config.flicker,
      flickerSpeed: config.flickerSpeed,
      flickerAmount: config.flickerAmount,
      flickerOffset: Math.random() * Math.PI * 2,
      currentIntensity: config.intensity,
      duration: config.duration || Infinity,
      createdAt: Date.now(),
      enabled: true,
      castsShadows: options.castsShadows !== false,
      ...options
    };

    this.lights.set(light.id, light);
    return light;
  }

  /**
   * Remove a light source
   */
  removeLight(id) {
    return this.lights.delete(id);
  }

  /**
   * Update all light sources
   */
  update(deltaTime = 16) {
    this.frameCount++;
    const now = Date.now();

    // Update lights and remove expired ones
    for (const [id, light] of this.lights.entries()) {
      if (!light.enabled) {
        continue;
      }

      // Check duration
      if (light.duration !== Infinity) {
        if (now - light.createdAt >= light.duration) {
          this.lights.delete(id);
          continue;
        }
      }

      // Update flicker
      if (light.flicker) {
        const flickerTime = this.frameCount * light.flickerSpeed + light.flickerOffset;
        const flickerValue = Math.sin(flickerTime) * light.flickerAmount;
        light.currentIntensity = light.intensity + flickerValue;
      } else {
        light.currentIntensity = light.intensity;
      }
    }
  }

  /**
   * Set global ambient light level (from day/night cycle)
   */
  setAmbientLight(level, shadowIntensity = null) {
    this.ambientLight = Math.max(0, Math.min(1, level));
    if (shadowIntensity !== null) {
      this.shadowIntensity = Math.max(0, Math.min(1, shadowIntensity));
    }
  }

  /**
   * Get lights in viewport (for rendering optimization)
   */
  getLightsInViewport(camera, viewport) {
    const buffer = 200; // Render lights slightly outside viewport
    const minX = camera.x - buffer;
    const maxX = camera.x + viewport.width + buffer;
    const minY = camera.y - buffer;
    const maxY = camera.y + viewport.height + buffer;

    return Array.from(this.lights.values()).filter(light => {
      if (!light.enabled) {
        return false;
      }

      const effectiveRadius = light.radius * light.currentIntensity;
      return (
        light.x + effectiveRadius > minX &&
        light.x - effectiveRadius < maxX &&
        light.y + effectiveRadius > minY &&
        light.y - effectiveRadius < maxY
      );
    });
  }

  /**
   * Calculate shadow positions for entities
   */
  calculateShadows(entities, lights, camera) {
    if (this.ambientLight >= 0.95) {
      return [];
    } // No shadows in full daylight

    const shadows = [];

    entities.forEach(entity => {
      lights.forEach(light => {
        const dx = entity.x - light.x;
        const dy = entity.y - light.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > light.radius) {
          return;
        }

        // Calculate shadow direction (away from light)
        const angle = Math.atan2(dy, dx);
        const shadowLength = Math.min(50, (light.radius - distance) * 0.5);

        shadows.push({
          x: entity.x,
          y: entity.y,
          length: shadowLength,
          angle,
          opacity: this.shadowIntensity * light.currentIntensity * (1 - this.ambientLight),
          width: entity.radius || 20
        });
      });
    });

    return shadows;
  }

  /**
   * Get all active lights
   */
  getLights() {
    return Array.from(this.lights.values()).filter(l => l.enabled);
  }

  /**
   * Get light by ID
   */
  getLight(id) {
    return this.lights.get(id);
  }

  /**
   * Update light position (for moving lights like player torch)
   */
  updateLightPosition(id, x, y) {
    const light = this.lights.get(id);
    if (light) {
      light.x = x;
      light.y = y;
    }
  }

  /**
   * Enable/disable light
   */
  setLightEnabled(id, enabled) {
    const light = this.lights.get(id);
    if (light) {
      light.enabled = enabled;
    }
  }

  /**
   * Clear all lights
   */
  clear() {
    this.lights.clear();
    this.nextId = 1;
  }

  reset() {
    this.clear();
    this.ambientLight = 1.0;
    this.shadowIntensity = 0.3;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LightingSystem;
}

if (typeof window !== 'undefined') {
  window.LightingSystem = LightingSystem;
}
