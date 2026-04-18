/**
 * UI MANAGER
 * Manages game UI, HUD, shop, and level-up screens
 * @module UIManager
 * @author Claude Code
 * @version 2.0.0
 */

class UIManager {
  constructor(gameState) {
    this.gameState = gameState;
    this.shopOpen = false;
    this.gameStartedDispatched = false;
    this.gameOverDispatched = false;
    this._gameStartTime = null;

    // Store handler references for cleanup
    this.handlers = {
      shopClose: () => this.hideShop(),
      keydown: e => {
        if (e.key === 'Escape' && this.shopOpen) {
          this.hideShop();
        }
        // R or Space to respawn on game-over screen
        if ((e.key === 'r' || e.key === 'R' || e.key === ' ') && this.els.gameOver?.style.display === 'block') {
          const btn = document.getElementById('respawn-btn');
          if (btn && !btn.disabled) {
            e.preventDefault();
            btn.click();
          }
        }
        // Escape on game-over = return to menu (no confirm needed)
        if (e.key === 'Escape' && this.els.gameOver?.style.display === 'block') {
          this._returnToMenu();
        }
      },
      beforeunload: e => {
        const gameActive = document.body.classList.contains('game-active');
        if (gameActive) {
          e.preventDefault();
          // returnValue required for legacy browsers
          e.returnValue = '';
        }
      }
    };

    this.shopCloseBtn = document.getElementById('shop-close-btn');

    // Cache DOM refs queried every frame in update()
    this.els = {
      healthBar: document.getElementById('health-bar'),
      healthFill: document.getElementById('health-fill'),
      healthText: document.getElementById('health-text'),
      xpBar: document.getElementById('xp-bar'),
      xpFill: document.getElementById('xp-fill'),
      levelText: document.getElementById('level-text'),
      xpText: document.getElementById('xp-text'),
      scoreValue: document.getElementById('score-value'),
      waveValue: document.getElementById('wave-value'),
      goldValue: document.getElementById('gold-value'),
      gameOver: document.getElementById('game-over'),
      finalScore: document.getElementById('final-score'),
      finalWave: document.getElementById('final-wave'),
      finalLevel: document.getElementById('final-level'),
      finalGold: document.getElementById('final-gold'),
      finalKills: document.getElementById('final-kills'),
      playersCount: document.getElementById('players-count'),
      zombiesCount: document.getElementById('zombies-count'),
      healthGhost: document.getElementById('health-ghost')
    };

    this._ghostPercent = 100;
    this._ghostTimer = null;

    // Cache last-rendered values to skip no-op DOM writes
    this._last = {};

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Shop close button
    if (this.shopCloseBtn) {
      this.shopCloseBtn.addEventListener('click', this.handlers.shopClose);
    }

    // Esc key closes shop (keyboard accessibility)
    document.addEventListener('keydown', this.handlers.keydown);

    // Warn browser before unload when player is alive
    window.addEventListener('beforeunload', this.handlers.beforeunload);

    // Guard: prevent duplicate emissions before server acknowledges the first
    this._buyPending = false;
    this._lastBoughtItem = null;
    // Guard: prevent duplicate upgrade selections before screen hides
    this._upgradePending = false;

    // Make buyItem global for onclick handlers
    window.buyItem = (itemId, category) => {
      logger.debug('[Shop] buyItem called:', itemId, category);

      if (!window.networkManager) {
        console.error('[Shop] NetworkManager not available');
        if (window.toastManager) {
          window.toastManager.show({ message: '❌ Connexion non disponible', type: 'error', duration: 2000 });
        }
        return;
      }

      // Double-buy guard: drop the click if a purchase is already in-flight
      if (this._buyPending) {
        logger.debug('[Shop] Purchase already in-flight, ignoring duplicate click');
        return;
      }

      this._buyPending = true;
      logger.debug('[Shop] Sending purchase request to server...');
      window.networkManager.buyItem(itemId, category);

      // Show feedback that request was sent
      if (window.toastManager) {
        window.toastManager.show({ message: "⏳ Traitement de l'achat...", type: 'info', duration: 1000 });
      }
    };

    console.log('✅ Shop buyItem function registered on window');
  }

  cleanup() {
    // Remove shop close button listener
    if (this.shopCloseBtn) {
      this.shopCloseBtn.removeEventListener('click', this.handlers.shopClose);
    }
    document.removeEventListener('keydown', this.handlers.keydown);
    window.removeEventListener('beforeunload', this.handlers.beforeunload);
  }

  _returnToMenu() {
    if (this.els.gameOver) {
      this.els.gameOver.style.display = 'none';
    }
    const nicknameScreen = document.getElementById('nickname-screen');
    if (nicknameScreen) {
      nicknameScreen.style.display = 'flex';
    }
    if (window.showSkinsButton) {
      window.showSkinsButton();
    }
  }

  /**
   * Main per-frame update. Called from the game loop.
   * Delegates to sub-methods to keep each concern ≤25 lines.
   */
  update() {
    const player = this.gameState.getPlayer();
    if (!player) return;

    this._maybeDispatchGameStarted(player);
    this._updateHUD(player);
    this._updatePlayerCount();

    if (!player.alive) {
      this._handleGameOver(player);
    } else {
      this.deathRecorded = false;
      this.gameOverDispatched = false;
    }
  }

  /** Fires `game_started` once when the player becomes alive. @private */
  _maybeDispatchGameStarted(player) {
    if (!player.alive || this.gameStartedDispatched) return;
    document.dispatchEvent(new CustomEvent('game_started', {
      detail: {
        wave: this.gameState.state.wave || 1,
        level: player.level || 1,
        weapon: player.weapon || 'pistol'
      }
    }));
    this.gameStartedDispatched = true;
    this.gameOverDispatched = false;
    this._gameStartTime = Date.now();
  }

  /** Updates health, XP, score, wave and gold bars. @private */
  _updateHUD(player) {
    const healthPercent = Math.max(0, (player.health / player.maxHealth) * 100);
    const healthRounded = Math.max(0, Math.round(player.health));
    const lowHealth = healthPercent < 30;
    const score = (player.totalScore || 0).toLocaleString();
    const wave = `${this.gameState.state.wave || 1}`;
    const gold = player.gold || 0;

    const { els, _last: last } = this;
    if (last.healthPercent !== healthPercent) {
      els.healthFill.style.width = healthPercent + '%';
      els.healthBar.setAttribute('aria-valuenow', Math.round(healthPercent));
      this._updateHealthGhost(healthPercent);
      last.healthPercent = healthPercent;
    }
    if (last.healthRounded !== healthRounded) { els.healthText.textContent = healthRounded; last.healthRounded = healthRounded; }
    if (last.lowHealth !== lowHealth) { els.healthBar.classList.toggle('low-health', lowHealth); last.lowHealth = lowHealth; }

    this._updateXPBar(player);

    // Stats — server increments `totalScore` on kills (combo-multiplied).
    if (last.score !== score) { els.scoreValue.textContent = score; last.score = score; }
    if (last.wave !== wave) { els.waveValue.textContent = wave; last.wave = wave; }
    if (last.gold !== gold) { els.goldValue.textContent = gold; last.gold = gold; }
  }

  /** Updates XP bar fill, level label and near-levelup highlight. @private */
  _updateXPBar(player) {
    if (!player.level || player.xp === undefined) return;
    const { els, _last: last } = this;
    const xpNeeded = this.getXPForLevel(player.level);
    const xpPercent = (player.xp / xpNeeded) * 100;
    // BUGFIX: clamp to 100% — brief XP/level-up race can exceed 100, stretching the bar.
    const xpFillVal = Math.min(100, xpPercent);
    const nearLevelup = xpPercent > 85;
    const xpText = `${Math.floor(player.xp)}/${xpNeeded}`;

    if (last.xpFillVal !== xpFillVal) { els.xpFill.style.width = xpFillVal + '%'; last.xpFillVal = xpFillVal; }
    if (last.level !== player.level) { els.levelText.textContent = player.level; last.level = player.level; }
    if (last.xpText !== xpText) { els.xpText.textContent = xpText; last.xpText = xpText; }
    if (last.nearLevelup !== nearLevelup) { els.xpBar.classList.toggle('near-levelup', nearLevelup); last.nearLevelup = nearLevelup; }
  }

  /** Renders game-over screen on first death frame. @private */
  _handleGameOver(player) {
    const { els } = this;
    const wasHidden = els.gameOver.style.display !== 'block';
    els.gameOver.style.display = 'block';

    if (wasHidden) {
      if (window.audioManager) window.audioManager.play('death');
      this._startRespawnCountdown();
      this._renderGameOverStats(player);
      this._renderPersonalBestComparison(player);
    }

    if (!this.deathRecorded && window.leaderboardSystem) {
      this.deathRecorded = true;
      window.leaderboardSystem.addEntry(player);
    }

    if (!this.gameOverDispatched) {
      const killedBy = player.lastKillerType || null;
      document.dispatchEvent(new CustomEvent('game_over', {
        detail: {
          score: player.totalScore || 0,
          wave: this.gameState.state.wave || 1,
          level: player.level || 1,
          gold: player.gold || 0,
          weapon: player.weapon || 'pistol',
          zombiesKilled: player.zombiesKilled || player.kills || 0,
          killedBy
        }
      }));
      this.gameOverDispatched = true;
      this.gameStartedDispatched = false;
      this._updateDeathCause(killedBy);
    }
  }

  /** Animates the respawn countdown (3-2-1) and re-enables button. @private */
  _startRespawnCountdown() {
    const respawnBtn = document.getElementById('respawn-btn');
    const cdSpan = document.getElementById('respawn-countdown');
    if (!respawnBtn || !respawnBtn.disabled) return;
    let n = 3;
    if (cdSpan) cdSpan.textContent = n;
    const iv = setInterval(() => {
      n--;
      if (n > 0) {
        if (cdSpan) cdSpan.textContent = n;
      } else {
        clearInterval(iv);
        if (cdSpan) cdSpan.textContent = '';
        respawnBtn.disabled = false;
        respawnBtn.focus();
      }
    }, 500);
  }

  /** Fills the game-over score/wave/level/gold/kills/time fields. @private */
  _renderGameOverStats(player) {
    const { els } = this;
    els.finalScore.textContent = (player.totalScore || 0).toLocaleString();
    els.finalWave.textContent = `${this.gameState.state.wave || 1}`;
    els.finalLevel.textContent = player.level || 1;
    els.finalGold.textContent = (player.gold || 0).toLocaleString();
    if (els.finalKills) {
      els.finalKills.textContent = (player.zombiesKilled || player.kills || 0).toLocaleString();
    }
    const timeEl = document.getElementById('final-time');
    if (timeEl && this._gameStartTime) {
      const secs = Math.floor((Date.now() - this._gameStartTime) / 1000);
      const mm = String(Math.floor(secs / 60)).padStart(2, '0');
      const ss = String(secs % 60).padStart(2, '0');
      timeEl.textContent = `${mm}:${ss}`;
    }
  }

  /** Updates live player and zombie counts in the HUD. @private */
  _updatePlayerCount() {
    const { els } = this;
    const activePlayers = Object.values(this.gameState.state.players).filter(p => p.hasNickname).length;
    els.playersCount.textContent = activePlayers;
    els.zombiesCount.textContent = Object.keys(this.gameState.state.zombies).length;
  }

  getXPForLevel(level) {
    if (level <= 5) {
      return 50 + (level - 1) * 30;
    } else if (level <= 10) {
      return 200 + (level - 5) * 50;
    } else if (level <= 20) {
      return 400 + (level - 10) * 75;
    } else {
      return Math.floor(1000 + (level - 20) * 100);
    }
  }

  _renderPersonalBestComparison(player) {
    const container = document.getElementById('game-over-best');
    if (!container) {
      return;
    }
    const lb = window.leaderboardSystem;
    const pb = lb && lb.personalBest ? lb.personalBest : null;
    const currentScore = player.totalScore || 0;
    container.style.display = 'block';
    const pbScoreEl = document.getElementById('pb-score');
    const deltaEl = document.getElementById('pb-delta');
    const deltaLabel = document.getElementById('pb-delta-label');
    const banner = document.getElementById('pb-banner');
    const deltaRow = document.getElementById('pb-delta-row');
    if (!pb) {
      if (pbScoreEl) {
        pbScoreEl.textContent = '—';
      }
      if (deltaRow) {
        deltaRow.style.display = 'none';
      }
      if (banner) {
        banner.style.display = currentScore > 0 ? 'block' : 'none';
      }
      return;
    }
    const delta = currentScore - pb.score;
    if (pbScoreEl) {
      pbScoreEl.textContent = pb.score.toLocaleString();
    }
    if (deltaRow) {
      deltaRow.style.display = 'flex';
    }
    if (delta >= 0) {
      if (deltaLabel) {
        deltaLabel.textContent = typeof I18n !== 'undefined' ? I18n.t('ui.record_beaten') : 'Record battu de';
      }
      if (deltaEl) {
        deltaEl.textContent = `+${delta.toLocaleString()}`;
        deltaEl.style.color = '#44ff66';
      }
      if (banner) {
        banner.style.display = 'block';
      }
    } else {
      if (deltaLabel) {
        deltaLabel.textContent = typeof I18n !== 'undefined' ? I18n.t('ui.delta') : 'Écart';
      }
      if (deltaEl) {
        deltaEl.textContent = delta.toLocaleString();
        deltaEl.style.color = '#ff8866';
      }
      if (banner) {
        banner.style.display = 'none';
      }
    }
  }

  _updateHealthGhost(healthPercent) {
    const { els } = this;
    if (!els.healthGhost) {
      return;
    }
    if (healthPercent < this._ghostPercent) {
      if (this._ghostTimer) {
        clearTimeout(this._ghostTimer);
      }
      this._ghostTimer = setTimeout(() => {
        this._ghostPercent = healthPercent;
        els.healthGhost.style.width = healthPercent + '%';
        this._ghostTimer = null;
      }, 400);
    } else {
      this._ghostPercent = healthPercent;
      els.healthGhost.style.width = healthPercent + '%';
    }
  }

  _showAnnouncement(h1Text, pText, bg, duration, withCountdown = false) {
    const el = document.getElementById('wave-announcement');
    el.querySelector('h1').textContent = h1Text;
    const pEl = el.querySelector('#wave-announcement-sub') || el.querySelector('p');
    if (pEl) pEl.textContent = pText;
    el.style.background = bg;
    el.style.display = 'none';
    void el.offsetWidth;
    el.style.display = 'block';

    // Animated countdown (3-2-1) when requested
    const cdEl = document.getElementById('wave-countdown');
    if (cdEl) {
      cdEl.textContent = '';
      if (withCountdown) {
        let n = 3;
        cdEl.textContent = n;
        cdEl.classList.add('wave-countdown--active');
        const iv = setInterval(() => {
          n--;
          if (n > 0) { cdEl.textContent = n; }
          else { cdEl.textContent = ''; cdEl.classList.remove('wave-countdown--active'); clearInterval(iv); }
        }, 1000);
      }
    }

    setTimeout(() => {
      el.style.display = 'none';
    }, duration);
  }

  showBossAnnouncement(bossName) {
    this._showAnnouncement(
      (typeof I18n !== 'undefined' ? I18n.t('ui.boss') : 'BOSS !'),
      bossName,
      'rgba(255, 0, 0, 0.9)',
      CONSTANTS.ANIMATIONS.BOSS_ANNOUNCEMENT
    );
  }

  showNewWaveAnnouncement(wave, zombiesCount) {
    this._showAnnouncement(
      `VAGUE ${wave}`,
      `${zombiesCount} zombies à éliminer !`,
      'rgba(0, 255, 100, 0.9)',
      3000,
      true
    );
  }

  showMilestoneBonus(bonus, _level) {
    this._showAnnouncement(
      `${bonus.icon} ${bonus.title}`,
      bonus.description,
      'linear-gradient(135deg, rgba(255, 215, 0, 0.95) 0%, rgba(255, 140, 0, 0.95) 100%)',
      CONSTANTS.ANIMATIONS.MILESTONE_DELAY
    );
  }

  showLevelUpScreen(newLevel, upgradeChoices) {
    const levelUpScreen = document.getElementById('level-up-screen');
    const upgradeChoicesContainer = document.getElementById('upgrade-choices');

    const levelUpTitle = levelUpScreen.querySelector('.level-up-title');
    levelUpTitle.textContent = `⬆️ NIVEAU ${newLevel} ! ⬆️`;

    // Animate title
    levelUpTitle.style.animation = 'none';
    setTimeout(() => {
      levelUpTitle.style.animation = 'pulse 1s ease-in-out infinite';
    }, 10);

    // Clear previous choices
    upgradeChoicesContainer.textContent = '';

    // Build all cards in a fragment to avoid repeated reflows
    const fragment = document.createDocumentFragment();
    upgradeChoices.forEach(upgrade => {
      const card = document.createElement('div');
      card.className = `upgrade-card ${upgrade.rarity}`;
      const rarityEl = document.createElement('div');
      rarityEl.className = 'upgrade-rarity';
      rarityEl.textContent = upgrade.rarity;
      const nameEl = document.createElement('div');
      nameEl.className = 'upgrade-name';
      nameEl.textContent = upgrade.name;
      const descEl = document.createElement('div');
      descEl.className = 'upgrade-description';
      descEl.textContent = upgrade.description;
      card.append(rarityEl, nameEl, descEl);

      card.addEventListener('click', () => {
        if (this._upgradePending) {
return;
}
        if (!window.networkManager) {
return;
}
        this._upgradePending = true;
        window.networkManager.selectUpgrade(upgrade.id);
        document.dispatchEvent(
          new CustomEvent('upgrade_obtained', {
            detail: { upgradeId: upgrade.id, rarity: upgrade.rarity }
          })
        );
        levelUpScreen.style.display = 'none';
        this._upgradePending = false;
      });

      fragment.appendChild(card);
    });
    upgradeChoicesContainer.appendChild(fragment);

    levelUpScreen.style.display = 'flex';
  }

  showRoomAnnouncement(roomNum, totalRooms) {
    this._showAnnouncement(
      `Salle ${roomNum}/${totalRooms}`,
      (typeof I18n !== 'undefined' ? I18n.t('ui.forward') : 'En avant!'),
      'rgba(255, 170, 0, 0.9)',
      2000
    );
  }

  showRunCompleted(gold, level) {
    alert(`Run complété! Or gagné: ${gold}, Niveau atteint: ${level}`);
  }

  showShop() {
    const player = this.gameState.getPlayer();
    if (!player || !player.alive) {
      return;
    }

    this.shopOpen = true;
    document.getElementById('shop').style.display = 'block';
    this.populateShop();

    // Activer l'invincibilité tant que le shop est ouvert
    if (window.networkManager) {
      window.networkManager.shopOpened();
    }
  }

  hideShop() {
    this.shopOpen = false;
    document.getElementById('shop').style.display = 'none';
    this._hideWeaponPreview();

    // Désactiver l'invincibilité quand le shop se ferme
    if (window.networkManager) {
      window.networkManager.shopClosed();
    }
  }

  populateShop() {
    const player = this.gameState.getPlayer();
    if (!player) {
      console.error('[Shop] No player found when populating shop');
      return;
    }

    logger.debug('[Shop] Populating shop. Player gold:', player.gold);
    logger.debug('[Shop] Shop items available:', this.gameState.shopItems);

    // Update gold display
    document.getElementById('shop-gold').textContent = player.gold || 0;

    // Populate permanent upgrades
    const permanentContainer = document.getElementById('permanent-upgrades');
    if (!permanentContainer) {
      console.error('[Shop] permanent-upgrades container not found');
      return;
    }
    permanentContainer.innerHTML = '';

    if (!this.gameState.shopItems || !this.gameState.shopItems.permanent) {
      console.error('[Shop] No permanent shop items available');
      return;
    }

    logger.debug('[Shop] Creating permanent upgrade buttons...');
    for (const key in this.gameState.shopItems.permanent) {
      permanentContainer.appendChild(this._buildPermanentItem(key, this.gameState.shopItems.permanent[key], player));
    }

    // Populate temporary items
    const temporaryContainer = document.getElementById('temporary-items');
    if (!temporaryContainer) {
      console.error('[Shop] temporary-items container not found');
      return;
    }
    temporaryContainer.innerHTML = '';

    if (!this.gameState.shopItems || !this.gameState.shopItems.temporary) {
      console.error('[Shop] No temporary shop items available');
      return;
    }

    logger.debug('[Shop] Creating temporary item buttons...');
    for (const key in this.gameState.shopItems.temporary) {
      temporaryContainer.appendChild(this._buildTemporaryItem(key, this.gameState.shopItems.temporary[key], player));
    }

    logger.debug('[Shop] Shop populated successfully');

    // Flash the last bought item
    if (this._lastBoughtItem) {
      const btn = document.querySelector(`.shop-buy-btn[data-item-id="${this._lastBoughtItem}"]`);
      if (btn) {
        const itemDiv = btn.closest('.shop-item');
        if (itemDiv) {
          itemDiv.classList.remove('bought-flash');
          void itemDiv.offsetWidth; // force reflow
          itemDiv.classList.add('bought-flash');
          itemDiv.addEventListener('animationend', () => itemDiv.classList.remove('bought-flash'), { once: true });
        }
      }
      this._lastBoughtItem = null;
    }
  }

  _showWeaponPreview(weaponKey) {
    const stats = window.WEAPON_STATS && window.WEAPON_STATS[weaponKey];
    const maxes = window.WEAPON_STATS_MAX;
    const panel = document.getElementById('weapon-stats-preview');
    if (!stats || !panel) return;

    document.getElementById('wsp-name').textContent = stats.name;

    const dmgPct = Math.round((stats.damage / maxes.damage) * 100);
    document.getElementById('wsp-damage-val').textContent = stats.damage;
    document.getElementById('wsp-damage-bar').style.width = dmgPct + '%';

    // fireRate: lower = faster → invert for "cadence" bar
    const ratePct = Math.round((1 - stats.fireRate / maxes.fireRate) * 100);
    const rateLabel = stats.fireRate <= 150 ? 'Très rapide' : stats.fireRate <= 400 ? 'Rapide' : stats.fireRate <= 900 ? 'Moyen' : 'Lent';
    document.getElementById('wsp-rate-val').textContent = rateLabel;
    document.getElementById('wsp-rate-bar').style.width = Math.max(ratePct, 5) + '%';

    const rangePct = Math.round((stats.bulletSpeed / maxes.bulletSpeed) * 100);
    document.getElementById('wsp-range-val').textContent = stats.bulletSpeed === 0 ? 'Arc' : stats.bulletSpeed >= 20 ? 'Longue' : stats.bulletSpeed >= 13 ? 'Moyenne' : 'Courte';
    document.getElementById('wsp-range-bar').style.width = Math.max(rangePct, 5) + '%';

    const specialEl = document.getElementById('wsp-special');
    specialEl.textContent = stats.special || '';
    specialEl.style.display = stats.special ? 'block' : 'none';

    panel.classList.add('visible');
  }

  _hideWeaponPreview() {
    const panel = document.getElementById('weapon-stats-preview');
    if (panel) panel.classList.remove('visible');
  }

  /**
   * Builds a DOM element for a permanent upgrade shop item.
   * @param {string} key - Item identifier.
   * @param {object} item - Item config from shopItems.permanent.
   * @param {object} player - Current player state.
   * @returns {HTMLElement}
   */
  _buildPermanentItem(key, item, player) {
    const currentLevel = player.upgrades[key] || 0;
    const cost = item.baseCost + currentLevel * item.costIncrease;
    const isMaxed = currentLevel >= item.maxLevel;
    const canAfford = player.gold >= cost;

    const itemDiv = document.createElement('div');
    itemDiv.className = `shop-item ${isMaxed ? 'maxed' : ''}`;

    const tooltipLines = [item.description];
    if (item.effect) tooltipLines.push(item.effect);
    tooltipLines.push(`Niveau: ${currentLevel}/${item.maxLevel}`);
    if (!isMaxed) tooltipLines.push(`Prochain niveau: ${cost} 💰`);

    itemDiv.innerHTML = `
      <div class="shop-tooltip">${tooltipLines.join(' · ')}</div>
      <div class="shop-item-info">
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-desc">${item.description}</div>
        <div class="shop-item-level">Niveau: ${currentLevel}/${item.maxLevel}</div>
      </div>
      <div class="shop-item-buy">
        <div class="shop-item-price ${!isMaxed && !canAfford ? 'cant-afford' : ''}">${isMaxed ? 'MAX' : cost + ' 💰'}</div>
        <button class="shop-buy-btn" data-item-id="${key}" data-category="permanent" ${isMaxed || !canAfford ? 'disabled' : ''}>
          ${isMaxed ? 'MAX' : 'Acheter'}
        </button>
      </div>
    `;

    const btn = itemDiv.querySelector('.shop-buy-btn');
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.disabled) {
        const msg = isMaxed ? '⚠️ Niveau maximum atteint' : '⚠️ Or insuffisant';
        if (window.toastManager) window.toastManager.show({ message: msg, type: 'warning', duration: 2000 });
        return;
      }
      window.buyItem(btn.dataset.itemId, btn.dataset.category);
    });

    logger.debug('[Shop] Created button for:', key, 'disabled:', isMaxed || !canAfford);
    return itemDiv;
  }

  /**
   * Builds a DOM element for a temporary shop item.
   * @param {string} key - Item identifier.
   * @param {object} item - Item config from shopItems.temporary.
   * @param {object} player - Current player state.
   * @returns {HTMLElement}
   */
  _buildTemporaryItem(key, item, player) {
    const canAfford = player.gold >= item.cost;
    const itemDiv = document.createElement('div');
    itemDiv.className = 'shop-item';
    const tooltip = item.effect ? `${item.description} · ${item.effect}` : item.description;

    itemDiv.innerHTML = `
      <div class="shop-tooltip">${tooltip}</div>
      <div class="shop-item-info">
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-desc">${item.description}</div>
      </div>
      <div class="shop-item-buy">
        <div class="shop-item-price ${!canAfford ? 'cant-afford' : ''}">${item.cost} 💰</div>
        <button class="shop-buy-btn" data-item-id="${key}" data-category="temporary" ${!canAfford ? 'disabled' : ''}>
          Acheter
        </button>
      </div>
    `;

    if (window.WEAPON_STATS && window.WEAPON_STATS[key]) {
      itemDiv.addEventListener('mouseenter', () => this._showWeaponPreview(key));
      itemDiv.addEventListener('mouseleave', () => this._hideWeaponPreview());
    }

    const btn = itemDiv.querySelector('.shop-buy-btn');
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.disabled) {
        if (window.toastManager) window.toastManager.show({ message: '⚠️ Or insuffisant', type: 'warning', duration: 2000 });
        return;
      }
      window.buyItem(btn.dataset.itemId, btn.dataset.category);
    });

    logger.debug('[Shop] Created button for:', key, 'disabled:', !canAfford);
    return itemDiv;
  }

  toggleStatsPanel() {
    const statsPanel = document.getElementById('stats-panel');
    const isVisible = statsPanel.style.display === 'block';
    if (isVisible) {
      statsPanel.style.display = 'none';
    } else {
      statsPanel.style.display = 'block';
      this.updateStatsPanel();
    }
  }

  showStatsPanel() {
    const statsPanel = document.getElementById('stats-panel');
    statsPanel.style.display = 'block';
    this.updateStatsPanel();
  }

  hideStatsPanel() {
    const statsPanel = document.getElementById('stats-panel');
    statsPanel.style.display = 'none';
  }

  updateStatsPanel() {
    const player = this.gameState.getPlayer();
    if (!player) {
      return;
    }

    // Base stats
    const baseStatsContainer = document.getElementById('base-stats');
    baseStatsContainer.innerHTML = `
      <div class="stat-item">
        <span class="stat-name">❤️ Vie</span>
        <span class="stat-value">${Math.round(player.health)} / ${player.maxHealth}</span>
      </div>
      <div class="stat-item">
        <span class="stat-name">⚔️ Multiplicateur de Dégâts</span>
        <span class="stat-value multiplier">x${(player.damageMultiplier || 1).toFixed(2)}</span>
      </div>
      <div class="stat-item">
        <span class="stat-name">👟 Multiplicateur de Vitesse</span>
        <span class="stat-value multiplier">x${(player.speedMultiplier || 1).toFixed(2)}</span>
      </div>
      <div class="stat-item">
        <span class="stat-name">🔫 Multiplicateur Cadence</span>
        <span class="stat-value multiplier">x${(player.fireRateMultiplier || 1).toFixed(2)}</span>
      </div>
      <div class="stat-item">
        <span class="stat-name">📊 Niveau</span>
        <span class="stat-value">${player.level || 1}</span>
      </div>
      <div class="stat-item">
        <span class="stat-name">💰 Or</span>
        <span class="stat-value">${player.gold || 0}</span>
      </div>
    `;

    // Active upgrades
    this.updateActiveUpgrades(player);

    // Shop upgrades
    this.updateShopUpgrades(player);
  }

  updateScoreboard() {
    const container = document.getElementById('scoreboard-players');
    if (!container) return;
    const players = Object.values(this.gameState.state.players || {})
      .filter(p => p.hasNickname)
      .map(p => ({
        name: p.nickname || p.id,
        score: p.totalScore || p.score || 0,
        kills: p.zombiesKilled || p.kills || 0,
        deaths: p.deaths || 0,
        level: p.level || 1,
      }))
      .sort((a, b) => b.score - a.score);

    if (players.length <= 1) {
      container.closest('.stats-section').style.display = 'none';
      return;
    }
    container.closest('.stats-section').style.display = '';
    container.innerHTML = `
      <table class="scoreboard-table">
        <thead><tr>
          <th>#</th><th>Joueur</th><th>Score</th><th>Kills</th><th>Morts</th><th>Lvl</th>
        </tr></thead>
        <tbody>${players.map((p, i) => `
          <tr class="${i === 0 ? 'scoreboard-first' : ''}">
            <td class="stat-mono">${i + 1}</td>
            <td>${p.name}</td>
            <td class="stat-mono">${p.score.toLocaleString()}</td>
            <td class="stat-mono">${p.kills}</td>
            <td class="stat-mono">${p.deaths}</td>
            <td class="stat-mono">${p.level}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  updateActiveUpgrades(player) {
    const container = document.getElementById('active-upgrades');
    let hasUpgrades = false;
    let html = '';

    const upgrades = [
      {
        condition: player.regeneration > 0,
        html: `<div class="stat-item rare"><span class="stat-name">💚 Régénération</span><span class="stat-value">+${player.regeneration} PV/sec</span></div>`
      },
      {
        condition: player.bulletPiercing > 0,
        html: `<div class="stat-item rare"><span class="stat-name">🎯 Balles Perforantes</span><span class="stat-value">+${player.bulletPiercing} ennemis</span></div>`
      },
      {
        condition: player.lifeSteal > 0,
        html: `<div class="stat-item rare"><span class="stat-name">🩸 Vol de Vie</span><span class="stat-value">${(player.lifeSteal * 100).toFixed(0)}%</span></div>`
      },
      {
        condition: player.criticalChance > 0,
        html: `<div class="stat-item rare"><span class="stat-name">💥 Chance Critique</span><span class="stat-value">${(player.criticalChance * 100).toFixed(0)}%</span></div>`
      },
      {
        condition: player.goldMagnetRadius > 0,
        html: `<div class="stat-item"><span class="stat-name">💰 Aimant à Or</span><span class="stat-value">+${player.goldMagnetRadius}px</span></div>`
      },
      {
        condition: player.dodgeChance > 0,
        html: `<div class="stat-item rare"><span class="stat-name">🌀 Esquive</span><span class="stat-value">${(player.dodgeChance * 100).toFixed(0)}%</span></div>`
      },
      {
        condition: player.explosiveRounds,
        html: `<div class="stat-item legendary"><span class="stat-name">💣 Munitions Explosives</span><span class="stat-value">Rayon ${player.explosionRadius}px</span></div>`
      },
      {
        condition: player.extraBullets > 0,
        html: `<div class="stat-item legendary"><span class="stat-name">🎆 Balles Supplémentaires</span><span class="stat-value">+${player.extraBullets}</span></div>`
      },
      {
        condition: player.thorns > 0,
        html: `<div class="stat-item rare"><span class="stat-name">🛡️ Épines</span><span class="stat-value">${(player.thorns * 100).toFixed(0)}%</span></div>`
      },
      {
        condition: player.autoTurrets > 0,
        html: `<div class="stat-item legendary"><span class="stat-name">🎯 Tourelles Automatiques</span><span class="stat-value">x${player.autoTurrets}</span></div>`
      }
    ];

    upgrades.forEach(upgrade => {
      if (upgrade.condition) {
        hasUpgrades = true;
        html += upgrade.html;
      }
    });

    container.innerHTML = hasUpgrades
      ? html
      : '<div class="no-upgrades">Aucune amélioration active</div>';
  }

  updateShopUpgrades(player) {
    const container = document.getElementById('permanent-shop-upgrades');
    let hasUpgrades = false;
    let html = '';

    if (player.upgrades && player.upgrades.maxHealth > 0) {
      hasUpgrades = true;
      html += `<div class="stat-item"><span class="stat-name">❤️ Vie Maximum</span><span class="stat-value">Niveau ${player.upgrades.maxHealth}/10</span></div>`;
    }

    if (player.upgrades && player.upgrades.damage > 0) {
      hasUpgrades = true;
      html += `<div class="stat-item"><span class="stat-name">⚔️ Dégâts</span><span class="stat-value">Niveau ${player.upgrades.damage}/5</span></div>`;
    }

    if (player.upgrades && player.upgrades.speed > 0) {
      hasUpgrades = true;
      html += `<div class="stat-item"><span class="stat-name">👟 Vitesse</span><span class="stat-value">Niveau ${player.upgrades.speed}/5</span></div>`;
    }

    if (player.upgrades && player.upgrades.fireRate > 0) {
      hasUpgrades = true;
      html += `<div class="stat-item"><span class="stat-name">🔫 Cadence de Tir</span><span class="stat-value">Niveau ${player.upgrades.fireRate}/5</span></div>`;
    }

    container.innerHTML = hasUpgrades
      ? html
      : '<div class="no-upgrades">Aucun upgrade permanent acheté</div>';
  }

  _formatKillerLabel(killerType) {
    if (!killerType) {
      return null;
    }
    if (typeof I18n !== 'undefined') {
      const key = `enemy.${killerType}`;
      const translated = I18n.t(key);
      if (translated !== key) {
return translated;
}
    }
    const labels = {
      zombie: 'Zombie', fast: 'Zombie Rapide', tank: 'Zombie Tank',
      berserker: 'Berserker', exploder: 'Zombie Explosif', splitter: 'Zombie Diviseur',
      spitter: 'Zombie Cracheur', ghost: 'Zombie Fantôme', elemental: 'Zombie Élémentaire',
      bossCharnier: 'Boss : Le Charnier', bossInfect: "Boss : L'Infect",
      bossColosse: 'Boss : Le Colosse', bossRoi: 'Boss : Le Roi',
      bossInfernal: "Boss : L'Infernal", bossCryos: 'Boss : Cryos',
      bossVortex: 'Boss : Vortex', bossNexus: 'Boss : Nexus',
      bossApocalypse: "Boss : L'Apocalypse", hazard: 'Zone de Danger'
    };
    return labels[killerType] || killerType;
  }

  _updateDeathCause(killerType) {
    const el = document.getElementById('final-killed-by');
    const row = document.getElementById('killed-by-row');
    if (!el || !row) {
      return;
    }
    const label = this._formatKillerLabel(killerType);
    if (label) {
      el.textContent = label;
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  }
}

// Export to window
window.UIManager = UIManager;
