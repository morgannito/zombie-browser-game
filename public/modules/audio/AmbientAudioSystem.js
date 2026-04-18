/**
 * Ambient Audio System
 * Manages ambient sounds and background music with procedural drone,
 * crossfade, and intensity layers.
 *
 * All nodes route through the shared OptimizedAudioCore masterGain
 * (if available) so global volume and mute apply. Nodes are disconnected
 * on stop to prevent AudioContext node leaks.
 * @version 1.1.0
 */

class AmbientAudioSystem {
  constructor() {
    this.enabled = true;
    this.volume = 0.3;
    this.musicVolume = 0.2;

    /** @type {AudioContext|null} */
    this.audioContext = null;
    /** @type {GainNode|null} shared master output node */
    this._masterOut = null;

    /** @type {string[]} keys of currently active ambient sounds */
    this.currentAmbient = [];

    // Drone nodes (procedural bass)
    this._droneOsc = null;
    this._droneOsc2 = null;
    this._droneFilter = null;
    this._droneGain = null;
    this._droneLFO = null;
    this._modulationGain = null;
    this._droneRunning = false;

    /** @type {string|null} */
    this.currentTrack = null;

    /** @type {Object<string, {volume:number, loop:boolean}>} */
    this.musicTracks = {
      menu:     { url: null, volume: 0.20, loop: true },
      gameplay: { url: null, volume: 0.15, loop: true },
      combat:   { url: null, volume: 0.25, loop: true },
      boss:     { url: null, volume: 0.30, loop: true },
      victory:  { url: null, volume: 0.25, loop: false },
      defeat:   { url: null, volume: 0.20, loop: false },
    };

    /** @type {Object<string, {freq:number, filter:number, lfo:number}>} */
    this._droneParams = {
      menu:     { freq: 55,  filter: 400,  lfo: 0.10 },
      gameplay: { freq: 50,  filter: 300,  lfo: 0.08 },
      combat:   { freq: 60,  filter: 800,  lfo: 0.25 },
      boss:     { freq: 40,  filter: 1200, lfo: 0.40 },
      victory:  { freq: 80,  filter: 600,  lfo: 0.15 },
      defeat:   { freq: 35,  filter: 200,  lfo: 0.05 },
    };

    /** @type {Object<string, {volume:number, loop:boolean, fadeIn:number, fadeOut:number}>} */
    this.ambientSounds = {
      wind:    { volume: 0.20, loop: true,  fadeIn: 2000, fadeOut: 2000 },
      rain:    { volume: 0.30, loop: true,  fadeIn: 3000, fadeOut: 3000 },
      crickets:{ volume: 0.15, loop: true,  fadeIn: 4000, fadeOut: 4000 },
      fire:    { volume: 0.25, loop: true,  fadeIn: 1000, fadeOut: 1000 },
      thunder: { volume: 0.40, loop: false, fadeIn: 0,    fadeOut: 0    },
    };

    /** @type {Object<string, {gainNode:GainNode, source:AudioBufferSourceNode, filter:BiquadFilterNode}>} */
    this._ambientNodes = {};
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  /**
   * Initialise AudioContext. Reuses the shared OptimizedAudioCore context
   * when available to avoid multiple AudioContext instances (resource leak).
   */
  init() {
    if (this.audioContext) return;
    try {
      const core = window.getAudioCore?.();
      this.audioContext = core?.audioContext
        ?? new (window.AudioContext || window.webkitAudioContext)();
      // Route through core masterGain if available, else direct to destination
      this._masterOut = core?.masterGain ?? this.audioContext.destination;
    } catch (e) {
      console.warn('[AmbientAudio] Web Audio API not supported:', e);
    }
  }

  /**
   * Ensure context is initialised and resumed (handles iOS autoplay policy).
   * @returns {AudioContext|null}
   * @private
   */
  _ensureContext() {
    if (!this.audioContext) this.init();
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext ?? null;
  }

  // ── Procedural drone ───────────────────────────────────────────────────────

  /**
   * Build and start a new procedural drone for the given track.
   * Stops any existing drone first.
   * @param {string} trackKey
   * @private
   */
  _startDrone(trackKey) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    this._stopDrone();

    const params = this._droneParams[trackKey] ?? this._droneParams.gameplay;
    const trackCfg = this.musicTracks[trackKey] ?? this.musicTracks.gameplay;
    const targetVol = trackCfg.volume * this.musicVolume * this.volume;

    const { osc, osc2, filter, lfo, modGain, gainNode } =
      this._buildDroneGraph(ctx, params, targetVol);

    this._droneOsc = osc;
    this._droneOsc2 = osc2;
    this._droneFilter = filter;
    this._droneGain = gainNode;
    this._droneLFO = lfo;
    this._modulationGain = modGain;
    this._droneRunning = true;
  }

  /**
   * Create all drone nodes and connect them.
   * @param {AudioContext} ctx
   * @param {{ freq:number, filter:number, lfo:number }} params
   * @param {number} targetVol
   * @returns {{ osc, osc2, filter, lfo, modGain, gainNode }}
   * @private
   */
  _buildDroneGraph(ctx, params, targetVol) {
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(params.freq, now);

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(params.freq * 2, now);
    osc2.detune.setValueAtTime(7, now);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(params.filter, now);
    filter.Q.setValueAtTime(2, now);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(params.lfo, now);

    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(params.filter * 0.4, now);
    lfo.connect(modGain);
    modGain.connect(filter.frequency);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(targetVol, now + 2.0);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.35, now);

    osc.connect(filter);
    osc2.connect(subGain);
    subGain.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this._masterOut);

    lfo.start();
    osc.start();
    osc2.start();

    return { osc, osc2, filter, lfo, modGain, gainNode };
  }

  /**
   * Fade out and stop the current drone, disconnecting all nodes.
   * @param {number} [fadeDuration=1500] - Milliseconds
   * @private
   */
  _stopDrone(fadeDuration = 1500) {
    if (!this._droneRunning || !this.audioContext) return;
    const ctx = this.audioContext;
    const gain = this._droneGain;

    if (gain) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeDuration / 1000);
    }

    const stopAt = ctx.currentTime + fadeDuration / 1000 + 0.05;
    try { this._droneOsc?.stop(stopAt); } catch (_) {}
    try { this._droneOsc2?.stop(stopAt); } catch (_) {}
    try { this._droneLFO?.stop(stopAt); } catch (_) {}

    // Disconnect after fade to release nodes
    if (gain) {
      (window.setManagedTimeout || setTimeout)(() => {
        try { gain.disconnect(); } catch (_) {}
      }, fadeDuration + 100);
    }

    this._droneOsc = null;
    this._droneOsc2 = null;
    this._droneFilter = null;
    this._droneGain = null;
    this._droneLFO = null;
    this._modulationGain = null;
    this._droneRunning = false;
  }

  /**
   * Smoothly ramp drone parameters to match a new track (no restart).
   * @param {string} trackKey
   * @private
   */
  _updateDroneIntensity(trackKey) {
    if (!this._droneRunning || !this.audioContext) return;
    const params = this._droneParams[trackKey];
    if (!params) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const rampTo = (param, value) => {
      if (!param) return;
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(value, now + 1.5);
    };

    rampTo(this._droneFilter?.frequency, params.filter);
    rampTo(this._droneLFO?.frequency, params.lfo);
    rampTo(this._droneOsc?.frequency, params.freq);
    rampTo(this._droneOsc2?.frequency, params.freq * 2);
  }

  // ── Music (crossfade) ──────────────────────────────────────────────────────

  /**
   * Switch to a music track, crossfading from the current one.
   * If the track has no url, uses the procedural drone.
   * @param {string} trackKey
   * @param {number} [fadeDuration=2000] - Milliseconds
   */
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
      this._crossfadeAudioFile(trackKey, track, fadeDuration);
      return;
    }

    if (!this._droneRunning) {
      this._startDrone(trackKey);
    } else {
      this._updateDroneIntensity(trackKey);
      this._rampDroneVolume(track, fadeDuration);
    }
  }

  /**
   * Ramp drone gain to match the new track's target volume.
   * @param {{ volume:number }} track
   * @param {number} fadeDuration
   * @private
   */
  _rampDroneVolume(track, fadeDuration) {
    if (!this._droneGain || !this.audioContext) return;
    const targetVol = track.volume * this.musicVolume * this.volume;
    const now = this.audioContext.currentTime;
    this._droneGain.gain.cancelScheduledValues(now);
    this._droneGain.gain.setValueAtTime(this._droneGain.gain.value, now);
    this._droneGain.gain.linearRampToValueAtTime(targetVol, now + fadeDuration / 1000);
  }

  /**
   * Stub for real audio-file crossfade (URL-based tracks).
   * @param {string} trackKey
   * @param {{ url:string }} track
   * @param {number} fadeDuration
   * @private
   */
  _crossfadeAudioFile(trackKey, track, fadeDuration) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    this._stopDrone(fadeDuration);
    console.log(`[Music] Crossfade to file: ${track.url} (${fadeDuration}ms)`);
  }

  /**
   * Stop current music with a fade.
   * @param {number} [fadeDuration=2000]
   */
  stopMusic(fadeDuration = 2000) {
    if (!this.currentTrack) return;
    this.currentTrack = null;
    this._stopDrone(fadeDuration);
  }

  // ── Ambient sounds ─────────────────────────────────────────────────────────

  /**
   * Start a procedural ambient sound layer.
   * Connects through masterGain so global volume applies.
   * @param {'wind'|'rain'|'crickets'|'fire'|'thunder'} soundKey
   */
  playAmbient(soundKey) {
    if (!this.enabled || this._ambientNodes[soundKey]) return;
    const config = this.ambientSounds[soundKey];
    if (!config) return;

    const ctx = this._ensureContext();
    if (!ctx) return;

    const { source, filter, gainNode } = this._buildAmbientGraph(ctx, soundKey, config);
    this._ambientNodes[soundKey] = { gainNode, source, filter };
    this.currentAmbient.push(soundKey);
  }

  /**
   * Build noise source → filter → gain for an ambient sound.
   * @param {AudioContext} ctx
   * @param {string} soundKey
   * @param {{ volume:number, loop:boolean, fadeIn:number }} config
   * @returns {{ source, filter, gainNode }}
   * @private
   */
  _buildAmbientGraph(ctx, soundKey, config) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    this._applyAmbientFilter(filter, soundKey);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(
      config.volume * this.volume,
      ctx.currentTime + config.fadeIn / 1000
    );

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this._masterOut);
    source.start();

    return { source, filter, gainNode };
  }

  /**
   * Configure a filter for a given ambient sound type.
   * @param {BiquadFilterNode} filter
   * @param {string} soundKey
   * @private
   */
  _applyAmbientFilter(filter, soundKey) {
    if (soundKey === 'rain') {
      filter.type = 'bandpass'; filter.frequency.value = 3000; filter.Q.value = 0.5;
    } else if (soundKey === 'wind') {
      filter.type = 'lowpass'; filter.frequency.value = 800; filter.Q.value = 1;
    } else if (soundKey === 'crickets') {
      filter.type = 'bandpass'; filter.frequency.value = 5000; filter.Q.value = 3;
    } else {
      filter.type = 'lowpass'; filter.frequency.value = 2000;
    }
  }

  /**
   * Fade out and stop an ambient sound layer, disconnecting its nodes.
   * @param {string} soundKey
   */
  stopAmbient(soundKey) {
    const node = this._ambientNodes[soundKey];
    if (!node || !this.audioContext) return;

    const config = this.ambientSounds[soundKey];
    const fadeOut = (config?.fadeOut ?? 1000) / 1000;
    const ctx = this.audioContext;

    node.gainNode.gain.cancelScheduledValues(ctx.currentTime);
    node.gainNode.gain.setValueAtTime(node.gainNode.gain.value, ctx.currentTime);
    node.gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeOut);

    const stopAt = ctx.currentTime + fadeOut + 0.05;
    try { node.source.stop(stopAt); } catch (_) {}

    // Disconnect after fade to release nodes
    (window.setManagedTimeout || setTimeout)(() => {
      try { node.gainNode.disconnect(); } catch (_) {}
    }, (fadeOut + 0.1) * 1000);

    delete this._ambientNodes[soundKey];
    this.currentAmbient = this.currentAmbient.filter(k => k !== soundKey);
  }

  // ── Game state update ──────────────────────────────────────────────────────

  /**
   * React to game state changes: update music intensity and ambient layers.
   * @param {{ inCombat?: boolean, bossActive?: boolean, weather?: {type:string}, dayNight?: {timeOfDay:number} }} gameState
   */
  update(gameState) {
    if (!this.enabled) return;

    if (gameState.weather) {
      const isRainy = gameState.weather.type === 'rain' || gameState.weather.type === 'storm';
      isRainy ? this.playAmbient('rain') : this.stopAmbient('rain');
      if (gameState.weather.type === 'storm' && Math.random() < 0.01) this.playAmbient('thunder');
    }

    if (gameState.dayNight) {
      const { timeOfDay: hour } = gameState.dayNight;
      hour >= 19 || hour < 5 ? this.playAmbient('crickets') : this.stopAmbient('crickets');
    }

    if (gameState.inCombat) {
      gameState.bossActive ? this.playMusic('boss', 1000) : this.playMusic('combat', 1500);
    } else {
      this.playMusic('gameplay', 2000);
    }
  }

  // ── Volume controls ────────────────────────────────────────────────────────

  /**
   * @param {number} volume - 0–1
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    this._applyVolumeToAll();
  }

  /**
   * @param {number} volume - 0–1
   */
  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (!this._droneGain || !this.audioContext || !this.currentTrack) return;
    const track = this.musicTracks[this.currentTrack];
    const targetVol = (track?.volume ?? 0.2) * this.musicVolume * this.volume;
    const now = this.audioContext.currentTime;
    this._droneGain.gain.cancelScheduledValues(now);
    this._droneGain.gain.setValueAtTime(this._droneGain.gain.value, now);
    this._droneGain.gain.linearRampToValueAtTime(targetVol, now + 0.2);
  }

  /**
   * Apply current volume to all running drone and ambient nodes.
   * @private
   */
  _applyVolumeToAll() {
    if (this._droneGain && this.audioContext && this.currentTrack) {
      const track = this.musicTracks[this.currentTrack];
      const targetVol = (track?.volume ?? 0.2) * this.musicVolume * this.volume;
      this._droneGain.gain.setValueAtTime(targetVol, this.audioContext.currentTime);
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

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.stopAllSounds();
  }

  /** Stop all ambient layers and music. */
  stopAllSounds() {
    [...this.currentAmbient].forEach(k => this.stopAmbient(k));
    this.stopMusic(500);
  }

  /**
   * Full teardown. Only closes audioContext if it was created by this instance
   * (i.e., not the shared OptimizedAudioCore context).
   */
  cleanup() {
    this.stopAllSounds();
    const sharedCtx = window.getAudioCore?.()?.audioContext;
    if (this.audioContext && this.audioContext !== sharedCtx) {
      this.audioContext.close();
    }
    this.audioContext = null;
    this._masterOut = null;
  }

  /** Reset volume settings and stop all sounds. */
  reset() {
    this.stopAllSounds();
    this.volume = 0.3;
    this.musicVolume = 0.2;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AmbientAudioSystem;
}

if (typeof window !== 'undefined') {
  window.AmbientAudioSystem = AmbientAudioSystem;
}
