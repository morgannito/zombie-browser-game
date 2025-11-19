/**
 * LEADERBOARD SYSTEM - Système de classement
 * @version 1.0.0
 */

class LeaderboardSystem {
  constructor() {
    this.scores = this.loadScores();
    this.personalBest = this.loadPersonalBest();
    this.socket = null;
  }

  // ===============================================
  // SAFE LOCALSTORAGE HELPERS
  // ===============================================
  _safeGetItem(key, defaultValue = null) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`localStorage.getItem failed for key "${key}":`, e.message);
      return defaultValue;
    }
  }

  _safeSetItem(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn(`localStorage.setItem failed for key "${key}":`, e.message);
      return false;
    }
  }

  // Initialiser avec socket
  initialize(socket) {
    this.socket = socket;

    // Écouter les mises à jour du leaderboard depuis le serveur
    socket.on('leaderboard_update', (data) => {
      this.updateLeaderboard(data);
    });

    // Demander le leaderboard au serveur
    socket.emit('request_leaderboard');
  }

  // Calculer le score d'une run
  calculateScore(stats) {
    // Score = (Vagues × 100) + (Level × 50) + (Zombies × 10) + Gold
    const score =
      (stats.wave || 0) * 100 +
      (stats.level || 0) * 50 +
      (stats.zombiesKilled || 0) * 10 +
      (stats.goldEarned || 0);

    return Math.floor(score);
  }

  // Soumettre un score
  submitScore(playerName, stats) {
    const score = this.calculateScore(stats);

    const entry = {
      playerName,
      score,
      wave: stats.wave || 0,
      level: stats.level || 0,
      zombiesKilled: stats.zombiesKilled || 0,
      goldEarned: stats.goldEarned || 0,
      timestamp: Date.now(),
      date: new Date().toLocaleDateString('fr-FR')
    };

    // Mettre à jour le meilleur score personnel
    if (!this.personalBest || score > this.personalBest.score) {
      this.personalBest = entry;
      this.savePersonalBest();
    }

    // Envoyer au serveur
    if (this.socket) {
      this.socket.emit('submit_score', entry);
    }

    // Sauvegarder localement aussi
    this.addLocalScore(entry);

    return entry;
  }

  // Ajouter score local
  addLocalScore(entry) {
    this.scores.push(entry);
    this.scores.sort((a, b) => b.score - a.score);
    this.scores = this.scores.slice(0, 100); // Garder top 100
    this.saveScores();
  }

  // Mettre à jour le leaderboard depuis le serveur
  updateLeaderboard(data) {
    if (data.global) {
      this.globalScores = data.global;
    }
    if (data.weekly) {
      this.weeklyScores = data.weekly;
    }
    if (data.daily) {
      this.dailyScores = data.daily;
    }

    // Refresh UI si ouverte
    this.refreshUI();
  }

  // Obtenir position du joueur
  getPlayerPosition(playerName, period = 'all') {
    let scores = this.scores;

    if (period === 'weekly' && this.weeklyScores) {
      scores = this.weeklyScores;
    } else if (period === 'daily' && this.dailyScores) {
      scores = this.dailyScores;
    } else if (period === 'all' && this.globalScores) {
      scores = this.globalScores;
    }

    const index = scores.findIndex(s => s.playerName === playerName);
    return index >= 0 ? index + 1 : null;
  }

  // Obtenir le top N
  getTopScores(n = 10, period = 'all') {
    let scores = this.scores;

    if (period === 'weekly' && this.weeklyScores) {
      scores = this.weeklyScores;
    } else if (period === 'daily' && this.dailyScores) {
      scores = this.dailyScores;
    } else if (period === 'all' && this.globalScores) {
      scores = this.globalScores;
    }

    return scores.slice(0, n);
  }

  // Sauvegarder/charger données
  saveScores() {
    this._safeSetItem('leaderboard_scores', JSON.stringify(this.scores));
  }

  loadScores() {
    const saved = this._safeGetItem('leaderboard_scores');
    return saved ? JSON.parse(saved) : [];
  }

  savePersonalBest() {
    this._safeSetItem('personal_best', JSON.stringify(this.personalBest));
  }

  loadPersonalBest() {
    const saved = this._safeGetItem('personal_best');
    return saved ? JSON.parse(saved) : null;
  }

  // Créer l'UI du leaderboard
  createLeaderboardUI() {
    const container = document.createElement('div');
    container.id = 'leaderboard-panel';
    container.className = 'leaderboard-panel';
    container.style.display = 'none';

    container.innerHTML = `
      <div class="leaderboard-panel-header">
        <h2>🏆 LEADERBOARD</h2>
        <button class="leaderboard-close-btn">×</button>
      </div>
      <div class="leaderboard-panel-content">
        <div class="leaderboard-tabs">
          <button class="leaderboard-tab active" data-period="all">🌍 Global</button>
          <button class="leaderboard-tab" data-period="weekly">📅 Hebdo</button>
          <button class="leaderboard-tab" data-period="daily">📆 Aujourd'hui</button>
        </div>
        ${this.personalBest ? `
          <div class="personal-best">
            <div class="personal-best-header">🏅 Votre Meilleur Score</div>
            <div class="personal-best-score">${this.personalBest.score.toLocaleString()}</div>
            <div class="personal-best-stats">
              Vague ${this.personalBest.wave} | Niveau ${this.personalBest.level} | ${this.personalBest.zombiesKilled} zombies
            </div>
          </div>
        ` : ''}
        <div class="leaderboard-list" id="leaderboard-list">
          ${this.renderLeaderboard('all')}
        </div>
      </div>
    `;

    document.body.appendChild(container);

    // Event listeners
    container.querySelector('.leaderboard-close-btn').addEventListener('click', () => {
      container.style.display = 'none';
    });

    container.querySelectorAll('.leaderboard-tab').forEach(tab => {
      (window.eventListenerManager ? window.eventListenerManager.add(tab, 'click', (e) : (window.eventListenerManager ? window.eventListenerManager.add(tab, 'click', (e)) : tab.addEventListener('click', (e))) => {
        container.querySelectorAll('.leaderboard-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        const period = e.target.dataset.period;
        this.showLeaderboard(period);
      });
    });

    return container;
  }

  // Rendre le leaderboard
  renderLeaderboard(period = 'all') {
    const scores = this.getTopScores(50, period);

    if (scores.length === 0) {
      return '<div class="leaderboard-empty">Aucun score pour le moment</div>';
    }

    return scores.map((entry, index) => {
      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
      const isPersonal = this.personalBest && entry.score === this.personalBest.score;

      return `
        <div class="leaderboard-entry ${isPersonal ? 'personal' : ''} ${rank <= 3 ? 'top3' : ''}">
          <div class="leaderboard-rank">${medal}</div>
          <div class="leaderboard-player">${entry.playerName}</div>
          <div class="leaderboard-score">${entry.score.toLocaleString()}</div>
          <div class="leaderboard-details">
            V${entry.wave} | Lv${entry.level} | ${entry.zombiesKilled} zombies
          </div>
          <div class="leaderboard-date">${entry.date}</div>
        </div>
      `;
    }).join('');
  }

  // Afficher leaderboard par période
  showLeaderboard(period) {
    const list = document.getElementById('leaderboard-list');
    if (list) {
      list.innerHTML = this.renderLeaderboard(period);
    }
  }

  // Refresh UI
  refreshUI() {
    const list = document.getElementById('leaderboard-list');
    if (list) {
      const activeTab = document.querySelector('.leaderboard-tab.active');
      const period = activeTab ? activeTab.dataset.period : 'all';
      list.innerHTML = this.renderLeaderboard(period);
    }
  }

  // Ouvrir le panneau
  openPanel() {
    const panel = document.getElementById('leaderboard-panel');
    if (panel) {
      panel.style.display = 'block';
      this.refreshUI();
    }
  }

  // Créer widget leaderboard pour l'écran d'accueil
  createLeaderboardWidget() {
    const widget = document.createElement('div');
    widget.className = 'leaderboard-widget';

    const topScores = this.getTopScores(5, 'all');

    widget.innerHTML = `
      <div class="leaderboard-widget-header">
        <h3>🏆 Top 5</h3>
        <button class="leaderboard-widget-expand">Voir tout →</button>
      </div>
      <div class="leaderboard-widget-list">
        ${topScores.map((entry, index) => {
          const rank = index + 1;
          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
          return `
            <div class="leaderboard-widget-entry">
              <span class="rank">${medal}</span>
              <span class="player">${entry.playerName}</span>
              <span class="score">${entry.score.toLocaleString()}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;

    widget.querySelector('.leaderboard-widget-expand').addEventListener('click', () => {
      this.openPanel();
    });

    return widget;
  }
}

// Initialiser le système global
window.leaderboardSystem = new LeaderboardSystem();
