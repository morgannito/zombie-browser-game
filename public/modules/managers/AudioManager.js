/**
 * AUDIO MANAGER
 * Simple synthesized sounds using Web Audio API
 * @module AudioManager
 * @author Claude Code
 * @version 2.0.0
 */

class AudioManager {
  constructor() {
    this.audioContext = null;
    this.enabled = true;
    this.initAudioContext();
  }

  initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
      this.enabled = false;
    }
  }

  play(soundType) {
    if (!this.enabled || !this.audioContext) {
      return;
    }

    // Resume audio context if needed (for mobile auto-play restrictions)
    // CORRECTION: Ne pas bloquer après resume() car c'est async
    // Le contexte va se résumer automatiquement et les sons suivants fonctionneront
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(e => {
        console.warn('Failed to resume audio context:', e);
      });
      // Continue quand même - le premier son peut ne pas jouer, mais ça débloque le contexte
    }

    const now = this.audioContext.currentTime;

    switch (soundType) {
    case 'shoot':
      this.playShoot(now);
      break;
    case 'doubleClick':
      this.playDoubleClick(now);
      break;
    case 'longPress':
      this.playLongPress(now);
      break;
    case 'swipe':
      this.playSwipe(now);
      break;
    case 'click':
      this.playClick(now);
      break;
    default:
      break;
    }
  }

  playShoot(startTime) {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.frequency.setValueAtTime(800, startTime);
    osc.frequency.exponentialRampToValueAtTime(200, startTime + 0.1);

    gain.gain.setValueAtTime(0.1, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.1);

    osc.start(startTime);
    osc.stop(startTime + 0.1);
  }

  playDoubleClick(startTime) {
    for (let i = 0; i < 2; i++) {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      const time = startTime + i * 0.1;
      osc.frequency.setValueAtTime(1200, time);
      gain.gain.setValueAtTime(0.1, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

      osc.start(time);
      osc.stop(time + 0.05);
    }
  }

  playLongPress(startTime) {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.frequency.setValueAtTime(600, startTime);
    osc.frequency.linearRampToValueAtTime(900, startTime + 0.2);

    gain.gain.setValueAtTime(0.08, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

    osc.start(startTime);
    osc.stop(startTime + 0.2);
  }

  playSwipe(startTime) {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.frequency.setValueAtTime(400, startTime);
    osc.frequency.exponentialRampToValueAtTime(1200, startTime + 0.15);

    gain.gain.setValueAtTime(0.08, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

    osc.start(startTime);
    osc.stop(startTime + 0.15);
  }

  playClick(startTime) {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.frequency.setValueAtTime(1000, startTime);
    gain.gain.setValueAtTime(0.1, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.05);

    osc.start(startTime);
    osc.stop(startTime + 0.05);
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}

// Export to window
window.AudioManager = AudioManager;
