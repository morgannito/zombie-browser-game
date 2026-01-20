/**
 * ACHIEVEMENT SYSTEM - Sistema de logros y recompensas
 * @version 1.0.0
 */

class AchievementSystem {
  constructor() {
    this.achievements = this.initializeAchievements();
    this.unlockedAchievements = this.loadProgress();
    this.notificationQueue = [];
    this.stats = {
      totalZombiesKilled: 0,
      zombiesKilledByType: {},
      totalGoldEarned: 0,
      totalRunsCompleted: 0,
      totalRoomsSurvived: 0,
      highestLevel: 0,
      highestWave: 0,
      totalCriticalHits: 0,
      totalDodges: 0,
      weaponsUnlocked: [],
      upgradesObtained: [],
      bossesDefeated: 0,
      noDamageBossKills: 0,
      pistolOnlyRuns: 0,
      allUpgradesInRun: false
    };
    this.loadStats();
  }

  initializeAchievements() {
    return {
      // ACHIEVEMENTS DE PROGRESSION (25 total)
      'first_blood': {
        id: 'first_blood',
        name: '🩸 Premier Sang',
        description: 'Tuer votre premier zombie',
        category: 'progression',
        rarity: 'common',
        condition: () => this.stats.totalZombiesKilled >= 1,
        reward: { gold: 50, gems: 5 },
        unlocked: false
      },
      'zombie_hunter': {
        id: 'zombie_hunter',
        name: '🧟 Chasseur de Zombies',
        description: 'Tuer 100 zombies',
        category: 'progression',
        rarity: 'common',
        condition: () => this.stats.totalZombiesKilled >= 100,
        reward: { gold: 100, gems: 10 },
        unlocked: false
      },
      'zombie_slayer': {
        id: 'zombie_slayer',
        name: '⚔️ Tueur de Zombies',
        description: 'Tuer 500 zombies',
        category: 'progression',
        rarity: 'rare',
        condition: () => this.stats.totalZombiesKilled >= 500,
        reward: { gold: 250, gems: 25 },
        unlocked: false
      },
      'zombie_exterminator': {
        id: 'zombie_exterminator',
        name: '💀 Exterminateur',
        description: 'Tuer 1000 zombies',
        category: 'progression',
        rarity: 'epic',
        condition: () => this.stats.totalZombiesKilled >= 1000,
        reward: { gold: 500, gems: 50 },
        unlocked: false
      },
      'zombie_apocalypse': {
        id: 'zombie_apocalypse',
        name: '🌍 Apocalypse Zombie',
        description: 'Tuer 5000 zombies',
        category: 'progression',
        rarity: 'legendary',
        condition: () => this.stats.totalZombiesKilled >= 5000,
        reward: { gold: 1000, gems: 100, title: 'Apocalypse Survivor' },
        unlocked: false
      },

      // Achievements de niveau
      'level_10': {
        id: 'level_10',
        name: '🔟 Niveau 10',
        description: 'Atteindre le niveau 10',
        category: 'progression',
        rarity: 'common',
        condition: () => this.stats.highestLevel >= 10,
        reward: { gold: 75, gems: 10 },
        unlocked: false
      },
      'level_20': {
        id: 'level_20',
        name: '🔥 Niveau 20',
        description: 'Atteindre le niveau 20',
        category: 'progression',
        rarity: 'rare',
        condition: () => this.stats.highestLevel >= 20,
        reward: { gold: 200, gems: 25 },
        unlocked: false
      },
      'level_50': {
        id: 'level_50',
        name: '⭐ Niveau 50',
        description: 'Atteindre le niveau 50',
        category: 'progression',
        rarity: 'epic',
        condition: () => this.stats.highestLevel >= 50,
        reward: { gold: 500, gems: 50, title: 'Level Master' },
        unlocked: false
      },

      // Achievements de vagues
      'wave_10': {
        id: 'wave_10',
        name: '🌊 Survivant - Vague 10',
        description: 'Survivre jusqu\'à la vague 10',
        category: 'progression',
        rarity: 'rare',
        condition: () => this.stats.highestWave >= 10,
        reward: { gold: 150, gems: 20 },
        unlocked: false
      },
      'wave_25': {
        id: 'wave_25',
        name: '🏆 Survivant - Vague 25',
        description: 'Survivre jusqu\'à la vague 25',
        category: 'progression',
        rarity: 'epic',
        condition: () => this.stats.highestWave >= 25,
        reward: { gold: 400, gems: 40 },
        unlocked: false
      },
      'wave_50': {
        id: 'wave_50',
        name: '👑 Roi de la Survie - Vague 50',
        description: 'Survivre jusqu\'à la vague 50',
        category: 'progression',
        rarity: 'legendary',
        condition: () => this.stats.highestWave >= 50,
        reward: { gold: 1000, gems: 100, title: 'Survival King' },
        unlocked: false
      },

      // ACHIEVEMENTS DE DÉFI (15 total)
      'no_damage_boss': {
        id: 'no_damage_boss',
        name: '🛡️ Perfection',
        description: 'Battre un boss sans prendre de dégâts',
        category: 'challenge',
        rarity: 'epic',
        condition: () => this.stats.noDamageBossKills >= 1,
        reward: { gold: 300, gems: 30 },
        unlocked: false
      },
      'pistol_purist': {
        id: 'pistol_purist',
        name: '🔫 Puriste au Pistolet',
        description: 'Terminer une run complète avec seulement le pistolet',
        category: 'challenge',
        rarity: 'rare',
        condition: () => this.stats.pistolOnlyRuns >= 1,
        reward: { gold: 250, gems: 25 },
        unlocked: false
      },
      'critical_master': {
        id: 'critical_master',
        name: '💥 Maître des Critiques',
        description: 'Faire 100 coups critiques',
        category: 'challenge',
        rarity: 'rare',
        condition: () => this.stats.totalCriticalHits >= 100,
        reward: { gold: 200, gems: 20 },
        unlocked: false
      },
      'dodge_master': {
        id: 'dodge_master',
        name: '⚡ Maître de l\'Esquive',
        description: 'Esquiver 50 attaques',
        category: 'challenge',
        rarity: 'rare',
        condition: () => this.stats.totalDodges >= 50,
        reward: { gold: 200, gems: 20 },
        unlocked: false
      },
      'speedrun_3min': {
        id: 'speedrun_3min',
        name: '⏱️ Speedrunner',
        description: 'Terminer une room en moins de 3 minutes',
        category: 'challenge',
        rarity: 'epic',
        condition: () => this.stats.fastestRoomTime && this.stats.fastestRoomTime <= 180,
        reward: { gold: 350, gems: 35 },
        unlocked: false
      },
      'gold_collector': {
        id: 'gold_collector',
        name: '💰 Collectionneur d\'Or',
        description: 'Collecter 10,000 or au total',
        category: 'challenge',
        rarity: 'epic',
        condition: () => this.stats.totalGoldEarned >= 10000,
        reward: { gold: 500, gems: 50 },
        unlocked: false
      },
      'boss_slayer': {
        id: 'boss_slayer',
        name: '👹 Tueur de Boss',
        description: 'Battre 10 boss',
        category: 'challenge',
        rarity: 'rare',
        condition: () => this.stats.bossesDefeated >= 10,
        reward: { gold: 300, gems: 30 },
        unlocked: false
      },

      // ACHIEVEMENTS DE COLLECTION (10 total)
      'weapon_collector': {
        id: 'weapon_collector',
        name: '🔫 Collectionneur d\'Armes',
        description: 'Débloquer toutes les armes',
        category: 'collection',
        rarity: 'epic',
        condition: () => this.stats.weaponsUnlocked.length >= 8,
        reward: { gold: 400, gems: 40, title: 'Weapon Master' },
        unlocked: false
      },
      'upgrade_hunter': {
        id: 'upgrade_hunter',
        name: '⬆️ Chasseur d\'Upgrades',
        description: 'Obtenir 20 upgrades différents',
        category: 'collection',
        rarity: 'rare',
        condition: () => this.stats.upgradesObtained.length >= 20,
        reward: { gold: 250, gems: 25 },
        unlocked: false
      },

      // ACHIEVEMENTS SPÉCIAUX (5 total)
      'lucky_streak': {
        id: 'lucky_streak',
        name: '🍀 Chance Insolente',
        description: 'Obtenir 3 upgrades légendaires dans une run',
        category: 'special',
        rarity: 'legendary',
        condition: () => this.stats.legendaryUpgradesInRun >= 3,
        reward: { gold: 750, gems: 75, title: 'Lucky One' },
        unlocked: false
      },
      'first_run': {
        id: 'first_run',
        name: '🎮 Première Partie',
        description: 'Terminer votre première run',
        category: 'special',
        rarity: 'common',
        condition: () => this.stats.totalRunsCompleted >= 1,
        reward: { gold: 100, gems: 10 },
        unlocked: false
      },
      'dedicated_player': {
        id: 'dedicated_player',
        name: '💪 Joueur Dévoué',
        description: 'Se connecter 7 jours consécutifs',
        category: 'special',
        rarity: 'epic',
        condition: () => this.stats.loginStreak >= 7,
        reward: { gold: 500, gems: 50 },
        unlocked: false
      },

      // ACHIEVEMENTS CACHÉS (5 total)
      'secret_room': {
        id: 'secret_room',
        name: '🔐 Explorateur Secret',
        description: '???',
        category: 'hidden',
        rarity: 'legendary',
        hidden: true,
        condition: () => this.stats.secretRoomsFound >= 1,
        reward: { gold: 1000, gems: 100, title: 'Secret Finder' },
        unlocked: false
      },
      'easter_egg': {
        id: 'easter_egg',
        name: '🥚 Chasseur d\'Easter Eggs',
        description: '???',
        category: 'hidden',
        rarity: 'legendary',
        hidden: true,
        condition: () => this.stats.easterEggsFound >= 3,
        reward: { gold: 1500, gems: 150, title: 'Egg Hunter' },
        unlocked: false
      }
    };
  }

  // Charger la progression depuis localStorage
  loadProgress() {
    const saved = localStorage.getItem('achievements_progress');
    if (saved) {
      return JSON.parse(saved);
    }
    return {};
  }

  // Sauvegarder la progression
  saveProgress() {
    localStorage.setItem('achievements_progress', JSON.stringify(this.unlockedAchievements));
  }

  // Charger les stats
  loadStats() {
    const saved = localStorage.getItem('achievement_stats');
    if (saved) {
      this.stats = { ...this.stats, ...JSON.parse(saved) };
    }
  }

  // Sauvegarder les stats
  saveStats() {
    localStorage.setItem('achievement_stats', JSON.stringify(this.stats));
  }

  // Mettre à jour une stat
  updateStat(statName, value) {
    if (typeof this.stats[statName] === 'number') {
      this.stats[statName] += value;
    } else if (Array.isArray(this.stats[statName])) {
      if (!this.stats[statName].includes(value)) {
        this.stats[statName].push(value);
      }
    } else {
      this.stats[statName] = value;
    }
    this.saveStats();
    this.checkAchievements();
  }

  // Vérifier tous les achievements
  checkAchievements() {
    const newUnlocks = [];

    for (const [id, achievement] of Object.entries(this.achievements)) {
      // Sauter si déjà débloqué
      if (this.unlockedAchievements[id]) {
        continue;
      }

      // Vérifier la condition
      if (achievement.condition()) {
        this.unlockAchievement(id);
        newUnlocks.push(achievement);
      }
    }

    return newUnlocks;
  }

  // Débloquer un achievement
  unlockAchievement(achievementId) {
    const achievement = this.achievements[achievementId];
    if (!achievement || this.unlockedAchievements[achievementId]) {
      return;
    }

    this.unlockedAchievements[achievementId] = {
      unlockedAt: Date.now(),
      rewardClaimed: false
    };

    this.saveProgress();

    // Afficher une notification
    this.showAchievementNotification(achievement);

    // Donner les récompenses automatiquement
    this.claimReward(achievementId);
  }

  // Récupérer une récompense
  claimReward(achievementId) {
    const achievement = this.achievements[achievementId];
    const unlockData = this.unlockedAchievements[achievementId];

    if (!achievement || !unlockData || unlockData.rewardClaimed) {
      return null;
    }

    unlockData.rewardClaimed = true;
    this.saveProgress();

    return achievement.reward;
  }

  // Afficher notification d'achievement
  showAchievementNotification(achievement) {
    // Créer notification toast
    if (window.toastManager) {
      const rarityEmoji = {
        common: '⭐',
        rare: '💎',
        epic: '👑',
        legendary: '🏆'
      };

      window.toastManager.show(
        `${rarityEmoji[achievement.rarity]} ACHIEVEMENT DÉBLOQUÉ!\n${achievement.name}`,
        'achievement',
        5000
      );
    }

    // Créer une notification visuelle spéciale
    this.createAchievementPopup(achievement);
  }

  // Créer popup d'achievement
  createAchievementPopup(achievement) {
    const popup = document.createElement('div');
    popup.className = 'achievement-popup';
    popup.innerHTML = `
      <div class="achievement-popup-inner ${achievement.rarity}">
        <div class="achievement-icon">🏆</div>
        <div class="achievement-content">
          <div class="achievement-header">ACHIEVEMENT DÉBLOQUÉ!</div>
          <div class="achievement-name">${achievement.name}</div>
          <div class="achievement-desc">${achievement.description}</div>
          <div class="achievement-reward">
            ${achievement.reward.gold ? `💰 ${achievement.reward.gold} Or` : ''}
            ${achievement.reward.gems ? ` | 💎 ${achievement.reward.gems} Gems` : ''}
            ${achievement.reward.title ? ` | 🎖️ "${achievement.reward.title}"` : ''}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(popup);

    // Animation d'entrée
    setTimeout(() => {
      if (popup && popup.parentNode) {
        popup.classList.add('show');
      }
    }, 100);

    // Retirer après 6 secondes (avec vérification de sécurité)
    setTimeout(() => {
      if (popup && popup.parentNode) {
        popup.classList.remove('show');
        setTimeout(() => {
          if (popup && popup.parentNode) {
            popup.remove();
          }
        }, 500);
      }
    }, 6000);
  }

  // Obtenir le progrès d'un achievement
  getProgress() {
    const total = Object.keys(this.achievements).length;
    const unlocked = Object.keys(this.unlockedAchievements).length;
    const percentage = Math.floor((unlocked / total) * 100);

    return {
      total,
      unlocked,
      percentage,
      gems: this.getTotalGemsEarned(),
      gold: this.getTotalGoldEarned()
    };
  }

  // Obtenir le total de gems gagnés
  getTotalGemsEarned() {
    let total = 0;
    for (const [id, data] of Object.entries(this.unlockedAchievements)) {
      if (data.rewardClaimed && this.achievements[id]) {
        total += this.achievements[id].reward.gems || 0;
      }
    }
    return total;
  }

  // Obtenir le total d'or gagné
  getTotalGoldEarned() {
    let total = 0;
    for (const [id, data] of Object.entries(this.unlockedAchievements)) {
      if (data.rewardClaimed && this.achievements[id]) {
        total += this.achievements[id].reward.gold || 0;
      }
    }
    return total;
  }

  // Obtenir tous les titres débloqués
  getUnlockedTitles() {
    const titles = [];
    for (const [id, _data] of Object.entries(this.unlockedAchievements)) {
      const achievement = this.achievements[id];
      if (achievement && achievement.reward.title) {
        titles.push(achievement.reward.title);
      }
    }
    return titles;
  }

  // Obtenir les achievements par catégorie
  getByCategory(category) {
    return Object.values(this.achievements).filter(a => a.category === category);
  }

  // Obtenir les achievements débloqués récemment
  getRecentUnlocks(limit = 5) {
    const unlocks = Object.entries(this.unlockedAchievements)
      .map(([id, data]) => ({
        ...this.achievements[id],
        unlockedAt: data.unlockedAt
      }))
      .sort((a, b) => b.unlockedAt - a.unlockedAt)
      .slice(0, limit);

    return unlocks;
  }

  // Créer l'UI des achievements
  createAchievementUI() {
    const container = document.createElement('div');
    container.id = 'achievement-panel';
    container.className = 'achievement-panel';
    container.style.display = 'none';

    const progress = this.getProgress();

    container.innerHTML = `
      <div class="achievement-panel-header">
        <h2>🏆 ACHIEVEMENTS</h2>
        <div class="achievement-progress">
          <div class="achievement-progress-bar">
            <div class="achievement-progress-fill" style="width: ${progress.percentage}%"></div>
          </div>
          <div class="achievement-progress-text">${progress.unlocked}/${progress.total} (${progress.percentage}%)</div>
        </div>
        <div class="achievement-rewards">
          💰 ${progress.gold} Or | 💎 ${progress.gems} Gems gagnés
        </div>
        <button class="achievement-close-btn">×</button>
      </div>
      <div class="achievement-panel-content">
        <div class="achievement-categories">
          <button class="achievement-category-btn active" data-category="all">Tous</button>
          <button class="achievement-category-btn" data-category="progression">Progression</button>
          <button class="achievement-category-btn" data-category="challenge">Défis</button>
          <button class="achievement-category-btn" data-category="collection">Collection</button>
          <button class="achievement-category-btn" data-category="special">Spéciaux</button>
          <button class="achievement-category-btn" data-category="hidden">Cachés</button>
        </div>
        <div class="achievement-list" id="achievement-list">
          ${this.renderAchievementList()}
        </div>
      </div>
    `;

    document.body.appendChild(container);

    // Event listeners
    container.querySelector('.achievement-close-btn').addEventListener('click', () => {
      container.style.display = 'none';
    });

    container.querySelectorAll('.achievement-category-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        container.querySelectorAll('.achievement-category-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const category = e.target.dataset.category;
        this.filterAchievements(category);
      });
    });

    return container;
  }

  // Rendre la liste des achievements
  renderAchievementList(category = 'all') {
    let achievements = Object.values(this.achievements);

    if (category !== 'all') {
      achievements = achievements.filter(a => a.category === category);
    }

    return achievements.map(achievement => {
      const isUnlocked = this.unlockedAchievements[achievement.id];
      const isHidden = achievement.hidden && !isUnlocked;

      return `
        <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'} ${achievement.rarity}">
          <div class="achievement-card-icon">${isUnlocked ? '🏆' : '🔒'}</div>
          <div class="achievement-card-content">
            <div class="achievement-card-name">${isHidden ? '???' : achievement.name}</div>
            <div class="achievement-card-desc">${isHidden ? 'Achievement secret' : achievement.description}</div>
            <div class="achievement-card-reward">
              ${!isHidden && achievement.reward.gold ? `💰 ${achievement.reward.gold}` : ''}
              ${!isHidden && achievement.reward.gems ? ` 💎 ${achievement.reward.gems}` : ''}
            </div>
          </div>
          <div class="achievement-card-rarity">${achievement.rarity.toUpperCase()}</div>
        </div>
      `;
    }).join('');
  }

  // Filtrer achievements par catégorie
  filterAchievements(category) {
    const list = document.getElementById('achievement-list');
    if (list) {
      list.innerHTML = this.renderAchievementList(category);
    }
  }

  // Ouvrir le panneau des achievements
  openPanel() {
    const panel = document.getElementById('achievement-panel');
    if (panel) {
      panel.style.display = 'block';
    }
  }
}

// Initialiser le système global
window.achievementSystem = new AchievementSystem();
