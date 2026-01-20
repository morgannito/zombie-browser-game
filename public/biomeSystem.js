/**
 * BIOME SYSTEM - Day/night, weather, and ambience variations.
 * @version 1.0.0
 */

(function() {
  'use strict';

  class BiomeSystem {
    constructor() {
      this.dayNight = null;
      this.weather = null;
      this.envParticles = null;
      this.currentBiome = null;
      this.lastBiomeWave = 1;
      this.indicator = null;
      this.baseTimeSpeed = 0.01;
      this.lastIndicatorText = '';
      this.lastWeatherKey = '';
      this.lastParticleType = '';
      this.init();
    }

    init() {
      const ready = () => this.setup();
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ready);
      } else {
        ready();
      }
    }

    setup() {
      this.createIndicator();
      this.bindEvents();
      this.ensureSystems();
    }

    createIndicator() {
      if (document.getElementById('biome-indicator')) {
        this.indicator = document.getElementById('biome-indicator');
        return;
      }

      const indicator = document.createElement('div');
      indicator.id = 'biome-indicator';
      indicator.style.display = 'none';
      document.body.appendChild(indicator);
      this.indicator = indicator;
    }

    bindEvents() {
      const safeAdd = (target, event, handler) => {
        if (window.eventListenerManager) {
          window.eventListenerManager.add(target, event, handler);
        } else {
          target.addEventListener(event, handler);
        }
      };

      safeAdd(document, 'game_started', () => {
        this.setBiome(this.pickBiome());
        if (this.indicator) {
          this.indicator.style.display = 'block';
        }
      });

      safeAdd(document, 'game_over', () => {
        if (this.indicator) {
          this.indicator.style.display = 'none';
        }
      });

      safeAdd(document, 'wave_changed', (e) => {
        const wave = e.detail?.wave || 1;
        if (wave - this.lastBiomeWave >= 12) {
          this.lastBiomeWave = wave;
          this.setBiome(this.pickBiome());
        }
      });
    }

    ensureSystems() {
      if (this.dayNight || this.weather || this.envParticles) {
        return;
      }

      if (typeof window.DayNightCycle === 'undefined' ||
        typeof window.WeatherSystem === 'undefined' ||
        typeof window.EnvironmentalParticles === 'undefined') {
        this.deferSetup();
        return;
      }

      this.dayNight = new window.DayNightCycle();
      this.weather = new window.WeatherSystem();
      this.envParticles = new window.EnvironmentalParticles();
      this.baseTimeSpeed = this.dayNight.timeSpeed || 0.01;

      if (!this.currentBiome) {
        this.setBiome(this.pickBiome());
      }
    }

    deferSetup() {
      const retry = () => this.ensureSystems();
      if (window.timerManager) {
        window.timerManager.setTimeout(retry, 500);
      } else {
        setTimeout(retry, 500);
      }
    }

    pickBiome() {
      const biomes = this.getBiomeCatalog();
      return biomes[Math.floor(Math.random() * biomes.length)];
    }

    setBiome(biome) {
      this.currentBiome = biome;
      if (!this.dayNight || !this.weather || !this.envParticles) {
        return;
      }

      this.dayNight.setTime(biome.timeOfDay);
      this.dayNight.setTimeSpeed(this.baseTimeSpeed * biome.dayNightSpeed);

      this.applyWeatherSettings(biome.weather, biome.weatherIntensity);
      this.applyParticlesSettings(biome.particles, biome.windX, biome.windY);

      this.updateIndicator();
    }

    applyWeatherSettings(type, intensity) {
      const key = `${type}_${intensity}`;
      if (this.lastWeatherKey !== key) {
        this.weather.setWeather(type, intensity);
        this.lastWeatherKey = key;
      }
    }

    applyParticlesSettings(type, windX, windY) {
      if (this.lastParticleType !== type) {
        this.envParticles.setType(type);
        this.lastParticleType = type;
      }
      this.envParticles.setWind(windX, windY);
    }

    update(deltaTime = 16) {
      if (!this.dayNight || !this.weather || !this.envParticles || !window.gameState) {
        return;
      }

      const overrides = window.runMutatorsSystem?.getEnvironmentOverrides?.() || {};
      const biome = this.currentBiome || this.pickBiome();

      const timeSpeed = this.baseTimeSpeed * (biome.dayNightSpeed || 1) * (deltaTime / 16);
      this.dayNight.setTimeSpeed(timeSpeed);
      if (overrides.timeOfDay !== undefined) {
        this.dayNight.setTime(overrides.timeOfDay);
      }

      this.dayNight.update(deltaTime);

      const weatherType = overrides.weather || biome.weather;
      const weatherIntensity = overrides.weatherIntensity ?? biome.weatherIntensity;
      this.applyWeatherSettings(weatherType, weatherIntensity);

      const particleType = overrides.particles || biome.particles;
      const windX = overrides.windX ?? biome.windX;
      const windY = overrides.windY ?? biome.windY;
      this.applyParticlesSettings(particleType, windX, windY);

      const camera = window.gameEngine?.camera || { x: 0, y: 0 };
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      this.weather.update(deltaTime, viewport, camera);
      this.envParticles.update(deltaTime, camera, viewport);

      this.applyToGameState();
      this.updateIndicator();
    }

    applyToGameState() {
      if (!window.gameState || !window.gameState.state) {
        return;
      }

      const weatherConfig = this.weather.weatherTypes[this.weather.currentWeather] || {};
      window.gameState.state.weather = {
        type: this.weather.currentWeather,
        intensity: this.weather.intensity,
        fogDensity: this.weather.fogDensity,
        ambientLight: weatherConfig.ambientLight || 1,
        lightning: this.weather.lightningActive,
        raindrops: this.weather.raindrops,
        snowflakes: this.weather.snowflakes
      };

      window.gameState.state.dayNight = this.dayNight.getState();
      window.gameState.state.envParticles = this.envParticles;
    }

    updateIndicator() {
      if (!this.indicator || !this.currentBiome) {
        return;
      }

      const weatherLabels = {
        clear: 'Ciel clair',
        rain: 'Pluie',
        heavyRain: 'Pluie forte',
        fog: 'Brouillard',
        snow: 'Neige',
        storm: 'Orage'
      };
      const weatherName = weatherLabels[this.weather?.currentWeather] || this.weather?.currentWeather || 'Calme';
      const text = `${this.currentBiome.name} • ${weatherName}`;

      if (text !== this.lastIndicatorText) {
        this.indicator.textContent = text;
        this.lastIndicatorText = text;
      }
    }

    getBiomeCatalog() {
      return [
        {
          id: 'verdant',
          name: 'Forêt verdoyante',
          weather: 'rain',
          weatherIntensity: 0.4,
          particles: 'leaf',
          windX: 0.4,
          windY: 0.1,
          dayNightSpeed: 1,
          timeOfDay: 9
        },
        {
          id: 'ashen',
          name: 'Terres cendrées',
          weather: 'fog',
          weatherIntensity: 0.7,
          particles: 'ash',
          windX: 0.2,
          windY: 0.05,
          dayNightSpeed: 0.8,
          timeOfDay: 19
        },
        {
          id: 'tundra',
          name: 'Toundra gelée',
          weather: 'snow',
          weatherIntensity: 0.6,
          particles: 'pollen',
          windX: 0.3,
          windY: 0,
          dayNightSpeed: 1.1,
          timeOfDay: 13
        },
        {
          id: 'neon',
          name: 'Ruines néon',
          weather: 'storm',
          weatherIntensity: 0.5,
          particles: 'ember',
          windX: 0.5,
          windY: 0.2,
          dayNightSpeed: 1.2,
          timeOfDay: 21
        }
      ];
    }
  }

  window.biomeSystem = new BiomeSystem();
})();
