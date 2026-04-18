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
   * Initialize offscreen depth layers (far stars + mid dust).
   * Call once with viewport dimensions; safe to call again on resize.
   */
  initDepthLayers(vpW, vpH) {
    this._depthLayers = this._buildDepthLayers(vpW, vpH);
  }

  _buildDepthLayers(vpW, vpH) {
    const rng = (seed) => {
      let s = seed;
      return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
      };
    };

    // --- Far layer: large stars + distant silhouettes (speed 0.2x) ---
    const farCanvas = document.createElement('canvas');
    // 3x viewport width so we can tile by scrolling
    farCanvas.width = vpW * 3;
    farCanvas.height = vpH;
    const farCtx = farCanvas.getContext('2d');
    const r1 = rng(42);

    // Stars
    for (let i = 0; i < 120; i++) {
      const x = r1() * farCanvas.width;
      const y = r1() * vpH * 0.8;
      const size = 1 + r1() * 3;
      farCtx.fillStyle = `rgba(200,210,255,${0.3 + r1() * 0.5})`;
      farCtx.beginPath();
      farCtx.arc(x, y, size, 0, Math.PI * 2);
      farCtx.fill();
    }

    // Distant silhouettes (ruins / mountain shapes)
    for (let i = 0; i < 18; i++) {
      const x = r1() * farCanvas.width;
      const w = 60 + r1() * 120;
      const h = 40 + r1() * 80;
      const y = vpH * (0.55 + r1() * 0.2);
      farCtx.fillStyle = `rgba(20,25,45,${0.5 + r1() * 0.3})`;
      farCtx.beginPath();
      farCtx.moveTo(x, y);
      farCtx.lineTo(x + w * 0.5, y - h);
      farCtx.lineTo(x + w, y);
      farCtx.closePath();
      farCtx.fill();
    }

    // --- Mid layer: grey dust particles (speed 0.5x) ---
    const midCanvas = document.createElement('canvas');
    midCanvas.width = vpW * 3;
    midCanvas.height = vpH;
    const midCtx = midCanvas.getContext('2d');
    const r2 = rng(99);

    for (let i = 0; i < 200; i++) {
      const x = r2() * midCanvas.width;
      const y = r2() * vpH;
      const rx = 2 + r2() * 8;
      const ry = 1 + r2() * 3;
      midCtx.fillStyle = `rgba(160,150,140,${0.04 + r2() * 0.1})`;
      midCtx.beginPath();
      midCtx.ellipse(x, y, rx, ry, r2() * Math.PI, 0, Math.PI * 2);
      midCtx.fill();
    }

    return [
      { canvas: farCanvas, speed: 0.2, vpW, vpH },
      { canvas: midCanvas, speed: 0.5, vpW, vpH }
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
  update(_deltaTime = 16) {
    // Reserved for future animated backgrounds
  }

  /**
   * Get layer render data with parallax offset
   */
  getLayerData(camera, viewport) {
    if (!this.enabled) {
      return [];
    }

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
