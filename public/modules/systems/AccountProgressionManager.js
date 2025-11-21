/**
 * ACCOUNT PROGRESSION MANAGER - Client Side
 * Handles account progression UI notifications and skill loading
 * @module AccountProgressionManager
 * @version 1.0.0
 */

class AccountProgressionManager {
  constructor() {
    this.currentLevel = 1;
    this.currentXP = 0;
    this.skillBonuses = null;
  }

  /**
   * Initialize with socket listeners
   * @param {Socket} socket - Socket.IO client
   */
  init(socket) {
    this.socket = socket;

    // Listen for account XP gained
    socket.on('accountXPGained', (data) => {
      this.handleXPGained(data);
    });

    // Listen for skill bonuses loaded
    socket.on('skillBonusesLoaded', (bonuses) => {
      this.skillBonuses = bonuses;
      console.log('[AccountProgression] Skill bonuses loaded:', bonuses);
    });
  }

  /**
   * Handle XP gained notification
   * @param {Object} data - XP gain data
   */
  handleXPGained(data) {
    const {
      xpEarned,
      levelsGained,
      skillPointsGained,
      newLevel,
      progression
    } = data;

    console.log('[AccountProgression] XP Gained:', {
      xpEarned,
      levelsGained,
      newLevel
    });

    // Update current level
    this.currentLevel = newLevel;
    this.currentXP = progression.accountXP;

    // Show notification
    if (levelsGained > 0) {
      this.showLevelUpNotification(levelsGained, skillPointsGained, newLevel);
    } else {
      this.showXPGainedNotification(xpEarned);
    }
  }

  /**
   * Show level up notification
   * @param {Number} levelsGained
   * @param {Number} skillPointsGained
   * @param {Number} newLevel
   */
  showLevelUpNotification(levelsGained, skillPointsGained, newLevel) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'account-level-up-notification';
    notification.innerHTML = `
      <div class="account-level-up-content">
        <div class="account-level-up-icon">⭐</div>
        <div class="account-level-up-text">
          <div class="account-level-up-title">Account Level Up!</div>
          <div class="account-level-up-subtitle">
            ${levelsGained > 1 ? `Gained ${levelsGained} levels!` : `Level ${newLevel}`}
          </div>
          <div class="account-level-up-rewards">
            +${skillPointsGained} Skill Point${skillPointsGained > 1 ? 's' : ''}
          </div>
        </div>
      </div>
    `;

    // Add styles if not already present
    if (!document.getElementById('account-progression-styles')) {
      const style = document.createElement('style');
      style.id = 'account-progression-styles';
      style.textContent = `
        .account-level-up-notification {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 30px;
          border-radius: 15px;
          box-shadow: 0 10px 40px rgba(102, 126, 234, 0.5);
          z-index: 10000;
          animation: accountLevelUpAnim 0.5s ease-out;
        }

        .account-level-up-content {
          display: flex;
          align-items: center;
          gap: 20px;
          color: white;
        }

        .account-level-up-icon {
          font-size: 4em;
          animation: accountLevelUpRotate 1s ease-in-out infinite;
        }

        .account-level-up-title {
          font-size: 2em;
          font-weight: bold;
          margin-bottom: 5px;
        }

        .account-level-up-subtitle {
          font-size: 1.2em;
          opacity: 0.9;
        }

        .account-level-up-rewards {
          font-size: 1.5em;
          font-weight: bold;
          margin-top: 10px;
          color: #ffd700;
        }

        .account-xp-notification {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: rgba(102, 126, 234, 0.9);
          padding: 15px 25px;
          border-radius: 10px;
          color: white;
          font-weight: bold;
          z-index: 9999;
          animation: accountXPSlideIn 0.3s ease-out;
        }

        @keyframes accountLevelUpAnim {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
        }

        @keyframes accountLevelUpRotate {
          0%, 100% { transform: rotate(-10deg); }
          50% { transform: rotate(10deg); }
        }

        @keyframes accountXPSlideIn {
          0% {
            transform: translateX(400px);
            opacity: 0;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Add to page
    document.body.appendChild(notification);

    // Remove after 4 seconds
    setTimeout(() => {
      notification.style.animation = 'accountLevelUpAnim 0.3s ease-in reverse';
      setTimeout(() => notification.remove(), 300);
    }, 4000);

    // Play sound if available
    if (window.audioManager && typeof window.audioManager.playSound === 'function') {
      window.audioManager.playSound('levelup');
    }
  }

  /**
   * Show XP gained notification
   * @param {Number} xp
   */
  showXPGainedNotification(xp) {
    const notification = document.createElement('div');
    notification.className = 'account-xp-notification';
    notification.textContent = `+${xp} Account XP`;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'accountXPSlideIn 0.3s ease-in reverse';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Get skill bonuses
   * @returns {Object}
   */
  getSkillBonuses() {
    return this.skillBonuses || {};
  }

  /**
   * Check if has specific skill
   * @param {String} skillId
   * @returns {Boolean}
   */
  hasSkill(skillId) {
    return this.skillBonuses && this.skillBonuses[skillId] === true;
  }
}

// Export to window
window.AccountProgressionManager = AccountProgressionManager;
