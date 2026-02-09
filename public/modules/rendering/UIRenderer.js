/**
 * UI RENDERER
 * Handles rendering of HUD elements: boss health bar, kill feed, combo display,
 * damage numbers, wave info
 * @module UIRenderer
 * @author Claude Code
 * @version 1.0.0
 */

class UIRenderer {
  constructor() {
    // Damage numbers system
    this.damageNumbers = [];
    this.lastZombieHealthCheck = {};

    // Kill feed system
    this.lastZombieCount = 0;
    this.killFeedItems = [];

    // Combo tracking
    this.lastComboValue = 0;

    // Cache UI elements and last values to reduce DOM churn
    this.uiElements = {};
    this.uiState = {
      bossVisible: false,
      bossId: null,
      bossHealthPercent: null,
      bossHealthText: null,
      bossPhase: null,
      bossName: null,
      comboValue: null,
      comboMultiplier: null,
      comboVisible: null,
      wave: null,
      waveKills: null,
      waveTarget: null
    };
    this._zombieCountFrame = 0;

    // Local map for boss names (fallback if CONSTANTS.BOSS_NAMES is missing)
    this.bossNameMap =
      typeof CONSTANTS !== 'undefined' && CONSTANTS.BOSS_NAMES
        ? CONSTANTS.BOSS_NAMES
        : {
            boss: 'BOSS',
            bossCharnier: 'RAIIVY',
            bossInfect: 'SORENZA',
            bossColosse: 'HAIER',
            bossRoi: 'KUROI TO SUTA',
            bossOmega: 'MORGANNITO',
            bossInfernal: 'LORD INFERNUS',
            bossCryos: "CRYOS L'ETERNEL",
            bossVortex: 'VORTEX LE DESTRUCTEUR',
            bossNexus: 'NEXUS DU VIDE',
            bossApocalypse: 'APOCALYPSE PRIME'
          };
  }

  getUiElement(key, id) {
    if (this.uiElements[key]) {
      return this.uiElements[key];
    }

    const element = document.getElementById(id);
    if (element) {
      this.uiElements[key] = element;
    }

    return element;
  }

  /**
   * Add a damage number at position
   * @param {number} x - World X coordinate
   * @param {number} y - World Y coordinate
   * @param {number} damage - Damage amount
   * @param {string} type - Damage type (normal, critical, poison, fire, ice)
   */
  addDamageNumber(x, y, damage, type) {
    type = type || 'normal';

    const colors = {
      normal: '#ffffff',
      critical: '#ffff00',
      poison: '#00ff00',
      fire: '#ff6600',
      ice: '#00ffff',
      boss: '#ff0000'
    };

    this.damageNumbers.push({
      x: x,
      y: y,
      damage: Math.ceil(damage),
      color: colors[type] || colors.normal,
      opacity: 1,
      velocity: -2,
      createdAt: Date.now(),
      lifetime: 2000
    });

    if (this.damageNumbers.length > 50) {
      this.damageNumbers.shift();
    }
  }

  /**
   * Check zombie health changes and create damage numbers
   * @param {object} zombies - Current zombies state
   */
  checkZombieDamage(zombies) {
    for (const zombieId in zombies) {
      const zombie = zombies[zombieId];

      if (this.lastZombieHealthCheck[zombieId] !== undefined) {
        const lastHealth = this.lastZombieHealthCheck[zombieId];
        const currentHealth = zombie.health;

        if (currentHealth < lastHealth) {
          const damage = lastHealth - currentHealth;
          const damageType = zombie.isBoss ? 'boss' : 'normal';
          this.addDamageNumber(zombie.x, zombie.y - zombie.size, damage, damageType);
        }
      }

      this.lastZombieHealthCheck[zombieId] = zombie.health;
    }

    // Clean up dead zombies from tracking
    for (const zombieId in this.lastZombieHealthCheck) {
      if (!zombies[zombieId]) {
        delete this.lastZombieHealthCheck[zombieId];
      }
    }
  }

  /**
   * Update damage numbers positions and opacity
   * @param {number} _deltaTime - Time since last frame (ms)
   */
  updateDamageNumbers(_deltaTime) {
    const now = Date.now();

    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const dmg = this.damageNumbers[i];

      const age = now - dmg.createdAt;

      if (age > dmg.lifetime) {
        this.damageNumbers.splice(i, 1);
        continue;
      }

      dmg.y += dmg.velocity;
      dmg.opacity = 1 - age / dmg.lifetime;
    }
  }

  /**
   * Render damage numbers on canvas
   */
  renderDamageNumbers(ctx, camera) {
    if (!camera) {
      return;
    }

    ctx.save();

    for (const dmg of this.damageNumbers) {
      if (!camera.isInViewport(dmg.x, dmg.y, 50)) {
        continue;
      }

      ctx.globalAlpha = dmg.opacity;
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.strokeText(`-${dmg.damage}`, dmg.x, dmg.y);

      ctx.fillStyle = dmg.color;
      ctx.fillText(`-${dmg.damage}`, dmg.x, dmg.y);
    }

    ctx.restore();
  }

  /**
   * Update Boss Health Bar UI
   * @param {object} gameState - Game state object
   */
  updateBossHealthBar(gameState) {
    const container = this.getUiElement('bossContainer', 'boss-health-container');
    const nameEl = this.getUiElement('bossName', 'boss-name');
    const phaseEl = this.getUiElement('bossPhase', 'boss-phase');
    const healthBar = this.getUiElement('bossHealthBar', 'boss-health-bar');
    const healthText = this.getUiElement('bossHealthText', 'boss-health-text');

    if (!container || !nameEl || !phaseEl || !healthBar || !healthText) {
      return;
    }

    const zombies = gameState.state.zombies || {};
    let boss = null;
    let bossId = null;
    for (const zombieId in zombies) {
      const candidate = zombies[zombieId];
      if (candidate && candidate.isBoss) {
        boss = candidate;
        bossId = zombieId;
        break;
      }
    }

    if (!boss) {
      if (this.uiState.bossVisible) {
        container.style.display = 'none';
        this.uiState.bossVisible = false;
      }
      return;
    }

    if (!this.uiState.bossVisible) {
      container.style.display = 'block';
      this.uiState.bossVisible = true;
    }

    if (bossId !== this.uiState.bossId) {
      this.uiState.bossId = bossId;
      this.uiState.bossHealthPercent = null;
      this.uiState.bossHealthText = null;
      this.uiState.bossPhase = null;
      this.uiState.bossName = null;
    }

    const rawHealthPercent = (boss.health / boss.maxHealth) * 100;
    const healthPercent = Math.max(0, Math.min(100, rawHealthPercent));
    const healthPercentRounded = Math.round(healthPercent * 10) / 10;
    const healthTextValue = `${Math.ceil(healthPercent)}%`;

    const bossName = this.bossNameMap[boss.type] || 'BOSS';
    if (bossName !== this.uiState.bossName) {
      nameEl.textContent = bossName;
      this.uiState.bossName = bossName;
    }

    let phase = 1;
    if (healthPercent <= 33) {
      phase = 3;
    } else if (healthPercent <= 66) {
      phase = 2;
    }

    if (phase !== this.uiState.bossPhase) {
      phaseEl.textContent = `Phase ${phase}`;
      healthBar.classList.remove('phase-2', 'phase-3');
      if (phase === 2) {
        healthBar.classList.add('phase-2');
      } else if (phase === 3) {
        healthBar.classList.add('phase-3');
      }
      this.uiState.bossPhase = phase;
    }

    if (healthPercentRounded !== this.uiState.bossHealthPercent) {
      healthBar.style.width = `${healthPercentRounded}%`;
      this.uiState.bossHealthPercent = healthPercentRounded;
    }

    if (healthTextValue !== this.uiState.bossHealthText) {
      healthText.textContent = healthTextValue;
      this.uiState.bossHealthText = healthTextValue;
    }
  }

  // Kill Feed & Combo Methods
  updateKillFeedAndCombo(gameState) {
    const player = gameState.state.players[gameState.playerId];
    if (!player) {
      return;
    }

    const combo = player.combo || 0;
    const comboDisplay = this.getUiElement('comboDisplay', 'combo-display');
    const comboCount = this.getUiElement('comboCount', 'combo-count');
    const comboMultiplier = this.getUiElement('comboMultiplier', 'combo-multiplier');

    if (comboDisplay && comboCount && comboMultiplier) {
      const comboVisible = combo > 0;
      if (comboVisible !== this.uiState.comboVisible) {
        comboDisplay.style.display = comboVisible ? 'block' : 'none';
        this.uiState.comboVisible = comboVisible;
      }

      if (comboVisible) {
        if (combo !== this.uiState.comboValue) {
          comboCount.textContent = combo;
          this.uiState.comboValue = combo;
        }

        const multiplier = Math.min(1 + combo * 0.05, 3).toFixed(1);
        if (multiplier !== this.uiState.comboMultiplier) {
          comboMultiplier.textContent = multiplier;
          this.uiState.comboMultiplier = multiplier;
        }

        if (combo > this.lastComboValue) {
          comboCount.style.animation = 'none';
          setTimeout(() => {
            comboCount.style.animation = '';
          }, 10);
        }
      }
    }
    this.lastComboValue = combo;

    const countInterval = 10;
    if (++this._zombieCountFrame >= countInterval) {
      const currentZombieCount = Object.keys(gameState.state.zombies).length;
      if (currentZombieCount < this.lastZombieCount) {
        this.addKillFeedItem(player.nickname || 'Player', 'Zombie');
      }
      this.lastZombieCount = currentZombieCount;
      this._zombieCountFrame = 0;
    }

    this.updateKillFeed();
  }

  addKillFeedItem(killer, victim, type) {
    type = type || 'normal';

    const feedEl = document.getElementById('kill-feed');
    if (!feedEl) {
      return;
    }

    const item = document.createElement('div');
    item.classList.add('kill-feed-item');
    if (type === 'elite') {
      item.classList.add('elite');
    }
    if (type === 'boss') {
      item.classList.add('boss');
    }

    item.innerHTML = `
      <div class="kill-feed-text">
        <span class="kill-feed-killer">${killer}</span>
        <span>\u2620</span>
        <span class="kill-feed-victim ${type}">${victim}</span>
      </div>
    `;

    feedEl.prepend(item);

    this.killFeedItems.push({ element: item, createdAt: Date.now() });

    while (this.killFeedItems.length > 5) {
      const oldest = this.killFeedItems.shift();
      oldest.element.remove();
    }
  }

  updateKillFeed() {
    const now = Date.now();
    for (let i = this.killFeedItems.length - 1; i >= 0; i--) {
      const item = this.killFeedItems[i];
      const age = now - item.createdAt;

      if (age > 5000) {
        item.element.classList.add('removing');
        setTimeout(() => item.element.remove(), 300);
        this.killFeedItems.splice(i, 1);
      }
    }
  }

  updateWaveProgress(gameState) {
    const waveNumberEl = this.getUiElement('waveNumber', 'wave-progress-number');
    const waveKillsEl = this.getUiElement('waveKills', 'wave-kills');
    const waveTargetEl = this.getUiElement('waveTarget', 'wave-target');
    const progressBar = this.getUiElement('waveProgressBar', 'wave-progress-bar');

    if (!waveNumberEl || !waveKillsEl || !waveTargetEl || !progressBar) {
      return;
    }

    const wave = gameState.state.wave || 1;
    const zombiesKilled = gameState.state.zombiesKilledThisWave || 0;

    const targetZombies = Math.floor(10 + wave * 2);

    const waveChanged = wave !== this.uiState.wave;
    const killsChanged = zombiesKilled !== this.uiState.waveKills;
    const targetChanged = targetZombies !== this.uiState.waveTarget;

    if (waveChanged) {
      waveNumberEl.textContent = wave;
      this.uiState.wave = wave;
    }
    if (killsChanged) {
      waveKillsEl.textContent = zombiesKilled;
      this.uiState.waveKills = zombiesKilled;
    }
    if (targetChanged) {
      waveTargetEl.textContent = targetZombies;
      this.uiState.waveTarget = targetZombies;
    }

    if (killsChanged || targetChanged) {
      const progress = Math.min((zombiesKilled / targetZombies) * 100, 100);
      progressBar.style.width = `${progress}%`;
    }
  }
}

window.UIRenderer = UIRenderer;
