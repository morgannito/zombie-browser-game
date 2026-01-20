/**
 * OPTIMIZED SOUND EFFECTS
 * Uses OptimizedAudioCore for all sound playback with throttling and pooling
 * Replaces EnhancedSoundEffects with better resource management
 * @version 1.0.0
 * @author Claude Code
 */

class OptimizedSoundEffects {
  constructor() {
    this.core = window.getAudioCore ? window.getAudioCore() : null;
    if (!this.core) {
      console.warn('[OptimizedSoundEffects] OptimizedAudioCore not available');
    }
  }

  /**
   * SHOOT SOUNDS - Optimized with throttling
   */
  playShoot(weaponType = 'pistol', distance = 0) {
    if (!this.core) {
      return;
    }

    const attenuation = this.calculateDistanceAttenuation(distance);
    if (attenuation < 0.05) {
      return;
    } // Too far, don't play

    switch (weaponType) {
    case 'pistol':
      this.playPistolShot(attenuation);
      break;
    case 'shotgun':
      this.playShotgunShot(attenuation);
      break;
    case 'machinegun':
    case 'minigun':
      this.playMachinegunShot(attenuation);
      break;
    case 'rifle':
    case 'sniper':
      this.playRifleShot(attenuation);
      break;
    default:
      this.playPistolShot(attenuation);
    }
  }

  playPistolShot(volume = 1) {
    // Muzzle blast
    this.core.playTone({
      type: 'shoot',
      frequency: 280 + Math.random() * 40,
      frequencyEnd: 80,
      duration: 0.08,
      volume: 0.35 * volume,
      waveType: 'square',
      filterFreq: 1200,
      filterType: 'lowpass',
      useReverb: true,
      reverbAmount: 0.12
    });

    // Mechanical click (delayed)
    (window.setManagedTimeout || setTimeout)(() => {
      this.core.playTone({
        type: 'shoot',
        frequency: 2500 + Math.random() * 500,
        duration: 0.01,
        volume: 0.12 * volume,
        waveType: 'square',
        filterFreq: 2000,
        filterType: 'highpass'
      });
    }, 10);
  }

  playShotgunShot(volume = 1) {
    // Multiple pellet sounds
    for (let i = 0; i < 3; i++) {
      const delay = i * 3;
      (window.setManagedTimeout || setTimeout)(() => {
        this.core.playTone({
          type: 'shoot',
          frequency: 120 + Math.random() * 40,
          frequencyEnd: 50,
          duration: 0.15,
          volume: (0.4 - i * 0.08) * volume,
          waveType: 'sawtooth',
          filterFreq: 800 - i * 100,
          filterType: 'lowpass',
          useReverb: true,
          reverbAmount: 0.2
        });
      }, delay);
    }
  }

  playMachinegunShot(volume = 1) {
    this.core.playTone({
      type: 'machinegun', // Special throttle config
      frequency: 380 + Math.random() * 60,
      frequencyEnd: 100,
      duration: 0.035,
      volume: 0.22 * volume,
      waveType: 'square',
      filterFreq: 1000 + Math.random() * 200,
      filterType: 'bandpass',
      useReverb: true,
      reverbAmount: 0.06
    });
  }

  playRifleShot(volume = 1) {
    // Supersonic crack
    this.core.playTone({
      type: 'shoot',
      frequency: 2000,
      frequencyEnd: 800,
      duration: 0.02,
      volume: 0.25 * volume,
      waveType: 'square',
      filterFreq: 1500,
      filterType: 'highpass'
    });

    // Main blast (delayed slightly)
    (window.setManagedTimeout || setTimeout)(() => {
      this.core.playTone({
        type: 'shoot',
        frequency: 200,
        frequencyEnd: 60,
        duration: 0.18,
        volume: 0.45 * volume,
        waveType: 'sawtooth',
        filterFreq: 1500,
        filterType: 'lowpass',
        useReverb: true,
        reverbAmount: 0.25
      });
    }, 5);
  }

  /**
   * HIT SOUNDS
   */
  playHit(isCritical = false) {
    if (!this.core) {
      return;
    }

    this.core.playTone({
      type: 'hit',
      frequency: isCritical ? 600 : 400,
      frequencyEnd: isCritical ? 100 : 80,
      duration: 0.1,
      volume: isCritical ? 0.35 : 0.2,
      waveType: 'sawtooth'
    });
  }

  /**
   * ZOMBIE DEATH
   */
  playZombieDeath() {
    if (!this.core) {
      return;
    }

    this.core.playTone({
      type: 'zombieDeath',
      frequency: 300,
      frequencyEnd: 50,
      duration: 0.3,
      volume: 0.28,
      waveType: 'sawtooth',
      filterFreq: 1000,
      filterType: 'lowpass',
      useReverb: true,
      reverbAmount: 0.1
    });
  }

  /**
   * EXPLOSION
   */
  playExplosion() {
    if (!this.core) {
      return;
    }

    this.core.playNoise({
      type: 'explosion',
      duration: 0.5,
      volume: 0.5,
      filterFreqStart: 1000,
      filterFreqEnd: 50,
      useReverb: true
    });
  }

  /**
   * COLLECT (gold, powerup)
   */
  playCollect(type = 'gold') {
    if (!this.core) {
      return;
    }

    if (type === 'gold') {
      this.core.playTone({
        type: 'collect',
        frequency: 800,
        frequencyEnd: 1200,
        duration: 0.1,
        volume: 0.25,
        waveType: 'sine'
      });
    } else if (type === 'powerup') {
      this.core.playTone({
        type: 'collect',
        frequency: 400,
        frequencyEnd: 800,
        duration: 0.2,
        volume: 0.25,
        waveType: 'sine'
      });
    }
  }

  /**
   * LEVEL UP - Arpeggio
   */
  playLevelUp() {
    if (!this.core) {
      return;
    }

    const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C, E, G, C
    frequencies.forEach((freq, i) => {
      (window.setManagedTimeout || setTimeout)(() => {
        this.core.playTone({
          type: 'levelup',
          frequency: freq,
          duration: 0.25,
          volume: 0.25,
          waveType: 'sine'
        });
      }, i * 100);
    });
  }

  /**
   * PLAYER DAMAGE
   */
  playPlayerDamage() {
    if (!this.core) {
      return;
    }

    this.core.playTone({
      type: 'playerDamage',
      frequency: 200,
      frequencyEnd: 100,
      duration: 0.2,
      volume: 0.35,
      waveType: 'sawtooth'
    });
  }

  /**
   * HEAL
   */
  playHeal() {
    if (!this.core) {
      return;
    }

    this.core.playTone({
      type: 'collect',
      frequency: 600,
      frequencyEnd: 900,
      duration: 0.3,
      volume: 0.2,
      waveType: 'sine'
    });
  }

  /**
   * BOSS SPAWN
   */
  playBossSpawn() {
    if (!this.core) {
      return;
    }

    // Triple bass drone
    for (let i = 0; i < 3; i++) {
      this.core.playTone({
        type: 'bossSpawn',
        frequency: 80 - i * 10,
        frequencyEnd: 60 - i * 10,
        duration: 1.0,
        volume: 0.18,
        waveType: 'sawtooth'
      });
    }
  }

  /**
   * UI SOUNDS
   */
  playUISound(type = 'click') {
    if (!this.core) {
      return;
    }

    if (type === 'click') {
      this.core.playTone({
        type: 'ui',
        frequency: 800,
        duration: 0.05,
        volume: 0.18,
        waveType: 'sine'
      });
    } else if (type === 'hover') {
      this.core.playTone({
        type: 'ui',
        frequency: 600,
        duration: 0.03,
        volume: 0.1,
        waveType: 'sine'
      });
    } else if (type === 'reward') {
      this.core.playTone({
        type: 'ui',
        frequency: 900,
        frequencyEnd: 1400,
        duration: 0.14,
        volume: 0.2,
        waveType: 'sine'
      });
    }
  }

  /**
   * RELOAD
   */
  playReload(weaponType = 'pistol') {
    if (!this.core) {
      return;
    }

    // Magazine out
    this.core.playTone({
      type: 'ui',
      frequency: 2500,
      duration: 0.015,
      volume: 0.15,
      waveType: 'square',
      filterFreq: 2000,
      filterType: 'highpass'
    });

    // Magazine in
    (window.setManagedTimeout || setTimeout)(() => {
      this.core.playTone({
        type: 'ui',
        frequency: 600,
        duration: 0.04,
        volume: 0.2,
        waveType: 'square',
        filterFreq: 800,
        filterType: 'bandpass'
      });
    }, 300);

    // Bolt action for non-pistols
    if (weaponType !== 'pistol') {
      (window.setManagedTimeout || setTimeout)(() => {
        this.core.playTone({
          type: 'ui',
          frequency: 2500,
          duration: 0.02,
          volume: 0.18,
          waveType: 'square',
          filterFreq: 2000,
          filterType: 'highpass'
        });
      }, 600);
    }
  }

  /**
   * DRY FIRE (empty gun)
   */
  playDryFire() {
    if (!this.core) {
      return;
    }

    this.core.playTone({
      type: 'ui',
      frequency: 1500,
      duration: 0.02,
      volume: 0.12,
      waveType: 'square'
    });
  }

  /**
   * Distance attenuation calculation
   */
  calculateDistanceAttenuation(distance, maxDistance = 1000) {
    if (distance >= maxDistance) {
      return 0;
    }
    return Math.max(0, 1 - (distance / maxDistance));
  }

  /**
   * Get stats from core
   */
  getStats() {
    return this.core ? this.core.getStats() : null;
  }
}

// Export
if (typeof window !== 'undefined') {
  window.OptimizedSoundEffects = OptimizedSoundEffects;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = OptimizedSoundEffects;
}
