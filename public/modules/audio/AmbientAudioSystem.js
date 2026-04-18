/**
 * Ambient Audio System
 * Manages ambient sounds and background music with procedural drone, crossfade, and intensity layers.
 */

class AmbientAudioSystem {
  constructor() {
    this.enabled = true;
    this.volume = 0.3;
    this.musicVolume = 0.2;

    this.audioContext = null;
    this.currentAmbient = [];

    // Drone nodes (procedural bass)
    this._droneOsc = null;
    this._droneFilter = null;
    this._droneGain = null;
    this._droneLFO = null;
    this._modulationGain = null;
    this._droneRunning = false;

    // Music track state (Web Audio AudioBufferSourceNode or procedural)
    this._trackA = null; // { gainNode, source }
    this._trackB = null;
    this._activeSlot = 'A'; // which slot is playing
    this.currentTrack = null;
    this._fadeTimeout = null;

    // Music tracks (url:null = use procedural drone)
    this.musicTracks = {
      menu:     { url: null, volume: 0.20, loop: true },
      gameplay: { url: null, volume: 0.15, loop: true },
      combat:   { url: null, volume: 0.25, loop: true },
      boss:     { url: null, volume: 0.30, loop: true },
      victory:  { url: null, volume: 0.25, loop: false },
      defeat:   { url: null, volume: 0.20, loop: false },
    };

    // Drone parameters per track (freq, filterFreq, LFO rate)
    this._droneParams = {
      menu:     { freq: 55,  filter: 400,  lfo: 0.10 },
      gameplay: { freq: 50,  filter: 300,  lfo: 0.08 },
      combat:   { freq: 60,  filter: 800,  lfo: 0.25 },
      boss:     { freq: 40,  filter: 1200, lfo: 0.40 },
      victory:  { freq: 80,  filter: 600,  lfo: 0.15 },
      defeat:   { freq: 35,  filter: 200,  lfo: 0.05 },
    };

    // Ambient sound configurations (no files, procedural noise)
    this.ambientSounds = {
      wind:    { volume: 0.20, loop: true, fadeIn: 2000, fadeOut: 2000 },
      rain:    { volume: 0.30, loop: true, fadeIn: 3000, fadeOut: 3000 },
      crickets:{ volume: 0.15, loop: true, fadeIn: 4000, fadeOut: 4000 },
      fire:    { volume: 0.25, loop: true, fadeIn: 1000, fadeOut: 1000 },
      thunder: { volume: 0.40, loop: false, fadeIn: 0,   fadeOut: 0 },
    };
    this._ambientNodes = {}; // key -> { gainNode, source }
  }

  // ---- Init ----------------------------------------------------------------

  init() {
    if (this.audioContext) return;
    try {
      this.audioContext = window.getAudioCore?.()?.audioContext
        ?? new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('[AmbientAudio] Web Audio API not supported:', e);
    }
  }

  _ensureContext() {
    if (!this.audioContext) this.init();
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  // ---- Procedural drone ----------------------------------------------------

  _startDrone(trackKey) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    this._stopDrone();

    const params = this._droneParams[trackKey] ?? this._droneParams.gameplay;
    const trackCfg = this.musicTracks[trackKey] ?? this.musicTracks.gameplay;
    const targetVol = trackCfg.volume * this.musicVolume * this.volume;

    // Main oscillator (sine bass)
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(params.freq, ctx.currentTime);

    // Sub oscillator (octave up, detuned)
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(params.freq * 2, ctx.currentTime);
    osc2.detune.setValueAtTime(7, ctx.currentTime);

    // Filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(params.filter, ctx.currentTime);
    filter.Q.setValueAtTime(2, ctx.currentTime);

    // LFO for filter modulation
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(params.lfo, ctx.currentTime);

    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(params.filter * 0.4, ctx.currentTime);

    lfo.connect(modGain);
    modGain.connect(filter.frequency);

    // Master gain for this drone
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(targetVol, ctx.currentTime + 2.0);

    // Sub gain (quieter)
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.35, ctx.currentTime);

    osc.connect(filter);
    osc2.connect(subGain);
    subGain.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    lfo.start();
    osc.start();
    osc2.start();

    this._droneOsc = osc;
    this._droneOsc2 = osc2;
    this._droneFilter = filter;
    this._droneGain = gainNode;
    this._droneLFO = lfo;
    this._modulationGain = modGain;
    this._droneRunning = true;
  }

  _stopDrone(fadeDuration = 1500) {
    if (!this._droneRunning || !this.audioContext) return;
    const ctx = this.audioContext;
    const gain = this._droneGain;

    if (gain) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeDuration / 1000);
    }

    const osc = this._droneOsc;
    const osc2 = this._droneOsc2;
    const lfo = this._droneLFO;
    const stopAt = ctx.currentTime + fadeDuration / 1000 + 0.05;

    try { osc?.stop(stopAt); } catch (_) {}
    try { osc2?.stop(stopAt); } catch (_) {}
    try { lfo?.stop(stopAt); } catch (_) {}

    this._droneOsc = null;
    this._droneOsc2 = null;
    this._droneFilter = null;
    this._droneGain = null;
    this._droneLFO = null;
    this._modulationGain = null;
    this._droneRunning = false;
  }

  _updateDroneIntensity(trackKey) {
    if (!this._droneRunning || !this.audioContext) return;
    const ctx = this.audioContext;
    const params = this._droneParams[trackKey];
    if (!params) return;

    // Ramp filter frequency and LFO rate smoothly
    const now = ctx.currentTime;
    if (this._droneFilter) {
      this._droneFilter.frequency.cancelScheduledValues(now);
      this._droneFilter.frequency.setValueAtTime(this._droneFilter.frequency.value, now);
      this._droneFilter.frequency.linearRampToValueAtTime(params.filter, now + 1.5);
    }
    if (this._droneLFO) {
      this._droneLFO.frequency.cancelScheduledValues(now);
      this._droneLFO.frequency.setValueAtTime(this._droneLFO.frequency.value, now);
      this._droneLFO.frequency.linearRampToValueAtTime(params.lfo, now + 1.5);
    }
    if (this._droneOsc) {
      this._droneOsc.frequency.cancelScheduledValues(now);
      this._droneOsc.frequency.setValueAtTime(this._droneOsc.frequency.value, now);
      this._droneOsc.frequency.linearRampToValueAtTime(params.freq, now + 1.5);
    }
    if (this._droneOsc2) {
      this._droneOsc2.frequency.cancelScheduledValues(now);
      this._droneOsc2.frequency.setValueAtTime(this._droneOsc2.frequency.value, now);
      this._droneOsc2.frequency.linearRampToValueAtTime(params.freq * 2, now + 1.5);
    }
  }

  // ---- Music (crossfade) ---------------------------------------------------

  playMusic(trackKey, fadeDuration = 2000) {
    if (!this.enabled) return;
    if (this.currentTrack === trackKey) return;

    const track = this.musicTracks[trackKey];
    if (!track) {
      console.warn(`[Music] Unknown track: ${trackKey}`);
      return;
    }

    this.currentTrack = trackKey;

    if (track.url) {
      // Real audio file crossfade (if URL provided)
      this._crossfadeAudioFile(trackKey, track, fadeDuration);
    } else {
      // Procedural drone
      if (!this._droneRunning) {
        this._startDrone(trackKey);
      } else {
        this._updateDroneIntensity(trackKey);
        // Update target volume
        if (this._droneGain && this.audioContext) {
          const targetVol = track.volume * this.musicVolume * this.volume;
          const now = this.audioContext.currentTime;
          this._droneGain.gain.cancelScheduledValues(now);
          this._droneGain.gain.setValueAtTime(this._droneGain.gain.value, now);
          this._droneGain.gain.linearRampToValueAtTime(targetVol, now + fadeDuration / 1000);
        }
      }
    }
  }

  _crossfadeAudioFile(trackKey, track, fadeDuration) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    // Fade out current drone if running
    this._stopDrone(fadeDuration);
    // Actual audio buffer loading would go here; for now log intent
    console.log(`[Music] Crossfade to file: ${track.url} (${fadeDuration}ms)`);
  }

  stopMusic(fadeDuration = 2000) {
    if (!this.currentTrack) return;
    this.currentTrack = null;
    this._stopDrone(fadeDuration);
  }

  // ---- Ambient sounds ------------------------------------------------------

  playAmbient(soundKey) {
    if (!this.enabled || this._ambientNodes[soundKey]) return;
    const config = this.ambientSounds[soundKey];
    if (!config) return;

    const ctx = this._ensureContext();
    if (!ctx) return;

    // Generate white noise buffer (1s, looped)
    const bufferSize = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Shape noise per sound type
    const filter = ctx.createBiquadFilter();
    if (soundKey === 'rain') {
      filter.type = 'bandpass'; filter.frequency.value = 3000; filter.Q.value = 0.5;
    } else if (soundKey === 'wind') {
      filter.type = 'lowpass'; filter.frequency.value = 800; filter.Q.value = 1;
    } else if (soundKey === 'crickets') {
      filter.type = 'bandpass'; filter.frequency.value = 5000; filter.Q.value = 3;
    } else {
      filter.type = 'lowpass'; filter.frequency.value = 2000;
    }

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(
      config.volume * this.volume,
      ctx.currentTime + config.fadeIn / 1000
    );

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start();

    this._ambientNodes[soundKey] = { gainNode, source, filter };
    this.currentAmbient.push(soundKey);
  }

  stopAmbient(soundKey) {
    const node = this._ambientNodes[soundKey];
    if (!node || !this.audioContext) return;

    const config = this.ambientSounds[soundKey];
    const fadeOut = (config?.fadeOut ?? 1000) / 1000;
    const ctx = this.audioContext;

    node.gainNode.gain.cancelScheduledValues(ctx.currentTime);
    node.gainNode.gain.setValueAtTime(node.gainNode.gain.value, ctx.currentTime);
    node.gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeOut);

    try { node.source.stop(ctx.currentTime + fadeOut + 0.05); } catch (_) {}

    delete this._ambientNodes[soundKey];
    this.currentAmbient = this.currentAmbient.filter(k => k !== soundKey);
  }

  // ---- Game state update ---------------------------------------------------

  update(gameState) {
    if (!this.enabled) return;

    // Ambient: weather
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

    // Ambient: time of day
    if (gameState.dayNight) {
      const hour = gameState.dayNight.timeOfDay;
      if (hour >= 19 || hour < 5) this.playAmbient('crickets');
      else this.stopAmbient('crickets');
    }

    // Music intensity
    if (gameState.inCombat) {
      if (gameState.bossActive) this.playMusic('boss', 1000);
      else this.playMusic('combat', 1500);
    } else {
      this.playMusic('gameplay', 2000);
    }
  }

  // ---- Volume controls -----------------------------------------------------

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    this._applyVolumeToAll();
  }

  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this._droneGain && this.audioContext && this.currentTrack) {
      const track = this.musicTracks[this.currentTrack];
      const targetVol = (track?.volume ?? 0.2) * this.musicVolume * this.volume;
      const now = this.audioContext.currentTime;
      this._droneGain.gain.cancelScheduledValues(now);
      this._droneGain.gain.setValueAtTime(this._droneGain.gain.value, now);
      this._droneGain.gain.linearRampToValueAtTime(targetVol, now + 0.2);
    }
  }

  _applyVolumeToAll() {
    if (this._droneGain && this.audioContext && this.currentTrack) {
      const track = this.musicTracks[this.currentTrack];
      const targetVol = (track?.volume ?? 0.2) * this.musicVolume * this.volume;
      const now = this.audioContext.currentTime;
      this._droneGain.gain.setValueAtTime(targetVol, now);
    }
    for (const [key, node] of Object.entries(this._ambientNodes)) {
      const config = this.ambientSounds[key];
      if (node.gainNode && this.audioContext) {
        node.gainNode.gain.setValueAtTime(
          config.volume * this.volume,
          this.audioContext.currentTime
        );
      }
    }
  }

  // ---- Lifecycle -----------------------------------------------------------

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.stopAllSounds();
  }

  stopAllSounds() {
    [...this.currentAmbient].forEach(k => this.stopAmbient(k));
    this.stopMusic(500);
  }

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
