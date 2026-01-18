/**
 * OPTIMIZED AUDIO CORE
 * Centralized audio management with pooling, throttling, and resource limits
 * @version 1.0.0
 * @author Claude Code
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
    this.enabled = true;

    // Configuration
    this.config = {
      maxConcurrentSounds: 32,
      maxConcurrentPerType: 8,
      defaultThrottleMs: 50,
      poolSize: 16,
      cleanupIntervalMs: 1000
    };

    // Sound throttling - prevents sound spam
    this.lastPlayTime = new Map(); // soundType -> timestamp
    this.throttleConfig = {
      shoot: 40,           // 25 shots/sec max
      hit: 30,             // 33 hits/sec max
      machinegun: 25,      // Rapid fire
      zombieDeath: 80,     // ~12/sec
      explosion: 200,      // 5/sec
      collect: 100,        // 10/sec
      ui: 50,              // 20/sec
      default: 50
    };

    // Active sounds tracking
    this.activeSounds = new Map(); // id -> {node, type, startTime, priority}
    this.soundCounter = 0;
    this.soundsPerType = new Map(); // type -> count

    // Node pools for reuse
    this.oscillatorPool = [];
    this.gainNodePool = [];
    this.filterPool = [];

    // Priority system (higher = more important, less likely to be culled)
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

    // Reverb node (shared)
    this.reverbNode = null;
    this.reverbGain = null;

    // Cleanup interval
    this.cleanupInterval = null;

    this.init();
  }

  /**
   * Initialize audio context and shared resources
   */
  init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Master gain
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.8;
      this.masterGain.connect(this.audioContext.destination);

      // Create shared reverb
      this.createSharedReverb();

      // Pre-populate pools
      this.populatePools();

      // Start cleanup interval
      this.startCleanupInterval();

      console.log('[OptimizedAudioCore] Initialized with pooling and throttling');
    } catch (e) {
      console.warn('[OptimizedAudioCore] Web Audio API not supported:', e);
      this.enabled = false;
    }
  }

  /**
   * Create shared reverb for all sounds
   */
  createSharedReverb() {
    if (!this.audioContext) return;

    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * 1.5; // 1.5 seconds
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const decay = Math.pow(1 - i / length, 2.5);
      impulseL[i] = (Math.random() * 2 - 1) * decay;
      impulseR[i] = (Math.random() * 2 - 1) * decay;
    }

    this.reverbNode = this.audioContext.createConvolver();
    this.reverbNode.buffer = impulse;

    this.reverbGain = this.audioContext.createGain();
    this.reverbGain.gain.value = 0.15;
    this.reverbNode.connect(this.reverbGain);
    this.reverbGain.connect(this.masterGain);
  }

  /**
   * Pre-populate node pools
   */
  populatePools() {
    // We don't pre-create oscillators (they're one-shot)
    // But we track available gain nodes that can be reused
    for (let i = 0; i < this.config.poolSize; i++) {
      const gain = this.audioContext.createGain();
      gain.connect(this.masterGain);
      gain._inUse = false;
      this.gainNodePool.push(gain);

      const filter = this.audioContext.createBiquadFilter();
      filter._inUse = false;
      this.filterPool.push(filter);
    }
  }

  /**
   * Get a gain node from pool or create new
   */
  getGainNode() {
    let node = this.gainNodePool.find(n => !n._inUse);
    if (!node) {
      node = this.audioContext.createGain();
      node.connect(this.masterGain);
      this.gainNodePool.push(node);
    }
    node._inUse = true;
    node.gain.value = 0; // Reset
    return node;
  }

  /**
   * Return gain node to pool
   */
  releaseGainNode(node) {
    if (node) {
      node._inUse = false;
      node.gain.value = 0;
    }
  }

  /**
   * Get a filter node from pool or create new
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
   * Return filter node to pool
   */
  releaseFilterNode(node) {
    if (node) {
      node._inUse = false;
      try {
        node.disconnect();
      } catch (e) { /* ignore */ }
    }
  }

  /**
   * Check if sound should be throttled
   */
  shouldThrottle(soundType) {
    const now = performance.now();
    const lastTime = this.lastPlayTime.get(soundType) || 0;
    const throttleMs = this.throttleConfig[soundType] || this.throttleConfig.default;

    if (now - lastTime < throttleMs) {
      return true;
    }

    this.lastPlayTime.set(soundType, now);
    return false;
  }

  /**
   * Check if we can play more sounds (resource limits)
   */
  canPlaySound(soundType, priority) {
    // Check global limit
    if (this.activeSounds.size >= this.config.maxConcurrentSounds) {
      // Try to cull low-priority sounds
      return this.cullLowPrioritySounds(priority);
    }

    // Check per-type limit
    const typeCount = this.soundsPerType.get(soundType) || 0;
    if (typeCount >= this.config.maxConcurrentPerType) {
      return false;
    }

    return true;
  }

  /**
   * Cull low-priority sounds to make room
   */
  cullLowPrioritySounds(newPriority) {
    // Find sounds with lower priority
    const cullCandidates = [];
    for (const [id, sound] of this.activeSounds) {
      if (sound.priority < newPriority) {
        cullCandidates.push({ id, ...sound });
      }
    }

    if (cullCandidates.length === 0) {
      return false; // Can't cull anything
    }

    // Sort by priority (lowest first), then by age (oldest first)
    cullCandidates.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.startTime - b.startTime;
    });

    // Cull the lowest priority/oldest sound
    const toCull = cullCandidates[0];
    this.stopSound(toCull.id);
    return true;
  }

  /**
   * Register an active sound
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

    // Update type counter
    const typeCount = this.soundsPerType.get(type) || 0;
    this.soundsPerType.set(type, typeCount + 1);

    // Schedule automatic cleanup
    const cleanupTime = (duration * 1000) + 100;
    (window.setManagedTimeout || setTimeout)(() => {
      this.unregisterSound(id);
    }, cleanupTime);

    return id;
  }

  /**
   * Unregister a sound (cleanup)
   */
  unregisterSound(id) {
    const sound = this.activeSounds.get(id);
    if (!sound) return;

    // Release pooled nodes
    if (sound.nodes) {
      if (sound.nodes.gain) this.releaseGainNode(sound.nodes.gain);
      if (sound.nodes.filter) this.releaseFilterNode(sound.nodes.filter);
    }

    // Update type counter
    const typeCount = this.soundsPerType.get(sound.type) || 1;
    this.soundsPerType.set(sound.type, Math.max(0, typeCount - 1));

    this.activeSounds.delete(id);
  }

  /**
   * Stop a specific sound immediately
   */
  stopSound(id) {
    const sound = this.activeSounds.get(id);
    if (!sound) return;

    if (sound.nodes && sound.nodes.oscillator) {
      try {
        sound.nodes.oscillator.stop();
      } catch (e) { /* already stopped */ }
    }

    this.unregisterSound(id);
  }

  /**
   * Resume audio context (required after user interaction on mobile)
   */
  async resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (e) {
        console.warn('[OptimizedAudioCore] Failed to resume:', e);
      }
    }
  }

  /**
   * Play a simple tone with full optimization
   * @returns {number|null} Sound ID or null if throttled/blocked
   */
  playTone(options) {
    if (!this.enabled || !this.audioContext) return null;

    const {
      type = 'shoot',
      frequency = 440,
      duration = 0.1,
      volume = 0.3,
      waveType = 'square',
      frequencyEnd = null,
      filterFreq = null,
      filterType = 'lowpass',
      useReverb = false,
      reverbAmount = 0.15
    } = options;

    // Throttle check
    if (this.shouldThrottle(type)) {
      return null;
    }

    // Resource limit check
    const priority = this.priorityConfig[type] || 5;
    if (!this.canPlaySound(type, priority)) {
      return null;
    }

    // Resume context if needed
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const now = this.audioContext.currentTime;

    // Create oscillator (can't be pooled - one-shot)
    const oscillator = this.audioContext.createOscillator();
    oscillator.type = waveType;
    oscillator.frequency.setValueAtTime(frequency, now);

    if (frequencyEnd !== null) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(frequencyEnd, 20), // Prevent 0 frequency
        now + duration
      );
    }

    // Get gain from pool
    const gainNode = this.getGainNode();
    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

    // Optional filter
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

    // Optional reverb
    if (useReverb && this.reverbNode) {
      const reverbSend = this.audioContext.createGain();
      reverbSend.gain.value = reverbAmount;
      gainNode.connect(reverbSend);
      reverbSend.connect(this.reverbNode);
    }

    // Start and stop
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);

    // Register for tracking
    const soundId = this.registerSound(type, {
      oscillator,
      gain: gainNode,
      filter: filterNode
    }, duration);

    return soundId;
  }

  /**
   * Play white noise (explosions, etc.)
   */
  playNoise(options) {
    if (!this.enabled || !this.audioContext) return null;

    const {
      type = 'explosion',
      duration = 0.5,
      volume = 0.4,
      filterFreqStart = 1000,
      filterFreqEnd = 50,
      useReverb = true
    } = options;

    // Throttle check
    if (this.shouldThrottle(type)) {
      return null;
    }

    // Resource limit check
    const priority = this.priorityConfig[type] || 5;
    if (!this.canPlaySound(type, priority)) {
      return null;
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const now = this.audioContext.currentTime;
    const bufferSize = Math.min(this.audioContext.sampleRate * duration, 48000);
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    const filterNode = this.getFilterNode();
    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(filterFreqStart, now);
    filterNode.frequency.exponentialRampToValueAtTime(Math.max(filterFreqEnd, 20), now + duration);

    const gainNode = this.getGainNode();
    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

    noise.connect(filterNode);
    filterNode.connect(gainNode);

    if (useReverb && this.reverbNode) {
      const reverbSend = this.audioContext.createGain();
      reverbSend.gain.value = 0.2;
      gainNode.connect(reverbSend);
      reverbSend.connect(this.reverbNode);
    }

    noise.start(now);
    noise.stop(now + duration);

    return this.registerSound(type, { gain: gainNode, filter: filterNode }, duration);
  }

  /**
   * Start periodic cleanup
   */
  startCleanupInterval() {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Periodic cleanup of stale sounds
   */
  cleanup() {
    const now = performance.now();
    const staleThreshold = 5000; // 5 seconds

    for (const [id, sound] of this.activeSounds) {
      const elapsed = now - sound.startTime;
      const expectedDuration = (sound.duration || 1) * 1000;

      if (elapsed > expectedDuration + staleThreshold) {
        console.warn(`[OptimizedAudioCore] Cleaning stale sound ${id}`);
        this.unregisterSound(id);
      }
    }
  }

  /**
   * Set master volume
   */
  setMasterVolume(volume) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Get current stats
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
   * Enable/disable audio
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAllSounds();
    }
  }

  /**
   * Stop all active sounds
   */
  stopAllSounds() {
    for (const id of this.activeSounds.keys()) {
      this.stopSound(id);
    }
  }

  /**
   * Full cleanup on destroy
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.stopAllSounds();

    if (this.audioContext) {
      this.audioContext.close();
    }

    OptimizedAudioCore.instance = null;
  }
}

// Singleton instance holder
OptimizedAudioCore.instance = null;

// Factory function to get shared instance
function getAudioCore() {
  if (!OptimizedAudioCore.instance) {
    new OptimizedAudioCore();
  }
  return OptimizedAudioCore.instance;
}

// Export
if (typeof window !== 'undefined') {
  window.OptimizedAudioCore = OptimizedAudioCore;
  window.getAudioCore = getAudioCore;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OptimizedAudioCore, getAudioCore };
}
