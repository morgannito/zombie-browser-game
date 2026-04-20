/**
 * LEADERBOARD SYSTEM
 * Manages high scores and player statistics
 * @module LeaderboardSystem
 * @author Claude Code
 * @version 2.0.0
 */

const PAGE_SIZE = 10;

class LeaderboardSystem {
  constructor() {
    this.socket = null;
    this.leaderboard = this.loadLeaderboard();
    this._page = 0;
    this._lastEntries = [];
    this.createUI();
  }

  // Compatibility with legacy leaderboard integration.
  initialize(socket) {
    this.socket = socket || null;
  }

  loadLeaderboard() {
    const saved = localStorage.getItem('zombieGameLeaderboard');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        localStorage.removeItem('zombieGameLeaderboard');
      }
    }
    return {
      highestScore: 0,
      mostKills: 0,
      mostGold: 0,
      longestSurvival: 0,
      entries: []
    };
  }

  saveLeaderboard() {
    localStorage.setItem('zombieGameLeaderboard', JSON.stringify(this.leaderboard));
  }

  addEntry(player) {
    if (player && player.alive === false) {
      // BUGFIX: caller may pass either a run-start timestamp (legacy live
      // path) or a pre-computed elapsed seconds value (submitScore path).
      // Detect: if the value looks like a recent epoch ms (> 1e12), treat
      // it as a start timestamp; otherwise treat it as already in seconds.
      let survivalTime = 0;
      if (typeof player.survivalTime === 'number' && player.survivalTime > 0) {
        survivalTime =
          player.survivalTime > 1e12
            ? Math.floor((Date.now() - player.survivalTime) / 1000)
            : Math.floor(player.survivalTime);
      }

      const entry = {
        nickname: player.nickname || 'Anonyme',
        score: player.totalScore || 0,
        kills: player.zombiesKilled || player.kills || 0,
        gold: player.gold || 0,
        survivalTime: survivalTime,
        date: new Date().toISOString(),
        wave: window.gameState?.state?.wave || 1
      };

      // Mettre à jour les records
      if (entry.score > this.leaderboard.highestScore) {
        this.leaderboard.highestScore = entry.score;
      }
      if (entry.kills > this.leaderboard.mostKills) {
        this.leaderboard.mostKills = entry.kills;
      }
      if (entry.gold > this.leaderboard.mostGold) {
        this.leaderboard.mostGold = entry.gold;
      }
      if (survivalTime > this.leaderboard.longestSurvival) {
        this.leaderboard.longestSurvival = survivalTime;
      }

      // Ajouter l'entrée
      this.leaderboard.entries.push(entry);

      // Garder seulement les 10 meilleures entrées
      this.leaderboard.entries.sort((a, b) => b.score - a.score);
      this.leaderboard.entries = this.leaderboard.entries.slice(0, 10);

      this.saveLeaderboard();
      this.updateUI();
    }
  }

  // Legacy API used by retention/lifetime systems.
  calculateScore(stats = {}) {
    return Math.floor(
      (stats.wave || 0) * 100 +
        (stats.level || 0) * 50 +
        (stats.zombiesKilled || 0) * 10 +
        (stats.goldEarned || stats.gold || 0)
    );
  }

  // Legacy API used by lifetime stats.
  submitScore(playerName, stats = {}) {
    const entry = {
      alive: false,
      nickname: playerName || 'Anonyme',
      totalScore: this.calculateScore(stats),
      score: this.calculateScore(stats),
      zombiesKilled: stats.zombiesKilled || 0,
      kills: stats.zombiesKilled || 0,
      gold: stats.goldEarned || stats.gold || 0,
      // BUGFIX: pass elapsed seconds directly. addEntry now auto-detects
      // whether this is a timestamp or seconds via the > 1e12 threshold.
      survivalTime: stats.runDuration || 0
    };

    this.addEntry(entry);

    if (this.socket && this.socket.connected) {
      this.socket.emit('submit_score', {
        playerName: entry.nickname,
        score: entry.score,
        wave: stats.wave || 0,
        level: stats.level || 0,
        zombiesKilled: entry.zombiesKilled,
        goldEarned: entry.gold
      });
    }
  }

  getTopScores(limit = 10) {
    return this.leaderboard.entries.slice(0, limit).map(e => ({
      playerName: e.nickname,
      score: e.score,
      wave: e.wave || 0,
      level: e.level || 0,
      zombiesKilled: e.kills || 0,
      goldEarned: e.gold || 0
    }));
  }

  getPlayerPosition(playerName) {
    const idx = this.leaderboard.entries.findIndex(e => e.nickname === playerName);
    return idx >= 0 ? idx + 1 : null;
  }

  createUI() {
    // Créer le bouton pour afficher le leaderboard
    const btn = document.createElement('button');
    btn.id = 'leaderboard-btn';
    btn.innerHTML = '🏆 Classement';
    btn.style.cssText = `
      position: fixed;
      top: 20px;
      right: 90px;
      padding: 10px 20px;
      background: rgba(255, 215, 0, 0.9);
      border: 2px solid #FFD700;
      border-radius: 8px;
      color: #000;
      font-weight: bold;
      cursor: pointer;
      z-index: 1000;
      font-size: 16px;
    `;
    btn.onclick = () => this.toggleLeaderboard();
    document.body.appendChild(btn);

    // Créer le panneau du leaderboard
    const panel = document.createElement('div');
    panel.id = 'leaderboard-panel';
    panel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 600px;
      max-height: 80vh;
      background: rgba(20, 20, 40, 0.95);
      border: 3px solid #FFD700;
      border-radius: 15px;
      padding: 20px;
      z-index: 2000;
      display: none;
      overflow-y: auto;
      box-shadow: 0 0 50px rgba(255, 215, 0, 0.5);
    `;
    panel.innerHTML = `
      <h2 style="color: #FFD700; text-align: center; margin-top: 0;">🏆 CLASSEMENT 🏆</h2>
      <div id="leaderboard-records" style="margin-bottom: 20px;"></div>
      <div id="leaderboard-content"></div>
      <button id="close-leaderboard" style="
        width: 100%;
        padding: 10px;
        margin-top: 20px;
        background: #ff4444;
        border: none;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        cursor: pointer;
        font-size: 16px;
      ">Fermer</button>
    `;
    document.body.appendChild(panel);

    document.getElementById('close-leaderboard').onclick = () => this.toggleLeaderboard();

    this.updateUI();
  }

  createLeaderboardUI() {
    const existing = document.getElementById('leaderboard-panel');
    if (existing) {
      return existing;
    }
    this.createUI();
    return document.getElementById('leaderboard-panel');
  }

  toggleLeaderboard() {
    const panel = document.getElementById('leaderboard-panel');
    if (!panel) {
      return;
    }
    if (panel.style.display === 'none') {
      panel.style.display = 'block';
      this.updateUI();
    } else {
      panel.style.display = 'none';
    }
  }

  openPanel() {
    const panel = document.getElementById('leaderboard-panel');
    if (!panel) {
      this.createLeaderboardUI();
      return this.openPanel();
    }
    panel.style.display = 'block';
    this.updateUI();
  }

  updateUI() {
    const recordsDiv = document.getElementById('leaderboard-records');
    const contentDiv = document.getElementById('leaderboard-content');

    if (!recordsDiv || !contentDiv) {
      return;
    }

    // Afficher les records
    recordsDiv.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
        <div style="background: rgba(255, 215, 0, 0.2); padding: 10px; border-radius: 5px; text-align: center;">
          <div style="color: #FFD700; font-size: 24px; font-weight: bold;">${this.leaderboard.highestScore.toLocaleString()}</div>
          <div style="color: #ccc; font-size: 14px;">Meilleur Score</div>
        </div>
        <div style="background: rgba(255, 100, 100, 0.2); padding: 10px; border-radius: 5px; text-align: center;">
          <div style="color: #ff6464; font-size: 24px; font-weight: bold;">${this.leaderboard.mostKills.toLocaleString()}</div>
          <div style="color: #ccc; font-size: 14px;">Record de Kills</div>
        </div>
        <div style="background: rgba(100, 255, 100, 0.2); padding: 10px; border-radius: 5px; text-align: center;">
          <div style="color: #64ff64; font-size: 24px; font-weight: bold;">${this.leaderboard.mostGold.toLocaleString()}</div>
          <div style="color: #ccc; font-size: 14px;">Plus d'Or</div>
        </div>
        <div style="background: rgba(100, 100, 255, 0.2); padding: 10px; border-radius: 5px; text-align: center;">
          <div style="color: #6464ff; font-size: 24px; font-weight: bold;">${this.formatTime(this.leaderboard.longestSurvival)}</div>
          <div style="color: #ccc; font-size: 14px;">Temps de Survie</div>
        </div>
      </div>
    `;

    const allEntries = this.leaderboard.entries;
    if (allEntries.length === 0) {
      contentDiv.innerHTML = '<p style="color: #ccc; text-align: center;">Aucune partie jouée</p>';
      return;
    }

    const totalPages = Math.max(1, Math.ceil(allEntries.length / PAGE_SIZE));
    this._page = Math.min(this._page, totalPages - 1);
    const start = this._page * PAGE_SIZE;
    const pageEntries = allEntries.slice(start, start + PAGE_SIZE);

    const table = document.createElement('table');
    table.style.cssText = 'width:100%;color:white;border-collapse:collapse;';
    const thead = document.createElement('tr');
    thead.style.cssText = 'background:rgba(255,215,0,0.2);border-bottom:2px solid #FFD700;';
    const thL = 'padding:10px;text-align:left;';
    const thC = 'padding:10px;text-align:center;';
    [
      ['Rang', thL],
      ['Joueur', thL],
      ['Score', thC],
      ['Kills', thC],
      ['Vague', thC]
    ].forEach(([label, css]) => {
      const th = document.createElement('th');
      th.style.cssText = css;
      th.textContent = label;
      thead.appendChild(th);
    });
    table.appendChild(thead);

    pageEntries.forEach((entry, i) => {
      const index = start + i;
      const rankColor =
        index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#fff';
      const rankIcon = index < 3 ? ['🥇', '🥈', '🥉'][index] : String(index + 1);
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
      const tdRank = document.createElement('td');
      tdRank.style.cssText = `padding:10px;color:${rankColor};font-weight:bold;`;
      tdRank.textContent = rankIcon;
      const tdName = document.createElement('td');
      tdName.style.padding = '10px';
      tdName.textContent = entry.nickname;
      const tdScore = document.createElement('td');
      tdScore.style.cssText = 'padding:10px;text-align:center;color:#FFD700;';
      tdScore.textContent = entry.score.toLocaleString();
      const tdKills = document.createElement('td');
      tdKills.style.cssText = 'padding:10px;text-align:center;color:#ff6464;';
      tdKills.textContent = entry.kills;
      const tdWave = document.createElement('td');
      tdWave.style.cssText = 'padding:10px;text-align:center;color:#64ff64;';
      tdWave.textContent = `Vague ${entry.wave}`;
      tr.append(tdRank, tdName, tdScore, tdKills, tdWave);
      table.appendChild(tr);
    });

    const nav = document.createElement('div');
    nav.style.cssText =
      'display:flex;justify-content:space-between;align-items:center;margin-top:10px;color:#ccc;';
    const btnPrev = document.createElement('button');
    btnPrev.textContent = '<';
    btnPrev.style.cssText =
      'background:rgba(255,215,0,0.2);border:1px solid #FFD700;color:#FFD700;padding:5px 12px;border-radius:4px;cursor:pointer;';
    btnPrev.onclick = () => {
      this._page = Math.max(0, this._page - 1);
      this.updateUI();
    };
    const pageInfo = document.createElement('span');
    pageInfo.textContent = `Page ${this._page + 1} / ${totalPages}`;
    const btnNext = document.createElement('button');
    btnNext.textContent = '>';
    btnNext.style.cssText =
      'background:rgba(255,215,0,0.2);border:1px solid #FFD700;color:#FFD700;padding:5px 12px;border-radius:4px;cursor:pointer;';
    btnNext.onclick = () => {
      this._page = Math.min(totalPages - 1, this._page + 1);
      this.updateUI();
    };
    nav.append(btnPrev, pageInfo, btnNext);

    contentDiv.textContent = '';
    contentDiv.append(table, nav);
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
  createLeaderboardWidget() {
    const widget = document.createElement('div');
    widget.className = 'leaderboard-widget';
    const topScores = this.getTopScores(5);

    widget.innerHTML = `
      <div class="leaderboard-widget-header">
        <h3>🏆 Top 5</h3>
        <button class="leaderboard-widget-expand">Voir tout →</button>
      </div>
      <div class="leaderboard-widget-list">
        ${topScores
          .map(
            (entry, index) => `
          <div class="leaderboard-widget-entry">
            <span class="rank">#${index + 1}</span>
            <span class="player">${this._escapeHtml(entry.playerName)}</span>
            <span class="score">${entry.score.toLocaleString()}</span>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    const expandBtn = widget.querySelector('.leaderboard-widget-expand');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => this.openPanel());
    }

    return widget;
  }
}

// Export to window
window.LeaderboardSystem = LeaderboardSystem;
