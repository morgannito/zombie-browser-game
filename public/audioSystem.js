/**
 * ADVANCED AUDIO SYSTEM
 * Complete audio and music system with Web Audio API
 * Synthesized sounds and procedural music
 * @version 1.0.0
 */

/* ============================================
   MUSIC GENERATOR
   ============================================ */

class MusicGenerator {
  constructor(audioContext) {
    this.context = audioContext;
    this.masterGain = null;
    this.isPlaying = false;
    this.currentTheme = 'menu';
    this.tempo = 120; // BPM
    this.volume = 0.3;

    // Oscillators pour la musique
    this.oscillators = [];
    this.scheduledNotes = [];
  }

  /**
   * Initialise le système de musique
   */
  init() {
    if (!this.context) return;

    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.context.destination);
  }

  /**
   * Joue une note
   */
  playNote(frequency, duration, type = 'sine', volume = 0.3) {
    if (!this.context || !this.masterGain) return;

    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    // Envelope ADSR
    const now = this.context.currentTime;
    gainNode.gain.value = 0;
    gainNode.gain.linearRampToValueAtTime(volume, now + 0.01);
    gainNode.gain.linearRampToValueAtTime(volume * 0.7, now + duration * 0.3);
    gainNode.gain.linearRampToValueAtTime(0, now + duration);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    oscillator.start(now);
    oscillator.stop(now + duration);

    this.oscillators.push(oscillator);

    // Nettoyage
    (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => {
      const index = this.oscillators.indexOf(oscillator);
      if (index > -1) this.oscillators.splice(index, 1);
    }, duration * 1000);
  }

  /**
   * Joue un accord
   */
  playChord(frequencies, duration, volume = 0.2) {
    frequencies.forEach(freq => {
      this.playNote(freq, duration, 'sine', volume);
    });
  }

  /**
   * Thème musical - Menu
   */
  playMenuTheme() {
    if (!this.context) return;

    this.currentTheme = 'menu';
    const beatDuration = 60 / this.tempo;

    // Progression d'accords: Am - F - C - G
    const progression = [
      [220, 261.63, 329.63], // Am
      [174.61, 220, 261.63], // F
      [130.81, 164.81, 196],  // C
      [196, 246.94, 293.66]   // G
    ];

    let currentChord = 0;

    const playLoop = () => {
      if (!this.isPlaying || this.currentTheme !== 'menu') return;

      this.playChord(progression[currentChord], beatDuration * 4, 0.15);
      currentChord = (currentChord + 1) % progression.length;

      (window.timerManager ? window.timerManager.setTimeout : setTimeout)(playLoop, beatDuration * 4 * 1000);
    };

    playLoop();
  }

  /**
   * Thème musical - Combat normal
   */
  playCombatTheme() {
    if (!this.context) return;

    this.currentTheme = 'combat';
    this.tempo = 140;
    const beatDuration = 60 / this.tempo;

    // Riff de basse répétitif
    const bassLine = [110, 110, 146.83, 146.83, 123.47, 123.47, 164.81, 164.81];
    let noteIndex = 0;

    const playLoop = () => {
      if (!this.isPlaying || this.currentTheme !== 'combat') return;

      this.playNote(bassLine[noteIndex], beatDuration * 0.8, 'square', 0.2);
      noteIndex = (noteIndex + 1) % bassLine.length;

      // Mélodie par dessus de temps en temps
      if (noteIndex % 4 === 0) {
        (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => {
          this.playNote(440 + Math.random() * 100, beatDuration * 0.3, 'sawtooth', 0.1);
        }, beatDuration * 500);
      }

      (window.timerManager ? window.timerManager.setTimeout : setTimeout)(playLoop, beatDuration * 1000);
    };

    playLoop();
  }

  /**
   * Thème musical - Boss fight
   */
  playBossTheme() {
    if (!this.context) return;

    this.currentTheme = 'boss';
    this.tempo = 160;
    const beatDuration = 60 / this.tempo;

    // Progression intense
    const bassLine = [82.41, 87.31, 82.41, 98, 82.41, 87.31, 110];
    let noteIndex = 0;

    const playLoop = () => {
      if (!this.isPlaying || this.currentTheme !== 'boss') return;

      // Basse puissante
      this.playNote(bassLine[noteIndex], beatDuration * 0.9, 'sawtooth', 0.25);

      // Effets dramatiques
      if (noteIndex % 2 === 0) {
        (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => {
          this.playNote(bassLine[noteIndex] * 4, beatDuration * 0.2, 'square', 0.15);
        }, beatDuration * 250);
      }

      noteIndex = (noteIndex + 1) % bassLine.length;
      (window.timerManager ? window.timerManager.setTimeout : setTimeout)(playLoop, beatDuration * 1000);
    };

    playLoop();
  }

  /**
   * Démarre la musique selon le contexte
   */
  start(theme = 'menu') {
    if (!this.context) return;

    this.isPlaying = true;

    switch (theme) {
      case 'menu':
        this.playMenuTheme();
        break;
      case 'combat':
        this.playCombatTheme();
        break;
      case 'boss':
        this.playBossTheme();
        break;
    }
  }

  /**
   * Arrête la musique
   */
  stop() {
    this.isPlaying = false;
    this.oscillators.forEach(osc => {
      try {
        osc.stop();
      } catch (e) {
        // Déjà arrêté
      }
    });
    this.oscillators = [];
  }

  /**
   * Change le thème musical
   */
  changeTheme(newTheme) {
    if (newTheme === this.currentTheme) return;

    this.stop();
    (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => {
      this.start(newTheme);
    }, 200);
  }

  /**
   * Ajuste le volume
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }
}

/* ============================================
   ENHANCED SOUND EFFECTS
   ============================================ */

class EnhancedSoundEffects {
  constructor(audioContext) {
    this.context = audioContext;
    this.sounds = {};

    // Intégration du système d'armes avancé
    this.weaponAudio = null;
    if (typeof WeaponAudioSystem !== 'undefined') {
      this.weaponAudio = new WeaponAudioSystem(audioContext);
    }
  }

  /**
   * Joue un son de tir amélioré avec variations et réverbération
   */
  playShoot(weaponType = 'pistol', distance = 0) {
    // Utiliser le nouveau système si disponible
    if (this.weaponAudio) {
      switch (weaponType) {
        case 'pistol':
          this.weaponAudio.playPistol(distance, true);
          break;
        case 'shotgun':
          this.weaponAudio.playShotgun(distance, true);
          break;
        case 'machinegun':
        case 'minigun':
          this.weaponAudio.playMachinegun(distance, true);
          break;
        case 'rifle':
        case 'sniper':
          this.weaponAudio.playRifle(distance, true);
          break;
        default:
          this.weaponAudio.playPistol(distance, true);
      }
      return;
    }

    // Fallback sur l'ancien système
    if (!this.context) return;

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    switch (weaponType) {
      case 'pistol':
        oscillator.frequency.value = 300;
        filter.frequency.value = 800;
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        break;

      case 'shotgun':
        oscillator.frequency.value = 150;
        filter.frequency.value = 400;
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        break;

      case 'machinegun':
        oscillator.frequency.value = 400;
        filter.frequency.value = 1000;
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        break;
    }

    oscillator.type = 'square';
    filter.type = 'lowpass';

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.context.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.2);
  }

  /**
   * Son de rechargement
   */
  playReload(weaponType = 'pistol') {
    if (this.weaponAudio) {
      this.weaponAudio.playReload(weaponType);
    }
  }

  /**
   * Son d'arme vide
   */
  playDryFire() {
    if (this.weaponAudio) {
      this.weaponAudio.playDryFire();
    }
  }

  /**
   * Son d'impact sur zombie
   */
  playHit(isCritical = false) {
    if (!this.context) return;

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(isCritical ? 600 : 400, now);
    oscillator.frequency.exponentialRampToValueAtTime(isCritical ? 100 : 80, now + 0.1);

    gainNode.gain.setValueAtTime(isCritical ? 0.4 : 0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.1);
  }

  /**
   * Son de mort de zombie
   */
  playZombieDeath() {
    if (!this.context) return;

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(300, now);
    oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.3);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.3);

    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.context.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.3);
  }

  /**
   * Son d'explosion
   */
  playExplosion() {
    if (!this.context) return;

    const now = this.context.currentTime;

    // Noise pour l'explosion
    const bufferSize = this.context.sampleRate * 0.5;
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.context.createBufferSource();
    noise.buffer = buffer;

    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, now);
    filter.frequency.exponentialRampToValueAtTime(50, now + 0.5);

    const gainNode = this.context.createGain();
    gainNode.gain.setValueAtTime(0.6, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.context.destination);

    noise.start(now);
    noise.stop(now + 0.5);
  }

  /**
   * Son de collecte (or, power-up)
   */
  playCollect(type = 'gold') {
    if (!this.context) return;

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();

    oscillator.type = 'sine';

    if (type === 'gold') {
      oscillator.frequency.setValueAtTime(800, now);
      oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
    } else if (type === 'powerup') {
      oscillator.frequency.setValueAtTime(400, now);
      oscillator.frequency.exponentialRampToValueAtTime(800, now + 0.2);
    }

    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.2);
  }

  /**
   * Son de level up
   */
  playLevelUp() {
    if (!this.context) return;

    const now = this.context.currentTime;
    const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C, E, G, C (octave)

    frequencies.forEach((freq, i) => {
      const oscillator = this.context.createOscillator();
      const gainNode = this.context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = freq;

      gainNode.gain.setValueAtTime(0, now + i * 0.1);
      gainNode.gain.linearRampToValueAtTime(0.3, now + i * 0.1 + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);

      oscillator.connect(gainNode);
      gainNode.connect(this.context.destination);

      oscillator.start(now + i * 0.1);
      oscillator.stop(now + i * 0.1 + 0.3);
    });
  }

  /**
   * Son de damage sur le joueur
   */
  playPlayerDamage() {
    if (!this.context) return;

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(200, now);
    oscillator.frequency.linearRampToValueAtTime(100, now + 0.2);

    gainNode.gain.setValueAtTime(0.4, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.2);
  }

  /**
   * Son de heal
   */
  playHeal() {
    if (!this.context) return;

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(600, now);
    oscillator.frequency.linearRampToValueAtTime(900, now + 0.3);

    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.3);
  }

  /**
   * Son d'apparition de boss
   */
  playBossSpawn() {
    if (!this.context) return;

    const now = this.context.currentTime;

    // Son grave et menaçant
    for (let i = 0; i < 3; i++) {
      const oscillator = this.context.createOscillator();
      const gainNode = this.context.createGain();

      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(80 - i * 10, now);
      oscillator.frequency.linearRampToValueAtTime(60 - i * 10, now + 1);

      gainNode.gain.setValueAtTime(0.2, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1);

      oscillator.connect(gainNode);
      gainNode.connect(this.context.destination);

      oscillator.start(now);
      oscillator.stop(now + 1);
    }
  }

  /**
   * Son d'UI (clic, hover)
   */
  playUISound(type = 'click') {
    if (!this.context) return;

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();

    oscillator.type = 'sine';

    if (type === 'click') {
      oscillator.frequency.value = 800;
      gainNode.gain.setValueAtTime(0.2, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    } else if (type === 'hover') {
      oscillator.frequency.value = 600;
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
    }

    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.1);
  }
}

/* ============================================
   ADVANCED AUDIO MANAGER
   ============================================ */

class AdvancedAudioManager {
  constructor() {
    this.context = null;
    this.music = null;
    this.sounds = null;
    this.enabled = true;
    this.musicEnabled = true;
    this.soundsEnabled = true;
    this.masterVolume = 0.7;
    this.musicVolume = 0.5;
    this.soundsVolume = 0.8;

    this.init();
  }

  /**
   * Initialise le système audio
   */
  init() {
    try {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      this.music = new MusicGenerator(this.context);
      this.sounds = new EnhancedSoundEffects(this.context);

      this.music.init();
      this.music.setVolume(this.musicVolume * this.masterVolume);
    } catch (e) {
      console.warn('Web Audio API not supported', e);
      this.enabled = false;
    }
  }

  /**
   * Reprend le contexte audio (nécessaire après interaction utilisateur)
   */
  async resume() {
    if (this.context && this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  /**
   * Démarre la musique
   */
  startMusic(theme = 'menu') {
    if (!this.enabled || !this.musicEnabled) return;
    this.resume();
    this.music.start(theme);
  }

  /**
   * Change le thème musical
   */
  changeMusic(theme) {
    if (!this.enabled || !this.musicEnabled) return;
    this.music.changeTheme(theme);
  }

  /**
   * Arrête la musique
   */
  stopMusic() {
    if (!this.music) return;
    this.music.stop();
  }

  /**
   * Joue un effet sonore
   */
  playSound(soundType, ...args) {
    if (!this.enabled || !this.soundsEnabled || !this.sounds) return;

    this.resume();

    switch (soundType) {
      case 'shoot':
        this.sounds.playShoot(...args);
        break;
      case 'hit':
        this.sounds.playHit(...args);
        break;
      case 'zombieDeath':
        this.sounds.playZombieDeath();
        break;
      case 'explosion':
        this.sounds.playExplosion();
        break;
      case 'collect':
        this.sounds.playCollect(...args);
        break;
      case 'levelup':
        this.sounds.playLevelUp();
        break;
      case 'playerDamage':
        this.sounds.playPlayerDamage();
        break;
      case 'heal':
        this.sounds.playHeal();
        break;
      case 'bossSpawn':
        this.sounds.playBossSpawn();
        break;
      case 'ui':
        this.sounds.playUISound(...args);
        break;
    }
  }

  /**
   * Active/désactive le son
   */
  toggleSound() {
    this.soundsEnabled = !this.soundsEnabled;
    return this.soundsEnabled;
  }

  /**
   * Active/désactive la musique
   */
  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (!this.musicEnabled) {
      this.stopMusic();
    }
    return this.musicEnabled;
  }

  /**
   * Définit le volume principal
   */
  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.music) {
      this.music.setVolume(this.musicVolume * this.masterVolume);
    }
  }

  /**
   * Définit le volume de la musique
   */
  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.music) {
      this.music.setVolume(this.musicVolume * this.masterVolume);
    }
  }

  /**
   * Définit le volume des effets sonores
   */
  setSoundsVolume(volume) {
    this.soundsVolume = Math.max(0, Math.min(1, volume));
  }
}

// Export pour utilisation globale
if (typeof window !== 'undefined') {
  window.AdvancedAudioManager = AdvancedAudioManager;
  window.MusicGenerator = MusicGenerator;
  window.EnhancedSoundEffects = EnhancedSoundEffects;
}
