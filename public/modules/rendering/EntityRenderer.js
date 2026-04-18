/**
 * ENTITY RENDERER
 * Handles rendering of players, zombies, bullets, loot, powerups, destructible obstacles
 * @module EntityRenderer
 * @author Claude Code
 * @version 1.0.0
 */

const MAGNET_RADIUS_SQ = 80 * 80; // 6400 — avoids Math.sqrt in magnet loops

const SKIN_COLORS = {
  cyan:   { primary: '#0088ff', secondary: '#0066cc' },
  red:    { primary: '#cc1111', secondary: '#991111' },
  green:  { primary: '#009933', secondary: '#007722' },
  purple: { primary: '#7722cc', secondary: '#551199' },
  gold:   { primary: '#cc9900', secondary: '#aa7700' }
};

const DANGER_AURA_COLORS = {
  explosive: '#ff6a00',
  shooter: '#ffcc00',
  teleporter: '#c266ff',
  summoner: '#ff33aa',
  shielded: '#66ddff',
  poison: '#66ff66',
  tank: '#ff4444'
};

class EntityRenderer {
  /**
   * Fast minimal sprite for perf mode.
   * Replaces 25+ canvas ops per zombie with 7 ops. ~5x faster.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} zombie
   */
  _drawZombieFast(ctx, zombie) {
    const s = zombie.size;
    const x = zombie.x;
    const y = zombie.y;
    const scale = zombie.isBoss ? 1.5 : 1;
    const baseSize = s / 25;
    const bodyW = 18 * baseSize * scale;
    const bodyH = 20 * baseSize * scale;
    const headR = 10 * baseSize * scale;

    // Body
    ctx.fillStyle = zombie.color;
    ctx.fillRect(x - bodyW / 2, y - 5 * baseSize * scale, bodyW, bodyH);

    // Head
    ctx.beginPath();
    ctx.arc(x, y - 10 * baseSize * scale, headR, 0, Math.PI * 2);
    ctx.fill();

    // Eyes (red, no shadow)
    ctx.fillStyle = '#ff0000';
    const eyeOff = 4 * baseSize * scale;
    const eyeSize = zombie.isBoss ? 4 * scale : 2.5 * scale;
    ctx.fillRect(x - eyeOff - eyeSize / 2, y - 13 * baseSize * scale, eyeSize, eyeSize);
    ctx.fillRect(x + eyeOff - eyeSize / 2, y - 13 * baseSize * scale, eyeSize, eyeSize);
  }

  constructor() {
    // Hit flash state: zombieId -> { startTime, duration }
    this._hitFlashes = new Map();

    // Death animation: playerId -> { startTime, x, y, angle, duration }
    this._deathAnimations = new Map();

    // Offscreen sprite cache: cacheKey -> OffscreenCanvas (or regular canvas fallback)
    // Key: "${color}|${isBoss}|${isElite}|${sizeBucket}"
    // LRU eviction: hard cap at 40 sprites
    this._zombieSpriteCache = new Map();
    this._zombieSpriteCacheLRU = new Map(); // key → true, Map insertion order = LRU oldest→newest

    // measureText cache: label string -> pixel width (invalidated on font change)
    this._textWidthCache = new Map();
    this._textWidthCacheFont = '';

    // Style dedup: track last written fillStyle/strokeStyle to skip redundant writes
    this._lastFill = null;
    this._lastStroke = null;

    // Offscreen powerup icon cache: "type|color" -> offscreen canvas (base icon at nominal size)
    this._powerupSpriteCache = new Map();

    // Offscreen player body cache: 'current'|'other' -> offscreen canvas (static torso+head)
    this._playerBodyCache = new Map();

    // Per-frame collections (reused to avoid GC pressure)
    this._visibleZombies = [];
    this._auraBuckets = new Map();

    // Frustum culling stats (reset each frame via resetCullingStats)
    this._culledEntities = 0;
    this._renderedEntities = 0;

    // Magnet pickup: interpolated visual positions per item id
    // Maps: id -> { x, y }
    this._magnetPowerups = new Map();
    this._magnetLoot = new Map();

    // Bullet trail history: bulletId -> [{x,y}] — evicted when bullet removed
    this._bulletsByColor = new Map();
    this._bulletTrailHistory = new Map();

    // darkenColor result cache for renderDestructibleObstacles (cleared each call)
    this._darkenCache = new Map();
  }

  /**
   * Release all caches and pooled data structures.
   * Call when the renderer is no longer needed (e.g. game over / scene teardown).
   */
  destroy() {
    this._hitFlashes.clear();
    this._deathAnimations.clear();
    this._zombieSpriteCache.clear();
    this._zombieSpriteCacheLRU.clear();
    this._textWidthCache.clear();
    this._powerupSpriteCache.clear();
    this._playerBodyCache.clear();
    this._visibleZombies.length = 0;
    this._auraBuckets.clear();
    this._magnetPowerups.clear();
    this._magnetLoot.clear();
    this._bulletsByColor.clear();
    this._bulletTrailHistory.clear();
    this._darkenCache.clear();
  }

  /**
   * Returns (from cache or freshly rendered) an offscreen canvas for a powerup base icon.
   * Renders filled circle + white symbol at nominal size; caller scales via drawImage.
   */
  _getPowerupSprite(type, color, size, symbol) {
    const key = `${type}|${color}`;
    if (this._powerupSpriteCache.has(key)) {
return this._powerupSpriteCache.get(key);
}

    const dim = (size + 2) * 2;
    let offscreen;
    try {
      offscreen = new OffscreenCanvas(dim, dim);
    } catch (_) {
      offscreen = document.createElement('canvas');
      offscreen.width = dim;
      offscreen.height = dim;
    }
    const oc = offscreen.getContext('2d', { willReadFrequently: false });
    const cx = dim / 2;

    oc.fillStyle = color;
    oc.beginPath();
    oc.arc(cx, cx, size, 0, Math.PI * 2);
    oc.fill();
    oc.strokeStyle = '#fff';
    oc.lineWidth = 2;
    oc.stroke();
    oc.fillStyle = '#fff';
    oc.font = 'bold 12px Arial';
    oc.textAlign = 'center';
    oc.textBaseline = 'middle';
    oc.fillText(symbol, cx, cx);

    this._powerupSpriteCache.set(key, offscreen);
    return offscreen;
  }

  /**
   * Returns (from cache or freshly rendered) an offscreen canvas for the static player body.
   * Renders torso + head + hat at 64x64; caller places via drawImage.
   */
  _getPlayerBodySprite(isCurrentPlayer, skinColor) {
    const colorKey = isCurrentPlayer ? (skinColor || 'default') : 'other';
    const key = isCurrentPlayer ? `current|${colorKey}` : 'other';
    if (this._playerBodyCache.has(key)) {
return this._playerBodyCache.get(key);
}

    const dim = 64;
    const cx = dim / 2;
    const cy = dim / 2 + 4;

    let offscreen;
    try {
      offscreen = new OffscreenCanvas(dim, dim);
    } catch (_) {
      offscreen = document.createElement('canvas');
      offscreen.width = dim;
      offscreen.height = dim;
    }
    const oc = offscreen.getContext('2d', { willReadFrequently: false });
    const baseSize = 20 / 20;
    const SKIN_COLORS = {
      cyan: { primary: '#0088ff', border: '#00ffff' },
      red: { primary: '#cc1111', border: '#ff4444' },
      green: { primary: '#009933', border: '#00cc44' },
      purple: { primary: '#7722cc', border: '#aa44ff' },
      gold: { primary: '#cc9900', border: '#ffd700' }
    };
    const sc = isCurrentPlayer ? (SKIN_COLORS[skinColor] || SKIN_COLORS.cyan) : null;
    const primaryColor = isCurrentPlayer ? sc.primary : '#ff8800';
    const borderColor = isCurrentPlayer ? sc.border : '#ffaa00';

    oc.save();
    oc.translate(cx, cy);

    // Body
    const bodyWidth = 16 * baseSize;
    const bodyHeight = 18 * baseSize;
    oc.fillStyle = primaryColor;
    oc.strokeStyle = '#000';
    oc.lineWidth = 1.5;
    oc.fillRect(-bodyWidth / 2, -4 * baseSize, bodyWidth, bodyHeight);
    oc.strokeRect(-bodyWidth / 2, -4 * baseSize, bodyWidth, bodyHeight);
    oc.strokeStyle = borderColor;
    oc.lineWidth = 1;
    oc.beginPath();
    oc.moveTo(0, -4 * baseSize);
    oc.lineTo(0, -4 * baseSize + bodyHeight);
    oc.stroke();

    // Head
    const headRadius = 8 * baseSize;
    oc.fillStyle = '#ffcc99';
    oc.strokeStyle = '#000';
    oc.lineWidth = 1.5;
    oc.beginPath();
    oc.arc(0, -8 * baseSize, headRadius, 0, Math.PI * 2);
    oc.fill();
    oc.stroke();

    // Eyes
    const eyeSize = 2;
    const eyeOffset = 3 * baseSize;
    oc.fillStyle = '#fff';
    oc.beginPath();
    oc.arc(-eyeOffset, -9 * baseSize, eyeSize, 0, Math.PI * 2);
    oc.arc(eyeOffset, -9 * baseSize, eyeSize, 0, Math.PI * 2);
    oc.fill();
    oc.fillStyle = '#000';
    oc.beginPath();
    oc.arc(-eyeOffset, -9 * baseSize, eyeSize / 2, 0, Math.PI * 2);
    oc.arc(eyeOffset, -9 * baseSize, eyeSize / 2, 0, Math.PI * 2);
    oc.fill();

    // Smile
    oc.strokeStyle = '#000';
    oc.lineWidth = 1;
    oc.beginPath();
    oc.arc(0, -6 * baseSize, 3 * baseSize, 0.2, Math.PI - 0.2);
    oc.stroke();

    // Hat
    oc.fillStyle = borderColor;
    oc.beginPath();
    oc.arc(0, -12 * baseSize, headRadius * 0.8, Math.PI, Math.PI * 2);
    oc.fill();

    oc.restore();
    this._playerBodyCache.set(key, offscreen);
    return offscreen;
  }

  /** Reset per-frame culling counters. Call at start of each render frame. */
  resetCullingStats() {
    this._culledEntities = 0;
    this._renderedEntities = 0;
  }

  /** @returns {{ culled: number, rendered: number }} */
  getCullingStats() {
    return { culled: this._culledEntities, rendered: this._renderedEntities };
  }

  /**
   * Set fillStyle only if changed — avoids redundant GPU state writes.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} color
   */
  _setFill(ctx, color) {
    if (this._lastFill !== color) {
      ctx.fillStyle = color;
      this._lastFill = color;
    }
  }

  /**
   * Set strokeStyle only if changed.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} color
   */
  _setStroke(ctx, color) {
    if (this._lastStroke !== color) {
      ctx.strokeStyle = color;
      this._lastStroke = color;
    }
  }

  /**
   * Returns (from cache or freshly rendered) an offscreen canvas sprite
   * for the given zombie's (color, isBoss, isElite, sizeBucket) tuple.
   * Handles OffscreenCanvas fallback and LRU eviction (cap=40).
   * @param {Object} zombie
   * @returns {OffscreenCanvas|HTMLCanvasElement}
   */
  _getOrBuildZombieSprite(zombie) {
    const sizeBucket = Math.round(zombie.size / 4);
    const isElite = zombie.isElite ? 1 : 0;
    const isBoss = zombie.isBoss ? 1 : 0;
    const key = `${zombie.color}|${isBoss}|${isElite}|${sizeBucket}`;

    // LRU hit: move to end (delete + re-insert maintains insertion order)
    if (this._zombieSpriteCache.has(key)) {
      this._zombieSpriteCacheLRU.delete(key);
      this._zombieSpriteCacheLRU.set(key, true);
      return this._zombieSpriteCache.get(key);
    }

    // Evict oldest if at cap
    const SPRITE_CACHE_CAP = 40;
    if (this._zombieSpriteCache.size >= SPRITE_CACHE_CAP) {
      const evictKey = this._zombieSpriteCacheLRU.keys().next().value;
      if (evictKey) {
        this._zombieSpriteCacheLRU.delete(evictKey);
        this._zombieSpriteCache.delete(evictKey);
      }
    }

    // Build sprite: size×2.5 canvas centered on zombie origin
    const s = sizeBucket * 4; // representative size for this bucket
    const scale = isBoss ? 1.5 : 1;
    const baseSize = s / 25;
    const canvasSize = Math.ceil(s * 2.5);
    const cx = canvasSize / 2; // center x in offscreen canvas
    const cy = canvasSize / 2; // center y

    let offscreen;
    try {
      offscreen = new OffscreenCanvas(canvasSize, canvasSize);
    } catch (_) {
      offscreen = document.createElement('canvas');
      offscreen.width = canvasSize;
      offscreen.height = canvasSize;
    }
    const oc = offscreen.getContext('2d', { willReadFrequently: false });
    oc.imageSmoothingEnabled = false;

    // Body
    const bodyW = 18 * baseSize * scale;
    const bodyH = 20 * baseSize * scale;
    oc.fillStyle = zombie.color;
    oc.strokeStyle = '#000';
    oc.lineWidth = isBoss ? 3 : 1.5;
    oc.fillRect(cx - bodyW / 2, cy - 5 * baseSize * scale, bodyW, bodyH);
    oc.strokeRect(cx - bodyW / 2, cy - 5 * baseSize * scale, bodyW, bodyH);

    // Head
    const headR = 10 * baseSize * scale;
    oc.beginPath();
    oc.arc(cx, cy - 10 * baseSize * scale, headR, 0, Math.PI * 2);
    oc.fill();
    oc.stroke();

    // Eyes (no shadow – perf sprite)
    const eyeSize = isBoss ? 4 * scale : 2.5 * scale;
    const eyeOff = 4 * baseSize * scale;
    oc.fillStyle = '#ff0000';
    oc.fillRect(cx - eyeOff - eyeSize / 2, cy - 13 * baseSize * scale, eyeSize, eyeSize);
    oc.fillRect(cx + eyeOff - eyeSize / 2, cy - 13 * baseSize * scale, eyeSize, eyeSize);

    // Boss crown indicator
    if (isBoss) {
      oc.fillStyle = '#ffd700';
      const crownY = cy - 10 * baseSize * scale - headR - 6;
      oc.fillRect(cx - headR * 0.7, crownY, headR * 1.4, 5);
      oc.fillRect(cx - headR * 0.55, crownY - 6, 4, 8);
      oc.fillRect(cx - 2, crownY - 8, 4, 10);
      oc.fillRect(cx + headR * 0.55 - 4, crownY - 6, 4, 8);
    }

    // Elite glow ring
    if (isElite) {
      oc.save();
      oc.strokeStyle = '#ff8c00';
      oc.lineWidth = 2;
      oc.globalAlpha = 0.6;
      oc.beginPath();
      oc.arc(cx, cy, s * 0.7, 0, Math.PI * 2);
      oc.stroke();
      oc.restore();
    }

    this._zombieSpriteCache.set(key, offscreen);
    this._zombieSpriteCacheLRU.set(key, true);
    return offscreen;
  }

  /**
   * Draw zombie via offscreen-canvas blit (fastest path).
   * Uses _getOrBuildZombieSprite for cache lookup/build, then drawImage.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} zombie
   */
  _drawZombieSprited(ctx, zombie) {
    const sprite = this._getOrBuildZombieSprite(zombie);
    const canvasSize = sprite.width;
    ctx.drawImage(sprite, Math.round(zombie.x - canvasSize / 2), Math.round(zombie.y - canvasSize / 2));
  }

  /**
   * Register a short red flash on a zombie when it takes a hit
   * @param {string|number} zombieId
   * @param {number} duration - ms, default 120
   */
  registerHitFlash(zombieId, duration = 120) {
    this._hitFlashes.set(zombieId, { startTime: performance.now(), duration });
  }

  _getHitFlashAlpha(zombieId, now) {
    const flash = this._hitFlashes.get(zombieId);
    if (!flash) {
      return 0;
    }
    const elapsed = now - flash.startTime;
    if (elapsed >= flash.duration) {
      this._hitFlashes.delete(zombieId);
      return 0;
    }
    return 1 - elapsed / flash.duration;
  }

  /**
   * Darken a hex color by a given percentage.
   * @param {string} color - Hex color string e.g. '#ff0000'
   * @param {number} percent - 0–100 darkening amount
   * @returns {string} Darkened hex color
   */
  darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = ((num >> 8) & 0x00ff) - amt;
    const B = (num & 0x0000ff) - amt;
    return (
      '#' +
      (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
      )
        .toString(16)
        .slice(1)
    );
  }

  /**
   * Render all powerup pickups with pulsing glow and magnet interpolation.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} camera
   * @param {Object} powerups - Map of id -> powerup state
   * @param {Object} powerupTypes - Type definitions keyed by type name
   * @param {Object} config - Game config (POWERUP_SIZE)
   * @param {number} now - Current timestamp ms
   * @param {{x:number,y:number}|null} playerPos - For magnet pull
   * @param {boolean} magnetEnabled
   */
  renderPowerups(ctx, camera, powerups, powerupTypes, config, now, playerPos, magnetEnabled) {
    if (!powerups) {
      return;
    }

    now = now || Date.now();

    // Magnet: purge stale ids, lerp active ones toward player
    const MAGNET_LERP = 0.15;
    if (magnetEnabled && playerPos) {
      for (const id in powerups) {
        const p = powerups[id];
        const dx = p.x - playerPos.x;
        const dy = p.y - playerPos.y;
        if (dx * dx + dy * dy < MAGNET_RADIUS_SQ) {
          const prev = this._magnetPowerups.get(id) ?? { x: p.x, y: p.y };
          this._magnetPowerups.set(id, {
            x: prev.x + (playerPos.x - prev.x) * MAGNET_LERP,
            y: prev.y + (playerPos.y - prev.y) * MAGNET_LERP
          });
        } else {
          this._magnetPowerups.delete(id);
        }
      }
      // Purge removed powerups
      for (const id of this._magnetPowerups.keys()) {
        if (!powerups[id]) {
this._magnetPowerups.delete(id);
}
      }
    } else {
      this._magnetPowerups.clear();
    }

    // Hoisted: constant per-frame value and symbol table
    const pulse = Math.sin(now / 200) * 3 + config.POWERUP_SIZE;
    const cullRadius = config.POWERUP_SIZE * 2;
    const symbols = {
      health: '+',
      speed: '»',
      shotgun: 'S',
      machinegun: 'M',
      rocketlauncher: 'R'
    };

    // Hoisted ctx writes that are constant across all powerups
    ctx.lineWidth = 2;
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const powerupId in powerups) {
      const powerup = powerups[powerupId];
      const magPos = this._magnetPowerups.get(powerupId);
      const drawX = magPos ? magPos.x : powerup.x;
      const drawY = magPos ? magPos.y : powerup.y;

      // Cull before reading powerup.type or powerupTypes lookup
      if (!camera.isInViewport(drawX, drawY, cullRadius)) {
        this._culledEntities++;
        continue;
      }
      this._renderedEntities++;

      const type = powerupTypes[powerup.type];
      if (!type) {
        // Skip unknown powerup type — DON'T return, that would abort the whole loop.
        continue;
      }

      // Outer glow ring pulsating for visibility
      const glowAlpha = (Math.sin(now / 400) + 1) / 2;
      ctx.globalAlpha = 0.3 + glowAlpha * 0.5;
      ctx.strokeStyle = type.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(drawX, drawY, pulse + 5 + glowAlpha * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;

      // Blit pre-rendered base icon (circle+symbol), scaled to current pulse radius
      const symbol = symbols[powerup.type] || '?';
      const baseSprite = this._getPowerupSprite(powerup.type, type.color, config.POWERUP_SIZE, symbol);
      const nomDim = (config.POWERUP_SIZE + 2) * 2;
      const scale = (pulse * 2) / nomDim;
      const drawDim = nomDim * scale;
      ctx.drawImage(baseSprite, drawX - drawDim / 2, drawY - drawDim / 2, drawDim, drawDim);
    }
  }

  /**
   * Render all loot coins with rotation, pulse alpha, and magnet pull effect.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} camera
   * @param {Object} loot - Map of id -> loot state
   * @param {Object} config - Game config (LOOT_SIZE)
   * @param {number} now - Current timestamp ms
   * @param {{x:number,y:number}|null} playerPos
   * @param {boolean} magnetEnabled
   */
  renderLoot(ctx, camera, loot, config, now, playerPos, magnetEnabled) {
    if (!loot) {
      return;
    }

    now = now || Date.now();

    // Magnet: lerp loot toward player when within range
    const MAGNET_LERP = 0.15;
    if (magnetEnabled && playerPos) {
      for (const id in loot) {
        const item = loot[id];
        const dx = item.x - playerPos.x;
        const dy = item.y - playerPos.y;
        if (dx * dx + dy * dy < MAGNET_RADIUS_SQ) {
          const prev = this._magnetLoot.get(id) ?? { x: item.x, y: item.y };
          this._magnetLoot.set(id, {
            x: prev.x + (playerPos.x - prev.x) * MAGNET_LERP,
            y: prev.y + (playerPos.y - prev.y) * MAGNET_LERP
          });
        } else {
          this._magnetLoot.delete(id);
        }
      }
      for (const id of this._magnetLoot.keys()) {
        if (!loot[id]) {
this._magnetLoot.delete(id);
}
      }
    } else {
      this._magnetLoot.clear();
    }

    // Hoisted: rotation and pulse are constant for all loot items in this frame
    const LOOT_PULSE_PERIOD = 2000; // ms for one full pulse cycle
    const LOOT_ALPHA_MIN = 0.75;
    const LOOT_ALPHA_MAX = 1.0;
    const LOOT_GLOW_RADIUS_EXTRA = 6; // px extra radius for halo
    const rotation = (now / 500) % (Math.PI * 2);
    const pulseT = (Math.sin((now / LOOT_PULSE_PERIOD) * Math.PI * 2) + 1) / 2; // 0..1
    const pulseAlpha = LOOT_ALPHA_MIN + pulseT * (LOOT_ALPHA_MAX - LOOT_ALPHA_MIN);
    const lootSizeW = config.LOOT_SIZE;
    const lootSizeH = config.LOOT_SIZE * 0.6;
    const glowW = lootSizeW + LOOT_GLOW_RADIUS_EXTRA;
    const glowH = lootSizeH + LOOT_GLOW_RADIUS_EXTRA;

    for (const lootId in loot) {
      const item = loot[lootId];
      const magPos = this._magnetLoot.get(lootId);
      const drawX = magPos ? magPos.x : item.x;
      const drawY = magPos ? magPos.y : item.y;

      // Cull before ctx.save / translate / rotate
      if (!camera.isInViewport(drawX, drawY, 30)) {
        this._culledEntities++;
        continue;
      }
      this._renderedEntities++;

      ctx.save();
      ctx.globalAlpha = pulseAlpha * 0.35; // soft halo at 35% opacity
      ctx.translate(drawX, drawY);
      ctx.rotate(rotation);

      // Glow halo
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.ellipse(0, 0, glowW, glowH, 0, 0, Math.PI * 2);
      ctx.fill();

      // Coin body
      ctx.globalAlpha = pulseAlpha;
      ctx.fillStyle = '#ffd700';
      ctx.strokeStyle = '#ff8c00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, lootSizeW, lootSizeH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }
  }

  /**
   * Render all destructible obstacles (barrels, vases, tires, crates) with health bars.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} camera
   * @param {Object[]} obstacles - Array of obstacle state objects
   */
  renderDestructibleObstacles(ctx, camera, obstacles) {
    if (!obstacles || obstacles.length === 0) {
      return;
    }

    // Cache darkenColor results per base color (reset each call is fine — small set)
    const darkenCache = this._darkenCache;
    darkenCache.clear();
    const getDark = (color, pct) => {
      const key = color + pct;
      let v = darkenCache.get(key);
      if (v === undefined) {
        v = this.darkenColor(color, pct);
        darkenCache.set(key, v);
      }
      return v;
    };

    obstacles.forEach(obstacle => {
      if (obstacle.destroyed) {
        return;
      }

      if (!camera.isInViewport(obstacle.x, obstacle.y, obstacle.width * 2)) {
        this._culledEntities++;
        return;
      }
      this._renderedEntities++;

      ctx.translate(obstacle.x, obstacle.y);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(
        2,
        obstacle.height / 3,
        obstacle.width / 2,
        obstacle.height / 6,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      const baseColor = obstacle.color || '#8B4513';
      ctx.fillStyle = baseColor;
      ctx.strokeStyle = getDark(baseColor, 30);
      ctx.lineWidth = 2;

      if (obstacle.type === 'barrel') {
        ctx.beginPath();
        ctx.ellipse(0, -obstacle.height / 2 + 5, obstacle.width / 2, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillRect(
          -obstacle.width / 2,
          -obstacle.height / 2 + 5,
          obstacle.width,
          obstacle.height - 10
        );
        ctx.strokeRect(
          -obstacle.width / 2,
          -obstacle.height / 2 + 5,
          obstacle.width,
          obstacle.height - 10
        );

        ctx.beginPath();
        ctx.ellipse(0, obstacle.height / 2 - 5, obstacle.width / 2, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = getDark(baseColor, 40);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-obstacle.width / 2, -5);
        ctx.lineTo(obstacle.width / 2, -5);
        ctx.moveTo(-obstacle.width / 2, 5);
        ctx.lineTo(obstacle.width / 2, 5);
        ctx.stroke();
      } else if (obstacle.type === 'vase') {
        ctx.beginPath();
        ctx.moveTo(-obstacle.width / 3, -obstacle.height / 2);
        ctx.lineTo(-obstacle.width / 2, -obstacle.height / 4);
        ctx.lineTo(-obstacle.width / 2, obstacle.height / 4);
        ctx.lineTo(-obstacle.width / 3, obstacle.height / 2);
        ctx.lineTo(obstacle.width / 3, obstacle.height / 2);
        ctx.lineTo(obstacle.width / 2, obstacle.height / 4);
        ctx.lineTo(obstacle.width / 2, -obstacle.height / 4);
        ctx.lineTo(obstacle.width / 3, -obstacle.height / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (obstacle.type === 'tire') {
        ctx.beginPath();
        ctx.ellipse(0, 0, obstacle.width / 2, obstacle.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#444';
        ctx.beginPath();
        ctx.ellipse(0, 0, obstacle.width / 4, obstacle.height / 4, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height);
        ctx.strokeRect(-obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height);

        ctx.strokeStyle = getDark(baseColor, 40);
        ctx.lineWidth = 2;
        // Batch all vertical lines into a single path instead of one stroke per line
        ctx.beginPath();
        for (let i = -obstacle.width / 2 + 10; i < obstacle.width / 2; i += 10) {
          ctx.moveTo(i, -obstacle.height / 2);
          ctx.lineTo(i, obstacle.height / 2);
        }
        ctx.stroke();
      }

      if (obstacle.icon) {
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(obstacle.icon, 0, -obstacle.height / 2 - 15);
      }

      const healthPercent = obstacle.health / obstacle.maxHealth;
      if (healthPercent < 1) {
        const barWidth = obstacle.width;
        const barHeight = 4;
        const barY = -obstacle.height / 2 - 8;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);

        let healthColor = '#00ff00';
        if (healthPercent < 0.3) {
          healthColor = '#ff0000';
        } else if (healthPercent < 0.6) {
          healthColor = '#ffaa00';
        }

        ctx.fillStyle = healthColor;
        ctx.fillRect(-barWidth / 2, barY, barWidth * healthPercent, barHeight);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(-barWidth / 2, barY, barWidth, barHeight);
      }

      ctx.translate(-obstacle.x, -obstacle.y);
    });
  }

  /**
   * Render all bullets with gradient trails, batched by color for minimum state changes.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} camera
   * @param {Object} bullets - Map of id -> bullet state
   * @param {Object} config - Game config (BULLET_SIZE)
   */
  renderBullets(ctx, camera, bullets, config) {
    if (!bullets || !config) {
      return;
    }

    // PERF: reuse instance-level Map + clear per frame instead of new Map() per frame.
    const bulletsByColor = this._bulletsByColor;
    bulletsByColor.clear();
    const defaultColor = '#ffff00';
    const defaultSize = config.BULLET_SIZE || 5;
    const TRAIL_MAX = 7;

    // Evict history for bullets no longer present
    const trailHistory = this._bulletTrailHistory;
    for (const id of trailHistory.keys()) {
      if (!bullets[id]) {
        trailHistory.delete(id);
      }
    }

    for (const id in bullets) {
      const bullet = bullets[id];
      if (!bullet || !Number.isFinite(bullet.x) || !Number.isFinite(bullet.y)) {
        continue;
      }
      if (!camera.isInViewport(bullet.x, bullet.y, 50)) {
        this._culledEntities++;
        continue;
      }
      this._renderedEntities++;

      // Update trail history (tag bullet with its map key for fast lookup)
      bullet._trailId = id;
      let hist = trailHistory.get(id);
      if (!hist) {
        hist = [];
        trailHistory.set(id, hist);
      }
      hist.push({ x: bullet.x, y: bullet.y });
      if (hist.length > TRAIL_MAX) {
        hist.shift();
      }

      const color = bullet.color || defaultColor;
      let arr = bulletsByColor.get(color);
      if (!arr) {
        arr = [];
        bulletsByColor.set(color, arr);
      }
      arr.push(bullet);
    }

    // Draw gradient trails (behind bullets)
    ctx.save();
    ctx.lineCap = 'round';
    for (const [color, colorBullets] of bulletsByColor) {
      for (let i = 0; i < colorBullets.length; i++) {
        const bullet = colorBullets[i];
        const hist = trailHistory.get(bullet._trailId);
        if (!hist || hist.length < 2) {
continue;
}
        const tail = hist[0];
        const head = hist[hist.length - 1];
        if (tail.x === head.x && tail.y === head.y) {
continue;
}
        const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, color);
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = grad;
        ctx.lineWidth = (bullet.size || defaultSize) * 0.9;
        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y);
        for (let j = 1; j < hist.length; j++) {
          ctx.lineTo(hist[j].x, hist[j].y);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // One beginPath + N arc() + one fill per color group
    ctx.shadowBlur = 10;
    for (const [color, colorBullets] of bulletsByColor) {
      ctx.fillStyle = color;
      ctx.shadowColor = color;

      ctx.beginPath();
      for (let i = 0; i < colorBullets.length; i++) {
        const bullet = colorBullets[i];
        const bulletSize = bullet.size || defaultSize;
        ctx.moveTo(bullet.x + bulletSize, bullet.y);
        ctx.arc(bullet.x, bullet.y, bulletSize, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    ctx.shadowBlur = 0;
  }

  /**
   * Draw one zombie sprite (full animated, fast, or sprite-cached path depending on flags).
   * Also draws hit flash overlay if active.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} zombie
   * @param {number} timestamp - high-res timestamp for animations
   * @param {number} [now] - Date.now() value (default: Date.now())
   */
  drawZombieSprite(ctx, zombie, timestamp, now) {
    now = now || Date.now();
    // FASTEST PATH: offscreen-canvas blit.
    // useZombieSpriteCache can be set explicitly. Auto-enables with useZombieFastDraw (perf mode)
    // unless explicitly opted out (=== false). Blits pre-rendered sprites via drawImage —
    // typically 3-10x faster than _drawZombieFast for 30+ zombies on screen.
    const useSpriteCache =
      window.useZombieSpriteCache === true ||
      (window.useZombieFastDraw === true && window.useZombieSpriteCache !== false);
    if (useSpriteCache) {
      this._drawZombieSprited(ctx, zombie);
      return;
    }

    // FAST PATH: simplified immediate-mode sprite (7 ops, no walk anim)
    if (window.useZombieFastDraw === true) {
      this._drawZombieFast(ctx, zombie);
      return;
    }

    ctx.save();
    ctx.translate(zombie.x, zombie.y);

    const walkCycle = Math.sin(timestamp / 200 + zombie.id * 100) * 0.2;
    const scale = zombie.isBoss ? 1.5 : 1;
    const baseSize = zombie.size / 25;

    ctx.fillStyle = zombie.color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = zombie.isBoss ? 3 : 1.5;

    const legWidth = 6 * baseSize * scale;
    const legHeight = 12 * baseSize * scale;
    const legSpacing = 8 * baseSize * scale;

    ctx.save();
    ctx.translate(-legSpacing / 2, 10 * baseSize * scale);
    ctx.rotate(walkCycle);
    ctx.fillRect(-legWidth / 2, 0, legWidth, legHeight);
    ctx.strokeRect(-legWidth / 2, 0, legWidth, legHeight);
    ctx.restore();

    ctx.save();
    ctx.translate(legSpacing / 2, 10 * baseSize * scale);
    ctx.rotate(-walkCycle);
    ctx.fillRect(-legWidth / 2, 0, legWidth, legHeight);
    ctx.strokeRect(-legWidth / 2, 0, legWidth, legHeight);
    ctx.restore();

    const bodyWidth = 18 * baseSize * scale;
    const bodyHeight = 20 * baseSize * scale;
    ctx.fillRect(-bodyWidth / 2, -5 * baseSize * scale, bodyWidth, bodyHeight);
    ctx.strokeRect(-bodyWidth / 2, -5 * baseSize * scale, bodyWidth, bodyHeight);

    const armWidth = 5 * baseSize * scale;
    const armHeight = 14 * baseSize * scale;
    const armOffset = bodyWidth / 2 + 2 * baseSize * scale;

    ctx.save();
    ctx.translate(-armOffset, 0);
    ctx.rotate(-walkCycle * 1.5);
    ctx.fillRect(-armWidth / 2, 0, armWidth, armHeight);
    ctx.strokeRect(-armWidth / 2, 0, armWidth, armHeight);
    ctx.restore();

    ctx.save();
    ctx.translate(armOffset, 0);
    ctx.rotate(walkCycle * 1.5);
    ctx.fillRect(-armWidth / 2, 0, armWidth, armHeight);
    ctx.strokeRect(-armWidth / 2, 0, armWidth, armHeight);
    ctx.restore();

    const headRadius = 10 * baseSize * scale;
    ctx.beginPath();
    ctx.arc(0, -10 * baseSize * scale, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const eyeSize = zombie.isBoss ? 4 * scale : 2.5 * scale;
    const eyeOffset = 4 * baseSize * scale;
    ctx.fillStyle = '#ff0000';
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#ff0000';
    ctx.beginPath();
    ctx.arc(-eyeOffset, -12 * baseSize * scale, eyeSize, 0, Math.PI * 2);
    ctx.arc(eyeOffset, -12 * baseSize * scale, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -6 * baseSize * scale, 4 * baseSize * scale, 0.2, Math.PI - 0.2);
    ctx.stroke();

    this._renderZombieTypeDetails(
      ctx,
      zombie,
      timestamp,
      baseSize,
      scale,
      bodyWidth,
      bodyHeight,
      headRadius,
      armOffset,
      now
    );

    // Hit flash: red tint overlay on the zombie
    const flashAlpha = this._getHitFlashAlpha(zombie.id, timestamp);
    if (flashAlpha > 0) {
      const halfW = bodyWidth / 2 + 4;
      const halfH = bodyHeight / 2 + headRadius + 8;
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(255, 60, 60, ${flashAlpha * 0.75})`;
      ctx.fillRect(-halfW, -halfH, halfW * 2, halfH * 2);
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.restore();
  }

  _renderZombieTypeDetails(
    ctx,
    zombie,
    timestamp,
    baseSize,
    scale,
    bodyWidth,
    bodyHeight,
    headRadius,
    armOffset,
    now
  ) {
    if (zombie.type === 'tank') {
      ctx.fillStyle = '#444';
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1;
      ctx.fillRect(-bodyWidth / 2 - 4, -3 * baseSize * scale, 8, 10);
      ctx.strokeRect(-bodyWidth / 2 - 4, -3 * baseSize * scale, 8, 10);
      ctx.fillRect(bodyWidth / 2 - 4, -3 * baseSize * scale, 8, 10);
      ctx.strokeRect(bodyWidth / 2 - 4, -3 * baseSize * scale, 8, 10);
      ctx.fillRect(-headRadius * 0.8, -16 * baseSize * scale, headRadius * 1.6, 4);
      ctx.strokeRect(-headRadius * 0.8, -16 * baseSize * scale, headRadius * 1.6, 4);
    } else if (zombie.type === 'fast') {
      ctx.strokeStyle = zombie.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-bodyWidth / 2 - 5 - i * 4, -5 + i * 4);
        ctx.lineTo(-bodyWidth / 2 - 12 - i * 4, -5 + i * 4);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (zombie.type === 'explosive') {
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6 + Math.sin(timestamp / 100) * 0.3;
      ctx.beginPath();
      ctx.moveTo(0, -5 * baseSize * scale);
      ctx.lineTo(-5, 0);
      ctx.moveTo(0, -5 * baseSize * scale);
      ctx.lineTo(5, 0);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (zombie.type === 'healer') {
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(0, 0, headRadius + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (zombie.type === 'slower') {
      ctx.strokeStyle = '#8800ff';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(0, 0, headRadius + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (zombie.type === 'poison') {
      const pulseAmount = Math.sin(timestamp / 200) * 0.15;
      ctx.strokeStyle = '#22ff22';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.4 + pulseAmount;
      ctx.beginPath();
      ctx.arc(0, 0, headRadius + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.25 + pulseAmount;
      ctx.beginPath();
      ctx.arc(0, 0, headRadius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#00aa00';
      const dropPositions = [
        { x: -bodyWidth / 3, y: bodyHeight / 4 },
        { x: bodyWidth / 4, y: bodyHeight / 3 },
        { x: 0, y: -bodyHeight / 4 }
      ];
      dropPositions.forEach(pos => {
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y, 2 * scale, 3 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (zombie.type === 'shooter') {
      this._renderShooterDetails(ctx, zombie, baseSize, scale, bodyWidth, armOffset);
    } else if (zombie.type === 'teleporter') {
      this._renderTeleporterDetails(ctx, zombie, baseSize, scale, headRadius, now);
    } else if (zombie.type === 'summoner') {
      this._renderSummonerDetails(ctx, zombie, baseSize, scale, headRadius, now);
    } else if (zombie.type === 'shielded') {
      this._renderShieldedDetails(ctx, zombie, baseSize, scale, headRadius);
    } else if (zombie.type === 'minion') {
      ctx.strokeStyle = '#660066';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, headRadius + 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#660066';
      ctx.font = `${6 * scale}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u221e', 0, -10 * baseSize * scale);
    } else if (zombie.type === 'bossCharnier') {
      this._renderBossCharnierDetails(ctx, zombie, scale, headRadius, now);
    } else if (zombie.type === 'bossInfect') {
      this._renderBossInfectDetails(ctx, baseSize, scale, headRadius, now);
    } else if (zombie.type === 'bossColosse') {
      this._renderBossColosseDetails(
        ctx,
        zombie,
        baseSize,
        scale,
        bodyWidth,
        bodyHeight,
        headRadius,
        now
      );
    } else if (zombie.type === 'bossRoi') {
      this._renderBossRoiDetails(ctx, zombie, baseSize, scale, headRadius, now);
    } else if (zombie.type === 'bossOmega') {
      this._renderBossOmegaDetails(ctx, zombie, baseSize, scale, headRadius, now);
    } else if (zombie.isBoss) {
      ctx.fillStyle = '#ff0000';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8 * scale, -18 * baseSize * scale);
      ctx.lineTo(-6 * scale, -22 * baseSize * scale);
      ctx.lineTo(-3 * scale, -18 * baseSize * scale);
      ctx.lineTo(0, -24 * baseSize * scale);
      ctx.lineTo(3 * scale, -18 * baseSize * scale);
      ctx.lineTo(6 * scale, -22 * baseSize * scale);
      ctx.lineTo(8 * scale, -18 * baseSize * scale);
      ctx.fill();
      ctx.stroke();
    }
  }

  _renderShooterDetails(ctx, _zombie, baseSize, scale, bodyWidth, armOffset) {
    ctx.fillStyle = '#333';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;

    const gunLength = 15 * baseSize * scale;
    const gunWidth = 3 * baseSize * scale;

    ctx.save();
    ctx.translate(armOffset, 8 * baseSize * scale);

    ctx.fillRect(0, -gunWidth / 2, gunLength, gunWidth);
    ctx.strokeRect(0, -gunWidth / 2, gunLength, gunWidth);

    ctx.fillRect(-3 * baseSize * scale, -gunWidth / 2, 5 * baseSize * scale, 8 * baseSize * scale);
    ctx.strokeRect(
      -3 * baseSize * scale,
      -gunWidth / 2,
      5 * baseSize * scale,
      8 * baseSize * scale
    );

    ctx.fillStyle = '#ff3300';
    ctx.beginPath();
    ctx.arc(gunLength, 0, 2 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(-bodyWidth / 2, 2 * baseSize * scale);
    ctx.lineTo(bodyWidth / 2, 2 * baseSize * scale);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  _renderTeleporterDetails(ctx, _zombie, baseSize, scale, headRadius, now) {
    const pulseAmount = Math.sin(now / 150) * 0.2;
    ctx.strokeStyle = '#aa00ff';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#aa00ff';
    ctx.globalAlpha = 0.5 + pulseAmount;

    ctx.beginPath();
    ctx.arc(0, 0, headRadius + 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.3 + pulseAmount;
    ctx.beginPath();
    ctx.arc(0, 0, headRadius + 12, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -5 * baseSize * scale);
    ctx.lineTo(-3, 0);
    ctx.lineTo(0, 0);
    ctx.lineTo(-2, 5 * baseSize * scale);
    ctx.moveTo(0, 0);
    ctx.lineTo(3, 2 * baseSize * scale);
    ctx.stroke();
  }

  _renderSummonerDetails(ctx, _zombie, baseSize, scale, headRadius, now) {
    const pulseAmount = Math.sin(now / 250) * 0.2;
    ctx.strokeStyle = '#00ddff';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#00ddff';
    ctx.globalAlpha = 0.4 + pulseAmount;

    ctx.beginPath();
    ctx.arc(0, 0, headRadius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, headRadius + 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 1.5;
    const runeSize = 3 * baseSize * scale;

    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const x = Math.cos(angle) * runeSize;
      const y = Math.sin(angle) * runeSize + 3 * baseSize * scale;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();
  }

  _renderShieldedDetails(ctx, zombie, baseSize, scale, _headRadius) {
    ctx.save();

    const shieldAngle = zombie.facingAngle || 0;
    ctx.rotate(shieldAngle);

    ctx.fillStyle = '#c0c0c0';
    ctx.strokeStyle = '#808080';
    ctx.lineWidth = 2;

    const shieldWidth = 15 * baseSize * scale;
    const shieldHeight = 25 * baseSize * scale;

    ctx.beginPath();
    ctx.moveTo(0, -shieldHeight / 2);
    ctx.lineTo(shieldWidth, -shieldHeight / 4);
    ctx.lineTo(shieldWidth, shieldHeight / 4);
    ctx.lineTo(0, shieldHeight / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(shieldWidth * 0.6, -shieldHeight / 6, 4 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#a0a0a0';
    ctx.beginPath();
    ctx.arc(shieldWidth * 0.5, 0, 3 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  _renderBossCharnierDetails(ctx, _zombie, scale, headRadius, now) {
    ctx.save();

    const pulseAmount = Math.sin(now / 300) * 0.2;
    ctx.strokeStyle = '#1a0033';
    ctx.lineWidth = 4;
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#1a0033';
    ctx.globalAlpha = 0.6 + pulseAmount;

    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, headRadius + 20 + i * 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#ffffff';
    ctx.font = `${12 * scale}px Arial`;
    const skullPositions = [
      { angle: 0, radius: headRadius + 25 },
      { angle: Math.PI * 0.5, radius: headRadius + 25 },
      { angle: Math.PI, radius: headRadius + 25 },
      { angle: Math.PI * 1.5, radius: headRadius + 25 }
    ];

    skullPositions.forEach(pos => {
      const x = Math.cos(pos.angle + now / 1000) * pos.radius;
      const y = Math.sin(pos.angle + now / 1000) * pos.radius;
      ctx.fillText('\uD83D\uDC80', x, y);
    });

    ctx.restore();
  }

  _renderBossInfectDetails(ctx, baseSize, scale, headRadius, now) {
    ctx.save();

    const pulseAmount = Math.sin(now / 250) * 0.2;
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 5;
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#00ff00';
    ctx.globalAlpha = 0.7 + pulseAmount;

    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, headRadius + 15 + i * 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#00ff00';
    ctx.font = `${15 * scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u2623\uFE0F', 0, 5 * baseSize * scale);

    ctx.restore();
  }

  _renderBossColosseDetails(ctx, zombie, baseSize, scale, bodyWidth, bodyHeight, headRadius, now) {
    ctx.save();

    const isEnraged = zombie.isEnraged || zombie.health / zombie.maxHealth < 0.3;
    const pulseAmount = Math.sin(now / (isEnraged ? 100 : 300)) * 0.3;
    ctx.strokeStyle = isEnraged ? '#ff0000' : '#ff6600';
    ctx.lineWidth = isEnraged ? 6 : 4;
    ctx.shadowBlur = isEnraged ? 35 : 20;
    ctx.shadowColor = isEnraged ? '#ff0000' : '#ff6600';
    ctx.globalAlpha = (isEnraged ? 0.8 : 0.5) + pulseAmount;

    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, headRadius + 18 + i * 12, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#333333';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;

    const plateSize = 6 * scale;
    const positions = [
      { x: -bodyWidth / 3, y: 0 },
      { x: bodyWidth / 3, y: 0 },
      { x: 0, y: -bodyHeight / 4 },
      { x: 0, y: bodyHeight / 4 }
    ];

    positions.forEach(pos => {
      ctx.fillRect(pos.x - plateSize / 2, pos.y - plateSize / 2, plateSize, plateSize);
      ctx.strokeRect(pos.x - plateSize / 2, pos.y - plateSize / 2, plateSize, plateSize);
    });

    ctx.fillStyle = isEnraged ? '#ff0000' : '#ffaa00';
    ctx.font = `${15 * scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\uD83D\uDCAA', 0, 5 * baseSize * scale);

    ctx.restore();
  }

  _renderBossRoiDetails(ctx, zombie, baseSize, scale, headRadius, now) {
    ctx.save();

    const pulseAmount = Math.sin(now / 200) * 0.15;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 5;
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ffd700';
    ctx.globalAlpha = 0.7 + pulseAmount;

    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, headRadius + 20 + i * 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (zombie.phase >= 2) {
      ctx.strokeStyle = '#aa00ff';
      ctx.globalAlpha = 0.5 + pulseAmount;
      ctx.beginPath();
      ctx.arc(0, 0, headRadius + 30, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#ffd700';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();

    const crownPoints = [
      { x: -12 * scale, y: -20 * baseSize * scale },
      { x: -10 * scale, y: -26 * baseSize * scale },
      { x: -6 * scale, y: -20 * baseSize * scale },
      { x: -3 * scale, y: -28 * baseSize * scale },
      { x: 0, y: -20 * baseSize * scale },
      { x: 3 * scale, y: -28 * baseSize * scale },
      { x: 6 * scale, y: -20 * baseSize * scale },
      { x: 10 * scale, y: -26 * baseSize * scale },
      { x: 12 * scale, y: -20 * baseSize * scale }
    ];

    crownPoints.forEach((point, i) => {
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });

    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffd700';
    ctx.font = `${15 * scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\uD83D\uDC51', 0, 5 * baseSize * scale);

    ctx.restore();
  }

  _renderBossOmegaDetails(ctx, zombie, baseSize, scale, headRadius, now) {
    ctx.save();

    const pulseAmount = Math.sin(now / 150) * 0.2;
    const phase = zombie.phase || 1;

    ctx.strokeStyle = '#1a0033';
    ctx.lineWidth = 6;
    ctx.shadowBlur = 40;
    ctx.shadowColor = '#1a0033';
    ctx.globalAlpha = 0.8 + pulseAmount;
    ctx.beginPath();
    ctx.arc(0, 0, headRadius + 35, 0, Math.PI * 2);
    ctx.stroke();

    if (phase >= 2) {
      ctx.strokeStyle = '#aa00ff';
      ctx.shadowColor = '#aa00ff';
      ctx.globalAlpha = 0.7 + pulseAmount;
      ctx.beginPath();
      ctx.arc(0, 0, headRadius + 30, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (phase >= 3) {
      ctx.strokeStyle = '#00ff00';
      ctx.shadowColor = '#00ff00';
      ctx.globalAlpha = 0.7 + pulseAmount;
      ctx.beginPath();
      ctx.arc(0, 0, headRadius + 25, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (phase >= 4) {
      ctx.strokeStyle = '#ff0000';
      ctx.shadowColor = '#ff0000';
      ctx.globalAlpha = 0.9 + pulseAmount;
      ctx.beginPath();
      ctx.arc(0, 0, headRadius + 20, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.font = `bold ${20 * scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText('\u03A9', 0, 5 * baseSize * scale);
    ctx.fillText('\u03A9', 0, 5 * baseSize * scale);

    ctx.fillStyle = '#ffffff';
    ctx.font = `${10 * scale}px Arial`;
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI * 2) / 6 + now / 1000;
      const x = Math.cos(angle) * (headRadius + 40);
      const y = Math.sin(angle) * (headRadius + 40);
      ctx.fillText('\u2605', x, y);
    }

    ctx.restore();
  }

  /**
   * Render all visible zombies: sprites, health bars, elite/boss overlays, batched auras.
   * Applies frustum culling and Y-sorts for correct painter's-algorithm depth order.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} camera
   * @param {Object} zombies - Map of id -> zombie state
   * @param {number} [timestamp] - high-res animation timestamp
   */
  renderZombies(ctx, camera, zombies, timestamp) {
    timestamp = timestamp || performance.now();
    const now = Date.now();

    // Collect visible zombies + batch auras by color to minimize state changes
    // Reset style dedup cache: drawZombieSprite may call ctx.restore() which
    // changes fillStyle/strokeStyle without going through _setFill/_setStroke.
    this._lastFill = null;
    this._lastStroke = null;
    const visibleZombies = this._visibleZombies;
    const auraBuckets = this._auraBuckets;
    visibleZombies.length = 0;
    auraBuckets.clear();

    for (const zombieId in zombies) {
      const zombie = zombies[zombieId];
      if (!zombie || zombie.health <= 0 || !Number.isFinite(zombie.x) || !Number.isFinite(zombie.y)) {
        continue;
      }
      const cullMargin = zombie.isBoss ? zombie.size * 4 : zombie.size * 2;
      if (!camera.isInViewport(zombie.x, zombie.y, cullMargin)) {
        this._culledEntities++;
        continue;
      }
      this._renderedEntities++;
      visibleZombies.push(zombie);

      // Accumulate aura batches (non-elite, non-boss with known danger type)
      if (!zombie.isElite && !zombie.isBoss) {
        const auraColor = DANGER_AURA_COLORS[zombie.type];
        if (auraColor) {
          let bucket = auraBuckets.get(auraColor);
          if (!bucket) {
            bucket = [];
            auraBuckets.set(auraColor, bucket);
          }
          bucket.push(zombie);
        }
      }
    }

    // Y-sort for correct depth (painter's algorithm: higher Y = drawn later = in front)
    visibleZombies.sort((a, b) => a.y - b.y);

    // Draw sprites + per-zombie overlays
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < visibleZombies.length; i++) {
      const zombie = visibleZombies[i];
      this.drawZombieSprite(ctx, zombie, timestamp, now);
      this._renderZombieOverlay(ctx, zombie, timestamp, now);
    }

    this._renderAuraBatch(ctx, auraBuckets, timestamp);
  }

  /**
   * Draw health bar, elite glow, boss name label, and special indicator for one zombie.
   * Called once per visible zombie inside renderZombies.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} zombie
   * @param {number} timestamp
   * @param {number} now
   */
  _renderZombieOverlay(ctx, zombie, timestamp, now) {
    if (window.gameSettings?.showZombieOutlines) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = zombie.isBoss ? 4 : 2;
      ctx.beginPath();
      ctx.arc(zombie.x, zombie.y, zombie.size * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (zombie.maxHealth && zombie.health !== null && zombie.health !== undefined) {
      const healthPercent = Math.max(0, Math.min(1, zombie.health / zombie.maxHealth));
      const barWidth = zombie.size * 1.6;
      const barY = zombie.y - zombie.size - 10;
      const barColor = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000';
      this._setFill(ctx, barColor);
      ctx.fillRect(zombie.x - barWidth / 2, barY, barWidth * healthPercent, 5);
      this._setStroke(ctx, '#fff');
      ctx.lineWidth = 1;
      ctx.strokeRect(zombie.x - barWidth / 2, barY, barWidth, 5);
    }

    if (zombie.isElite) {
      ctx.globalAlpha = 0.4 + Math.sin(timestamp / 200) * 0.2;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ffd700';
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(zombie.x, zombie.y, zombie.size + 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffd700';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.font = 'bold 20px Arial';
      ctx.strokeText('\uD83D\uDC51', zombie.x, zombie.y - zombie.size - 35);
      ctx.fillText('\uD83D\uDC51', zombie.x, zombie.y - zombie.size - 35);
    }

    if (zombie.isBoss) {
      const bossName = CONSTANTS.BOSS_NAMES[zombie.type] || 'BOSS';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px Arial';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(bossName, zombie.x, zombie.y - zombie.size - 25);
      ctx.fillText(bossName, zombie.x, zombie.y - zombie.size - 25);
    }

    this.renderZombieSpecialIndicator(ctx, zombie, now);
  }

  /**
   * Render one batched pass of danger-aura rings (one stroke call per color).
   * @param {CanvasRenderingContext2D} ctx
   * @param {Map<string,Object[]>} auraBuckets
   * @param {number} timestamp
   */
  _renderAuraBatch(ctx, auraBuckets, timestamp) {
    const auraPulse = 0.25 + Math.sin(timestamp / 220) * 0.1;
    ctx.lineWidth = 2;
    for (const [auraColor, bucket] of auraBuckets) {
      ctx.globalAlpha = auraPulse;
      ctx.shadowBlur = 12;
      ctx.shadowColor = auraColor;
      ctx.strokeStyle = auraColor;
      ctx.beginPath();
      for (let i = 0; i < bucket.length; i++) {
        const z = bucket[i];
        ctx.moveTo(z.x + z.size + 8, z.y);
        ctx.arc(z.x, z.y, z.size + 8, 0, Math.PI * 2);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  /**
   * Draw the emoji/ring indicator for special zombie types (explosive, healer, poison, etc.).
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} zombie
   * @param {number} [now] - Date.now() value
   */
  renderZombieSpecialIndicator(ctx, zombie, now) {
    now = now || Date.now();

    if (zombie.type === 'explosive') {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeText('\uD83D\uDCA3', zombie.x, zombie.y);
      ctx.fillText('\uD83D\uDCA3', zombie.x, zombie.y);
    } else if (zombie.type === 'healer') {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(zombie.x, zombie.y, zombie.size + 10 + Math.sin(now / 200) * 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeText('+', zombie.x, zombie.y);
      ctx.fillText('+', zombie.x, zombie.y);
    } else if (zombie.type === 'slower') {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#8800ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(zombie.x, zombie.y, zombie.size + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeText('\u23F1', zombie.x, zombie.y);
      ctx.fillText('\u23F1', zombie.x, zombie.y);
    } else if (zombie.type === 'poison') {
      ctx.save();
      ctx.globalAlpha = 0.4 + Math.sin(now / 200) * 0.15;
      ctx.strokeStyle = '#22ff22';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(zombie.x, zombie.y, zombie.size + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#22ff22';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeText('\u2620', zombie.x, zombie.y);
      ctx.fillText('\u2620', zombie.x, zombie.y);
    } else if (zombie.type === 'teleporter') {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(now / 150) * 0.2;
      ctx.strokeStyle = '#9900ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(zombie.x, zombie.y, zombie.size + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#9900ff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.font = 'bold 18px Arial';
      ctx.strokeText('\u26A1', zombie.x, zombie.y);
      ctx.fillText('\u26A1', zombie.x, zombie.y);
    } else if (zombie.type === 'summoner') {
      this._renderSummonerIndicator(ctx, zombie, now);
    } else if (zombie.type === 'shielded') {
      this._renderShieldedIndicator(ctx, zombie);
    } else if (zombie.type === 'minion') {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#ff99ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(zombie.x, zombie.y, zombie.size + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (zombie.type === 'berserker') {
      this._renderBerserkerIndicator(ctx, zombie, now);
    } else if (zombie.type === 'bossCharnier') {
      this._renderBossCharnierIndicator(ctx, zombie, now);
    } else if (zombie.type === 'bossInfect') {
      this._renderBossInfectIndicator(ctx, zombie, now);
    } else if (zombie.type === 'bossColosse') {
      this._renderBossColosseIndicator(ctx, zombie, now);
    } else if (zombie.type === 'bossRoi') {
      this._renderBossRoiIndicator(ctx, zombie, now);
    } else if (zombie.type === 'bossOmega') {
      this._renderBossOmegaIndicator(ctx, zombie, now);
    }
  }

  _renderSummonerIndicator(ctx, zombie, now) {
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(now / 180) * 0.15;
    ctx.strokeStyle = '#cc00ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(zombie.x, zombie.y, zombie.size + 14 + Math.sin(now / 250) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#cc00ff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.font = 'bold 18px Arial';
    ctx.strokeText('\uD83D\uDD2E', zombie.x, zombie.y);
    ctx.fillText('\uD83D\uDD2E', zombie.x, zombie.y);

    if (zombie.minionCount > 0) {
      ctx.font = 'bold 10px Arial';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeText(
        `${zombie.minionCount}`,
        zombie.x + zombie.size * 0.6,
        zombie.y - zombie.size * 0.6
      );
      ctx.fillText(
        `${zombie.minionCount}`,
        zombie.x + zombie.size * 0.6,
        zombie.y - zombie.size * 0.6
      );
    }
  }

  _renderShieldedIndicator(ctx, zombie) {
    if (zombie.facingAngle !== null && zombie.facingAngle !== undefined) {
      ctx.save();
      ctx.translate(zombie.x, zombie.y);
      ctx.rotate(zombie.facingAngle);

      ctx.strokeStyle = '#00ccff';
      ctx.fillStyle = 'rgba(0, 204, 255, 0.3)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const shieldRadius = zombie.size + 10;
      ctx.arc(0, 0, shieldRadius, -Math.PI / 4, Math.PI / 4);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    ctx.fillStyle = '#00ccff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.font = 'bold 18px Arial';
    ctx.strokeText('\uD83D\uDEE1\uFE0F', zombie.x, zombie.y);
    ctx.fillText('\uD83D\uDEE1\uFE0F', zombie.x, zombie.y);
  }

  _renderBerserkerIndicator(ctx, zombie, now) {
    if (zombie.isExtremeRaged) {
      ctx.save();
      ctx.globalAlpha = 0.6 + Math.sin(now / 100) * 0.3;
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(zombie.x, zombie.y, zombie.size + 15 + Math.sin(now / 150) * 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#ff4400';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(zombie.x, zombie.y, zombie.size + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.font = 'bold 20px Arial';
      ctx.strokeText('\u2694\uFE0F', zombie.x, zombie.y);
      ctx.fillText('\u2694\uFE0F', zombie.x, zombie.y);
    } else if (zombie.isRaged) {
      ctx.save();
      ctx.globalAlpha = 0.4 + Math.sin(now / 180) * 0.2;
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(zombie.x, zombie.y, zombie.size + 10 + Math.sin(now / 200) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#ff6600';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.font = 'bold 18px Arial';
      ctx.strokeText('\uD83D\uDCA2', zombie.x, zombie.y);
      ctx.fillText('\uD83D\uDCA2', zombie.x, zombie.y);
    } else {
      ctx.fillStyle = '#ff6600';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.font = 'bold 16px Arial';
      ctx.strokeText('\uD83D\uDCAA', zombie.x, zombie.y);
      ctx.fillText('\uD83D\uDCAA', zombie.x, zombie.y);
    }

    if (zombie.isDashing) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ff4400';
      ctx.lineWidth = zombie.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const dashTrailLength = 40;
      const trailX = zombie.x - Math.cos(zombie.dashAngle || 0) * dashTrailLength;
      const trailY = zombie.y - Math.sin(zombie.dashAngle || 0) * dashTrailLength;
      ctx.moveTo(trailX, trailY);
      ctx.lineTo(zombie.x, zombie.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  _renderBossCharnierIndicator(ctx, zombie, now) {
    ctx.save();
    ctx.globalAlpha = 0.3 + Math.sin(now / 150) * 0.2;
    ctx.strokeStyle = '#8b0000';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(zombie.x, zombie.y, zombie.size + 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.font = 'bold 24px Arial';
    ctx.strokeText('\uD83D\uDC80', zombie.x, zombie.y);
    ctx.fillText('\uD83D\uDC80', zombie.x, zombie.y);

    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#8b0000';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText('RAIIVY', zombie.x, zombie.y - zombie.size - 40);
    ctx.fillText('RAIIVY', zombie.x, zombie.y - zombie.size - 40);
  }

  _renderBossInfectIndicator(ctx, zombie, now) {
    ctx.save();
    ctx.globalAlpha = 0.4 + Math.sin(now / 200) * 0.2;
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(zombie.x, zombie.y, zombie.size + 25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#00ff00';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.font = 'bold 26px Arial';
    ctx.strokeText('\u2623\uFE0F', zombie.x, zombie.y);
    ctx.fillText('\u2623\uFE0F', zombie.x, zombie.y);

    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#00ff00';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText('SORENZA', zombie.x, zombie.y - zombie.size - 40);
    ctx.fillText('SORENZA', zombie.x, zombie.y - zombie.size - 40);
  }

  _renderBossColosseIndicator(ctx, zombie, now) {
    const isEnraged = zombie.isEnraged;
    const auraColor = isEnraged ? '#ff0000' : '#ff4500';

    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(now / (isEnraged ? 100 : 180)) * 0.3;
    ctx.strokeStyle = auraColor;
    ctx.lineWidth = isEnraged ? 8 : 5;
    ctx.beginPath();
    ctx.arc(zombie.x, zombie.y, zombie.size + (isEnraged ? 30 : 20), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = auraColor;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.font = 'bold 28px Arial';
    ctx.strokeText(isEnraged ? '\uD83D\uDCA2' : '\uD83D\uDCAA', zombie.x, zombie.y);
    ctx.fillText(isEnraged ? '\uD83D\uDCA2' : '\uD83D\uDCAA', zombie.x, zombie.y);

    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = auraColor;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    const name = isEnraged ? 'HAIER ENRAG\u00C9' : 'HAIER';
    ctx.strokeText(name, zombie.x, zombie.y - zombie.size - 40);
    ctx.fillText(name, zombie.x, zombie.y - zombie.size - 40);
  }

  _renderBossRoiIndicator(ctx, zombie, now) {
    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(now / 120) * 0.3;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(zombie.x, zombie.y, zombie.size + 25, 0, Math.PI * 2);
    ctx.stroke();

    if (zombie.phase >= 2) {
      ctx.strokeStyle = '#ffaa00';
      ctx.beginPath();
      ctx.arc(zombie.x, zombie.y, zombie.size + 35, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = '#ffd700';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.font = 'bold 30px Arial';
    ctx.strokeText('\uD83D\uDC51', zombie.x, zombie.y);
    ctx.fillText('\uD83D\uDC51', zombie.x, zombie.y);

    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#ffd700';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    const phaseName = `KUROI TO SUTA (Phase ${zombie.phase || 1})`;
    ctx.strokeText(phaseName, zombie.x, zombie.y - zombie.size - 40);
    ctx.fillText(phaseName, zombie.x, zombie.y - zombie.size - 40);
  }

  _renderBossOmegaIndicator(ctx, zombie, now) {
    const phaseColors = ['#ff00ff', '#ff0088', '#8800ff', '#ff0000'];
    const currentColor = phaseColors[(zombie.phase || 1) - 1];

    ctx.save();
    ctx.globalAlpha = 0.6 + Math.sin(now / 80) * 0.4;
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(zombie.x, zombie.y, zombie.size + 30, 0, Math.PI * 2);
    ctx.stroke();

    if (zombie.phase >= 2) {
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(zombie.x, zombie.y, zombie.size + 45, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (zombie.phase >= 3) {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(zombie.x, zombie.y, zombie.size + 60, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = currentColor;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.font = 'bold 32px Arial';
    ctx.strokeText('\u03A9', zombie.x, zombie.y + 5);
    ctx.fillText('\u03A9', zombie.x, zombie.y + 5);

    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = currentColor;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    const omegaName = `MORGANNITO (Phase ${zombie.phase || 1}/4)`;
    ctx.strokeText(omegaName, zombie.x, zombie.y - zombie.size - 40);
    ctx.fillText(omegaName, zombie.x, zombie.y - zombie.size - 40);
  }

  /**
   * Draw the name label above a player, with rounded background bubble.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {string} text - Label to display
   * @param {boolean} isCurrentPlayer
   * @param {number} [offsetY] - Y offset above player center (default -40)
   */
  renderPlayerNameBubble(ctx, x, y, text, isCurrentPlayer, offsetY) {
    offsetY = offsetY || -40;

    const font = 'bold 14px Arial';
    ctx.font = font;
    if (this._textWidthCacheFont !== font) {
      this._textWidthCache.clear();
      this._textWidthCacheFont = font;
    }
    let textWidth = this._textWidthCache.get(text);
    if (textWidth === undefined) {
      textWidth = ctx.measureText(text).width;
      if (this._textWidthCache.size > 64) {
        this._textWidthCache.clear();
      }
      this._textWidthCache.set(text, textWidth);
    }

    const paddingX = 12;
    const bubbleWidth = textWidth + paddingX * 2;
    const bubbleHeight = 24;
    const borderRadius = 12;

    const bubbleX = x - bubbleWidth / 2;
    const bubbleY = y + offsetY - bubbleHeight / 2;

    ctx.fillStyle = isCurrentPlayer ? 'rgba(0, 136, 255, 0.9)' : 'rgba(255, 136, 0, 0.9)';
    ctx.beginPath();
    ctx.moveTo(bubbleX + borderRadius, bubbleY);
    ctx.lineTo(bubbleX + bubbleWidth - borderRadius, bubbleY);
    ctx.arcTo(
      bubbleX + bubbleWidth,
      bubbleY,
      bubbleX + bubbleWidth,
      bubbleY + borderRadius,
      borderRadius
    );
    ctx.lineTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight - borderRadius);
    ctx.arcTo(
      bubbleX + bubbleWidth,
      bubbleY + bubbleHeight,
      bubbleX + bubbleWidth - borderRadius,
      bubbleY + bubbleHeight,
      borderRadius
    );
    ctx.lineTo(bubbleX + borderRadius, bubbleY + bubbleHeight);
    ctx.arcTo(
      bubbleX,
      bubbleY + bubbleHeight,
      bubbleX,
      bubbleY + bubbleHeight - borderRadius,
      borderRadius
    );
    ctx.lineTo(bubbleX, bubbleY + borderRadius);
    ctx.arcTo(bubbleX, bubbleY, bubbleX + borderRadius, bubbleY, borderRadius);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = isCurrentPlayer ? '#00ffff' : '#ffaa00';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + offsetY);
  }

  renderWeaponSprite(ctx, x, y, angle, weaponType, isCurrentPlayer) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const primaryColor = isCurrentPlayer ? '#333333' : '#444444';
    const accentColor = isCurrentPlayer ? '#00ffff' : '#ffaa00';

    switch (weaponType) {
      case 'pistol':
        this._renderPistol(ctx, primaryColor, accentColor);
        break;
      case 'shotgun':
        this._renderShotgun(ctx, primaryColor, accentColor);
        break;
      case 'machinegun':
        this._renderMachinegun(ctx, primaryColor, accentColor);
        break;
      case 'rocketlauncher':
        this._renderRocketLauncher(ctx, primaryColor, accentColor);
        break;
      default:
        this._renderPistol(ctx, primaryColor, accentColor);
    }

    ctx.restore();
  }

  _renderPistol(ctx, primaryColor, accentColor) {
    ctx.fillStyle = primaryColor;
    ctx.fillRect(5, -3, 18, 6);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(5, -3, 18, 6);

    ctx.fillStyle = '#222';
    ctx.fillRect(23, -2, 8, 4);
    ctx.strokeRect(23, -2, 8, 4);

    ctx.fillStyle = primaryColor;
    ctx.fillRect(5, 3, 6, 8);
    ctx.strokeRect(5, 3, 6, 8);

    ctx.fillStyle = accentColor;
    ctx.fillRect(15, -1, 3, 2);
  }

  _renderShotgun(ctx, primaryColor, accentColor) {
    ctx.fillStyle = primaryColor;
    ctx.fillRect(5, -4, 25, 8);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(5, -4, 25, 8);

    ctx.fillStyle = '#222';
    ctx.fillRect(30, -4, 12, 3);
    ctx.fillRect(30, 1, 12, 3);
    ctx.strokeRect(30, -4, 12, 3);
    ctx.strokeRect(30, 1, 12, 3);

    ctx.fillStyle = '#8B4513';
    ctx.fillRect(-5, -3, 10, 6);
    ctx.strokeRect(-5, -3, 10, 6);

    ctx.fillStyle = accentColor;
    ctx.fillRect(12, -2, 8, 4);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(12, -2, 8, 4);

    ctx.fillStyle = '#ff6600';
    ctx.fillRect(40, -3, 2, 1);
    ctx.fillRect(40, 2, 2, 1);
  }

  _renderMachinegun(ctx, primaryColor, accentColor) {
    ctx.fillStyle = primaryColor;
    ctx.fillRect(0, -5, 30, 10);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, -5, 30, 10);

    ctx.fillStyle = '#222';
    ctx.fillRect(30, -3, 15, 6);
    ctx.strokeRect(30, -3, 15, 6);

    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#00ffff';
      ctx.fillRect(32 + i * 3, -2, 1, 4);
    }

    ctx.fillStyle = '#444';
    ctx.fillRect(10, 5, 8, 12);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(10, 5, 8, 12);

    ctx.fillStyle = '#333';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, -3);
    ctx.lineTo(-12, -5);
    ctx.lineTo(-12, 5);
    ctx.lineTo(-5, 3);
    ctx.stroke();

    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(45, 0, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = accentColor;
    ctx.fillRect(5, -3, 2, 6);
    ctx.fillRect(20, -3, 2, 6);
  }

  _renderRocketLauncher(ctx, primaryColor, accentColor) {
    ctx.fillStyle = '#444';
    ctx.fillRect(0, -7, 40, 14);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, -7, 40, 14);

    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#ffff00' : '#000';
      ctx.fillRect(8 + i * 8, -6, 6, 12);
    }

    ctx.fillStyle = '#333';
    ctx.fillRect(5, -10, 30, 3);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(5, -10, 30, 3);

    ctx.fillStyle = '#222';
    ctx.fillRect(40, -6, 8, 12);
    ctx.strokeRect(40, -6, 8, 12);

    ctx.fillStyle = '#ff4400';
    ctx.fillRect(40, -7, 2, 14);
    ctx.fillRect(46, -7, 2, 14);

    ctx.fillStyle = '#333';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(15, 7);
    ctx.lineTo(15, 12);
    ctx.lineTo(20, 12);
    ctx.lineTo(20, 7);
    ctx.stroke();

    ctx.fillStyle = primaryColor;
    ctx.fillRect(-3, 2, 5, 10);
    ctx.strokeRect(-3, 2, 5, 10);

    ctx.fillStyle = '#ff0000';
    ctx.fillRect(38, -8, 3, 2);
    ctx.fillRect(38, 6, 3, 2);

    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(10, 0, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#666';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(-8 - i * 3, -4 + i * 2, 5, 2);
    }

    ctx.fillStyle = accentColor;
    ctx.fillRect(2, -5, 3, 10);
  }

  /**
   * Draw the animated player sprite (legs, arms, body blit) at the player's world position.
   * Handles idle bob, walk cycle, and skin color.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} player - Player state with x, y, vx, vy
   * @param {boolean} isCurrentPlayer
   * @param {number} timestamp
   */
  drawPlayerSprite(ctx, player, isCurrentPlayer, timestamp) {
    const vx = player.vx || 0, vy = player.vy || 0;
    const isMoving = vx * vx + vy * vy > 0.25; // 0.5² — skip Math.sqrt
    const idleBob = isMoving ? 0 : Math.sin(timestamp / 600) * 1.5;
    const walkCycle = isMoving ? Math.sin(timestamp / 150) * 0.3 : Math.sin(timestamp / 700) * 0.07;

    const activeSkin = isCurrentPlayer ? localStorage.getItem('pref_skin') || 'cyan' : null;
    const sc2 = isCurrentPlayer ? (SKIN_COLORS[activeSkin] || SKIN_COLORS.cyan) : null;
    const secondaryColor = isCurrentPlayer ? sc2.secondary : '#cc6600';
    const primaryColor = isCurrentPlayer ? sc2.primary : '#ff8800';

    ctx.save();
    ctx.translate(player.x, player.y + idleBob);
    const baseSize = 20 / 20;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;

    this._drawPlayerLegsAndArms(ctx, baseSize, secondaryColor, primaryColor, walkCycle, isMoving);

    // Blit pre-rendered static body (torso + head + hat) — replaces ~20 canvas primitives
    const bodySprite = this._getPlayerBodySprite(isCurrentPlayer, activeSkin);
    const dim = 64;
    ctx.drawImage(bodySprite, -dim / 2, -dim / 2 - 4, dim, dim);
    ctx.restore();
  }

  /**
   * Draw animated legs and arms for the player sprite (called from drawPlayerSprite).
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} baseSize
   * @param {string} secondaryColor
   * @param {string} primaryColor
   * @param {number} walkCycle
   * @param {boolean} isMoving
   */
  _drawPlayerLegsAndArms(ctx, baseSize, secondaryColor, primaryColor, walkCycle, isMoving) {
    const legWidth = 5 * baseSize;
    const legHeight = 10 * baseSize;
    const legSpacing = 7 * baseSize;

    ctx.save();
    ctx.translate(-legSpacing / 2, 8 * baseSize);
    ctx.rotate(walkCycle);
    ctx.fillStyle = secondaryColor;
    ctx.fillRect(-legWidth / 2, 0, legWidth, legHeight);
    ctx.strokeRect(-legWidth / 2, 0, legWidth, legHeight);
    ctx.fillStyle = '#222';
    ctx.fillRect(-legWidth / 2, legHeight - 2, legWidth, 2);
    ctx.restore();

    ctx.save();
    ctx.translate(legSpacing / 2, 8 * baseSize);
    ctx.rotate(-walkCycle);
    ctx.fillStyle = secondaryColor;
    ctx.fillRect(-legWidth / 2, 0, legWidth, legHeight);
    ctx.strokeRect(-legWidth / 2, 0, legWidth, legHeight);
    ctx.fillStyle = '#222';
    ctx.fillRect(-legWidth / 2, legHeight - 2, legWidth, 2);
    ctx.restore();

    const armWidth = 4 * baseSize;
    const armHeight = 12 * baseSize;
    const bodyWidth = 16 * baseSize;
    const armOffset = bodyWidth / 2 + 1 * baseSize;

    ctx.fillStyle = primaryColor;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;

    ctx.save();
    ctx.translate(-armOffset, 0);
    ctx.rotate(isMoving ? -walkCycle * 1.2 : -0.2);
    ctx.fillRect(-armWidth / 2, 0, armWidth, armHeight);
    ctx.strokeRect(-armWidth / 2, 0, armWidth, armHeight);
    ctx.fillStyle = '#ffcc99';
    ctx.beginPath();
    ctx.arc(0, armHeight, armWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(armOffset, 0);
    ctx.rotate(isMoving ? walkCycle * 1.2 : 0.2);
    ctx.fillRect(-armWidth / 2, 0, armWidth, armHeight);
    ctx.strokeRect(-armWidth / 2, 0, armWidth, armHeight);
    ctx.fillStyle = '#ffcc99';
    ctx.beginPath();
    ctx.arc(0, armHeight, armWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  renderPlayers(ctx, camera, players, currentPlayerId, config, dateNow, timestamp) {
    dateNow = dateNow || Date.now();
    timestamp = timestamp || performance.now();

    // Hoisted: constant across all players this frame
    const cullMargin = config.PLAYER_SIZE * 3;
    const healthBarY_offset = config.PLAYER_SIZE + 5;
    const nameBubbleOffset = -config.PLAYER_SIZE - 25;

    // for-in avoids Object.entries() array allocation; hasOwnProperty not needed here
    // (players object is a plain data map from server)
    for (const pid in players) {
      const p = players[pid];
      const isCurrentPlayer = pid === currentPlayerId;

      if (!p.alive) {
        // Trigger death animation once per death
        if (!this._deathAnimations.has(pid)) {
          this._deathAnimations.set(pid, { startTime: timestamp, x: p.x, y: p.y, duration: 800 });
        }
        const da = this._deathAnimations.get(pid);
        const t = Math.min(1, (timestamp - da.startTime) / da.duration);
        if (t < 1) {
          // easeIn fade + clockwise fall rotation
          const alpha = 1 - t * t;
          const rot = t * Math.PI * 0.5;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(da.x, da.y);
          ctx.rotate(rot);
          this.drawPlayerSprite(ctx, { ...p, x: 0, y: 0 }, isCurrentPlayer, timestamp);
          ctx.restore();
          ctx.globalAlpha = 1;
        } else {
          this._deathAnimations.delete(pid);
        }
        continue;
      }
      // Clear stale death entry when player respawns
      this._deathAnimations.delete(pid);

      if (!p.hasNickname && !isCurrentPlayer) {
        continue;
      }

      // Cull non-local players before any draw work
      if (!isCurrentPlayer && !camera.isInViewport(p.x, p.y, cullMargin)) {
        this._culledEntities++;
        continue;
      }
      this._renderedEntities++;

      if (p.speedBoost && dateNow < p.speedBoost) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00ffff';

        if (isCurrentPlayer && window.screenEffects) {
          window.screenEffects.createSpeedTrail(p.x, p.y);
        }
      }

      this.drawPlayerSprite(ctx, p, isCurrentPlayer, timestamp);

      ctx.shadowBlur = 0;

      const weaponType = p.weapon || 'pistol';
      this.renderWeaponSprite(ctx, p.x, p.y, p.angle, weaponType, isCurrentPlayer);

      const nickname = p.nickname || (isCurrentPlayer ? 'Vous' : 'Joueur');
      const playerLabel = `${nickname} (Lv${p.level || 1})`;
      this.renderPlayerNameBubble(ctx, p.x, p.y, playerLabel, isCurrentPlayer, nameBubbleOffset);

      const healthPercent = p.health / p.maxHealth;
      ctx.fillStyle =
        healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000';
      ctx.fillRect(p.x - 20, p.y + healthBarY_offset, 40 * healthPercent, 5);
      // Hoisted: strokeStyle and lineWidth are constant for the health bar border
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x - 20, p.y + healthBarY_offset, 40, 5);
    }
  }

  renderTargetIndicator(ctx, player) {
    if (!window.mobileControls || !window.mobileControls.autoShootActive) {
      return;
    }

    const target = window.mobileControls.getCurrentTarget();
    if (!target || !player) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.setLineDash([]);

    const reticleSize = 30;
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(target.x - reticleSize, target.y);
    ctx.lineTo(target.x + reticleSize, target.y);
    ctx.moveTo(target.x, target.y - reticleSize);
    ctx.lineTo(target.x, target.y + reticleSize);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(target.x, target.y, reticleSize - 5, 0, Math.PI * 2);
    ctx.stroke();

    const pulse = Math.sin(Date.now() / 200) * 5;
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(target.x, target.y, reticleSize + pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}

window.EntityRenderer = EntityRenderer;
