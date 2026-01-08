/**
 * Pause Menu Management
 * Handles game pause state, stats display, and menu interactions
 */

class PauseMenu {
  constructor() {
    this.isPaused = false;
    this.pauseStartTime = null;
    this.totalPausedTime = 0;
    this.gameStartTime = null;

    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
    } else {
      this.setupEventListeners();
    }
  }

  setupEventListeners() {
    const resumeBtn = document.getElementById('pause-resume-btn');
    const settingsBtn = document.getElementById('pause-settings-btn');
    const quitBtn = document.getElementById('pause-quit-btn');
    const pauseOverlay = document.querySelector('.pause-overlay');

    // Resume button
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => this.resume());
    }

    // Settings button
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        // Close pause menu and open settings
        this.hide();
        if (window.gameSettingsMenu) {
          window.gameSettingsMenu.open();
        }
      });
    }

    // Quit button
    if (quitBtn) {
      quitBtn.addEventListener('click', () => this.quit());
    }

    // Click overlay to resume (optional, can be disabled for strict pause)
    if (pauseOverlay) {
      pauseOverlay.addEventListener('click', () => this.resume());
    }

    // ESC key to toggle pause
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Don't toggle pause if other menus are open
        const settingsOpen = document.getElementById('settings-menu')?.style.display === 'block';
        const gameOverOpen = document.getElementById('game-over')?.style.display !== 'none';
        const shopOpen = document.getElementById('shop')?.style.display !== 'none';
        const levelUpOpen = document.getElementById('level-up-screen')?.style.display !== 'none';
        const nicknameOpen = document.getElementById('nickname-screen')?.style.display !== 'none';

        // If settings menu is open, close it and return to pause
        if (settingsOpen && this.isPaused) {
          if (window.gameSettingsMenu) {
            window.gameSettingsMenu.close();
          }
          this.show();
          return;
        }

        // Don't allow pause during other screens
        if (gameOverOpen || shopOpen || levelUpOpen || nicknameOpen || settingsOpen) {
          return;
        }

        this.toggle();
      }
    });
  }

  toggle() {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  pause() {
    if (this.isPaused) return;

    this.isPaused = true;
    this.pauseStartTime = Date.now();

    // Pause game engine if available
    if (window.gameEngine) {
      window.gameEngine.pause();
    }

    this.updateStats();
    this.show();
  }

  resume() {
    if (!this.isPaused) return;

    this.isPaused = false;

    // Track total paused time
    if (this.pauseStartTime) {
      this.totalPausedTime += Date.now() - this.pauseStartTime;
      this.pauseStartTime = null;
    }

    // Resume game engine if available
    if (window.gameEngine) {
      window.gameEngine.resume();
    }

    this.hide();
  }

  quit() {
    // Confirm quit action
    const confirmed = confirm('Êtes-vous sûr de vouloir quitter ? Votre progression sera perdue.');

    if (confirmed) {
      this.isPaused = false;
      this.hide();

      // Trigger game over or return to menu
      if (window.gameEngine) {
        window.gameEngine.gameOver();
      } else {
        // Fallback: reload page to restart
        window.location.reload();
      }
    }
  }

  show() {
    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) {
      pauseMenu.style.display = 'block';
    }
  }

  hide() {
    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) {
      pauseMenu.style.display = 'none';
    }
  }

  updateStats() {
    // Get current game state
    const gameState = this.getGameState();

    // Update wave
    const waveEl = document.getElementById('pause-wave');
    if (waveEl) {
      waveEl.textContent = gameState.wave || 1;
    }

    // Update level
    const levelEl = document.getElementById('pause-level');
    if (levelEl) {
      levelEl.textContent = gameState.level || 1;
    }

    // Update score
    const scoreEl = document.getElementById('pause-score');
    if (scoreEl) {
      scoreEl.textContent = this.formatNumber(gameState.score || 0);
    }

    // Update kills
    const killsEl = document.getElementById('pause-kills');
    if (killsEl) {
      killsEl.textContent = this.formatNumber(gameState.kills || 0);
    }

    // Update time
    const timeEl = document.getElementById('pause-time');
    if (timeEl) {
      const playTime = this.getPlayTime();
      timeEl.textContent = this.formatTime(playTime);
    }

    // Update gold
    const goldEl = document.getElementById('pause-gold');
    if (goldEl) {
      goldEl.textContent = this.formatNumber(gameState.gold || 0);
    }
  }

  getGameState() {
    // Try to get state from various possible sources
    const state = {
      wave: 1,
      level: 1,
      score: 0,
      kills: 0,
      gold: 0
    };

    // Try gameEngine first
    if (window.gameEngine?.gameState) {
      const gs = window.gameEngine.gameState;
      return {
        wave: gs.state?.wave || gs.wave || 1,
        level: gs.state?.level || gs.level || 1,
        score: gs.state?.score || gs.score || 0,
        kills: gs.state?.kills || gs.kills || 0,
        gold: gs.state?.gold || gs.gold || 0
      };
    }

    // Try DOM elements as fallback
    const waveValue = document.getElementById('wave-value')?.textContent;
    const levelValue = document.getElementById('level-text')?.textContent;
    const scoreValue = document.getElementById('score-value')?.textContent;
    const goldValue = document.getElementById('gold-value')?.textContent;

    if (waveValue) state.wave = parseInt(waveValue) || 1;
    if (levelValue) state.level = parseInt(levelValue) || 1;
    if (scoreValue) state.score = parseInt(scoreValue.replace(/,/g, '')) || 0;
    if (goldValue) state.gold = parseInt(goldValue.replace(/,/g, '')) || 0;

    return state;
  }

  getPlayTime() {
    if (!this.gameStartTime) {
      this.gameStartTime = Date.now();
    }

    const totalTime = Date.now() - this.gameStartTime;
    const playTime = totalTime - this.totalPausedTime;

    return Math.max(0, Math.floor(playTime / 1000)); // Convert to seconds
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  // Public method to mark game start
  onGameStart() {
    this.gameStartTime = Date.now();
    this.totalPausedTime = 0;
  }

  // Public method to reset state
  reset() {
    this.isPaused = false;
    this.pauseStartTime = null;
    this.totalPausedTime = 0;
    this.gameStartTime = null;
    this.hide();
  }
}

// Auto-initialize
if (typeof window !== 'undefined') {
  window.pauseMenu = new PauseMenu();
}
