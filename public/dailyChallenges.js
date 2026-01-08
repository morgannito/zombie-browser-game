/**
 * DAILY CHALLENGES SYSTEM - Défis quotidiens et hebdomadaires
 * @version 1.0.0
 */

class DailyChallengeSystem {
  constructor() {
    this.dailyChallenges = [];
    this.weeklyChallenges = [];
    this.challengeProgress = this.loadProgress();
    this.loginStreak = this.loadLoginStreak();
    this.lastLoginDate = this.loadLastLogin();

    this.initializeChallenges();
    this.checkAndResetChallenges();
    this.updateLoginStreak();
  }

  // Définir tous les types de défis possibles
  initializeChallenges() {
    this.availableDailyChallenges = [
      {
        id: 'kill_50_zombies',
        name: 'Extermination Rapide',
        description: 'Tuer 50 zombies',
        type: 'zombies_killed',
        target: 50,
        reward: { gold: 100, gems: 10 }
      },
      {
        id: 'kill_fast_zombies',
        name: 'Chasseur Rapide',
        description: 'Tuer 30 Fast Zombies',
        type: 'zombies_killed_type',
        zombieType: 'fast',
        target: 30,
        reward: { gold: 120, gems: 12 }
      },
      {
        id: 'kill_tank_zombies',
        name: 'Chasseur de Tanks',
        description: 'Tuer 15 Tank Zombies',
        type: 'zombies_killed_type',
        zombieType: 'tank',
        target: 15,
        reward: { gold: 150, gems: 15 }
      },
      {
        id: 'reach_level_15',
        name: 'Montée en Puissance',
        description: 'Atteindre le niveau 15',
        type: 'reach_level',
        target: 15,
        reward: { gold: 150, gems: 15 }
      },
      {
        id: 'earn_1000_gold',
        name: 'Collectionneur d\'Or',
        description: 'Collecter 1000 or en une run',
        type: 'gold_earned',
        target: 1000,
        reward: { gold: 200, gems: 20 }
      },
      {
        id: 'survive_10_waves',
        name: 'Survivant Déterminé',
        description: 'Survivre 10 vagues',
        type: 'waves_survived',
        target: 10,
        reward: { gold: 180, gems: 18 }
      },
      {
        id: 'complete_room_no_shop',
        name: 'Économe',
        description: 'Terminer 1 room sans acheter au shop',
        type: 'no_shop_purchase',
        target: 1,
        reward: { gold: 150, gems: 15 }
      },
      {
        id: 'critical_hits_20',
        name: 'Tireur d\'Élite',
        description: 'Faire 20 coups critiques',
        type: 'critical_hits',
        target: 20,
        reward: { gold: 130, gems: 13 }
      },
      {
        id: 'defeat_boss',
        name: 'Tueur de Boss',
        description: 'Battre 2 boss',
        type: 'bosses_defeated',
        target: 2,
        reward: { gold: 200, gems: 20 }
      },
      {
        id: 'no_damage_5min',
        name: 'Intouchable',
        description: 'Survivre 5 minutes sans prendre de dégâts',
        type: 'no_damage_time',
        target: 300,
        reward: { gold: 250, gems: 25 }
      }
    ];

    this.availableWeeklyChallenges = [
      {
        id: 'kill_500_zombies_weekly',
        name: 'Massacre Hebdomadaire',
        description: 'Tuer 500 zombies cette semaine',
        type: 'zombies_killed',
        target: 500,
        reward: { gold: 500, gems: 50, skin: 'weekly_skin_1' }
      },
      {
        id: 'complete_5_runs_weekly',
        name: 'Marathonien',
        description: 'Terminer 5 runs cette semaine',
        type: 'runs_completed',
        target: 5,
        reward: { gold: 750, gems: 75, skin: 'weekly_skin_2' }
      },
      {
        id: 'earn_10000_gold_weekly',
        name: 'Millionnaire',
        description: 'Gagner 10,000 or cette semaine',
        type: 'gold_earned',
        target: 10000,
        reward: { gold: 1000, gems: 100, title: 'Gold Baron' }
      },
      {
        id: 'reach_wave_30_weekly',
        name: 'Survivant Ultime',
        description: 'Atteindre la vague 30',
        type: 'reach_wave',
        target: 30,
        reward: { gold: 800, gems: 80, skin: 'elite_survivor' }
      },
      {
        id: 'login_7_days_weekly',
        name: 'Dévotion',
        description: 'Se connecter 7 jours cette semaine',
        type: 'login_days',
        target: 7,
        reward: { gold: 600, gems: 60 }
      }
    ];
  }

  // Générer défis quotidiens aléatoires
  generateDailyChallenges() {
    const shuffled = [...this.availableDailyChallenges].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3).map(challenge => ({
      ...challenge,
      progress: 0,
      completed: false,
      claimed: false
    }));
  }

  // Générer défi hebdomadaire aléatoire
  generateWeeklyChallenges() {
    const shuffled = [...this.availableWeeklyChallenges].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 1).map(challenge => ({
      ...challenge,
      progress: 0,
      completed: false,
      claimed: false
    }));
  }

  // Vérifier et réinitialiser les défis
  checkAndResetChallenges() {
    const now = new Date();
    const lastReset = this.loadLastReset();

    // Reset quotidien (chaque jour à minuit)
    if (!lastReset.daily || !this.isSameDay(new Date(lastReset.daily), now)) {
      this.dailyChallenges = this.generateDailyChallenges();
      lastReset.daily = now.toISOString();
      this.saveLastReset(lastReset);
      this.saveChallenges();
    } else {
      // Charger les défis existants
      const saved = this.loadChallenges();
      if (saved.daily) {
        this.dailyChallenges = saved.daily;
      } else {
        this.dailyChallenges = this.generateDailyChallenges();
      }
    }

    // Reset hebdomadaire (chaque lundi)
    if (!lastReset.weekly || !this.isSameWeek(new Date(lastReset.weekly), now)) {
      this.weeklyChallenges = this.generateWeeklyChallenges();
      lastReset.weekly = now.toISOString();
      this.saveLastReset(lastReset);
      this.saveChallenges();
    } else {
      const saved = this.loadChallenges();
      if (saved.weekly) {
        this.weeklyChallenges = saved.weekly;
      } else {
        this.weeklyChallenges = this.generateWeeklyChallenges();
      }
    }
  }

  // Vérifier si deux dates sont le même jour
  isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  // Vérifier si deux dates sont dans la même semaine
  isSameWeek(date1, date2) {
    const weekStart1 = this.getWeekStart(date1);
    const weekStart2 = this.getWeekStart(date2);
    return this.isSameDay(weekStart1, weekStart2);
  }

  // Obtenir le début de la semaine (lundi)
  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  // Mettre à jour le login streak
  updateLoginStreak() {
    const now = new Date();
    const lastLogin = this.lastLoginDate ? new Date(this.lastLoginDate) : null;

    if (!lastLogin) {
      // Premier login
      this.loginStreak = 1;
    } else {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      if (this.isSameDay(lastLogin, yesterday)) {
        // Login consécutif
        this.loginStreak++;
      } else if (!this.isSameDay(lastLogin, now)) {
        // Streak cassé
        this.loginStreak = 1;
      }
      // Si même jour, ne rien faire
    }

    this.lastLoginDate = now.toISOString();
    this.saveLoginStreak();
    this.saveLastLogin();

    // Donner récompense de streak
    this.giveStreakReward();
  }

  // Donner récompense de streak
  giveStreakReward() {
    const rewards = {
      3: { gold: 50, gems: 5 },
      7: { gold: 150, gems: 15 },
      14: { gold: 300, gems: 30 },
      30: { gold: 1000, gems: 100 }
    };

    if (rewards[this.loginStreak]) {
      const reward = rewards[this.loginStreak];
      if (window.toastManager) {
        window.toastManager.show(
          `🔥 ${this.loginStreak} JOURS DE SUITE!\n+${reward.gold} Or | +${reward.gems} Gems`,
          'streak',
          5000
        );
      }
      return reward;
    }

    return null;
  }

  // Mettre à jour la progression d'un défi
  updateProgress(type, value, metadata = {}) {
    let updated = false;

    // Mettre à jour défis quotidiens
    this.dailyChallenges.forEach(challenge => {
      if (challenge.completed) {
        return;
      }

      if (challenge.type === type) {
        // Vérifier les conditions spécifiques
        if (type === 'zombies_killed_type' && metadata.zombieType !== challenge.zombieType) {
          return;
        }

        challenge.progress += value;

        if (challenge.progress >= challenge.target) {
          challenge.progress = challenge.target;
          challenge.completed = true;
          this.showChallengeComplete(challenge, 'daily');
        }

        updated = true;
      }
    });

    // Mettre à jour défis hebdomadaires
    this.weeklyChallenges.forEach(challenge => {
      if (challenge.completed) {
        return;
      }

      if (challenge.type === type) {
        challenge.progress += value;

        if (challenge.progress >= challenge.target) {
          challenge.progress = challenge.target;
          challenge.completed = true;
          this.showChallengeComplete(challenge, 'weekly');
        }

        updated = true;
      }
    });

    if (updated) {
      this.saveChallenges();
    }
  }

  // Afficher notification de défi complété
  showChallengeComplete(challenge, period) {
    if (window.toastManager) {
      window.toastManager.show(
        `✅ DÉFI ${period === 'daily' ? 'QUOTIDIEN' : 'HEBDOMADAIRE'} COMPLÉTÉ!\n${challenge.name}`,
        'challenge',
        5000
      );
    }

    // Créer popup spéciale
    this.createChallengePopup(challenge, period);
  }

  // Créer popup de défi complété
  createChallengePopup(challenge, period) {
    const popup = document.createElement('div');
    popup.className = 'challenge-popup';
    popup.innerHTML = `
      <div class="challenge-popup-inner ${period}">
        <div class="challenge-icon">✅</div>
        <div class="challenge-content">
          <div class="challenge-header">DÉFI ${period === 'daily' ? 'QUOTIDIEN' : 'HEBDOMADAIRE'} COMPLÉTÉ!</div>
          <div class="challenge-name">${challenge.name}</div>
          <div class="challenge-desc">${challenge.description}</div>
          <div class="challenge-reward">
            ${challenge.reward.gold ? `💰 ${challenge.reward.gold} Or` : ''}
            ${challenge.reward.gems ? ` | 💎 ${challenge.reward.gems} Gems` : ''}
            ${challenge.reward.skin ? ` | 🎨 Skin: ${challenge.reward.skin}` : ''}
            ${challenge.reward.title ? ` | 🎖️ "${challenge.reward.title}"` : ''}
          </div>
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

  // Récupérer récompense
  claimReward(challengeId, period) {
    const challenges = period === 'daily' ? this.dailyChallenges : this.weeklyChallenges;
    const challenge = challenges.find(c => c.id === challengeId);

    if (!challenge || !challenge.completed || challenge.claimed) {
      return null;
    }

    challenge.claimed = true;
    this.saveChallenges();

    return challenge.reward;
  }

  // Obtenir le temps restant avant reset
  getTimeUntilReset(period) {
    const now = new Date();

    if (period === 'daily') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow - now;
    } else {
      // Prochain lundi
      const nextMonday = new Date(now);
      const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
      nextMonday.setDate(now.getDate() + daysUntilMonday);
      nextMonday.setHours(0, 0, 0, 0);
      return nextMonday - now;
    }
  }

  // Formater le temps restant
  formatTimeRemaining(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  // Sauvegarder/charger données
  saveChallenges() {
    localStorage.setItem('daily_challenges', JSON.stringify({
      daily: this.dailyChallenges,
      weekly: this.weeklyChallenges
    }));
  }

  loadChallenges() {
    const saved = localStorage.getItem('daily_challenges');
    return saved ? JSON.parse(saved) : { daily: [], weekly: [] };
  }

  saveLastReset(data) {
    localStorage.setItem('challenges_last_reset', JSON.stringify(data));
  }

  loadLastReset() {
    const saved = localStorage.getItem('challenges_last_reset');
    return saved ? JSON.parse(saved) : {};
  }

  saveLoginStreak() {
    localStorage.setItem('login_streak', this.loginStreak.toString());
  }

  loadLoginStreak() {
    const saved = localStorage.getItem('login_streak');
    return saved ? parseInt(saved) : 0;
  }

  saveLastLogin() {
    localStorage.setItem('last_login', this.lastLoginDate);
  }

  loadLastLogin() {
    return localStorage.getItem('last_login');
  }

  loadProgress() {
    const saved = localStorage.getItem('challenges_progress');
    return saved ? JSON.parse(saved) : {};
  }

  saveProgress() {
    localStorage.setItem('challenges_progress', JSON.stringify(this.challengeProgress));
  }

  // Créer l'UI des défis
  createChallengeUI() {
    const container = document.createElement('div');
    container.id = 'challenges-panel';
    container.className = 'challenges-panel';
    container.style.display = 'none';

    container.innerHTML = `
      <div class="challenges-panel-header">
        <h2>🎯 DÉFIS</h2>
        <div class="login-streak">
          🔥 Streak: ${this.loginStreak} jour${this.loginStreak > 1 ? 's' : ''}
        </div>
        <button class="challenges-close-btn">×</button>
      </div>
      <div class="challenges-panel-content">
        <div class="challenges-section">
          <h3>📅 Défis Quotidiens</h3>
          <div class="challenges-timer">
            Réinitialisation dans: ${this.formatTimeRemaining(this.getTimeUntilReset('daily'))}
          </div>
          <div class="challenges-list">
            ${this.renderChallengeList(this.dailyChallenges)}
          </div>
        </div>
        <div class="challenges-section">
          <h3>📆 Défis Hebdomadaires</h3>
          <div class="challenges-timer">
            Réinitialisation dans: ${this.formatTimeRemaining(this.getTimeUntilReset('weekly'))}
          </div>
          <div class="challenges-list">
            ${this.renderChallengeList(this.weeklyChallenges)}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    container.querySelector('.challenges-close-btn').addEventListener('click', () => {
      container.style.display = 'none';
    });

    return container;
  }

  // Rendre la liste de défis
  renderChallengeList(challenges) {
    return challenges.map(challenge => {
      const percentage = Math.min(100, (challenge.progress / challenge.target) * 100);
      const status = challenge.completed ? (challenge.claimed ? 'claimed' : 'completed') : 'active';

      return `
        <div class="challenge-card ${status}">
          <div class="challenge-card-header">
            <div class="challenge-card-name">${challenge.name}</div>
            <div class="challenge-card-status">
              ${challenge.completed ? (challenge.claimed ? '✔️ Récupéré' : '✅ Complété!') : '⏳'}
            </div>
          </div>
          <div class="challenge-card-desc">${challenge.description}</div>
          <div class="challenge-progress-bar">
            <div class="challenge-progress-fill" style="width: ${percentage}%"></div>
          </div>
          <div class="challenge-progress-text">${challenge.progress}/${challenge.target}</div>
          <div class="challenge-card-reward">
            ${challenge.reward.gold ? `💰 ${challenge.reward.gold}` : ''}
            ${challenge.reward.gems ? ` | 💎 ${challenge.reward.gems}` : ''}
            ${challenge.reward.skin ? ` | 🎨 ${challenge.reward.skin}` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // Ouvrir le panneau des défis
  openPanel() {
    const panel = document.getElementById('challenges-panel');
    if (panel) {
      panel.style.display = 'block';
      // Refresh l'affichage
      const dailyList = panel.querySelector('.challenges-section:nth-child(1) .challenges-list');
      const weeklyList = panel.querySelector('.challenges-section:nth-child(2) .challenges-list');
      if (dailyList) {
        dailyList.innerHTML = this.renderChallengeList(this.dailyChallenges);
      }
      if (weeklyList) {
        weeklyList.innerHTML = this.renderChallengeList(this.weeklyChallenges);
      }
    }
  }
}

// Initialiser le système global
window.dailyChallengeSystem = new DailyChallengeSystem();
