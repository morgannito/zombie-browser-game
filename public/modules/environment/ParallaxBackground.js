/**
 * Parallax Background System
 * Multi-layer scrolling background with depth effect
 */

class ParallaxBackground {
  constructor() {
    this.layers = [];
    this.enabled = true;

    // Default layer configurations
    this.defaultLayers = [
      {
        name: 'far-mountains',
        parallaxSpeed: 0.1,
        color: '#2a3f5f',
        shapes: 'mountains',
        density: 8,
        height: 0.3,
        yOffset: 0.6
      },
      {
        name: 'mid-trees',
        parallaxSpeed: 0.3,
        color: '#1a4d2e',
        shapes: 'trees',
        density: 12,
        height: 0.4,
        yOffset: 0.7
      },
      {
        name: 'near-grass',
        parallaxSpeed: 0.6,
        color: '#0d3b1a',
        shapes: 'grass',
        density: 20,
        height: 0.2,
        yOffset: 0.85
      }
    ];
  }

  /**
   * Initialize layers with procedural generation
   */
  init(mapWidth, mapHeight) {
    this.layers = this.defaultLayers.map(config => ({
      ...config,
      elements: this.generateLayerElements(config, mapWidth, mapHeight)
    }));
  }

  /**
   * Generate procedural elements for a layer
   */
  generateLayerElements(config, mapWidth, mapHeight) {
    const elements = [];
    const count = config.density;
    const spacing = mapWidth / count;

    for (let i = 0; i < count; i++) {
      const x = i * spacing + (Math.random() - 0.5) * spacing * 0.5;
      const baseY = mapHeight * config.yOffset;

      elements.push({
        x,
        y: baseY,
        width: spacing * (0.8 + Math.random() * 0.4),
        height: mapHeight * config.height * (0.7 + Math.random() * 0.6),
        variant: Math.floor(Math.random() * 3)
      });
    }

    return elements;
  }

  /**
   * Update layers (for animated backgrounds in future)
   */
  update(deltaTime = 16) {
    // Reserved for future animated backgrounds
  }

  /**
   * Get layer render data with parallax offset
   */
  getLayerData(camera, viewport) {
    if (!this.enabled) return [];

    return this.layers.map(layer => {
      // Calculate parallax offset
      const offsetX = camera.x * layer.parallaxSpeed;
      const offsetY = camera.y * layer.parallaxSpeed * 0.5;

      // Filter visible elements
      const visibleElements = layer.elements.filter(elem => {
        const screenX = elem.x - offsetX;
        return screenX + elem.width > 0 && screenX < viewport.width;
      });

      return {
        ...layer,
        offsetX,
        offsetY,
        visibleElements
      };
    });
  }

  /**
   * Toggle parallax effect
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Clear layers
   */
  clear() {
    this.layers = [];
  }

  reset() {
    this.clear();
    this.enabled = true;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ParallaxBackground;
}

if (typeof window !== 'undefined') {
  window.ParallaxBackground = ParallaxBackground;
}
