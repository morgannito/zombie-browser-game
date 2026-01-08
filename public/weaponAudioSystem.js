/**
 * ADVANCED WEAPON AUDIO SYSTEM
 * Realistic weapon sounds with variations, reverb, and distance attenuation
 * @version 2.0.0
 */

class WeaponAudioSystem {
  constructor(audioContext) {
    this.context = audioContext;
    this.reverbNode = null;
    this.masterGain = null;

    // Audio pools pour éviter les clics
    this.activeNodes = new Set();

    this.init();
  }

  /**
   * Initialise le système audio avec reverb
   */
  init() {
    if (!this.context) {
      return;
    }

    // Master gain
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0.8;
    this.masterGain.connect(this.context.destination);

    // Convolver pour réverbération
    this.createReverb();
  }

  /**
   * Crée un effet de réverbération réaliste
   */
  createReverb() {
    if (!this.context) {
      return;
    }

    const sampleRate = this.context.sampleRate;
    const length = sampleRate * 2; // 2 secondes de reverb
    const impulse = this.context.createBuffer(2, length, sampleRate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);

    // Impulse response avec decay exponentiel
    for (let i = 0; i < length; i++) {
      const decay = Math.pow(1 - i / length, 3);
      impulseL[i] = (Math.random() * 2 - 1) * decay;
      impulseR[i] = (Math.random() * 2 - 1) * decay;
    }

    this.reverbNode = this.context.createConvolver();
    this.reverbNode.buffer = impulse;
  }

  /**
   * Nettoie les nodes audio terminés
   */
  cleanupNode(node, delay) {
    (window.setManagedTimeout ? window.setManagedTimeout : setTimeout)(() => {
      this.activeNodes.delete(node);
    }, delay * 1000);
  }

  /**
   * Calcule le volume selon la distance (0-1)
   */
  calculateDistanceAttenuation(distance, maxDistance = 1000) {
    if (distance >= maxDistance) {
      return 0;
    }
    return Math.max(0, 1 - (distance / maxDistance));
  }

  /**
   * PISTOL - Son de pistolet réaliste
   */
  playPistol(distance = 0, variation = true) {
    if (!this.context) {
      return;
    }

    const now = this.context.currentTime;
    const baseFreq = variation ? 280 + Math.random() * 40 : 300;
    const attenuation = this.calculateDistanceAttenuation(distance);

    // Explosion initiale (muzzle blast)
    const blast = this.context.createOscillator();
    const blastGain = this.context.createGain();
    const blastFilter = this.context.createBiquadFilter();

    blast.type = 'square';
    blast.frequency.setValueAtTime(baseFreq, now);
    blast.frequency.exponentialRampToValueAtTime(80, now + 0.05);

    blastFilter.type = 'lowpass';
    blastFilter.frequency.setValueAtTime(1200, now);
    blastFilter.frequency.exponentialRampToValueAtTime(400, now + 0.08);
    blastFilter.Q.value = 2;

    blastGain.gain.setValueAtTime(0.4 * attenuation, now);
    blastGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    blast.connect(blastFilter);
    blastFilter.connect(blastGain);
    blastGain.connect(this.masterGain);

    // Reverb path
    const reverbGain = this.context.createGain();
    reverbGain.gain.value = 0.15 * attenuation;
    blastGain.connect(this.reverbNode);
    this.reverbNode.connect(reverbGain);
    reverbGain.connect(this.masterGain);

    blast.start(now);
    blast.stop(now + 0.1);

    // Mechanical click (hammer)
    (window.setManagedTimeout ? window.setManagedTimeout : setTimeout)(() => {
      this.playMechanicalClick(attenuation * 0.6);
    }, 10);

    // Shell casing
    (window.setManagedTimeout ? window.setManagedTimeout : setTimeout)(() => {
      this.playShellCasing(attenuation * 0.5);
    }, 200 + Math.random() * 100);

    this.cleanupNode(blast, 0.15);
  }

  /**
   * SHOTGUN - Son de fusil à pompe réaliste
   */
  playShotgun(distance = 0, variation = true) {
    if (!this.context) {
      return;
    }

    const now = this.context.currentTime;
    const attenuation = this.calculateDistanceAttenuation(distance);

    // Multiple blasts (pellets)
    for (let i = 0; i < 5; i++) {
      const delay = i * 0.003; // Légère dispersion
      const freq = 120 + (variation ? Math.random() * 40 : 20);

      const blast = this.context.createOscillator();
      const blastGain = this.context.createGain();
      const filter = this.context.createBiquadFilter();

      blast.type = 'sawtooth';
      blast.frequency.setValueAtTime(freq, now + delay);
      blast.frequency.exponentialRampToValueAtTime(50, now + delay + 0.15);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800 - i * 50, now + delay);
      filter.frequency.exponentialRampToValueAtTime(200, now + delay + 0.15);
      filter.Q.value = 3;

      blastGain.gain.setValueAtTime(0.5 * attenuation, now + delay);
      blastGain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.15);

      blast.connect(filter);
      filter.connect(blastGain);
      blastGain.connect(this.masterGain);

      // Reverb
      const reverbGain = this.context.createGain();
      reverbGain.gain.value = 0.25 * attenuation;
      blastGain.connect(this.reverbNode);
      this.reverbNode.connect(reverbGain);
      reverbGain.connect(this.masterGain);

      blast.start(now + delay);
      blast.stop(now + delay + 0.2);

      this.cleanupNode(blast, 0.25);
    }

    // Pump action sound
    (window.setManagedTimeout ? window.setManagedTimeout : setTimeout)(() => {
      this.playPumpAction(attenuation);
    }, 600);

    // Shell casing
    (window.setManagedTimeout ? window.setManagedTimeout : setTimeout)(() => {
      this.playShellCasing(attenuation * 0.7, 'shotgun');
    }, 300);
  }

  /**
   * MACHINEGUN/MINIGUN - Tir rapide avec variations
   */
  playMachinegun(distance = 0, variation = true) {
    if (!this.context) {
      return;
    }

    const now = this.context.currentTime;
    const baseFreq = variation ? 380 + Math.random() * 60 : 400;
    const attenuation = this.calculateDistanceAttenuation(distance);

    // Muzzle blast court et punchy
    const blast = this.context.createOscillator();
    const blastGain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    blast.type = 'square';
    blast.frequency.setValueAtTime(baseFreq, now);
    blast.frequency.exponentialRampToValueAtTime(100, now + 0.03);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000 + Math.random() * 200, now);
    filter.Q.value = 4;

    blastGain.gain.setValueAtTime(0.25 * attenuation, now);
    blastGain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);

    blast.connect(filter);
    filter.connect(blastGain);
    blastGain.connect(this.masterGain);

    // Moins de reverb (tir rapide)
    const reverbGain = this.context.createGain();
    reverbGain.gain.value = 0.08 * attenuation;
    blastGain.connect(this.reverbNode);
    this.reverbNode.connect(reverbGain);
    reverbGain.connect(this.masterGain);

    blast.start(now);
    blast.stop(now + 0.05);

    // Shell casing plus discret
    if (Math.random() > 0.7) { // Pas à chaque coup
      (window.setManagedTimeout ? window.setManagedTimeout : setTimeout)(() => {
        this.playShellCasing(attenuation * 0.3, 'rifle');
      }, 50 + Math.random() * 50);
    }

    this.cleanupNode(blast, 0.08);
  }

  /**
   * RIFLE/SNIPER - Coup puissant avec crack sonique
   */
  playRifle(distance = 0, variation = true) {
    if (!this.context) {
      return;
    }

    const now = this.context.currentTime;
    const attenuation = this.calculateDistanceAttenuation(distance);

    // Supersonic crack
    const crack = this.context.createOscillator();
    const crackGain = this.context.createGain();
    const crackFilter = this.context.createBiquadFilter();

    crack.type = 'square';
    crack.frequency.setValueAtTime(2000, now);
    crack.frequency.exponentialRampToValueAtTime(800, now + 0.02);

    crackFilter.type = 'highpass';
    crackFilter.frequency.value = 1500;

    crackGain.gain.setValueAtTime(0.3 * attenuation, now);
    crackGain.gain.exponentialRampToValueAtTime(0.01, now + 0.02);

    crack.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(this.masterGain);

    crack.start(now);
    crack.stop(now + 0.03);

    // Muzzle blast principal
    const blast = this.context.createOscillator();
    const blastGain = this.context.createGain();
    const blastFilter = this.context.createBiquadFilter();

    blast.type = 'sawtooth';
    blast.frequency.setValueAtTime(200, now + 0.005);
    blast.frequency.exponentialRampToValueAtTime(60, now + 0.2);

    blastFilter.type = 'lowpass';
    blastFilter.frequency.setValueAtTime(1500, now);
    blastFilter.frequency.exponentialRampToValueAtTime(300, now + 0.2);

    blastGain.gain.setValueAtTime(0.5 * attenuation, now + 0.005);
    blastGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    blast.connect(blastFilter);
    blastFilter.connect(blastGain);
    blastGain.connect(this.masterGain);

    // Forte reverb
    const reverbGain = this.context.createGain();
    reverbGain.gain.value = 0.3 * attenuation;
    blastGain.connect(this.reverbNode);
    this.reverbNode.connect(reverbGain);
    reverbGain.connect(this.masterGain);

    blast.start(now + 0.005);
    blast.stop(now + 0.25);

    // Shell casing
    (window.setManagedTimeout ? window.setManagedTimeout : setTimeout)(() => {
      this.playShellCasing(attenuation * 0.6, 'rifle');
    }, 250);

    this.cleanupNode(crack, 0.05);
    this.cleanupNode(blast, 0.3);
  }

  /**
   * Son de douille qui tombe
   */
  playShellCasing(volume = 0.3, type = 'pistol') {
    if (!this.context) {
      return;
    }

    const now = this.context.currentTime;
    const bounces = type === 'shotgun' ? 2 : 3;

    for (let i = 0; i < bounces; i++) {
      const delay = i * 0.08 + Math.random() * 0.03;
      const freq = type === 'shotgun' ? 800 : 1200;
      const decay = Math.pow(0.5, i); // Chaque rebond plus faible

      const osc = this.context.createOscillator();
      const gain = this.context.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq + Math.random() * 200, now + delay);

      gain.gain.setValueAtTime(volume * 0.15 * decay, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.03);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now + delay);
      osc.stop(now + delay + 0.04);

      this.cleanupNode(osc, delay + 0.05);
    }
  }

  /**
   * Click mécanique (marteau, bolt)
   */
  playMechanicalClick(volume = 0.3) {
    if (!this.context) {
      return;
    }

    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.value = 2500 + Math.random() * 500;

    filter.type = 'highpass';
    filter.frequency.value = 2000;

    gain.gain.setValueAtTime(volume * 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.01);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.015);

    this.cleanupNode(osc, 0.02);
  }

  /**
   * Son de pompe (shotgun)
   */
  playPumpAction(volume = 0.4) {
    if (!this.context) {
      return;
    }

    const now = this.context.currentTime;

    // Slide back
    const slide1 = this.context.createOscillator();
    const gain1 = this.context.createGain();
    const filter1 = this.context.createBiquadFilter();

    slide1.type = 'sawtooth';
    slide1.frequency.setValueAtTime(400, now);
    slide1.frequency.linearRampToValueAtTime(200, now + 0.1);

    filter1.type = 'bandpass';
    filter1.frequency.value = 600;
    filter1.Q.value = 2;

    gain1.gain.setValueAtTime(volume * 0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    slide1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(this.masterGain);

    slide1.start(now);
    slide1.stop(now + 0.12);

    // Slide forward
    const slide2 = this.context.createOscillator();
    const gain2 = this.context.createGain();
    const filter2 = this.context.createBiquadFilter();

    slide2.type = 'sawtooth';
    slide2.frequency.setValueAtTime(200, now + 0.15);
    slide2.frequency.linearRampToValueAtTime(350, now + 0.25);

    filter2.type = 'bandpass';
    filter2.frequency.value = 500;
    filter2.Q.value = 2;

    gain2.gain.setValueAtTime(volume * 0.25, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    slide2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(this.masterGain);

    slide2.start(now + 0.15);
    slide2.stop(now + 0.27);

    this.cleanupNode(slide1, 0.15);
    this.cleanupNode(slide2, 0.3);
  }

  /**
   * Son de rechargement (clip insertion)
   */
  playReload(weaponType = 'pistol', volume = 0.4) {
    if (!this.context) {
      return;
    }

    const now = this.context.currentTime;

    // Magazine out (extraction)
    this.playMechanicalClick(volume * 0.8);

    // Magazine in (insertion) - délai
    (window.setManagedTimeout ? window.setManagedTimeout : setTimeout)(() => {
      const insert = this.context.createOscillator();
      const gain = this.context.createGain();
      const filter = this.context.createBiquadFilter();

      insert.type = 'square';
      insert.frequency.value = 600;

      filter.type = 'bandpass';
      filter.frequency.value = 800;

      gain.gain.setValueAtTime(volume * 0.3, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      insert.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      insert.start(now + 0.3);
      insert.stop(now + 0.36);
    }, 300);

    // Bolt/slide action - fin de reload
    if (weaponType !== 'pistol') {
      (window.setManagedTimeout ? window.setManagedTimeout : setTimeout)(() => {
        this.playMechanicalClick(volume * 0.9);
      }, 600);
    }
  }

  /**
   * Son d'arme vide (dry fire)
   */
  playDryFire(volume = 0.3) {
    if (!this.context) {
      return;
    }

    const now = this.context.currentTime;
    const click = this.context.createOscillator();
    const gain = this.context.createGain();

    click.type = 'square';
    click.frequency.value = 1500;

    gain.gain.setValueAtTime(volume * 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.02);

    click.connect(gain);
    gain.connect(this.masterGain);

    click.start(now);
    click.stop(now + 0.025);

    this.cleanupNode(click, 0.03);
  }

  /**
   * Ajuste le volume global
   */
  setVolume(volume) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Cleanup complet
   */
  cleanup() {
    this.activeNodes.forEach(node => {
      try {
        node.stop();
      } catch (e) {
        // Already stopped
      }
    });
    this.activeNodes.clear();
  }
}

// Export
if (typeof window !== 'undefined') {
  window.WeaponAudioSystem = WeaponAudioSystem;
}
