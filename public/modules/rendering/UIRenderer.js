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

    // Hit markers system
    this.hitMarkers = [];
    this.HIT_MARKER_DURATION = 150; // ms
    this.HIT_MARKER_SIZE = 10; // half-arm length in px
    this.HIT_MARKER_GAP = 3; // gap from center in px

    // Pickup label popups system
    this.pickupLabels = [];
    this.PICKUP_LABEL_LIFETIME = 900; // ms
    this.PICKUP_LABEL_FLOAT_SPEED = 1.0; // px/frame upward
    this.PICKUP_LABEL_FONT_SIZE = 16; // px

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

    // Font string cache: fontSize (number) -> 'bold Npx Arial'
    this._fontCache = new Map();

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

    const DAMAGE_COLORS = {
      normal: '#ffffff',
      critical: '#ffdd00',
      poison: '#55ff55',
      fire: '#ff6600',
      ice: '#00ffff',
      boss: '#ff4444'
    };
    const DAMAGE_LIFETIME = 1800; // ms
    const BASE_FONT_SIZE = 18;
    const MAX_FONT_SIZE = 32;
    const fontSize = Math.min(BASE_FONT_SIZE + Math.sqrt(damage) * 0.6, MAX_FONT_SIZE);

    this.damageNumbers.push({
      x,
      y,
      damage: Math.ceil(damage),
      color: DAMAGE_COLORS[type] || DAMAGE_COLORS.normal,
      isCritical: type === 'critical' || type === 'boss',
      fontSize,
      opacity: 1,
      createdAt: Date.now(),
      lifetime: DAMAGE_LIFETIME
    });

    if (this.damageNumbers.length > 50) {
      this.damageNumbers.shift();
    }
  }

  /**
   * Add a hit marker at world position (called when player bullet hits zombie)
   * @param {number} x - World X
   * @param {number} y - World Y
   * @param {boolean} isCritical - Critical hit gets red color
   */
  addHitMarker(x, y, isCritical) {
    this.hitMarkers.push({
      x,
      y,
      isCritical: !!isCritical,
      createdAt: Date.now()
    });

    if (this.hitMarkers.length > 20) {
      this.hitMarkers.shift();
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
          this.addHitMarker(zombie.x, zombie.y, zombie.isBoss);
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
    const FLOAT_SPEED = 1.2; // px per frame (upward)

    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const dmg = this.damageNumbers[i];
      const age = now - dmg.createdAt;

      if (age > dmg.lifetime) {
        this.damageNumbers.splice(i, 1);
        continue;
      }

      // Cubic ease-out: fast at start, slows down
      const t = age / dmg.lifetime;
      const eased = 1 - Math.pow(1 - t, 3);
      dmg.y -= FLOAT_SPEED * (1 - eased * 0.8);

      // Fade out only in last 40% of lifetime
      const fadeStart = 0.6;
      dmg.opacity = t < fadeStart ? 1 : 1 - (t - fadeStart) / (1 - fadeStart);
    }
  }

  /**
   * Update hit markers: remove expired ones
   */
  updateHitMarkers() {
    const now = Date.now();
    for (let i = this.hitMarkers.length - 1; i >= 0; i--) {
      if (now - this.hitMarkers[i].createdAt > this.HIT_MARKER_DURATION) {
        this.hitMarkers.splice(i, 1);
      }
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
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const dmg of this.damageNumbers) {
      if (!camera.isInViewport(dmg.x, dmg.y, 50)) {
        continue;
      }

      ctx.globalAlpha = dmg.opacity;
      const fs = Math.round(dmg.fontSize);
      if (!this._fontCache.has(fs)) {
        this._fontCache.set(fs, `bold ${fs}px Arial`);
      }
      ctx.font = this._fontCache.get(fs);

      ctx.strokeStyle = '#000';
      ctx.lineWidth = dmg.isCritical ? 5 : 3;
      ctx.strokeText(`-${dmg.damage}`, dmg.x, dmg.y);

      ctx.fillStyle = dmg.color;
      ctx.fillText(`-${dmg.damage}`, dmg.x, dmg.y);
    }

    ctx.restore();
  }

  /**
   * Render hit markers as X shapes at zombie world positions
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} camera
   */
  renderHitMarkers(ctx, camera) {
    if (!camera || this.hitMarkers.length === 0) {
      return;
    }

    const now = Date.now();
    ctx.save();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    for (const marker of this.hitMarkers) {
      const age = now - marker.createdAt;
      const t = age / this.HIT_MARKER_DURATION;
      const opacity = 1 - t;
      const spread = this.HIT_MARKER_GAP + t * 4; // arms spread outward as it fades

      if (!camera.isInViewport(marker.x, marker.y, 30)) {
        continue;
      }

      const sx = marker.x;
      const sy = marker.y;
      const arm = this.HIT_MARKER_SIZE;
      const color = marker.isCritical ? '#ff4444' : '#ffffff';

      ctx.globalAlpha = opacity;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      this._drawHitX(ctx, sx, sy, arm, spread);

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      this._drawHitX(ctx, sx, sy, arm, spread);
    }

    ctx.restore();
  }

  /**
   * Draw the X shape of a hit marker
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - Center X (world coords)
   * @param {number} y - Center Y (world coords)
   * @param {number} arm - Arm length
   * @param {number} gap - Gap from center
   */
  _drawHitX(ctx, x, y, arm, gap) {
    const d = gap * Math.SQRT1_2; // diagonal offset
    ctx.beginPath();
    ctx.moveTo(x - d, y - d);
    ctx.lineTo(x - d - arm, y - d - arm);
    ctx.moveTo(x + d, y - d);
    ctx.lineTo(x + d + arm, y - d - arm);
    ctx.moveTo(x - d, y + d);
    ctx.lineTo(x - d - arm, y + d + arm);
    ctx.moveTo(x + d, y + d);
    ctx.lineTo(x + d + arm, y + d + arm);
    ctx.stroke();
  }

  /**
   * Add a floating pickup label at a world position.
   * @param {number} x - World X
   * @param {number} y - World Y
   * @param {string} text - Label text, e.g. "+50 gold"
   * @param {string} color - CSS color string
   */
  addPickupLabel(x, y, text, color) {
    this.pickupLabels.push({
      x,
      y,
      text,
      color: color || '#ffd700',
      opacity: 1,
      createdAt: Date.now()
    });
    if (this.pickupLabels.length > 30) {
      this.pickupLabels.shift();
    }
  }

  /** Advance pickup labels (float upward + fade out). Call once per frame. */
  updatePickupLabels() {
    const now = Date.now();
    for (let i = this.pickupLabels.length - 1; i >= 0; i--) {
      const lbl = this.pickupLabels[i];
      const t = (now - lbl.createdAt) / this.PICKUP_LABEL_LIFETIME;
      if (t >= 1) {
        this.pickupLabels.splice(i, 1);
        continue;
      }
      lbl.y -= this.PICKUP_LABEL_FLOAT_SPEED;
      lbl.opacity = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
    }
  }

  /**
   * Render floating pickup labels in world space.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} camera
   */
  renderPickupLabels(ctx, camera) {
    if (!camera || this.pickupLabels.length === 0) {
      return;
    }
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${this.PICKUP_LABEL_FONT_SIZE}px Arial`;
    for (const lbl of this.pickupLabels) {
      if (!camera.isInViewport(lbl.x, lbl.y, 60)) {
        continue;
      }
      ctx.globalAlpha = lbl.opacity;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(lbl.text, lbl.x, lbl.y);
      ctx.fillStyle = lbl.color;
      ctx.fillText(lbl.text, lbl.x, lbl.y);
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
      // Avoid Object.keys() allocation — count with for-in loop
      let currentZombieCount = 0;
      for (const _k in gameState.state.zombies) {
        currentZombieCount++;
      }
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

    const feedEl = this.getUiElement('kill-feed', 'kill-feed');
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

    const safeType = String(type).replace(/[^a-zA-Z0-9_-]/g, '');
    const wrap = document.createElement('div');
    wrap.className = 'kill-feed-text';
    const k = document.createElement('span');
    k.className = 'kill-feed-killer';
    k.textContent = String(killer);
    const sk = document.createElement('span');
    sk.textContent = '\u2620';
    const v = document.createElement('span');
    v.className = `kill-feed-victim ${safeType}`;
    v.textContent = String(victim);
    wrap.append(k, sk, v);
    item.replaceChildren(wrap);

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

  /**
   * Render offscreen boss indicators: red arrow on screen edge pointing to each boss.
   * @param {CanvasRenderingContext2D} ctx - Main canvas context (screen-space, post-pixelRatio scale)
   * @param {object} camera - CameraManager instance
   * @param {object} gameState - Game state
   * @param {number} canvasW - Logical canvas width (CSS pixels)
   * @param {number} canvasH - Logical canvas height (CSS pixels)
   */
  renderBossOffscreenIndicators(ctx, camera, gameState, canvasW, canvasH) {
    if (!camera) {
      return;
    }
    const MARGIN = 28;
    const ARROW = 12;
    const bounds = camera.getViewportBounds(0);
    ctx.save();
    for (const zombie of Object.values(gameState.state.zombies)) {
      if (!zombie.isBoss) {
        continue;
      }
      if (camera.isInViewport(zombie.x, zombie.y, 0)) {
        continue;
      }
      this._drawBossArrow(ctx, zombie, bounds, canvasW, canvasH, MARGIN, ARROW);
    }
    ctx.restore();
  }

  /**
   * Draw a single boss offscreen arrow + distance label.
   */
  _drawBossArrow(ctx, boss, bounds, cW, cH, margin, arrowSize) {
    const cx = (bounds.left + bounds.right) / 2;
    const cy = (bounds.top + bounds.bottom) / 2;
    const dx = boss.x - cx;
    const dy = boss.y - cy;
    const angle = Math.atan2(dy, dx);
    const hw = cW / 2 - margin;
    const hh = cH / 2 - margin;
    const tan = Math.tan(angle);
    let ex, ey;
    if (Math.abs(dy) <= Math.abs(dx)) {
      ex = dx > 0 ? hw : -hw;
      ey = ex * tan;
    } else {
      ey = dy > 0 ? hh : -hh;
      ex = ey / tan;
    }
    ex = Math.max(-hw, Math.min(hw, ex));
    ey = Math.max(-hh, Math.min(hh, ey));
    const sx = cW / 2 + ex;
    const sy = cH / 2 + ey;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);
    ctx.strokeStyle = '#ff2222';
    ctx.fillStyle = 'rgba(255,34,34,0.85)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(arrowSize, 0);
    ctx.lineTo(-arrowSize, -arrowSize * 0.7);
    ctx.lineTo(-arrowSize * 0.4, 0);
    ctx.lineTo(-arrowSize, arrowSize * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    const dist = Math.round(Math.hypot(dx, dy) / 50);
    ctx.rotate(-angle);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 4;
    ctx.fillText(`${dist}m`, 0, arrowSize + 10);
    ctx.restore();
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
