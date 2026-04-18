/**
 * OPTIMIZED SOUND EFFECTS
 * Uses OptimizedAudioCore for all sound playback with throttling and pooling.
 * All transient nodes created outside the core (heartbeat, groans, etc.)
 * are disconnected after playback to prevent node leaks.
 * @version 1.1.0
 */

class OptimizedSoundEffects {
  constructor() {
    /** @type {OptimizedAudioCore|null} */
    this.core = window.getAudioCore ? window.getAudioCore() : null;
    if (!this.core) {
      console.warn('[OptimizedSoundEffects] OptimizedAudioCore not available');
    }

    /** @type {{ src: AudioBufferSourceNode, bp: BiquadFilterNode, lp: BiquadFilterNode, gain: GainNode }|null} */
    this._windNodes = null;

    /** @type {number|undefined} timeout handle for groan scheduling */
    this._groanTimer = undefined;

    /** @type {number|null} interval handle for heartbeat */
    this._heartbeatInterval = null;
  }

  // ── Weapon sounds ──────────────────────────────────────────────────────────

  /**
   * Play a weapon shot sound attenuated by distance.
   * @param {'pistol'|'shotgun'|'machinegun'|'minigun'|'rifle'|'sniper'} [weaponType='pistol']
   * @param {number} [distance=0] - Distance from listener (0 = max volume)
   */
  playShoot(weaponType = 'pistol', distance = 0) {
    if (!this.core) {
return;
}
    const attenuation = this.calculateDistanceAttenuation(distance);
    if (attenuation < 0.05) {
return;
}

    switch (weaponType) {
      case 'pistol':   this._playPistolShot(attenuation); break;
      case 'shotgun':  this._playShotgunShot(attenuation); break;
      case 'machinegun':
      case 'minigun':  this._playMachinegunShot(attenuation); break;
      case 'rifle':
      case 'sniper':   this._playRifleShot(attenuation); break;
      default:         this._playPistolShot(attenuation);
    }
  }

  /**
   * @param {number} volume
   * @private
   */
  _playPistolShot(volume = 1) {
    this.core.playTone({
      type: 'shoot', frequency: 280 + Math.random() * 40, frequencyEnd: 80,
      duration: 0.08, volume: 0.35 * volume, waveType: 'square',
      filterFreq: 1200, filterType: 'lowpass', useReverb: true, reverbAmount: 0.12
    });

    (window.setManagedTimeout || setTimeout)(() => {
      this.core.playTone({
        type: 'shoot', frequency: 2500 + Math.random() * 500,
        duration: 0.01, volume: 0.12 * volume, waveType: 'square',
        filterFreq: 2000, filterType: 'highpass'
      });
    }, 10);
  }

  /**
   * @param {number} volume
   * @private
   */
  _playShotgunShot(volume = 1) {
    for (let i = 0; i < 3; i++) {
      (window.setManagedTimeout || setTimeout)(() => {
        this.core.playTone({
          type: 'shoot', frequency: 120 + Math.random() * 40, frequencyEnd: 50,
          duration: 0.15, volume: (0.4 - i * 0.08) * volume,
          waveType: 'sawtooth', filterFreq: 800 - i * 100, filterType: 'lowpass',
          useReverb: true, reverbAmount: 0.2
        });
      }, i * 3);
    }
  }

  /**
   * @param {number} volume
   * @private
   */
  _playMachinegunShot(volume = 1) {
    this.core.playTone({
      type: 'machinegun', frequency: 380 + Math.random() * 60, frequencyEnd: 100,
      duration: 0.035, volume: 0.22 * volume, waveType: 'square',
      filterFreq: 1000 + Math.random() * 200, filterType: 'bandpass',
      useReverb: true, reverbAmount: 0.06
    });
  }

  /**
   * @param {number} volume
   * @private
   */
  _playRifleShot(volume = 1) {
    this.core.playTone({
      type: 'shoot', frequency: 2000, frequencyEnd: 800,
      duration: 0.02, volume: 0.25 * volume, waveType: 'square',
      filterFreq: 1500, filterType: 'highpass'
    });

    (window.setManagedTimeout || setTimeout)(() => {
      this.core.playTone({
        type: 'shoot', frequency: 200, frequencyEnd: 60,
        duration: 0.18, volume: 0.45 * volume, waveType: 'sawtooth',
        filterFreq: 1500, filterType: 'lowpass', useReverb: true, reverbAmount: 0.25
      });
    }, 5);
  }

  // ── Combat sounds ──────────────────────────────────────────────────────────

  /**
   * @param {boolean} [isCritical=false]
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

  /** Play a zombie death sound with slight random pitch variation. */
  playZombieDeath() {
    if (!this.core) {
return;
}
    const pitch = 0.95 + Math.random() * 0.1;
    this.core.playTone({
      type: 'zombieDeath', frequency: 300 * pitch, frequencyEnd: 50 * pitch,
      duration: 0.3, volume: 0.28, waveType: 'sawtooth',
      filterFreq: 1000, filterType: 'lowpass', useReverb: true, reverbAmount: 0.1
    });
  }

  /** Play an explosion noise burst. */
  playExplosion() {
    if (!this.core) {
return;
}
    this.core.playNoise({
      type: 'explosion', duration: 0.5, volume: 0.5,
      filterFreqStart: 1000, filterFreqEnd: 50, useReverb: true
    });
  }

  /**
   * Play player damage sound.
   */
  playPlayerDamage() {
    if (!this.core) {
return;
}
    this.core.playTone({
      type: 'playerDamage', frequency: 200, frequencyEnd: 100,
      duration: 0.2, volume: 0.35, waveType: 'sawtooth'
    });
  }

  // ── Collect / UI sounds ────────────────────────────────────────────────────

  /**
   * @param {'gold'|'health'|'weapon'|'ammo'|'powerup'} [type='gold']
   */
  playCollect(type = 'gold') {
    if (!this.core) {
return;
}

    const presets = {
      gold:   { frequency: 800,  frequencyEnd: 1200, duration: 0.10, volume: 0.25, waveType: 'sine' },
      health: { frequency: 600,  frequencyEnd: 900,  duration: 0.25, volume: 0.30, waveType: 'sine' },
      weapon: { frequency: 300,  frequencyEnd: 200,  duration: 0.08, volume: 0.35, waveType: 'square' },
      ammo:   { frequency: 300,  frequencyEnd: 200,  duration: 0.08, volume: 0.35, waveType: 'square' },
      powerup:{ frequency: 400,  frequencyEnd: 800,  duration: 0.20, volume: 0.25, waveType: 'sine' }
    };

    const preset = presets[type] ?? presets.gold;
    this.core.playTone({ type: 'collect', ...preset });
  }

  /** Play a heal chime. */
  playHeal() {
    if (!this.core) {
return;
}
    this.core.playTone({
      type: 'collect', frequency: 600, frequencyEnd: 900,
      duration: 0.3, volume: 0.2, waveType: 'sine'
    });
  }

  /**
   * Play level-up fanfare: rising arpeggio followed by accent chord.
   */
  playLevelUp() {
    if (!this.core) {
return;
}
    const schedule = window.setManagedTimeout || setTimeout;

    const arpeggio = [523.25, 659.25, 783.99, 1046.5];
    arpeggio.forEach((freq, i) => {
      schedule(() => {
        this.core.playTone({ type: 'levelup', frequency: freq, duration: 0.22, volume: 0.3, waveType: 'sine' });
      }, i * 90);
    });

    const accent = [1046.5, 1318.51, 1567.98];
    schedule(() => {
      accent.forEach(freq => {
        this.core.playTone({ type: 'levelup', frequency: freq, duration: 0.45, volume: 0.18, waveType: 'triangle' });
      });
    }, arpeggio.length * 90 + 20);
  }

  /**
   * Play triple bass drone for boss spawn.
   */
  playBossSpawn() {
    if (!this.core) {
return;
}
    for (let i = 0; i < 3; i++) {
      this.core.playTone({
        type: 'bossSpawn', frequency: 80 - i * 10, frequencyEnd: 60 - i * 10,
        duration: 1.0, volume: 0.18, waveType: 'sawtooth'
      });
    }
  }

  /**
   * @param {'click'|'hover'|'reward'} [type='click']
   */
  playUISound(type = 'click') {
    if (!this.core) {
return;
}

    const presets = {
      click:  { frequency: 800, duration: 0.05, volume: 0.18, waveType: 'sine' },
      hover:  { frequency: 600, duration: 0.03, volume: 0.10, waveType: 'sine' },
      reward: { frequency: 900, frequencyEnd: 1400, duration: 0.14, volume: 0.2, waveType: 'sine' }
    };
    const preset = presets[type] ?? presets.click;
    this.core.playTone({ type: 'ui', ...preset });
  }

  /**
   * Play reload sound sequence.
   * @param {'pistol'|string} [weaponType='pistol']
   */
  playReload(weaponType = 'pistol') {
    if (!this.core) {
return;
}
    const schedule = window.setManagedTimeout || setTimeout;

    this.core.playTone({ type: 'ui', frequency: 2500, duration: 0.015, volume: 0.15, waveType: 'square', filterFreq: 2000, filterType: 'highpass' });

    schedule(() => {
      this.core.playTone({ type: 'ui', frequency: 600, duration: 0.04, volume: 0.2, waveType: 'square', filterFreq: 800, filterType: 'bandpass' });
    }, 300);

    if (weaponType !== 'pistol') {
      schedule(() => {
        this.core.playTone({ type: 'ui', frequency: 2500, duration: 0.02, volume: 0.18, waveType: 'square', filterFreq: 2000, filterType: 'highpass' });
      }, 600);
    }
  }

  /** Play dry-fire click (empty magazine). */
  playDryFire() {
    if (!this.core) {
return;
}
    this.core.playTone({ type: 'ui', frequency: 1500, duration: 0.02, volume: 0.12, waveType: 'square' });
  }

  // ── Ambient systems ────────────────────────────────────────────────────────

  /**
   * Start a looping filtered-noise wind layer.
   * Connects through masterGain so global volume applies.
   */
  startWind() {
    if (!this.core?.audioContext || this._windNodes) {
return;
}
    const ctx = this.core.audioContext;
    if (ctx.state === 'suspended') {
ctx.resume();
}

    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sr * 4, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
data[i] = Math.random() * 2 - 1;
}

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 400;
    bp.Q.value = 0.5;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;

    const gain = ctx.createGain();
    gain.gain.value = 0.04;

    src.connect(bp);
    bp.connect(lp);
    lp.connect(gain);
    gain.connect(this.core.masterGain);
    src.start();

    this._windNodes = { src, bp, lp, gain };
  }

  /** Stop and disconnect wind nodes. */
  stopWind() {
    if (!this._windNodes) {
return;
}
    try {
 this._windNodes.src.stop();
} catch { /* ignore */ }
    try {
 this._windNodes.gain.disconnect();
} catch { /* ignore */ }
    this._windNodes = null;
  }

  /**
   * Schedule recurring distant zombie groans (random 5–15 s interval).
   */
  startZombieGroans() {
    if (!this.core?.audioContext || this._groanTimer !== undefined) {
return;
}
    const scheduleNext = () => {
      const delay = 5000 + Math.random() * 10000;
      this._groanTimer = (window.setManagedTimeout || setTimeout)(() => {
        this._playDistantGroan();
        scheduleNext();
      }, delay);
    };
    scheduleNext();
  }

  /** Cancel groan scheduling. */
  stopZombieGroans() {
    if (this._groanTimer !== undefined) {
      clearTimeout(this._groanTimer);
      this._groanTimer = undefined;
    }
  }

  /**
   * Play a single distant zombie groan with panning and random pitch.
   * All nodes are disconnected after playback.
   * @private
   */
  _playDistantGroan() {
    if (!this.core?.audioContext) {
return;
}
    const ctx = this.core.audioContext;
    if (ctx.state === 'suspended') {
return;
}

    const pitchFactor = 0.85 + Math.random() * 0.3;
    const duration = 0.6 + Math.random() * 0.4;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90 * pitchFactor, now);
    osc.frequency.linearRampToValueAtTime(60 * pitchFactor, now + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    filter.Q.value = 2;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.06, now + 0.08);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const panner = ctx.createStereoPanner();
    panner.pan.value = (Math.random() * 2 - 1) * 0.8;

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(this.core.masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.05);

    // Disconnect after playback to prevent node leak
    osc.onended = () => {
      try {
 panner.disconnect();
} catch { /* ignore */ }
      try {
 gainNode.disconnect();
} catch { /* ignore */ }
    };
  }

  /**
   * Start looping heartbeat thumps (use when player HP < 30).
   */
  startHeartbeat() {
    if (!this.core?.audioContext || this._heartbeatInterval) {
return;
}
    this._heartbeatInterval = setInterval(() => this._playHeartThump(), 480);
  }

  /** Stop heartbeat loop. */
  stopHeartbeat() {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
  }

  /**
   * Play a double-thump (lub-dub) heartbeat.
   * Nodes are disconnected via onended to prevent leaks.
   * @private
   */
  _playHeartThump() {
    if (!this.core?.audioContext) {
return;
}
    const ctx = this.core.audioContext;
    if (ctx.state === 'suspended') {
return;
}

    [0, 0.12].forEach((offset, i) => {
      const t = ctx.currentTime + offset;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(i === 0 ? 55 : 48, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.15);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(i === 0 ? 0.45 : 0.28, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

      osc.connect(gain);
      gain.connect(this.core.masterGain);
      osc.start(t);
      osc.stop(t + 0.2);

      osc.onended = () => {
 try {
 gain.disconnect();
} catch { /* ignore */ }
};
    });
  }

  /**
   * Play a short sub-bass rumble for wave start.
   * Node disconnected via onended.
   */
  playWaveRumble() {
    if (!this.core?.audioContext) {
return;
}
    const ctx = this.core.audioContext;
    if (ctx.state === 'suspended') {
ctx.resume();
}
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(50, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.6);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(this.core.masterGain);
    osc.start(now);
    osc.stop(now + 0.65);

    osc.onended = () => {
 try {
 gain.disconnect();
} catch { /* ignore */ }
};
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  /**
   * Linear distance attenuation (1 at distance=0, 0 at distance=maxDistance).
   * @param {number} distance
   * @param {number} [maxDistance=1000]
   * @returns {number} 0–1
   */
  calculateDistanceAttenuation(distance, maxDistance = 1000) {
    if (distance >= maxDistance) {
return 0;
}
    return Math.max(0, 1 - distance / maxDistance);
  }

  /** @returns {Object|null} */
  getStats() {
    return this.core ? this.core.getStats() : null;
  }
}

if (typeof window !== 'undefined') {
  window.OptimizedSoundEffects = OptimizedSoundEffects;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = OptimizedSoundEffects;
}
