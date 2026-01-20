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
      shopClose: () => this.hideShop()
    };

    this.shopCloseBtn = document.getElementById('shop-close-btn');
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Shop close button
    if (this.shopCloseBtn) {
      this.shopCloseBtn.addEventListener('click', this.handlers.shopClose);
    }

    // Make buyItem global for onclick handlers
    window.buyItem = (itemId, category) => {
      console.log('[Shop] buyItem called:', itemId, category);

      if (!window.networkManager) {
        console.error('[Shop] NetworkManager not available');
        if (window.toastManager) {
          window.toastManager.show('❌ Connexion non disponible', 'error', 2000);
        }
        return;
      }

      console.log('[Shop] Sending purchase request to server...');
      window.networkManager.buyItem(itemId, category);

      // Show feedback that request was sent
      if (window.toastManager) {
        window.toastManager.show('⏳ Traitement de l\'achat...', 'info', 1000);
      }
    };

    console.log('✅ Shop buyItem function registered on window');
  }

  cleanup() {
    // Remove shop close button listener
    if (this.shopCloseBtn) {
      this.shopCloseBtn.removeEventListener('click', this.handlers.shopClose);
    }
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

    // Health bar
    const healthPercent = (player.health / player.maxHealth) * 100;
    const healthBar = document.getElementById('health-bar');
    document.getElementById('health-fill').style.width = healthPercent + '%';
    document.getElementById('health-text').textContent = Math.max(0, Math.round(player.health));

    // Low health warning (< 30%)
    if (healthPercent < 30) {
      healthBar.classList.add('low-health');
    } else {
      healthBar.classList.remove('low-health');
    }

    // XP and level
    if (player.level && player.xp !== undefined) {
      const xpNeeded = this.getXPForLevel(player.level);
      const xpPercent = (player.xp / xpNeeded) * 100;
      const xpBar = document.getElementById('xp-bar');
      document.getElementById('xp-fill').style.width = xpPercent + '%';
      document.getElementById('level-text').textContent = player.level;
      document.getElementById('xp-text').textContent = `${Math.floor(player.xp)}/${xpNeeded}`;

      // Near level up indicator (> 85%)
      if (xpPercent > 85) {
        xpBar.classList.add('near-levelup');
      } else {
        xpBar.classList.remove('near-levelup');
      }
    }

    // Stats
    document.getElementById('score-value').textContent = player.score;
    document.getElementById('wave-value').textContent = `${this.gameState.state.wave || 1}`;
    document.getElementById('gold-value').textContent = player.gold || 0;

    // Game over
    if (!player.alive) {
      document.getElementById('game-over').style.display = 'block';
      document.getElementById('final-score').textContent = (player.totalScore || player.score || 0).toLocaleString();
      document.getElementById('final-wave').textContent = `${this.gameState.state.wave || 1}`;
      document.getElementById('final-level').textContent = player.level || 1;
      document.getElementById('final-gold').textContent = (player.gold || 0).toLocaleString();

      // Sauvegarder dans le leaderboard (une seule fois)
      if (!this.deathRecorded && window.leaderboardSystem) {
        this.deathRecorded = true;
        window.leaderboardSystem.addEntry(player);
      }

      if (!this.gameOverDispatched) {
        const gameOverStats = {
          score: player.totalScore || player.score || 0,
          wave: this.gameState.state.wave || 1,
          level: player.level || 1,
          gold: player.gold || 0,
          weapon: player.weapon || 'pistol',
          zombiesKilled: player.zombiesKilled || player.kills || 0
        };
        document.dispatchEvent(new CustomEvent('game_over', { detail: gameOverStats }));
        this.gameOverDispatched = true;
        this.gameStartedDispatched = false;
      }
    } else {
      // Réinitialiser le flag quand le joueur est vivant
      this.deathRecorded = false;
      this.gameOverDispatched = false;
    }

    // Player count - only count players with nicknames (actually playing)
    const activePlayers = Object.values(this.gameState.state.players).filter(p => p.hasNickname).length;
    document.getElementById('players-count').textContent = activePlayers;
    document.getElementById('zombies-count').textContent = Object.keys(this.gameState.state.zombies).length;
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

  showBossAnnouncement(bossName) {
    const announcement = document.getElementById('wave-announcement');
    announcement.querySelector('h1').textContent = 'BOSS !';
    announcement.querySelector('p').textContent = bossName;
    announcement.style.background = 'rgba(255, 0, 0, 0.9)';
    announcement.style.display = 'block';

    setTimeout(() => {
      announcement.style.display = 'none';
      announcement.style.background = 'rgba(255, 170, 0, 0.9)';
    }, CONSTANTS.ANIMATIONS.BOSS_ANNOUNCEMENT);
  }

  showNewWaveAnnouncement(wave, zombiesCount) {
    const announcement = document.getElementById('wave-announcement');
    announcement.querySelector('h1').innerHTML = `VAGUE ${wave}`;
    announcement.querySelector('p').textContent = `${zombiesCount} zombies à éliminer !`;
    announcement.style.background = 'rgba(0, 255, 100, 0.9)';
    announcement.style.display = 'block';

    setTimeout(() => {
      announcement.style.display = 'none';
      announcement.style.background = 'rgba(255, 170, 0, 0.9)';
    }, 3000);
  }

  showMilestoneBonus(bonus, _level) {
    const announcement = document.getElementById('wave-announcement');
    announcement.querySelector('h1').innerHTML = `${bonus.icon} ${bonus.title}`;
    announcement.querySelector('p').textContent = bonus.description;
    announcement.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.95) 0%, rgba(255, 140, 0, 0.95) 100%)';
    announcement.style.border = '4px solid #FFD700';
    announcement.style.boxShadow = '0 0 30px rgba(255, 215, 0, 0.8)';
    announcement.style.display = 'block';

    setTimeout(() => {
      announcement.style.display = 'none';
      announcement.style.background = 'rgba(255, 170, 0, 0.9)';
      announcement.style.border = 'none';
      announcement.style.boxShadow = 'none';
    }, CONSTANTS.ANIMATIONS.MILESTONE_DELAY);
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
        document.dispatchEvent(new CustomEvent('upgrade_obtained', {
          detail: { upgradeId: upgrade.id, rarity: upgrade.rarity }
        }));
        levelUpScreen.style.display = 'none';
      });

      upgradeChoicesContainer.appendChild(card);
    });

    levelUpScreen.style.display = 'flex';
  }

  showRoomAnnouncement(roomNum, totalRooms) {
    const announcement = document.getElementById('wave-announcement');
    announcement.querySelector('h1').textContent = `Salle ${roomNum}/${totalRooms}`;
    announcement.querySelector('p').textContent = 'En avant!';
    announcement.style.display = 'block';

    setTimeout(() => {
      announcement.style.display = 'none';
    }, 2000);
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

    console.log('[Shop] Populating shop. Player gold:', player.gold);
    console.log('[Shop] Shop items available:', this.gameState.shopItems);

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

    console.log('[Shop] Creating permanent upgrade buttons...');
    for (const key in this.gameState.shopItems.permanent) {
      const item = this.gameState.shopItems.permanent[key];
      const currentLevel = player.upgrades[key] || 0;
      const cost = item.baseCost + (currentLevel * item.costIncrease);
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
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const itemId = btn.dataset.itemId;
        const category = btn.dataset.category;

        console.log('[Shop] Button clicked:', itemId, category, 'disabled:', btn.disabled);

        if (btn.disabled) {
          console.log('[Shop] Button is disabled, ignoring click');
          if (isMaxed) {
            if (window.toastManager) {
              window.toastManager.show('⚠️ Niveau maximum atteint', 'warning', 2000);
            }
          } else {
            if (window.toastManager) {
              window.toastManager.show('⚠️ Or insuffisant', 'warning', 2000);
            }
          }
          return;
        }

        window.buyItem(itemId, category);
      });

      console.log('[Shop] Created button for:', key, 'disabled:', (isMaxed || !canAfford));
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

    console.log('[Shop] Creating temporary item buttons...');
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
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const itemId = btn.dataset.itemId;
        const category = btn.dataset.category;

        console.log('[Shop] Button clicked:', itemId, category, 'disabled:', btn.disabled);

        if (btn.disabled) {
          console.log('[Shop] Button is disabled, ignoring click');
          if (window.toastManager) {
            window.toastManager.show('⚠️ Or insuffisant', 'warning', 2000);
          }
          return;
        }

        window.buyItem(itemId, category);
      });

      console.log('[Shop] Created button for:', key, 'disabled:', !canAfford);
    }

    console.log('[Shop] Shop populated successfully');
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
      { condition: player.regeneration > 0, html: `<div class="stat-item rare"><span class="stat-name">💚 Régénération</span><span class="stat-value">+${player.regeneration} PV/sec</span></div>` },
      { condition: player.bulletPiercing > 0, html: `<div class="stat-item rare"><span class="stat-name">🎯 Balles Perforantes</span><span class="stat-value">+${player.bulletPiercing} ennemis</span></div>` },
      { condition: player.lifeSteal > 0, html: `<div class="stat-item rare"><span class="stat-name">🩸 Vol de Vie</span><span class="stat-value">${(player.lifeSteal * 100).toFixed(0)}%</span></div>` },
      { condition: player.criticalChance > 0, html: `<div class="stat-item rare"><span class="stat-name">💥 Chance Critique</span><span class="stat-value">${(player.criticalChance * 100).toFixed(0)}%</span></div>` },
      { condition: player.goldMagnetRadius > 0, html: `<div class="stat-item"><span class="stat-name">💰 Aimant à Or</span><span class="stat-value">+${player.goldMagnetRadius}px</span></div>` },
      { condition: player.dodgeChance > 0, html: `<div class="stat-item rare"><span class="stat-name">🌀 Esquive</span><span class="stat-value">${(player.dodgeChance * 100).toFixed(0)}%</span></div>` },
      { condition: player.explosiveRounds, html: `<div class="stat-item legendary"><span class="stat-name">💣 Munitions Explosives</span><span class="stat-value">Rayon ${player.explosionRadius}px</span></div>` },
      { condition: player.extraBullets > 0, html: `<div class="stat-item legendary"><span class="stat-name">🎆 Balles Supplémentaires</span><span class="stat-value">+${player.extraBullets}</span></div>` },
      { condition: player.thorns > 0, html: `<div class="stat-item rare"><span class="stat-name">🛡️ Épines</span><span class="stat-value">${(player.thorns * 100).toFixed(0)}%</span></div>` },
      { condition: player.autoTurrets > 0, html: `<div class="stat-item legendary"><span class="stat-name">🎯 Tourelles Automatiques</span><span class="stat-value">x${player.autoTurrets}</span></div>` }
    ];

    upgrades.forEach(upgrade => {
      if (upgrade.condition) {
        hasUpgrades = true;
        html += upgrade.html;
      }
    });

    container.innerHTML = hasUpgrades ? html : '<div class="no-upgrades">Aucune amélioration active</div>';
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

    container.innerHTML = hasUpgrades ? html : '<div class="no-upgrades">Aucun upgrade permanent acheté</div>';
  }
}

// Export to window
window.UIManager = UIManager;
