/**
 * NICKNAME MANAGER
 * Handles player nickname input and spawn protection
 * @module NicknameManager
 * @author Claude Code
 * @version 2.0.0
 */

class NicknameManager {
  constructor(playerController) {
    this.playerController = playerController;
    this.nicknameInput = document.getElementById('nickname-input');
    this.startGameBtn = document.getElementById('start-game-btn');
    this.nicknameScreen = document.getElementById('nickname-screen');
    this.respawnBtn = document.getElementById('respawn-btn');

    this.spawnProtectionInterval = null; // Store interval for cleanup
    this.respawnCountdownInterval = null;
    this.isStarting = false;

    // Store handler references for cleanup
    this.handlers = {
      keypress: (e) => {
        if (e.key === 'Enter') {
          this.startGame();
        }
      },
      startGame: () => this.startGame(),
      respawn: () => this.respawn(),
      gameOver: () => this._enableRespawnWithDelay()
    };

    this.setupEventListeners();

    // Restore last used nickname
    const saved = window.loadPref ? window.loadPref('pref_nickname', '') : '';
    if (saved && this.nicknameInput) {
      this.nicknameInput.value = saved;
    }
  }

  _FORBIDDEN_WORDS = ['admin', 'root', 'server', 'system'];
  _NICKNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

  _validateNickname(nickname) {
    if (nickname.length < CONSTANTS.NICKNAME.MIN_LENGTH) {
      return `Pseudo trop court (min. ${CONSTANTS.NICKNAME.MIN_LENGTH} caractères)`;
    }
    if (nickname.length > CONSTANTS.NICKNAME.MAX_LENGTH) {
      return `Pseudo trop long (max. ${CONSTANTS.NICKNAME.MAX_LENGTH} caractères)`;
    }
    if (!this._NICKNAME_REGEX.test(nickname)) {
      return 'Caractère interdit (lettres, chiffres, - et _ uniquement)';
    }
    const lower = nickname.toLowerCase();
    for (const word of this._FORBIDDEN_WORDS) {
      if (lower.includes(word)) {
        return `Pseudo interdit ("${word}" réservé)`;
      }
    }
    return null;
  }

  _showError(message) {
    let el = document.getElementById('nickname-error-msg');
    if (!el) {
      el = document.createElement('p');
      el.id = 'nickname-error-msg';
      el.style.cssText = 'color:#ff6b6b;font-size:0.85rem;margin-top:6px;text-align:center;';
      if (this.nicknameInput && this.nicknameInput.parentNode) {
        this.nicknameInput.parentNode.insertBefore(el, this.nicknameInput.nextSibling);
      }
    }
    el.textContent = message || '';
    clearTimeout(this._errorTimer);
    if (message) {
      this._errorTimer = setTimeout(() => { el.textContent = ''; }, 4000);
    }
  }

  _updateSubmitState() {
    if (!this.startGameBtn) return;
    const nickname = this.nicknameInput ? this.nicknameInput.value.trim() : '';
    const error = this._validateNickname(nickname);
    this._showError(error);
    this.startGameBtn.disabled = !!error;
    this.startGameBtn.style.opacity = error ? '0.5' : '';
    this.startGameBtn.style.cursor = error ? 'not-allowed' : '';
  }

  setupEventListeners() {
    if (this.nicknameInput) {
      this.nicknameInput.addEventListener('keypress', this.handlers.keypress);
      this.handlers.input = () => this._updateSubmitState();
      this.nicknameInput.addEventListener('input', this.handlers.input);
    }
    this._updateSubmitState();

    if (this.startGameBtn) {
      this.startGameBtn.addEventListener('click', this.handlers.startGame);
    }

    if (this.respawnBtn) {
      this.respawnBtn.addEventListener('click', this.handlers.respawn);
    }

    document.addEventListener('game_over', this.handlers.gameOver);
  }

  cleanup() {
    // Clear spawn protection interval
    if (this.spawnProtectionInterval) {
      clearInterval(this.spawnProtectionInterval);
      this.spawnProtectionInterval = null;
    }

    if (this.respawnCountdownInterval) {
      clearInterval(this.respawnCountdownInterval);
      this.respawnCountdownInterval = null;
    }

    // Remove event listeners
    if (this.nicknameInput) {
      this.nicknameInput.removeEventListener('keypress', this.handlers.keypress);
      if (this.handlers.input) {
        this.nicknameInput.removeEventListener('input', this.handlers.input);
      }
    }

    if (this.startGameBtn) {
      this.startGameBtn.removeEventListener('click', this.handlers.startGame);
    }

    if (this.respawnBtn) {
      this.respawnBtn.removeEventListener('click', this.handlers.respawn);
    }

    document.removeEventListener('game_over', this.handlers.gameOver);
  }

  async startGame() {
    if (this.isStarting) {
      return;
    }
    this.isStarting = true;
    const nickname = this.nicknameInput.value.trim();

    const validationError = this._validateNickname(nickname);
    if (validationError) {
      this._showError(validationError);
      this.isStarting = false;
      return;
    }

    // Persist nickname for next session
    if (window.savePref) window.savePref('pref_nickname', nickname);

    let token = null;
    if (window.authManager) {
      try {
        await window.authManager.login(nickname);
        token = window.authManager.getToken();
      } catch (error) {
        this._showError(`Connexion impossible : ${error.message || 'authentification échouée'}`);
        this.isStarting = false;
        return;
      }
    } else {
      this._showError(typeof I18n !== 'undefined' ? I18n.t('nickname.auth_unavailable') : 'Authentification non disponible');
      this.isStarting = false;
      return;
    }

    const sessionId = window.sessionManager ? window.sessionManager.getSessionId() : null;
    if (window.networkManager && window.networkManager.connectWithAuth) {
      try {
        await window.networkManager.connectWithAuth({ sessionId, token });
      } catch (error) {
        this._showError(`Serveur inaccessible : ${error.message || 'erreur réseau'}`);
        this.isStarting = false;
        return;
      }
    } else {
      this._showError(typeof I18n !== 'undefined' ? I18n.t('nickname.network_unavailable') : 'Connexion réseau indisponible');
      this.isStarting = false;
      return;
    }

    // Hide nickname screen
    this.nicknameScreen.style.display = 'none';

    // Hide skins button and menu during gameplay
    if (window.hideSkinsButton) {
      window.hideSkinsButton();
    }
    const skinsMenu = document.getElementById('skins-menu');
    if (skinsMenu) {
      skinsMenu.style.display = 'none';
    }

    // Set player nickname
    this.playerController.setNickname(nickname);

    // Display player name
    const playerNameDisplay = document.getElementById('player-name-display');
    if (playerNameDisplay) {
      playerNameDisplay.textContent = `🎮 ${nickname}`;
    }

    // Show spawn protection
    this.showSpawnProtection();
    this.isStarting = false;
  }

  showSpawnProtection() {
    const protectionDiv = document.getElementById('spawn-protection');
    const timerSpan = document.getElementById('protection-timer');

    if (!protectionDiv || !timerSpan) {
      return;
    } // Guard against missing elements

    protectionDiv.style.display = 'block';

    // Clear previous interval if exists
    if (this.spawnProtectionInterval) {
      clearInterval(this.spawnProtectionInterval);
    }

    this.spawnProtectionInterval = setInterval(() => {
      const remaining = Math.ceil((this.playerController.spawnProtectionEndTime - Date.now()) / 1000);

      if (remaining <= 0) {
        if (protectionDiv) {
          protectionDiv.style.display = 'none';
        }
        clearInterval(this.spawnProtectionInterval);
        this.spawnProtectionInterval = null;
        if (window.networkManager) {
          window.networkManager.endSpawnProtection();
        }
      } else {
        if (timerSpan) {
          timerSpan.textContent = remaining;
        }
      }
    }, CONSTANTS.SPAWN_PROTECTION.UPDATE_INTERVAL);
  }

  _enableRespawnWithDelay() {
    if (!this.respawnBtn) {
return;
}
    const DELAY_MS = 1500;
    const TICK_MS = 100;
    const endTime = Date.now() + DELAY_MS;
    this.respawnBtn.disabled = true;
    this.respawnBtn.textContent = '1...';
    if (this.respawnCountdownInterval) {
      clearInterval(this.respawnCountdownInterval);
    }
    this.respawnCountdownInterval = setInterval(() => {
      const remaining = endTime - Date.now();
      if (remaining <= 0) {
        clearInterval(this.respawnCountdownInterval);
        this.respawnCountdownInterval = null;
        this.respawnBtn.disabled = false;
        this.respawnBtn.textContent = typeof I18n !== 'undefined' ? I18n.t('ui.continue') : 'CONTINUER ?';
      } else {
        this.respawnBtn.textContent = `${Math.ceil(remaining / 1000)}...`;
      }
    }, TICK_MS);
  }

  respawn() {
    this.playerController.respawn();

    // Hide replay button on respawn
    const replayBtn = document.getElementById('replay-btn');
    if (replayBtn) replayBtn.style.display = 'none';

    const gameOverScreen = document.getElementById('game-over');
    if (gameOverScreen) {
      gameOverScreen.style.display = 'none';
    }

    // Re-arm the respawn button's disabled guard for the next death cycle
    if (this.respawnBtn) {
      this.respawnBtn.disabled = true;
    }

    // Show nickname screen again
    if (this.nicknameInput) {
      this.nicknameInput.value = '';
      this.nicknameInput.focus();
    }
    this._updateSubmitState();
    if (this.nicknameScreen) {
      this.nicknameScreen.style.display = 'flex';
    }

    // Show skins button again in menu
    if (window.showSkinsButton) {
      window.showSkinsButton();
    }
  }
}

// Export to window
window.NicknameManager = NicknameManager;
