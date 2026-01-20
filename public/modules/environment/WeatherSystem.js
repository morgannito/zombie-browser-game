/**
 * Weather System
 * Rain, fog, snow, and other weather effects
 */

class WeatherSystem {
  constructor() {
    this.currentWeather = 'clear';
    this.intensity = 0;
    this.targetIntensity = 0;
    this.transitionSpeed = 0.01;

    this.raindrops = [];
    this.snowflakes = [];
    this.fogDensity = 0;

    // Weather configurations
    this.weatherTypes = {
      clear: {
        fogDensity: 0,
        visibility: 1,
        ambientLight: 1
      },
      rain: {
        fogDensity: 0.1,
        visibility: 0.8,
        ambientLight: 0.7,
        particlesPerFrame: 15,
        windX: 2,
        windY: 0
      },
      heavyRain: {
        fogDensity: 0.2,
        visibility: 0.6,
        ambientLight: 0.5,
        particlesPerFrame: 30,
        windX: 4,
        windY: 0
      },
      fog: {
        fogDensity: 0.4,
        visibility: 0.4,
        ambientLight: 0.6,
        particlesPerFrame: 0
      },
      snow: {
        fogDensity: 0.15,
        visibility: 0.7,
        ambientLight: 0.9,
        particlesPerFrame: 10,
        windX: 0.5,
        windY: 0
      },
      storm: {
        fogDensity: 0.3,
        visibility: 0.5,
        ambientLight: 0.4,
        particlesPerFrame: 40,
        windX: 6,
        windY: 1,
        lightning: true
      }
    };

    this.lightningTimer = 0;
    this.lightningActive = false;
    this.lightningDuration = 0;
  }

  /**
   * Set weather type
   */
  setWeather(weatherType, intensity = 1) {
    if (!this.weatherTypes[weatherType]) {
      console.warn(`Unknown weather type: ${weatherType}`);
      return;
    }

    this.currentWeather = weatherType;
    this.targetIntensity = Math.max(0, Math.min(1, intensity));
  }

  /**
   * Update weather state
   */
  update(_deltaTime = 16, viewport = { width: 800, height: 600 }, camera = { x: 0, y: 0 }) {
    // Smooth transition to target intensity
    if (this.intensity < this.targetIntensity) {
      this.intensity = Math.min(this.targetIntensity, this.intensity + this.transitionSpeed);
    } else if (this.intensity > this.targetIntensity) {
      this.intensity = Math.max(this.targetIntensity, this.intensity - this.transitionSpeed);
    }

    const config = this.weatherTypes[this.currentWeather];
    if (!config) {
      return;
    }

    // Update fog density
    this.fogDensity = config.fogDensity * this.intensity;

    // Update weather particles
    switch (this.currentWeather) {
    case 'rain':
    case 'heavyRain':
    case 'storm':
      this.updateRain(config, viewport, camera);
      break;
    case 'snow':
      this.updateSnow(config, viewport, camera);
      break;
    }

    // Update lightning for storms
    if (config.lightning && this.intensity > 0.5) {
      this.updateLightning();
    }

    // Update existing particles with in-place compaction to avoid allocations
    const raindrops = this.raindrops;
    let rainWrite = 0;
    for (let i = 0; i < raindrops.length; i++) {
      const drop = raindrops[i];
      drop.x += drop.vx;
      drop.y += drop.vy;
      drop.life--;
      if (drop.life > 0 && drop.y < camera.y + viewport.height + 100) {
        raindrops[rainWrite++] = drop;
      }
    }
    raindrops.length = rainWrite;

    const snowflakes = this.snowflakes;
    let snowWrite = 0;
    for (let i = 0; i < snowflakes.length; i++) {
      const flake = snowflakes[i];
      flake.x += flake.vx;
      flake.y += flake.vy;
      flake.rotation += flake.rotationSpeed;
      flake.life--;
      if (flake.life > 0 && flake.y < camera.y + viewport.height + 100) {
        snowflakes[snowWrite++] = flake;
      }
    }
    snowflakes.length = snowWrite;
  }

  updateRain(config, viewport, camera) {
    const count = Math.floor(config.particlesPerFrame * this.intensity);

    for (let i = 0; i < count; i++) {
      this.raindrops.push({
        x: camera.x + Math.random() * (viewport.width + 200) - 100,
        y: camera.y - 50,
        vx: config.windX || 2,
        vy: 15 + Math.random() * 5,
        length: 10 + Math.random() * 10,
        alpha: 0.3 + Math.random() * 0.3,
        life: 200
      });
    }
  }

  updateSnow(config, viewport, camera) {
    const count = Math.floor(config.particlesPerFrame * this.intensity);

    for (let i = 0; i < count; i++) {
      this.snowflakes.push({
        x: camera.x + Math.random() * (viewport.width + 200) - 100,
        y: camera.y - 50,
        vx: (Math.random() - 0.5) * 2,
        vy: 1 + Math.random() * 2,
        size: 2 + Math.random() * 3,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.1,
        alpha: 0.6 + Math.random() * 0.4,
        life: 300
      });
    }
  }

  updateLightning() {
    this.lightningTimer++;

    if (this.lightningActive) {
      this.lightningDuration--;
      if (this.lightningDuration <= 0) {
        this.lightningActive = false;
      }
    } else {
      // Random lightning strikes
      if (Math.random() < 0.002) { // ~0.2% chance per frame
        this.lightningActive = true;
        this.lightningDuration = 3 + Math.floor(Math.random() * 5);
      }
    }
  }

  /**
   * Get current weather state
   */
  getState() {
    const config = this.weatherTypes[this.currentWeather] || this.weatherTypes.clear;

    return {
      type: this.currentWeather,
      intensity: this.intensity,
      fogDensity: this.fogDensity,
      visibility: config.visibility * (1 - this.intensity * 0.5),
      ambientLight: config.ambientLight,
      raindrops: this.raindrops,
      snowflakes: this.snowflakes,
      lightning: this.lightningActive && config.lightning
    };
  }

  /**
   * Clear all weather
   */
  clear() {
    this.currentWeather = 'clear';
    this.intensity = 0;
    this.targetIntensity = 0;
    this.raindrops = [];
    this.snowflakes = [];
    this.fogDensity = 0;
    this.lightningActive = false;
  }

  reset() {
    this.clear();
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WeatherSystem;
}

if (typeof window !== 'undefined') {
  window.WeatherSystem = WeatherSystem;
}
