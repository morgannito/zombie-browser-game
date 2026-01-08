/**
 * Day/Night Cycle System
 * Dynamic time of day with ambient lighting, sky colors, and atmosphere changes
 */

class DayNightCycle {
  constructor() {
    this.timeOfDay = 12; // 0-24 hours (start at noon)
    this.timeSpeed = 0.01; // 1 game hour = 100 seconds real time
    this.isPaused = false;

    // Sky gradient configurations by time period
    this.skyConfigs = {
      dawn: { // 5-7h
        horizon: ['#ff6b4a', '#ffa07a', '#ffcf8a'],
        zenith: ['#4a6fa5', '#6a8fc5', '#8aafdf'],
        ambient: 0.6,
        shadowIntensity: 0.3,
        fogTint: 'rgba(255, 150, 100, 0.1)'
      },
      morning: { // 7-11h
        horizon: ['#87ceeb', '#b0d8f0', '#d5e8f5'],
        zenith: ['#4a90e2', '#6aa8f0', '#8ac0ff'],
        ambient: 0.9,
        shadowIntensity: 0.2,
        fogTint: 'rgba(135, 206, 235, 0.05)'
      },
      noon: { // 11-14h
        horizon: ['#87ceeb', '#a5d8f5', '#c5e8ff'],
        zenith: ['#2a70d2', '#4a90e2', '#6ab0f2'],
        ambient: 1.0,
        shadowIntensity: 0.15,
        fogTint: 'rgba(135, 206, 235, 0.03)'
      },
      afternoon: { // 14-17h
        horizon: ['#ffb366', '#ffc994', '#ffe0b2'],
        zenith: ['#5a8fc5', '#7aafe5', '#9acfff'],
        ambient: 0.85,
        shadowIntensity: 0.25,
        fogTint: 'rgba(255, 179, 102, 0.05)'
      },
      dusk: { // 17-19h
        horizon: ['#ff7f50', '#ff9a6a', '#ffb58a'],
        zenith: ['#3a5f95', '#4a7fb5', '#5a9fd5'],
        ambient: 0.5,
        shadowIntensity: 0.4,
        fogTint: 'rgba(255, 127, 80, 0.15)'
      },
      night: { // 19-23h
        horizon: ['#1a2433', '#2a3444', '#3a4454'],
        zenith: ['#0a1420', '#1a2430', '#2a3440'],
        ambient: 0.25,
        shadowIntensity: 0.6,
        fogTint: 'rgba(26, 36, 51, 0.2)',
        stars: true,
        moonLight: true
      },
      midnight: { // 23-5h
        horizon: ['#0a1420', '#1a2430', '#2a3440'],
        zenith: ['#000510', '#0a1520', '#1a2530'],
        ambient: 0.2,
        shadowIntensity: 0.7,
        fogTint: 'rgba(10, 20, 32, 0.25)',
        stars: true,
        moonLight: true
      }
    };

    // Stars for night sky
    this.stars = [];
    this.generateStars(200);

    // Moon properties
    this.moonPhase = 0.5; // 0 = new moon, 0.5 = full moon, 1 = new moon
    this.moonX = 0;
    this.moonY = 0;
  }

  generateStars(count) {
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random() * 0.6, // Top 60% of screen
        size: 0.5 + Math.random() * 1.5,
        brightness: 0.3 + Math.random() * 0.7,
        twinkleSpeed: 0.02 + Math.random() * 0.03,
        twinkleOffset: Math.random() * Math.PI * 2
      });
    }
  }

  /**
   * Update time progression
   */
  update(deltaTime = 16) {
    if (this.isPaused) {
      return;
    }

    // Progress time
    this.timeOfDay += this.timeSpeed;
    if (this.timeOfDay >= 24) {
      this.timeOfDay -= 24;
    }

    // Update moon position (moves across sky during night)
    const nightProgress = this.getNightProgress();
    this.moonX = nightProgress;
    this.moonY = 0.2 + Math.sin(nightProgress * Math.PI) * 0.3;
  }

  getNightProgress() {
    // Calculate progress through the night (0 = sunset, 1 = sunrise)
    if (this.timeOfDay >= 19 || this.timeOfDay < 5) {
      if (this.timeOfDay >= 19) {
        return (this.timeOfDay - 19) / 10; // 19h-24h = 0-0.5
      } else {
        return 0.5 + (this.timeOfDay / 5) * 0.5; // 0h-5h = 0.5-1.0
      }
    }
    return 0;
  }

  /**
   * Get current time period
   */
  getTimePeriod() {
    const hour = this.timeOfDay;

    if (hour >= 5 && hour < 7) {
      return 'dawn';
    }
    if (hour >= 7 && hour < 11) {
      return 'morning';
    }
    if (hour >= 11 && hour < 14) {
      return 'noon';
    }
    if (hour >= 14 && hour < 17) {
      return 'afternoon';
    }
    if (hour >= 17 && hour < 19) {
      return 'dusk';
    }
    if (hour >= 19 && hour < 23) {
      return 'night';
    }
    return 'midnight'; // 23-5h
  }

  /**
   * Get interpolated configuration between time periods
   */
  getCurrentConfig() {
    const hour = this.timeOfDay;
    let currentPeriod, nextPeriod, blend;

    // Define transition points
    if (hour >= 5 && hour < 7) {
      currentPeriod = 'dawn';
      nextPeriod = 'morning';
      blend = (hour - 5) / 2;
    } else if (hour >= 7 && hour < 11) {
      currentPeriod = 'morning';
      nextPeriod = 'noon';
      blend = (hour - 7) / 4;
    } else if (hour >= 11 && hour < 14) {
      currentPeriod = 'noon';
      nextPeriod = 'afternoon';
      blend = (hour - 11) / 3;
    } else if (hour >= 14 && hour < 17) {
      currentPeriod = 'afternoon';
      nextPeriod = 'dusk';
      blend = (hour - 14) / 3;
    } else if (hour >= 17 && hour < 19) {
      currentPeriod = 'dusk';
      nextPeriod = 'night';
      blend = (hour - 17) / 2;
    } else if (hour >= 19 && hour < 23) {
      currentPeriod = 'night';
      nextPeriod = 'midnight';
      blend = (hour - 19) / 4;
    } else {
      currentPeriod = 'midnight';
      nextPeriod = 'dawn';
      if (hour >= 23) {
        blend = (hour - 23) / 6;
      } else {
        blend = 0.33 + (hour / 5) * 0.67;
      }
    }

    const current = this.skyConfigs[currentPeriod];
    const next = this.skyConfigs[nextPeriod];

    return {
      horizon: this.interpolateColors(current.horizon, next.horizon, blend),
      zenith: this.interpolateColors(current.zenith, next.zenith, blend),
      ambient: this.lerp(current.ambient, next.ambient, blend),
      shadowIntensity: this.lerp(current.shadowIntensity, next.shadowIntensity, blend),
      fogTint: current.fogTint,
      stars: current.stars || false,
      moonLight: current.moonLight || false
    };
  }

  interpolateColors(colors1, colors2, blend) {
    return colors1.map((color1, i) => {
      const color2 = colors2[i];
      return this.blendColors(color1, color2, blend);
    });
  }

  blendColors(color1, color2, blend) {
    const c1 = this.hexToRgb(color1);
    const c2 = this.hexToRgb(color2);

    const r = Math.round(c1.r + (c2.r - c1.r) * blend);
    const g = Math.round(c1.g + (c2.g - c1.g) * blend);
    const b = Math.round(c1.b + (c2.b - c1.b) * blend);

    return `rgb(${r}, ${g}, ${b})`;
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Set specific time
   */
  setTime(hour) {
    this.timeOfDay = Math.max(0, Math.min(24, hour));
  }

  /**
   * Set time speed multiplier
   */
  setTimeSpeed(speed) {
    this.timeSpeed = Math.max(0, speed);
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  /**
   * Get state for rendering
   */
  getState() {
    const config = this.getCurrentConfig();

    return {
      timeOfDay: this.timeOfDay,
      period: this.getTimePeriod(),
      config,
      stars: config.stars ? this.stars : [],
      moon: config.moonLight ? {
        x: this.moonX,
        y: this.moonY,
        phase: this.moonPhase
      } : null
    };
  }

  reset() {
    this.timeOfDay = 12;
    this.isPaused = false;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DayNightCycle;
}

if (typeof window !== 'undefined') {
  window.DayNightCycle = DayNightCycle;
}
