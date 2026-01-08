/**
 * Ambient Audio System
 * Manages ambient sounds and background music
 */

class AmbientAudioSystem {
  constructor() {
    this.enabled = true;
    this.volume = 0.3;
    this.musicVolume = 0.2;

    // Audio context (Web Audio API for advanced control)
    this.audioContext = null;
    this.currentMusic = null;
    this.currentAmbient = [];

    // Ambient sound configurations
    this.ambientSounds = {
      wind: {
        url: null, // Placeholder - would load from assets
        volume: 0.2,
        loop: true,
        fadeIn: 2000,
        fadeOut: 2000
      },
      rain: {
        url: null,
        volume: 0.3,
        loop: true,
        fadeIn: 3000,
        fadeOut: 3000
      },
      crickets: {
        url: null,
        volume: 0.15,
        loop: true,
        fadeIn: 4000,
        fadeOut: 4000
      },
      fire: {
        url: null,
        volume: 0.25,
        loop: true,
        fadeIn: 1000,
        fadeOut: 1000
      },
      thunder: {
        url: null,
        volume: 0.4,
        loop: false,
        fadeIn: 0,
        fadeOut: 0
      }
    };

    // Music tracks
    this.musicTracks = {
      menu: {
        url: null,
        volume: 0.2,
        loop: true
      },
      gameplay: {
        url: null,
        volume: 0.15,
        loop: true
      },
      combat: {
        url: null,
        volume: 0.25,
        loop: true
      },
      boss: {
        url: null,
        volume: 0.3,
        loop: true
      },
      victory: {
        url: null,
        volume: 0.25,
        loop: false
      },
      defeat: {
        url: null,
        volume: 0.2,
        loop: false
      }
    };

    this.currentTrack = null;
    this.fadeTimeout = null;
  }

  /**
   * Initialize audio system
   */
  init() {
    // Create audio context on user interaction
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('Web Audio API not supported:', e);
      }
    }
  }

  /**
   * Play ambient sound
   */
  playAmbient(soundKey) {
    if (!this.enabled) {
      return;
    }

    const config = this.ambientSounds[soundKey];
    if (!config) {
      console.warn(`Unknown ambient sound: ${soundKey}`);
      return;
    }

    // Placeholder: Would create and play HTML5 Audio element
    console.log(`[Ambient] Playing: ${soundKey} (volume: ${config.volume})`);
  }

  /**
   * Stop ambient sound
   */
  stopAmbient(soundKey) {
    console.log(`[Ambient] Stopping: ${soundKey}`);
    // Would fade out and remove from currentAmbient array
  }

  /**
   * Play music track with crossfade
   */
  playMusic(trackKey, fadeDuration = 2000) {
    if (!this.enabled) {
      return;
    }

    const track = this.musicTracks[trackKey];
    if (!track) {
      console.warn(`Unknown music track: ${trackKey}`);
      return;
    }

    // If same track, do nothing
    if (this.currentTrack === trackKey) {
      return;
    }

    console.log(`[Music] Switching to: ${trackKey} (fade: ${fadeDuration}ms)`);

    // Placeholder: Would crossfade between tracks
    this.currentTrack = trackKey;
  }

  /**
   * Stop music
   */
  stopMusic(fadeDuration = 2000) {
    if (!this.currentTrack) {
      return;
    }

    console.log(`[Music] Stopping (fade: ${fadeDuration}ms)`);
    this.currentTrack = null;
  }

  /**
   * Update ambient sounds based on game state
   */
  update(gameState) {
    if (!this.enabled) {
      return;
    }

    // Auto-play ambient based on weather
    if (gameState.weather) {
      if (gameState.weather.type === 'rain' || gameState.weather.type === 'storm') {
        this.playAmbient('rain');
      } else {
        this.stopAmbient('rain');
      }

      if (gameState.weather.type === 'storm' && Math.random() < 0.01) {
        this.playAmbient('thunder');
      }
    }

    // Auto-play ambient based on time of day
    if (gameState.dayNight) {
      const hour = gameState.dayNight.timeOfDay;
      if (hour >= 19 || hour < 5) {
        // Night time - crickets
        this.playAmbient('crickets');
      } else {
        this.stopAmbient('crickets');
      }
    }

    // Auto-switch music based on combat state
    if (gameState.inCombat) {
      if (gameState.bossActive) {
        this.playMusic('boss', 1000);
      } else {
        this.playMusic('combat', 1500);
      }
    } else {
      this.playMusic('gameplay', 2000);
    }
  }

  /**
   * Set master volume
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    console.log(`[Audio] Master volume: ${this.volume}`);
  }

  /**
   * Set music volume
   */
  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    console.log(`[Audio] Music volume: ${this.musicVolume}`);
  }

  /**
   * Enable/disable system
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAllSounds();
    }
  }

  /**
   * Stop all sounds and music
   */
  stopAllSounds() {
    this.currentAmbient.forEach(sound => this.stopAmbient(sound));
    this.stopMusic(500);
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.stopAllSounds();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  reset() {
    this.stopAllSounds();
    this.volume = 0.3;
    this.musicVolume = 0.2;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AmbientAudioSystem;
}

if (typeof window !== 'undefined') {
  window.AmbientAudioSystem = AmbientAudioSystem;
}
