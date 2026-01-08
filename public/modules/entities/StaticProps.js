/**
 * Static Props System
 * Trees, rocks, cars, and other non-destructible environment decorations
 */

class StaticPropsSystem {
  constructor() {
    this.props = new Map();
    this.nextId = 1;

    // Prop type definitions
    this.propTypes = {
      tree: {
        name: 'Arbre',
        width: 60,
        height: 100,
        collisionRadius: 25,
        renderLayers: true,
        color: '#2d5016',
        trunkColor: '#4a3520',
        shadowSize: 1.2,
        variants: 3
      },
      rock: {
        name: 'Rocher',
        width: 50,
        height: 40,
        collisionRadius: 20,
        renderLayers: false,
        color: '#5a5a5a',
        shadowSize: 0.8,
        variants: 3
      },
      car: {
        name: 'Voiture',
        width: 80,
        height: 40,
        collisionRadius: 35,
        renderLayers: false,
        color: '#c0c0c0',
        shadowSize: 1.5,
        variants: 4
      },
      bush: {
        name: 'Buisson',
        width: 35,
        height: 30,
        collisionRadius: 15,
        renderLayers: false,
        color: '#3a6b35',
        shadowSize: 0.6,
        variants: 2
      },
      lampPost: {
        name: 'Lampadaire',
        width: 15,
        height: 90,
        collisionRadius: 8,
        renderLayers: true,
        color: '#4a4a4a',
        lightColor: '#ffff99',
        shadowSize: 0.4,
        variants: 1
      },
      fence: {
        name: 'Clôture',
        width: 60,
        height: 30,
        collisionRadius: 0, // No collision, cosmetic only
        renderLayers: false,
        color: '#6b4423',
        shadowSize: 0.5,
        variants: 2
      },
      sign: {
        name: 'Panneau',
        width: 30,
        height: 50,
        collisionRadius: 10,
        renderLayers: true,
        color: '#d4a574',
        shadowSize: 0.3,
        variants: 3
      },
      bench: {
        name: 'Banc',
        width: 50,
        height: 25,
        collisionRadius: 20,
        renderLayers: false,
        color: '#6b4423',
        shadowSize: 0.7,
        variants: 1
      }
    };
  }

  /**
   * Spawn props on the map
   */
  spawnProps(mapWidth, mapHeight, density = 0.8) {
    const types = Object.keys(this.propTypes);
    const totalProps = Math.floor(density * 100); // ~80 props per map
    const margin = 150;

    for (let i = 0; i < totalProps; i++) {
      // Weighted random selection (trees more common)
      let typeKey;
      const rand = Math.random();
      if (rand < 0.4) {
        typeKey = 'tree';
      } else if (rand < 0.6) {
        typeKey = 'rock';
      } else if (rand < 0.7) {
        typeKey = 'bush';
      } else if (rand < 0.8) {
        typeKey = 'car';
      } else if (rand < 0.85) {
        typeKey = 'lampPost';
      } else if (rand < 0.9) {
        typeKey = 'fence';
      } else if (rand < 0.95) {
        typeKey = 'sign';
      } else {
        typeKey = 'bench';
      }

      const type = this.propTypes[typeKey];

      // Random position, avoiding center spawn
      let x, y;
      let attempts = 0;
      do {
        x = margin + Math.random() * (mapWidth - margin * 2);
        y = margin + Math.random() * (mapHeight - margin * 2);
        attempts++;
      } while (this.isNearCenter(x, y, mapWidth, mapHeight, 250) && attempts < 10);

      if (attempts >= 10) {
        continue;
      } // Skip if can't find valid position

      this.createProp(typeKey, x, y);
    }
  }

  isNearCenter(x, y, mapWidth, mapHeight, radius) {
    const centerX = mapWidth / 2;
    const centerY = mapHeight / 2;
    const dx = x - centerX;
    const dy = y - centerY;
    return Math.sqrt(dx * dx + dy * dy) < radius;
  }

  createProp(typeKey, x, y, rotation = null) {
    const type = this.propTypes[typeKey];
    if (!type) {
      return null;
    }

    const prop = {
      id: this.nextId++,
      type: typeKey,
      x,
      y,
      width: type.width,
      height: type.height,
      rotation: rotation !== null ? rotation : Math.random() * Math.PI * 2,
      variant: Math.floor(Math.random() * (type.variants || 1)),
      collisionRadius: type.collisionRadius,
      zIndex: this.calculateZIndex(typeKey, y),
      ...type
    };

    this.props.set(prop.id, prop);
    return prop;
  }

  calculateZIndex(typeKey, y) {
    // Higher Y = closer to camera = higher zIndex
    // Trees and tall objects render with layers
    const baseZ = Math.floor(y / 10);

    switch (typeKey) {
    case 'tree':
    case 'lampPost':
    case 'sign':
      return baseZ + 1000; // Render above most things
    default:
      return baseZ;
    }
  }

  /**
   * Check collision with props
   */
  checkCollision(x, y, radius = 0) {
    for (const prop of this.props.values()) {
      if (prop.collisionRadius === 0) {
        continue;
      }

      const dx = x - prop.x;
      const dy = y - prop.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < (prop.collisionRadius + radius)) {
        return prop;
      }
    }
    return null;
  }

  /**
   * Get all props (sorted by zIndex for rendering)
   */
  getProps() {
    return Array.from(this.props.values()).sort((a, b) => a.zIndex - b.zIndex);
  }

  /**
   * Get props in viewport
   */
  getPropsInViewport(camera, viewport) {
    const buffer = 100; // Render props slightly outside viewport
    const minX = camera.x - buffer;
    const maxX = camera.x + viewport.width + buffer;
    const minY = camera.y - buffer;
    const maxY = camera.y + viewport.height + buffer;

    return this.getProps().filter(prop =>
      prop.x + prop.width / 2 > minX &&
      prop.x - prop.width / 2 < maxX &&
      prop.y + prop.height / 2 > minY &&
      prop.y - prop.height / 2 < maxY
    );
  }

  clear() {
    this.props.clear();
    this.nextId = 1;
  }

  reset() {
    this.clear();
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StaticPropsSystem;
}

if (typeof window !== 'undefined') {
  window.StaticPropsSystem = StaticPropsSystem;
}
