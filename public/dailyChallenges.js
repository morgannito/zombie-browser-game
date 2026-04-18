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
    this.lastRerollDate = this.loadLastReroll();
    this.panel = null;
    this.timerInterval = null;

    this.initializeChallenges();
    this.checkAndResetChallenges();
    this.updateLoginStreak();
    // Sync daily challenges from server (seed-based, consistent across players)
    this.fetchDailyChallengesFromServer();
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

  // Générer défis quotidiens — seed déterministe côté serveur (fallback local si API indisponible)
  generateDailyChallenges() {
    const shuffled = [...this.availableDailyChallenges].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3).map(challenge => ({
      ...challenge,
      progress: 0,
      completed: false,
      claimed: false
    }));
  }

  /** Charge les défis quotidiens depuis le serveur et met à jour l'état local */
  async fetchDailyChallengesFromServer() {
    const playerId = window.gameState?.playerId;
    if (!playerId) {
return;
}
    try {
      const res = await fetch(`/api/v1/daily-challenges/${playerId}`, { credentials: 'include' });
      if (!res.ok) {
return;
}
      const { data } = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
return;
}
      this.dailyChallenges = data.map(c => ({
        ...c,
        completed: !!c.completed,
        claimed: !!c.rewardClaimed
      }));
      this.saveChallenges();
      this.refreshPanel();
    } catch (_) { /* réseau indisponible — fallback localStorage */ }
  }

  /** Envoie un event delta au serveur (non-bloquant) */
  async pushEventToServer(eventType, delta = 1, meta = {}) {
    const playerId = window.gameState?.playerId;
    if (!playerId) {
return;
}
    try {
      await fetch(`/api/v1/daily-challenges/${playerId}/event`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType, delta, meta })
      });
    } catch (_) { /* fire-and-forget */ }
  }

  /** Claim récompense via serveur (atomic) */
  async claimRewardServer(challengeId) {
    const playerId = window.gameState?.playerId;
    if (!playerId) {
return null;
}
    try {
      const res = await fetch(`/api/v1/daily-challenges/${playerId}/claim`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId })
      });
      if (!res.ok) {
return null;
}
      const { data } = await res.json();
      return data?.reward ?? null;
    } catch (_) {
 return null;
}
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
        window.toastManager.show({ message: `🔥 ${this.loginStreak} JOURS DE SUITE!\n+${reward.gold} Or | +${reward.gems} Gems`, type: 'streak', duration: 5000 });
      }
      this.applyReward(reward, `Streak ${this.loginStreak} jours`);
      return reward;
    }

    return null;
  }

  // Mettre à jour la progression d'un défi
  updateProgress(type, value, metadata = {}) {
    let updated = false;

    // Mettre à jour défis quotidiens (local + push serveur)
    this.dailyChallenges.forEach(challenge => {
      if (challenge.completed) {
return;
}
      if (challenge.type !== type) {
return;
}
      if (type === 'zombies_killed_type' && metadata.zombieType !== challenge.zombieType) {
return;
}
      challenge.progress = Math.min((challenge.progress || 0) + value, challenge.target);
      if (challenge.progress >= challenge.target) {
 challenge.completed = true; this.showChallengeComplete(challenge, 'daily');
}
      updated = true;
    });
    if (updated) {
this.pushEventToServer(type, value, metadata);
}

    // Mettre à jour défis hebdomadaires (localStorage uniquement)
    this.weeklyChallenges.forEach(challenge => {
      if (challenge.completed) {
return;
}
      if (challenge.type !== type) {
return;
}
      challenge.progress += value;
      if (challenge.progress >= challenge.target) {
 challenge.progress = challenge.target; challenge.completed = true; this.showChallengeComplete(challenge, 'weekly');
}
      updated = true;
    });

    if (updated) {
 this.saveChallenges(); this.refreshPanel();
}
  }

  // Afficher notification de défi complété
  showChallengeComplete(challenge, period) {
    if (window.toastManager) {
      window.toastManager.show({ message: `✅ DÉFI ${period === 'daily' ? 'QUOTIDIEN' : 'HEBDOMADAIRE'} COMPLÉTÉ!\n${challenge.name}`, type: 'challenge', duration: 5000 });
    }

    // Créer popup spéciale
    this.createChallengePopup(challenge, period);
    this.refreshPanel();
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

  // Récupérer récompense — atomic via serveur pour daily, localStorage pour weekly
  claimReward(challengeId, period) {
    const challenges = period === 'daily' ? this.dailyChallenges : this.weeklyChallenges;
    const challenge = challenges.find(c => c.id === challengeId);
    if (!challenge || !challenge.completed || challenge.claimed) {
return null;
}

    if (period === 'daily') {
      this.claimRewardServer(challengeId).then(reward => {
        if (!reward) {
return;
} // double-claim bloqué côté serveur
        challenge.claimed = true;
        this.saveChallenges();
        this.applyReward(reward, `Défi quotidien: ${challenge.name}`);
        this.refreshPanel();
      });
      return challenge.reward; // optimistic UI
    }

    challenge.claimed = true;
    this.saveChallenges();
    this.applyReward(challenge.reward, `Défi hebdomadaire: ${challenge.name}`);
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

  saveLastReroll() {
    localStorage.setItem('daily_challenge_reroll', this.lastRerollDate || '');
  }

  loadLastReroll() {
    const saved = localStorage.getItem('daily_challenge_reroll');
    return saved || null;
  }

  canRerollDaily() {
    if (!this.lastRerollDate) {
      return true;
    }

    return !this.isSameDay(new Date(this.lastRerollDate), new Date());
  }

  rerollDailyChallenge() {
    if (!this.canRerollDaily()) {
      if (window.toastManager) {
        window.toastManager.show({ message: '🎲 Reroll déjà utilisé aujourd\'hui', type: 'info', duration: 3000 });
      }
      return false;
    }

    const replaceIndex = this.dailyChallenges.findIndex(challenge => !challenge.completed);
    if (replaceIndex === -1) {
      if (window.toastManager) {
        window.toastManager.show({ message: '✅ Tous les défis sont déjà complétés', type: 'info', duration: 3000 });
      }
      return false;
    }

    const currentIds = new Set(this.dailyChallenges.map(challenge => challenge.id));
    const pool = this.availableDailyChallenges.filter(challenge => !currentIds.has(challenge.id));
    if (pool.length === 0) {
      if (window.toastManager) {
        window.toastManager.show({ message: '🎯 Aucun défi disponible pour reroll', type: 'info', duration: 3000 });
      }
      return false;
    }

    const nextChallenge = pool[Math.floor(Math.random() * pool.length)];
    this.dailyChallenges[replaceIndex] = {
      ...nextChallenge,
      progress: 0,
      completed: false,
      claimed: false
    };

    this.lastRerollDate = new Date().toISOString();
    this.saveLastReroll();
    this.saveChallenges();
    this.refreshPanel();

    if (window.toastManager) {
      window.toastManager.show({ message: '🎲 Défi reroll avec succès!', type: 'success', duration: 2500 });
    }

    return true;
  }

  applyReward(reward, source) {
    if (!reward) {
      return;
    }

    if (reward.gold) {
      if (window.lifetimeStatsSystem) {
        window.lifetimeStatsSystem.recordGoldEarned(reward.gold);
      }

      const gameState = window.gameState;
      const playerId = gameState?.playerId;
      const player = gameState?.state?.players?.[playerId];
      if (player) {
        player.gold = (player.gold || 0) + reward.gold;
        if (window.gameUI && window.gameUI.update) {
          window.gameUI.update();
        }
      }
    }

    if (reward.gems && window.gemSystem) {
      window.gemSystem.addGems(reward.gems, source || 'Défi');
    }

    if (reward.skin && window.skinManager) {
      const unlocked = window.skinManager.unlockPlayerSkin(reward.skin) ||
        window.skinManager.unlockWeaponSkin(reward.skin);
      if (unlocked && window.toastManager) {
        window.toastManager.show({ message: `🎨 Nouveau skin débloqué: ${reward.skin}`, type: 'success', duration: 4000 });
      }
    }

    if (reward.title && window.toastManager) {
      window.toastManager.show({ message: `🎖️ Nouveau titre: ${reward.title}`, type: 'success', duration: 4000 });
    }
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
        <div class="challenges-section" data-period="daily">
          <div class="challenges-section-header">
            <h3>📅 Défis Quotidiens</h3>
            <button class="challenge-reroll-btn" type="button">🎲 Reroll</button>
          </div>
          <div class="challenges-timer" data-period="daily">
            Réinitialisation dans: ${this.formatTimeRemaining(this.getTimeUntilReset('daily'))}
          </div>
          <div class="challenges-list">
            ${this.renderChallengeList(this.dailyChallenges, 'daily')}
          </div>
        </div>
        <div class="challenges-section" data-period="weekly">
          <h3>📆 Défis Hebdomadaires</h3>
          <div class="challenges-timer" data-period="weekly">
            Réinitialisation dans: ${this.formatTimeRemaining(this.getTimeUntilReset('weekly'))}
          </div>
          <div class="challenges-list">
            ${this.renderChallengeList(this.weeklyChallenges, 'weekly')}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    this.panel = container;

    container.querySelector('.challenges-close-btn').addEventListener('click', () => {
      container.style.display = 'none';
      this.stopTimerUpdates();
    });

    container.addEventListener('click', (event) => {
      const target = event.target;
      if (!target || !target.classList) {
        return;
      }

      if (target.classList.contains('challenge-claim-btn')) {
        const challengeId = target.getAttribute('data-id');
        const period = target.getAttribute('data-period');
        if (challengeId && period) {
          const reward = this.claimReward(challengeId, period);
          if (reward) {
            this.playClaimFeedback(target);
            setTimeout(() => this.refreshPanel(), 250);
          } else {
            this.refreshPanel();
          }
        }
      }

      if (target.classList.contains('challenge-reroll-btn')) {
        this.rerollDailyChallenge();
      }
    });

    this.updateRerollState();
    return container;
  }

  // Rendre la liste de défis
  renderChallengeList(challenges, period) {
    return challenges.map(challenge => {
      const percentage = Math.min(100, (challenge.progress / challenge.target) * 100);
      const status = challenge.completed ? (challenge.claimed ? 'claimed' : 'completed') : 'active';
      const canClaim = challenge.completed && !challenge.claimed;

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
            ${challenge.reward.title ? ` | 🎖️ "${challenge.reward.title}"` : ''}
          </div>
          <div class="challenge-card-actions">
            ${canClaim ? `<button class="challenge-claim-btn" data-id="${challenge.id}" data-period="${period}">Récupérer</button>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // Ouvrir le panneau des défis
  openPanel() {
    const panel = this.panel || document.getElementById('challenges-panel');
    if (panel) {
      panel.style.display = 'block';
      this.refreshPanel();
      this.startTimerUpdates();
    }
  }

  playClaimFeedback(button) {
    const card = button.closest('.challenge-card');
    if (card) {
      card.classList.remove('claim-animate');
      void card.offsetWidth;
      card.classList.add('claim-animate');
      setTimeout(() => card.classList.remove('claim-animate'), 650);
    }

    button.classList.remove('claiming');
    void button.offsetWidth;
    button.classList.add('claiming');
    setTimeout(() => button.classList.remove('claiming'), 450);

    const audio = window.advancedAudio || window.audioManager;
    if (audio && audio.playSound) {
      audio.playSound('ui', 'reward');
    }
  }

  refreshPanel() {
    if (!this.panel || this.panel.style.display !== 'block') {
      return;
    }

    const dailyList = this.panel.querySelector('[data-period="daily"] .challenges-list');
    const weeklyList = this.panel.querySelector('[data-period="weekly"] .challenges-list');
    if (dailyList) {
      dailyList.innerHTML = this.renderChallengeList(this.dailyChallenges, 'daily');
    }
    if (weeklyList) {
      weeklyList.innerHTML = this.renderChallengeList(this.weeklyChallenges, 'weekly');
    }

    this.updateStreakDisplay();
    this.updateTimerDisplay();
    this.updateRerollState();
    if (window.contractsSystem && window.contractsSystem.refreshUI) {
      window.contractsSystem.refreshUI();
    }
  }

  updateStreakDisplay() {
    if (!this.panel) {
      return;
    }

    const streakEl = this.panel.querySelector('.login-streak');
    if (streakEl) {
      streakEl.textContent = `🔥 Streak: ${this.loginStreak} jour${this.loginStreak > 1 ? 's' : ''}`;
    }
  }

  updateTimerDisplay() {
    if (!this.panel) {
      return;
    }

    const dailyTimer = this.panel.querySelector('.challenges-timer[data-period="daily"]');
    const weeklyTimer = this.panel.querySelector('.challenges-timer[data-period="weekly"]');
    if (dailyTimer) {
      dailyTimer.textContent = `Réinitialisation dans: ${this.formatTimeRemaining(this.getTimeUntilReset('daily'))}`;
    }
    if (weeklyTimer) {
      weeklyTimer.textContent = `Réinitialisation dans: ${this.formatTimeRemaining(this.getTimeUntilReset('weekly'))}`;
    }
  }

  updateRerollState() {
    if (!this.panel) {
      return;
    }

    const rerollBtn = this.panel.querySelector('.challenge-reroll-btn');
    if (!rerollBtn) {
      return;
    }

    const canReroll = this.canRerollDaily();
    rerollBtn.disabled = !canReroll;
    rerollBtn.title = canReroll ? 'Reroll un défi quotidien' : 'Reroll déjà utilisé aujourd\'hui';
  }

  startTimerUpdates() {
    if (this.timerInterval) {
      return;
    }

    this.timerInterval = setInterval(() => {
      if (!this.panel || this.panel.style.display !== 'block') {
        this.stopTimerUpdates();
        return;
      }

      this.updateTimerDisplay();
      this.updateRerollState();
    }, 60000);

    this.updateTimerDisplay();
  }

  stopTimerUpdates() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
}

// Initialiser le système global
window.dailyChallengeSystem = new DailyChallengeSystem();
