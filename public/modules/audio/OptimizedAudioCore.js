/**
 * OPTIMIZED AUDIO CORE
 * Centralized audio management with pooling, throttling, and resource limits.
 * Handles iOS autoplay policy via user-gesture resume, and cleans up all nodes
 * on destroy to prevent AudioContext leaks.
 * @version 1.1.0
 */

class OptimizedAudioCore {
  constructor() {
    // Singleton pattern - share context across all audio systems
    if (OptimizedAudioCore.instance) {
      return OptimizedAudioCore.instance;
    }
    OptimizedAudioCore.instance = this;

    this.audioContext = null;
    this.masterGain = null;
    this.masterCompressor = null;
    this.enabled = true;
    this._muted = false;
    this._volumeBeforeMute = 0.8;

    // Configuration
    this.config = {
      maxConcurrentSounds: 32,
      maxConcurrentPerType: 8,
      defaultThrottleMs: 50,
      poolSize: 16,
      cleanupIntervalMs: 1000
    };

    /** @type {Map<string, number>} soundType -> last play timestamp */
    this.lastPlayTime = new Map();

    /** @type {Object<string, number>} minimum ms between plays per type */
    this.throttleConfig = {
      shoot: 40,
      hit: 30,
      machinegun: 25,
      zombieDeath: 80,
      explosion: 200,
      collect: 100,
      ui: 50,
      default: 50
    };

    /** @type {Map<number, {nodes:Object, type:string, startTime:number, priority:number, duration:number}>} */
    this.activeSounds = new Map();
    this.soundCounter = 0;
    /** @type {Map<string, number>} */
    this.soundsPerType = new Map();

    // Node pools for reuse
    this.gainNodePool = [];
    /** @type {Set<GainNode>} */
    this.freeGains = new Set();
    this.filterPool = [];

    /** @type {Object<string, number>} higher = more important */
    this.priorityConfig = {
      shoot: 5,
      hit: 4,
      zombieDeath: 6,
      explosion: 8,
      collect: 3,
      levelup: 9,
      playerDamage: 7,
      bossSpawn: 10,
      ui: 2,
      music: 1,
      ambient: 1
    };

    // Shared reverb
    this.reverbNode = null;
    this.reverbGain = null;
    this.reverbSendGain = null;

    /** @type {Map<number, AudioBuffer>} cached noise buffers keyed by duration bucket */
    this.noiseBufferCache = new Map();

    this.cleanupInterval = null;

    this._init();
  }

  // ── Initialisation ─────────────────────────────────────────────────────────

  /**
   * Create AudioContext, connect master chain, wire event listeners.
   * @private
   */
  _init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this._buildMasterChain();
      this._restorePersisted();
      this._bindKeyboardMute();
      this.createSharedReverb();
      this._populatePools();
      this._startCleanupInterval();
      this._bindVisibility();
      // iOS: resume on first user gesture
      this._bindUserGestureResume();
      console.log('[OptimizedAudioCore] Initialized');
    } catch (e) {
      console.warn('[OptimizedAudioCore] Web Audio API not supported:', e);
      this.enabled = false;
    }
  }

  /**
   * Build compressor → masterGain → destination chain.
   * @private
   */
  _buildMasterChain() {
    const ctx = this.audioContext;

    this.masterCompressor = ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.value = -18;
    this.masterCompressor.knee.value = 10;
    this.masterCompressor.ratio.value = 6;
    this.masterCompressor.attack.value = 0.003;
    this.masterCompressor.release.value = 0.15;
    this.masterCompressor.connect(ctx.destination);

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.8;
    this.masterGain.connect(this.masterCompressor);
  }

  /**
   * Restore volume and mute state from localStorage.
   * @private
   */
  _restorePersisted() {
    const savedVolume = parseFloat(localStorage.getItem('audioMasterVolume') ?? '0.8');
    const clamped = Math.max(0, Math.min(1, savedVolume));
    this._volumeBeforeMute = clamped;
    this.masterGain.gain.value = clamped;

    if (localStorage.getItem('audioMuted') === 'true') {
      this._muted = true;
      this.masterGain.gain.value = 0;
    }
  }

  /**
   * Bind key M for global mute toggle.
   * @private
   */
  _bindKeyboardMute() {
    this._onKeyMute = (e) => {
      if (e.code === 'KeyM' && !e.target.matches('input,textarea')) {
        this.toggleMute();
      }
    };
    document.addEventListener('keydown', this._onKeyMute);
  }

  /**
   * Suspend/resume context on tab visibility change.
   * @private
   */
  _bindVisibility() {
    this._onVisibility = () => this._handleVisibility();
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  /**
   * Register a one-time user-gesture listener to resume context on iOS.
   * Covers touch, click, and keydown.
   * @private
   */
  _bindUserGestureResume() {
    const resume = () => {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
      document.removeEventListener('touchstart', resume, { capture: true });
      document.removeEventListener('click', resume, { capture: true });
      document.removeEventListener('keydown', resume, { capture: true });
    };
    document.addEventListener('touchstart', resume, { capture: true, passive: true });
    document.addEventListener('click', resume, { capture: true });
    document.addEventListener('keydown', resume, { capture: true });
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  /**
   * Handle tab visibility change.
   * @private
   */
  _handleVisibility() {
    if (!this.audioContext) return;
    if (document.hidden) {
      this.audioContext.suspend().catch(() => {});
    } else if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
  }

  /**
   * Get or create a cached noise buffer for the given duration.
   * @param {number} duration - Duration in seconds
   * @returns {AudioBuffer}
   */
  _getNoiseBuffer(duration) {
    const key = Math.round(duration * 10);
    if (this.noiseBufferCache.has(key)) return this.noiseBufferCache.get(key);

    const bufferSize = Math.min(this.audioContext.sampleRate * duration, 48000);
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    this.noiseBufferCache.set(key, buffer);
    return buffer;
  }

  // ── Shared reverb ──────────────────────────────────────────────────────────

  /**
   * Build a shared convolution reverb connected to masterGain.
   * A single reverbSendGain is reused across all sounds to avoid per-sound node leaks.
   */
  createSharedReverb() {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 1.5;
    const impulse = ctx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const buf = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        buf[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
      }
    }

    this.reverbNode = ctx.createConvolver();
    this.reverbNode.buffer = impulse;

    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.15;
    this.reverbNode.connect(this.reverbGain);
    this.reverbGain.connect(this.masterGain);

    // Shared send — reused per sound, no new node allocation per call
    this.reverbSendGain = ctx.createGain();
    this.reverbSendGain.gain.value = 0.15;
    this.reverbSendGain.connect(this.reverbNode);
  }

  // ── Node pools ─────────────────────────────────────────────────────────────

  /**
   * Pre-populate gain and filter node pools.
   * @private
   */
  _populatePools() {
    for (let i = 0; i < this.config.poolSize; i++) {
      const gain = this.audioContext.createGain();
      gain.connect(this.masterGain);
      gain._inUse = false;
      this.gainNodePool.push(gain);
      this.freeGains.add(gain);

      const filter = this.audioContext.createBiquadFilter();
      filter._inUse = false;
      this.filterPool.push(filter);
    }
  }

  /**
   * Acquire a gain node from the pool (or create one).
   * @returns {GainNode}
   */
  getGainNode() {
    let node = this.freeGains.values().next().value;
    if (node) {
      this.freeGains.delete(node);
    } else {
      node = this.audioContext.createGain();
      node.connect(this.masterGain);
      this.gainNodePool.push(node);
    }
    node._inUse = true;
    node.gain.value = 0;
    return node;
  }

  /**
   * Return a gain node to the pool.
   * @param {GainNode} node
   */
  releaseGainNode(node) {
    if (!node) return;
    node._inUse = false;
    node.gain.value = 0;
    this.freeGains.add(node);
  }

  /**
   * Acquire a biquad filter node from the pool (or create one).
   * @returns {BiquadFilterNode}
   */
  getFilterNode() {
    let node = this.filterPool.find(n => !n._inUse);
    if (!node) {
      node = this.audioContext.createBiquadFilter();
      this.filterPool.push(node);
    }
    node._inUse = true;
    return node;
  }

  /**
   * Return a filter node to the pool and disconnect it.
   * @param {BiquadFilterNode} node
   */
  releaseFilterNode(node) {
    if (!node) return;
    node._inUse = false;
    try { node.disconnect(); } catch { /* already disconnected */ }
  }

  // ── Throttle / resource checks ─────────────────────────────────────────────

  /**
   * Check if a sound type should be throttled.
   * Updates lastPlayTime when allowed through.
   * @param {string} soundType
   * @returns {boolean}
   */
  shouldThrottle(soundType) {
    const now = performance.now();
    const last = this.lastPlayTime.get(soundType) || 0;
    const limit = this.throttleConfig[soundType] ?? this.throttleConfig.default;
    if (now - last < limit) return true;
    this.lastPlayTime.set(soundType, now);
    return false;
  }

  /**
   * Check whether a new sound can be played given resource limits.
   * May cull a lower-priority sound to make room.
   * @param {string} soundType
   * @param {number} priority
   * @returns {boolean}
   */
  canPlaySound(soundType, priority) {
    if (this.activeSounds.size >= this.config.maxConcurrentSounds) {
      return this._cullLowPrioritySounds(priority);
    }
    const typeCount = this.soundsPerType.get(soundType) || 0;
    return typeCount < this.config.maxConcurrentPerType;
  }

  /**
   * Stop the lowest-priority sound to make room for a higher one.
   * @param {number} newPriority
   * @returns {boolean} true if a sound was culled
   * @private
   */
  _cullLowPrioritySounds(newPriority) {
    const candidates = [];
    for (const [id, sound] of this.activeSounds) {
      if (sound.priority < newPriority) candidates.push({ id, ...sound });
    }
    if (!candidates.length) return false;

    candidates.sort((a, b) =>
      a.priority !== b.priority ? a.priority - b.priority : a.startTime - b.startTime
    );
    this.stopSound(candidates[0].id);
    return true;
  }

  // ── Sound lifecycle ────────────────────────────────────────────────────────

  /**
   * Register an active sound for tracking and schedule auto-cleanup.
   * @param {string} type - Sound category key
   * @param {Object} nodes - { oscillator?, gain, filter? }
   * @param {number} duration - Duration in seconds
   * @returns {number} Sound ID
   */
  registerSound(type, nodes, duration) {
    const id = ++this.soundCounter;
    const priority = this.priorityConfig[type] || 5;

    this.activeSounds.set(id, {
      nodes,
      type,
      startTime: performance.now(),
      priority,
      duration
    });

    const typeCount = this.soundsPerType.get(type) || 0;
    this.soundsPerType.set(type, typeCount + 1);

    const cleanupDelay = duration * 1000 + 100;
    (window.setManagedTimeout || setTimeout)(() => this.unregisterSound(id), cleanupDelay);

    return id;
  }

  /**
   * Release pooled nodes and remove sound from tracking.
   * @param {number} id
   */
  unregisterSound(id) {
    const sound = this.activeSounds.get(id);
    if (!sound) return;

    if (sound.nodes?.gain) this.releaseGainNode(sound.nodes.gain);
    if (sound.nodes?.filter) this.releaseFilterNode(sound.nodes.filter);

    const typeCount = this.soundsPerType.get(sound.type) || 1;
    this.soundsPerType.set(sound.type, Math.max(0, typeCount - 1));
    this.activeSounds.delete(id);
  }

  /**
   * Stop a specific sound immediately and release its nodes.
   * @param {number} id
   */
  stopSound(id) {
    const sound = this.activeSounds.get(id);
    if (!sound) return;

    if (sound.nodes?.oscillator) {
      try { sound.nodes.oscillator.stop(); } catch { /* already stopped */ }
    }
    this.unregisterSound(id);
  }

  /**
   * Resume AudioContext. Call after user interaction on iOS/Safari.
   * @returns {Promise<void>}
   */
  async resume() {
    if (this.audioContext?.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (e) {
        console.warn('[OptimizedAudioCore] Failed to resume:', e);
      }
    }
  }

  // ── Playback ───────────────────────────────────────────────────────────────

  /**
   * Play a synthesised tone, routing through pool and throttle guards.
   * @param {Object} options
   * @param {string}  [options.type='shoot']       - Sound category for throttle/priority
   * @param {number}  [options.frequency=440]      - Start frequency (Hz)
   * @param {number}  [options.duration=0.1]        - Duration in seconds
   * @param {number}  [options.volume=0.3]          - Gain (0-1)
   * @param {string}  [options.waveType='square']   - Oscillator type
   * @param {number}  [options.frequencyEnd=null]   - End frequency for ramp
   * @param {number}  [options.filterFreq=null]     - Biquad cutoff (null = no filter)
   * @param {string}  [options.filterType='lowpass']
   * @param {boolean} [options.useReverb=false]
   * @param {number}  [options.reverbAmount=0.15]
   * @returns {number|null} Sound ID, or null if throttled/blocked
   */
  playTone(options) {
    if (!this.enabled || !this.audioContext) return null;

    const {
      type = 'shoot', frequency = 440, duration = 0.1, volume = 0.3,
      waveType = 'square', frequencyEnd = null, filterFreq = null,
      filterType = 'lowpass', useReverb = false, reverbAmount = 0.15
    } = options;

    if (this.shouldThrottle(type)) return null;
    const priority = this.priorityConfig[type] || 5;
    if (!this.canPlaySound(type, priority)) return null;
    if (this.audioContext.state === 'suspended') this.audioContext.resume();

    const { oscillator, gainNode, filterNode } =
      this._buildToneGraph(frequency, frequencyEnd, duration, volume, waveType, filterFreq, filterType);

    if (useReverb && this.reverbSendGain) {
      this.reverbSendGain.gain.setValueAtTime(reverbAmount, this.audioContext.currentTime);
      gainNode.connect(this.reverbSendGain);
    }

    const now = this.audioContext.currentTime;
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);

    return this.registerSound(type, { oscillator, gain: gainNode, filter: filterNode }, duration);
  }

  /**
   * Build oscillator → [filter] → gain graph.
   * @private
   * @returns {{ oscillator: OscillatorNode, gainNode: GainNode, filterNode: BiquadFilterNode|null }}
   */
  _buildToneGraph(frequency, frequencyEnd, duration, volume, waveType, filterFreq, filterType) {
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const oscillator = ctx.createOscillator();
    oscillator.type = waveType;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (frequencyEnd !== null) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(frequencyEnd, 20), now + duration);
    }

    const gainNode = this.getGainNode();
    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

    let filterNode = null;
    if (filterFreq !== null) {
      filterNode = this.getFilterNode();
      filterNode.type = filterType;
      filterNode.frequency.setValueAtTime(filterFreq, now);
      oscillator.connect(filterNode);
      filterNode.connect(gainNode);
    } else {
      oscillator.connect(gainNode);
    }

    return { oscillator, gainNode, filterNode };
  }

  /**
   * Play filtered white noise (explosions, impacts, etc.).
   * @param {Object} options
   * @param {string}  [options.type='explosion']
   * @param {number}  [options.duration=0.5]
   * @param {number}  [options.volume=0.4]
   * @param {number}  [options.filterFreqStart=1000]
   * @param {number}  [options.filterFreqEnd=50]
   * @param {boolean} [options.useReverb=true]
   * @returns {number|null} Sound ID, or null if throttled/blocked
   */
  playNoise(options) {
    if (!this.enabled || !this.audioContext) return null;

    const {
      type = 'explosion', duration = 0.5, volume = 0.4,
      filterFreqStart = 1000, filterFreqEnd = 50, useReverb = true
    } = options;

    if (this.shouldThrottle(type)) return null;
    const priority = this.priorityConfig[type] || 5;
    if (!this.canPlaySound(type, priority)) return null;
    if (this.audioContext.state === 'suspended') this.audioContext.resume();

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this._getNoiseBuffer(duration);

    const filterNode = this.getFilterNode();
    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(filterFreqStart, now);
    filterNode.frequency.exponentialRampToValueAtTime(Math.max(filterFreqEnd, 20), now + duration);

    const gainNode = this.getGainNode();
    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

    noise.connect(filterNode);
    filterNode.connect(gainNode);

    // Use shared reverb send to avoid per-call node leak
    if (useReverb && this.reverbSendGain) {
      gainNode.connect(this.reverbSendGain);
    }

    noise.start(now);
    noise.stop(now + duration);

    return this.registerSound(type, { gain: gainNode, filter: filterNode }, duration);
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  /**
   * Start the periodic stale-sound cleanup interval.
   * @private
   */
  _startCleanupInterval() {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => this._cleanup(), this.config.cleanupIntervalMs);
  }

  /**
   * Remove sounds that outlived their expected duration by 5 s.
   * @private
   */
  _cleanup() {
    const now = performance.now();
    for (const [id, sound] of this.activeSounds) {
      const expected = (sound.duration || 1) * 1000;
      if (now - sound.startTime > expected + 5000) {
        console.warn(`[OptimizedAudioCore] Stale sound ${id} culled`);
        this.unregisterSound(id);
      }
    }
  }

  // ── Volume / mute ──────────────────────────────────────────────────────────

  /**
   * Set master volume and persist to localStorage.
   * @param {number} volume - 0–1
   */
  setMasterVolume(volume) {
    if (!this.masterGain) return;
    const v = Math.max(0, Math.min(1, volume));
    this._volumeBeforeMute = v;
    if (!this._muted) this.masterGain.gain.value = v;
    localStorage.setItem('audioMasterVolume', String(v));
  }

  /**
   * Toggle global mute and persist state.
   * @returns {boolean} New muted state
   */
  toggleMute() {
    if (!this.masterGain) return this._muted;
    this._muted = !this._muted;
    this.masterGain.gain.value = this._muted ? 0 : this._volumeBeforeMute;
    localStorage.setItem('audioMuted', String(this._muted));
    return this._muted;
  }

  /** @returns {boolean} */
  isMuted() { return this._muted; }

  // ── Misc API ───────────────────────────────────────────────────────────────

  /**
   * Enable or disable all audio.
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.stopAllSounds();
  }

  /** Stop every currently active sound immediately. */
  stopAllSounds() {
    for (const id of this.activeSounds.keys()) this.stopSound(id);
  }

  /**
   * @returns {{ activeSounds: number, maxSounds: number, pooledGainNodes: number, pooledFilters: number, soundsPerType: Object }}
   */
  getStats() {
    return {
      activeSounds: this.activeSounds.size,
      maxSounds: this.config.maxConcurrentSounds,
      pooledGainNodes: this.gainNodePool.length,
      pooledFilters: this.filterPool.length,
      soundsPerType: Object.fromEntries(this.soundsPerType)
    };
  }

  /**
   * Full teardown: stop sounds, remove listeners, close AudioContext.
   */
  destroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this._onVisibility) document.removeEventListener('visibilitychange', this._onVisibility);
    if (this._onKeyMute) document.removeEventListener('keydown', this._onKeyMute);

    this.stopAllSounds();
    this.noiseBufferCache.clear();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    OptimizedAudioCore.instance = null;
  }
}

OptimizedAudioCore.instance = null;

/**
 * Get (or lazily create) the shared OptimizedAudioCore singleton.
 * @returns {OptimizedAudioCore}
 */
function getAudioCore() {
  if (!OptimizedAudioCore.instance) new OptimizedAudioCore();
  return OptimizedAudioCore.instance;
}

if (typeof window !== 'undefined') {
  window.OptimizedAudioCore = OptimizedAudioCore;
  window.getAudioCore = getAudioCore;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OptimizedAudioCore, getAudioCore };
}
