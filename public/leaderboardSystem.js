/**
 * @file leaderboardSystem.js
 * @description Score tracking, ranking and leaderboard UI (full-panel + mini in-game widget).
 *
 * Public API:
 *   initialize(socket)         — bind socket.io events
 *   submitScore(name, stats)   — calculate & persist a run score
 *   getTopScores(n, period)    — 'all' | 'weekly' | 'daily'
 *   getPlayerPosition(name, period)
 *   createLeaderboardUI()      — inject full-panel into DOM
 *   createLeaderboardWidget()  — small home-screen widget
 *   createMiniLeaderboard()    — in-game top-5 overlay (toggle with L)
 *   destroyMiniLeaderboard()   — remove overlay + all its listeners
 *   openPanel()
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
        <div class="leaderboard-list" id="leaderboard-list"></div>
      </div>
    `;

    document.body.appendChild(container);
    const list = container.querySelector('#leaderboard-list');
    list.replaceChildren(...this.renderLeaderboard('all'));

    // Event listeners
    container.querySelector('.leaderboard-close-btn').addEventListener('click', () => {
      container.style.display = 'none';
    });

    container.querySelectorAll('.leaderboard-tab').forEach(tab => {
      const onClick = (e) => {
        container.querySelectorAll('.leaderboard-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        const period = e.target.dataset.period;
        this.showLeaderboard(period);
      };

      if (window.eventListenerManager) {
        window.eventListenerManager.add(tab, 'click', onClick);
      } else {
        tab.addEventListener('click', onClick);
      }
    });

    return container;
  }

  // Rendre le leaderboard
  renderLeaderboard(period = 'all') {
    const scores = this.getTopScores(50, period);

    if (scores.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'leaderboard-empty';
      empty.textContent = 'Aucun score pour le moment';
      return [empty];
    }

    return scores.map((entry, index) => this._buildEntryElement(entry, index + 1));
  }

  // Construire un élément DOM pour une entrée (sans innerHTML)
  _buildEntryElement(entry, rank) {
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    const isPersonal = this.personalBest && entry.score === this.personalBest.score;
    const div = document.createElement('div');
    div.className = `leaderboard-entry${isPersonal ? ' personal' : ''}${rank <= 3 ? ' top3' : ''}`;
    const rankEl = document.createElement('div'); rankEl.className = 'leaderboard-rank'; rankEl.textContent = medal;
    const playerEl = document.createElement('div'); playerEl.className = 'leaderboard-player'; playerEl.textContent = entry.playerName;
    const scoreEl = document.createElement('div'); scoreEl.className = 'leaderboard-score'; scoreEl.textContent = entry.score.toLocaleString();
    const detailsEl = document.createElement('div'); detailsEl.className = 'leaderboard-details';
    detailsEl.textContent = `V${entry.wave} | Lv${entry.level} | ${entry.zombiesKilled} zombies`;
    const dateEl = document.createElement('div'); dateEl.className = 'leaderboard-date'; dateEl.textContent = entry.date;
    div.append(rankEl, playerEl, scoreEl, detailsEl, dateEl);
    return div;
  }

  // Afficher leaderboard par période
  showLeaderboard(period) {
    const list = document.getElementById('leaderboard-list');
    if (list) {
      list.replaceChildren(...this.renderLeaderboard(period));
    }
  }

  // Refresh UI
  refreshUI() {
    const list = document.getElementById('leaderboard-list');
    if (list) {
      const activeTab = document.querySelector('.leaderboard-tab.active');
      const period = activeTab ? activeTab.dataset.period : 'all';
      list.replaceChildren(...this.renderLeaderboard(period));
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

    const header = document.createElement('div'); header.className = 'leaderboard-widget-header';
    const h3 = document.createElement('h3'); h3.textContent = '🏆 Top 5';
    const expandBtn = document.createElement('button'); expandBtn.className = 'leaderboard-widget-expand'; expandBtn.textContent = 'Voir tout →';
    header.append(h3, expandBtn);
    const listEl = document.createElement('div'); listEl.className = 'leaderboard-widget-list';
    topScores.forEach((entry, index) => {
      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
      const entryEl = document.createElement('div'); entryEl.className = 'leaderboard-widget-entry';
      const rankEl = document.createElement('span'); rankEl.className = 'rank'; rankEl.textContent = medal;
      const playerEl = document.createElement('span'); playerEl.className = 'player'; playerEl.textContent = entry.playerName;
      const scoreEl = document.createElement('span'); scoreEl.className = 'score'; scoreEl.textContent = entry.score.toLocaleString();
      entryEl.append(rankEl, playerEl, scoreEl);
      listEl.appendChild(entryEl);
    });
    widget.append(header, listEl);
    expandBtn.addEventListener('click', () => {
 this.openPanel();
});
    return widget;
  }

  // ===============================================
  // MINI-LEADERBOARD IN-GAME (coin droit)
  // ===============================================

  createMiniLeaderboard() {
    if (document.getElementById('mini-leaderboard')) return;

    const el = document.createElement('div');
    el.id = 'mini-leaderboard';

    const title = document.createElement('div');
    title.className = 'mini-lb-title';
    title.textContent = '🏆 TOP 5';

    const list = document.createElement('ol');
    list.className = 'mini-lb-list';
    list.id = 'mini-lb-list';

    el.append(title, list);
    document.body.appendChild(el);

    // Toggle touche L — stored for cleanup
    this._miniKeydown = (e) => {
      if (e.key === 'l' || e.key === 'L') {
        el.classList.toggle('mini-lb-hidden');
      }
    };
    document.addEventListener('keydown', this._miniKeydown);

    this._miniLeaderboardEl = el;
    this._fetchAndRenderMini();
    this._miniInterval = setInterval(() => this._fetchAndRenderMini(), 10000);
  }

  async _fetchAndRenderMini() {
    try {
      const res = await fetch('/api/v1/leaderboard?limit=5', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const entries = data.entries || data.global || data || [];
      this._renderMiniList(entries.slice(0, 5));
    } catch (_) {
      this._renderMiniList(this.getTopScores(5));
    }
  }

  _renderMiniList(entries) {
    const list = document.getElementById('mini-lb-list');
    if (!list) return;
    const localName = document.getElementById('nickname-input')?.value?.trim() ||
      document.getElementById('player-name-display')?.textContent?.replace('🎮 ', '').trim() || '';
    list.replaceChildren(...entries.map((entry, i) => {
      const name = entry.playerName || entry.name || '?';
      const kills = entry.kills ?? entry.zombiesKilled ?? 0;
      const li = document.createElement('li');
      li.className = 'mini-lb-entry' + (localName && name === localName ? ' mini-lb-local' : '');
      const rankEl = document.createElement('span'); rankEl.className = 'mini-lb-rank'; rankEl.textContent = `#${i + 1}`;
      const nameEl = document.createElement('span'); nameEl.className = 'mini-lb-name'; nameEl.textContent = name;
      const killsEl = document.createElement('span'); killsEl.className = 'mini-lb-kills'; killsEl.textContent = `\u2620 ${kills}`;
      li.append(rankEl, nameEl, killsEl);
      return li;
    }));
  }

  destroyMiniLeaderboard() {
    if (this._miniInterval) clearInterval(this._miniInterval);
    if (this._miniKeydown) {
      document.removeEventListener('keydown', this._miniKeydown);
      this._miniKeydown = null;
    }
    document.getElementById('mini-leaderboard')?.remove();
    this._miniLeaderboardEl = null;
  }
}

// Initialiser le système global
window.leaderboardSystem = new LeaderboardSystem();
