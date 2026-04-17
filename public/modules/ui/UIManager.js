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

    // Store handler references for cleanup
    this.handlers = {
      shopClose: () => this.hideShop(),
      keydown: e => {
        if (e.key === 'Escape' && this.shopOpen) {
          this.hideShop();
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

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Shop close button
    if (this.shopCloseBtn) {
      this.shopCloseBtn.addEventListener('click', this.handlers.shopClose);
    }

    // Esc key closes shop (keyboard accessibility)
    document.addEventListener('keydown', this.handlers.keydown);

    // Guard: prevent duplicate emissions before server acknowledges the first
    this._buyPending = false;

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
  }

  update() {
    const player = this.gameState.getPlayer();
    if (!player) {
      return;
    }

    if (player.alive && !this.gameStartedDispatched) {
      const startStats = {
        wave: this.gameState.state.wave || 1,
        level: player.level || 1,
        weapon: player.weapon || 'pistol'
      };
      document.dispatchEvent(new CustomEvent('game_started', { detail: startStats }));
      this.gameStartedDispatched = true;
      this.gameOverDispatched = false;
    }

    // Health bar with damage-lag ghost bar
    const healthPercent = Math.max(0, (player.health / player.maxHealth) * 100);
    const { els } = this;
    els.healthFill.style.width = healthPercent + '%';
    els.healthText.textContent = Math.max(0, Math.round(player.health));
    this._updateHealthGhost(healthPercent);

    // Low health warning (< 30%)
    if (healthPercent < 30) {
      els.healthBar.classList.add('low-health');
    } else {
      els.healthBar.classList.remove('low-health');
    }

    // XP and level
    if (player.level && player.xp !== undefined) {
      const xpNeeded = this.getXPForLevel(player.level);
      const xpPercent = (player.xp / xpNeeded) * 100;
      // BUGFIX: clamp the bar fill to 100% — a brief race between server XP
      // grant and level-up processing can make xpPercent ≥ 100, stretching
      // the fill div past its container.
      els.xpFill.style.width = Math.min(100, xpPercent) + '%';
      els.levelText.textContent = player.level;
      els.xpText.textContent = `${Math.floor(player.xp)}/${xpNeeded}`;
      // Near level up indicator (> 85%)
      if (xpPercent > 85) {
        els.xpBar.classList.add('near-levelup');
      } else {
        els.xpBar.classList.remove('near-levelup');
      }
    }

    // Stats — server increments `totalScore` on kills (combo-multiplied).
    els.scoreValue.textContent = (player.totalScore || 0).toLocaleString();
    els.waveValue.textContent = `${this.gameState.state.wave || 1}`;
    els.goldValue.textContent = player.gold || 0;

    // Game over
    if (!player.alive) {
      const wasHidden = els.gameOver.style.display !== 'block';
      els.gameOver.style.display = 'block';

      // Respawn button starts disabled (HTML attribute) to prevent accidental
      // clicks during the death animation. Re-enable after a short delay so
      // the player sees the recap before acting.
      if (wasHidden) {
        const respawnBtn = document.getElementById('respawn-btn');
        if (respawnBtn && respawnBtn.disabled) {
          setTimeout(() => {
            respawnBtn.disabled = false;
            respawnBtn.focus();
          }, 1500);
        }
      }

      els.finalScore.textContent = (player.totalScore || 0).toLocaleString();
      els.finalWave.textContent = `${this.gameState.state.wave || 1}`;
      els.finalLevel.textContent = player.level || 1;
      els.finalGold.textContent = (player.gold || 0).toLocaleString();
      if (els.finalKills) {
        els.finalKills.textContent = (player.zombiesKilled || player.kills || 0).toLocaleString();
      }

      // Comparaison avec personal best (avant l'enregistrement du nouveau score)
      if (wasHidden) {
        this._renderPersonalBestComparison(player);
      }

      // Sauvegarder dans le leaderboard (une seule fois)
      if (!this.deathRecorded && window.leaderboardSystem) {
        this.deathRecorded = true;
        window.leaderboardSystem.addEntry(player);
      }

      if (!this.gameOverDispatched) {
        const killedBy = player.lastKillerType || null;
        const gameOverStats = {
          score: player.totalScore || 0,
          wave: this.gameState.state.wave || 1,
          level: player.level || 1,
          gold: player.gold || 0,
          weapon: player.weapon || 'pistol',
          zombiesKilled: player.zombiesKilled || player.kills || 0,
          killedBy
        };
        document.dispatchEvent(new CustomEvent('game_over', { detail: gameOverStats }));
        this.gameOverDispatched = true;
        this.gameStartedDispatched = false;
        this._updateDeathCause(killedBy);
      }
    } else {
      // Réinitialiser le flag quand le joueur est vivant
      this.deathRecorded = false;
      this.gameOverDispatched = false;
    }

    // Player count - only count players with nicknames (actually playing)
    const activePlayers = Object.values(this.gameState.state.players).filter(
      p => p.hasNickname
    ).length;
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
        deltaLabel.textContent = 'Record battu de';
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
        deltaLabel.textContent = 'Écart';
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

  _showAnnouncement(h1Text, pText, bg, duration) {
    const el = document.getElementById('wave-announcement');
    el.querySelector('h1').textContent = h1Text;
    el.querySelector('p').textContent = pText;
    el.style.background = bg;
    el.style.display = 'none';
    void el.offsetWidth;
    el.style.display = 'block';
    setTimeout(() => {
      el.style.display = 'none';
    }, duration);
  }

  showBossAnnouncement(bossName) {
    this._showAnnouncement(
      'BOSS !',
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
      3000
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
    upgradeChoicesContainer.innerHTML = '';

    // Create upgrade cards
    upgradeChoices.forEach(upgrade => {
      const card = document.createElement('div');
      card.className = `upgrade-card ${upgrade.rarity}`;
      card.innerHTML = `
        <div class="upgrade-rarity">${upgrade.rarity}</div>
        <div class="upgrade-name">${upgrade.name}</div>
        <div class="upgrade-description">${upgrade.description}</div>
      `;

      card.addEventListener('click', () => {
        if (window.networkManager) {
          window.networkManager.selectUpgrade(upgrade.id);
        }
        document.dispatchEvent(
          new CustomEvent('upgrade_obtained', {
            detail: { upgradeId: upgrade.id, rarity: upgrade.rarity }
          })
        );
        levelUpScreen.style.display = 'none';
      });

      upgradeChoicesContainer.appendChild(card);
    });

    levelUpScreen.style.display = 'flex';
  }

  showRoomAnnouncement(roomNum, totalRooms) {
    this._showAnnouncement(
      `Salle ${roomNum}/${totalRooms}`,
      'En avant!',
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
      const item = this.gameState.shopItems.permanent[key];
      const currentLevel = player.upgrades[key] || 0;
      const cost = item.baseCost + currentLevel * item.costIncrease;
      const isMaxed = currentLevel >= item.maxLevel;
      const canAfford = player.gold >= cost;

      const itemDiv = document.createElement('div');
      itemDiv.className = `shop-item ${isMaxed ? 'maxed' : ''}`;

      itemDiv.innerHTML = `
        <div class="shop-item-info">
          <div class="shop-item-name">${item.name}</div>
          <div class="shop-item-desc">${item.description}</div>
          <div class="shop-item-level">Niveau: ${currentLevel}/${item.maxLevel}</div>
        </div>
        <div class="shop-item-buy">
          <div class="shop-item-price">${isMaxed ? 'MAX' : cost + ' 💰'}</div>
          <button class="shop-buy-btn" data-item-id="${key}" data-category="permanent" ${isMaxed || !canAfford ? 'disabled' : ''}>
            ${isMaxed ? 'MAX' : 'Acheter'}
          </button>
        </div>
      `;

      permanentContainer.appendChild(itemDiv);

      // Add event listener to the button
      const btn = itemDiv.querySelector('.shop-buy-btn');
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();

        const itemId = btn.dataset.itemId;
        const category = btn.dataset.category;

        logger.debug('[Shop] Button clicked:', itemId, category, 'disabled:', btn.disabled);

        if (btn.disabled) {
          logger.debug('[Shop] Button is disabled, ignoring click');
          if (isMaxed) {
            if (window.toastManager) {
              window.toastManager.show({ message: '⚠️ Niveau maximum atteint', type: 'warning', duration: 2000 });
            }
          } else {
            if (window.toastManager) {
              window.toastManager.show({ message: '⚠️ Or insuffisant', type: 'warning', duration: 2000 });
            }
          }
          return;
        }

        window.buyItem(itemId, category);
      });

      logger.debug('[Shop] Created button for:', key, 'disabled:', isMaxed || !canAfford);
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
      const item = this.gameState.shopItems.temporary[key];
      const canAfford = player.gold >= item.cost;

      const itemDiv = document.createElement('div');
      itemDiv.className = 'shop-item';

      itemDiv.innerHTML = `
        <div class="shop-item-info">
          <div class="shop-item-name">${item.name}</div>
          <div class="shop-item-desc">${item.description}</div>
        </div>
        <div class="shop-item-buy">
          <div class="shop-item-price">${item.cost} 💰</div>
          <button class="shop-buy-btn" data-item-id="${key}" data-category="temporary" ${!canAfford ? 'disabled' : ''}>
            Acheter
          </button>
        </div>
      `;

      temporaryContainer.appendChild(itemDiv);

      // Add event listener to the button
      const btn = itemDiv.querySelector('.shop-buy-btn');
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();

        const itemId = btn.dataset.itemId;
        const category = btn.dataset.category;

        logger.debug('[Shop] Button clicked:', itemId, category, 'disabled:', btn.disabled);

        if (btn.disabled) {
          logger.debug('[Shop] Button is disabled, ignoring click');
          if (window.toastManager) {
            window.toastManager.show({ message: '⚠️ Or insuffisant', type: 'warning', duration: 2000 });
          }
          return;
        }

        window.buyItem(itemId, category);
      });

      logger.debug('[Shop] Created button for:', key, 'disabled:', !canAfford);
    }

    logger.debug('[Shop] Shop populated successfully');
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
    const labels = {
      zombie: 'Zombie',
      fast: 'Zombie Rapide',
      tank: 'Zombie Tank',
      berserker: 'Berserker',
      exploder: 'Zombie Explosif',
      splitter: 'Zombie Diviseur',
      spitter: 'Zombie Cracheur',
      ghost: 'Zombie Fantôme',
      elemental: 'Zombie Élémentaire',
      bossCharnier: 'Boss : Le Charnier',
      bossInfect: "Boss : L'Infect",
      bossColosse: 'Boss : Le Colosse',
      bossRoi: 'Boss : Le Roi',
      bossInfernal: "Boss : L'Infernal",
      bossCryos: 'Boss : Cryos',
      bossVortex: 'Boss : Vortex',
      bossNexus: 'Boss : Nexus',
      bossApocalypse: "Boss : L'Apocalypse",
      hazard: 'Zone de Danger'
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
