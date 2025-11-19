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

    // Store handler references for cleanup
    this.handlers = {
      keypress: (e) => {
        if (e.key === 'Enter') {
          this.startGame();
        }
      },
      startGame: () => this.startGame(),
      respawn: () => this.respawn()
    };

    this.setupEventListeners();
  }

  setupEventListeners() {
    if (this.nicknameInput) {
      this.nicknameInput.addEventListener('keypress', this.handlers.keypress);
    }

    if (this.startGameBtn) {
      this.startGameBtn.addEventListener('click', this.handlers.startGame);
    }

    if (this.respawnBtn) {
      this.respawnBtn.addEventListener('click', this.handlers.respawn);
    }
  }

  cleanup() {
    // Clear spawn protection interval
    if (this.spawnProtectionInterval) {
      clearInterval(this.spawnProtectionInterval);
      this.spawnProtectionInterval = null;
    }

    // Remove event listeners
    if (this.nicknameInput) {
      this.nicknameInput.removeEventListener('keypress', this.handlers.keypress);
    }

    if (this.startGameBtn) {
      this.startGameBtn.removeEventListener('click', this.handlers.startGame);
    }

    if (this.respawnBtn) {
      this.respawnBtn.removeEventListener('click', this.handlers.respawn);
    }
  }

  startGame() {
    const nickname = this.nicknameInput.value.trim();

    if (nickname.length < CONSTANTS.NICKNAME.MIN_LENGTH) {
      alert(`Votre pseudo doit contenir au moins ${CONSTANTS.NICKNAME.MIN_LENGTH} caractères !`);
      return;
    }

    if (nickname.length > CONSTANTS.NICKNAME.MAX_LENGTH) {
      alert(`Votre pseudo ne peut pas dépasser ${CONSTANTS.NICKNAME.MAX_LENGTH} caractères !`);
      return;
    }

    // Validate nickname format (alphanumeric, spaces, underscores, hyphens only)
    const nicknameRegex = /^[\w\s-]+$/u;
    if (!nicknameRegex.test(nickname)) {
      alert('Votre pseudo ne peut contenir que des lettres, chiffres, espaces, tirets et underscores !');
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
  }

  showSpawnProtection() {
    const protectionDiv = document.getElementById('spawn-protection');
    const timerSpan = document.getElementById('protection-timer');

    if (!protectionDiv || !timerSpan) return; // Guard against missing elements

    protectionDiv.style.display = 'block';

    // Clear previous interval if exists
    if (this.spawnProtectionInterval) {
      clearInterval(this.spawnProtectionInterval);
    }

    this.spawnProtectionInterval = setInterval(() => {
      const remaining = Math.ceil((this.playerController.spawnProtectionEndTime - Date.now()) / 1000);

      if (remaining <= 0) {
        if (protectionDiv) protectionDiv.style.display = 'none';
        clearInterval(this.spawnProtectionInterval);
        this.spawnProtectionInterval = null;
        if (window.networkManager) {
          window.networkManager.endSpawnProtection();
        }
      } else {
        if (timerSpan) timerSpan.textContent = remaining;
      }
    }, CONSTANTS.SPAWN_PROTECTION.UPDATE_INTERVAL);
  }

  respawn() {
    this.playerController.respawn();

    const gameOverScreen = document.getElementById('game-over');
    if (gameOverScreen) {
      gameOverScreen.style.display = 'none';
    }

    // Show nickname screen again
    if (this.nicknameInput) {
      this.nicknameInput.value = '';
      this.nicknameInput.focus();
    }
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
