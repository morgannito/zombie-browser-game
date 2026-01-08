/**
 * UNLOCK SYSTEM - Système de déblocage progressif
 * @version 1.0.0
 */

class UnlockSystem {
  constructor() {
    this.unlocks = this.loadUnlocks();
    this.weaponRequirements = this.initializeWeaponRequirements();
  }

  // Définir les conditions de déblocage pour chaque arme
  initializeWeaponRequirements() {
    return {
      pistol: {
        name: 'Pistolet',
        unlocked: true, // Toujours débloqué
        requirement: 'Disponible dès le début',
        icon: '🔫'
      },
      shotgun: {
        name: 'Shotgun',
        unlocked: false,
        requirement: 'Tuer 100 zombies',
        condition: () => {
          const stats = window.achievementSystem?.stats || {};
          return stats.totalZombiesKilled >= 100;
        },
        icon: '💥'
      },
      machinegun: {
        name: 'Mitraillette',
        unlocked: false,
        requirement: 'Atteindre le niveau 20',
        condition: () => {
          const stats = window.achievementSystem?.stats || {};
          return stats.highestLevel >= 20;
        },
        icon: '🔫'
      },
      rocketlauncher: {
        name: 'Lance-Roquettes',
        unlocked: false,
        requirement: 'Battre 1 boss',
        condition: () => {
          const stats = window.achievementSystem?.stats || {};
          return stats.bossesDefeated >= 1;
        },
        icon: '🚀'
      },
      sniper: {
        name: 'Sniper',
        unlocked: false,
        requirement: 'Faire 100 coups critiques',
        condition: () => {
          const stats = window.achievementSystem?.stats || {};
          return stats.totalCriticalHits >= 100;
        },
        icon: '🎯'
      },
      flamethrower: {
        name: 'Lance-Flammes',
        unlocked: false,
        requirement: 'Terminer 1 run complète (3 rooms)',
        condition: () => {
          const stats = window.achievementSystem?.stats || {};
          return stats.totalRunsCompleted >= 1;
        },
        icon: '🔥'
      },
      grenadelauncher: {
        name: 'Lance-Grenades',
        unlocked: false,
        requirement: 'Tuer 10 Explosive Zombies',
        condition: () => {
          const stats = window.achievementSystem?.stats || {};
          return (stats.zombiesKilledByType?.explosive || 0) >= 10;
        },
        icon: '💣'
      },
      laser: {
        name: 'Laser',
        unlocked: false,
        requirement: 'Tuer 500 zombies au total',
        condition: () => {
          const stats = window.achievementSystem?.stats || {};
          return stats.totalZombiesKilled >= 500;
        },
        icon: '⚡'
      }
    };
  }

  // Vérifier et débloquer les armes
  checkUnlocks() {
    const newUnlocks = [];

    for (const [weaponId, weapon] of Object.entries(this.weaponRequirements)) {
      // Sauter si déjà débloqué
      if (this.unlocks[weaponId]) {
        continue;
      }

      // Pistolet toujours débloqué
      if (weaponId === 'pistol') {
        this.unlocks[weaponId] = true;
        continue;
      }

      // Vérifier la condition
      if (weapon.condition && weapon.condition()) {
        this.unlock(weaponId);
        newUnlocks.push(weapon);
      }
    }

    return newUnlocks;
  }

  // Débloquer une arme
  unlock(weaponId) {
    if (this.unlocks[weaponId]) {
      return;
    }

    this.unlocks[weaponId] = true;
    this.saveUnlocks();

    const weapon = this.weaponRequirements[weaponId];
    if (weapon) {
      this.showUnlockNotification(weapon);
    }

    // Mettre à jour les achievements
    if (window.achievementSystem) {
      window.achievementSystem.updateStat('weaponsUnlocked', weaponId);
    }
  }

  // Vérifier si une arme est débloquée
  isUnlocked(weaponId) {
    return this.unlocks[weaponId] === true;
  }

  // Obtenir toutes les armes débloquées
  getUnlockedWeapons() {
    return Object.keys(this.weaponRequirements).filter(id => this.isUnlocked(id));
  }

  // Obtenir le progrès de déblocage
  getProgress() {
    const total = Object.keys(this.weaponRequirements).length;
    const unlocked = this.getUnlockedWeapons().length;
    const percentage = Math.floor((unlocked / total) * 100);

    return { total, unlocked, percentage };
  }

  // Afficher notification de déblocage
  showUnlockNotification(weapon) {
    if (window.toastManager) {
      window.toastManager.show(
        `🔓 ARME DÉBLOQUÉE!\n${weapon.icon} ${weapon.name}`,
        'unlock',
        5000
      );
    }

    // Créer popup spéciale
    this.createUnlockPopup(weapon);
  }

  // Créer popup de déblocage
  createUnlockPopup(weapon) {
    const popup = document.createElement('div');
    popup.className = 'unlock-popup';
    popup.innerHTML = `
      <div class="unlock-popup-inner">
        <div class="unlock-icon">🔓</div>
        <div class="unlock-content">
          <div class="unlock-header">NOUVELLE ARME DÉBLOQUÉE!</div>
          <div class="unlock-weapon-icon">${weapon.icon}</div>
          <div class="unlock-weapon-name">${weapon.name}</div>
          <div class="unlock-requirement">✅ ${weapon.requirement}</div>
        </div>
      </div>
    `;

    document.body.appendChild(popup);

    (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => popup.classList.add('show'), 100);

    (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => {
      popup.classList.remove('show');
      (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => popup.remove(), 500);
    }, 6000);
  }

  // Sauvegarder/charger données
  saveUnlocks() {
    localStorage.setItem('weapon_unlocks', JSON.stringify(this.unlocks));
  }

  loadUnlocks() {
    const saved = localStorage.getItem('weapon_unlocks');
    if (saved) {
      return JSON.parse(saved);
    }
    return { pistol: true }; // Pistolet toujours débloqué
  }

  // Créer l'UI des déblocages
  createUnlockUI() {
    const container = document.createElement('div');
    container.id = 'unlock-panel';
    container.className = 'unlock-panel';
    container.style.display = 'none';

    const progress = this.getProgress();

    container.innerHTML = `
      <div class="unlock-panel-header">
        <h2>🔓 ARMES</h2>
        <div class="unlock-progress">
          <div class="unlock-progress-bar">
            <div class="unlock-progress-fill" style="width: ${progress.percentage}%"></div>
          </div>
          <div class="unlock-progress-text">${progress.unlocked}/${progress.total} débloquées (${progress.percentage}%)</div>
        </div>
        <button class="unlock-close-btn">×</button>
      </div>
      <div class="unlock-panel-content">
        <div class="unlock-list">
          ${this.renderUnlockList()}
        </div>
      </div>
    `;

    document.body.appendChild(container);

    container.querySelector('.unlock-close-btn').addEventListener('click', () => {
      container.style.display = 'none';
    });

    return container;
  }

  // Rendre la liste des déblocages
  renderUnlockList() {
    return Object.entries(this.weaponRequirements).map(([id, weapon]) => {
      const isUnlocked = this.isUnlocked(id);

      return `
        <div class="unlock-card ${isUnlocked ? 'unlocked' : 'locked'}">
          <div class="unlock-card-icon">${isUnlocked ? weapon.icon : '🔒'}</div>
          <div class="unlock-card-content">
            <div class="unlock-card-name">${weapon.name}</div>
            <div class="unlock-card-requirement">
              ${isUnlocked ? '✅' : '🔒'} ${weapon.requirement}
            </div>
          </div>
          <div class="unlock-card-status">
            ${isUnlocked ? '<span class="unlocked-badge">DÉBLOQUÉ</span>' : '<span class="locked-badge">VERROUILLÉ</span>'}
          </div>
        </div>
      `;
    }).join('');
  }

  // Ouvrir le panneau
  openPanel() {
    const panel = document.getElementById('unlock-panel');
    if (panel) {
      panel.style.display = 'block';
      // Refresh l'affichage
      const list = panel.querySelector('.unlock-list');
      if (list) {
        list.innerHTML = this.renderUnlockList();
      }
    }
  }
}

// Initialiser le système global
window.unlockSystem = new UnlockSystem();
