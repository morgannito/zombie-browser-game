/**
 * MINIMAP RENDERER
 * Handles rendering of the minimap overlay
 * @module MinimapRenderer
 * @author Claude Code
 * @version 1.0.0
 */

class MinimapRenderer {
  constructor() {
    // Heatmap offscreen canvas for zombie density
    this._heatCanvas = null;
    this._heatCtx = null;
    // Throttle: max 10 Hz (100 ms between renders)
    this._lastRenderTime = 0;
    // Zoom toggle (X key): false = normal, true = zoomed in 2x
    this._zoomed = false;
    // Boss pulse animation
    this._bossPhase = 0;
    // Proximity radius for zombie dots (world units)
    this.ZOMBIE_SHOW_RADIUS = 1000;
    this._setupZoomToggle();
  }

  _setupZoomToggle() {
    this._zoomKeyHandler = (e) => {
      if (e.code === 'KeyX' && !e.repeat) {
        this._zoomed = !this._zoomed;
      }
    };
    window.addEventListener('keydown', this._zoomKeyHandler);
  }

  /**
   * Build a zombie density heatmap on an offscreen canvas.
   * Each zombie adds a radial red gradient; bosses count more.
   * @param {number} w - Map pixel width
   * @param {number} h - Map pixel height
   * @param {object[]} zombies - Array of zombie objects with x,y,isBoss
   * @param {number} scaleX - World-to-minimap scale X
   * @param {number} scaleY - World-to-minimap scale Y
   */
  _buildHeatmap(w, h, zombies, scaleX, scaleY) {
    if (!this._heatCanvas || this._heatCanvas.width !== w || this._heatCanvas.height !== h) {
      this._heatCanvas = document.createElement('canvas');
      this._heatCanvas.width = w;
      this._heatCanvas.height = h;
      this._heatCtx = this._heatCanvas.getContext('2d');
    }
    const hCtx = this._heatCtx;
    hCtx.clearRect(0, 0, w, h);
    for (const z of zombies) {
      const mx = z.x * scaleX;
      const my = z.y * scaleY;
      const r = z.isBoss ? 18 : 10;
      const alpha = z.isBoss ? 0.35 : 0.18;
      const grad = hCtx.createRadialGradient(mx, my, 0, mx, my, r);
      grad.addColorStop(0, `rgba(255,0,0,${alpha})`);
      grad.addColorStop(1, 'rgba(255,0,0,0)');
      hCtx.fillStyle = grad;
      hCtx.beginPath();
      hCtx.arc(mx, my, r, 0, Math.PI * 2);
      hCtx.fill();
    }
  }

  renderMinimap(minimapCanvas, minimapCtx, gameState, playerId) {
    if (!gameState.config.ROOM_WIDTH) {
      return;
    }

    // Throttle to 10 Hz (100 ms min between renders)
    const now = performance.now();
    if (now - this._lastRenderTime < 100) {
      return;
    }
    this._lastRenderTime = now;

    // Advance boss pulse phase
    this._bossPhase = (this._bossPhase + 0.05) % (Math.PI * 2);

    const pixelRatio = window.devicePixelRatio || 1;
    minimapCtx.save();
    minimapCtx.scale(pixelRatio, pixelRatio);

    const baseWidth = minimapCanvas.width / pixelRatio;
    const baseHeight = minimapCanvas.height / pixelRatio;

    // Zoom: clip to canvas, then scale/translate around local player
    const zoomFactor = this._zoomed ? 2 : 1;
    const player = gameState.state.players[playerId];
    let offsetX = 0, offsetY = 0;

    if (this._zoomed && player) {
      const rawScaleX = baseWidth / gameState.config.ROOM_WIDTH;
      const rawScaleY = baseHeight / gameState.config.ROOM_HEIGHT;
      offsetX = baseWidth / 2 - player.x * rawScaleX * zoomFactor;
      offsetY = baseHeight / 2 - player.y * rawScaleY * zoomFactor;
    }

    minimapCtx.save();
    minimapCtx.beginPath();
    minimapCtx.rect(0, 0, baseWidth, baseHeight);
    minimapCtx.clip();
    minimapCtx.translate(offsetX, offsetY);
    minimapCtx.scale(zoomFactor, zoomFactor);

    const mapWidth = baseWidth;
    const mapHeight = baseHeight;
    const scaleX = mapWidth / gameState.config.ROOM_WIDTH;
    const scaleY = mapHeight / gameState.config.ROOM_HEIGHT;

    // Background
    minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    minimapCtx.fillRect(0, 0, mapWidth, mapHeight);

    // Walls
    minimapCtx.fillStyle = '#444';
    gameState.state.walls.forEach(wall => {
      minimapCtx.fillRect(
        wall.x * scaleX,
        wall.y * scaleY,
        wall.width * scaleX,
        wall.height * scaleY
      );
    });

    // Zombie density heatmap + dots — filtered by proximity to local player
    const zombieList = Object.values(gameState.state.zombies);
    const nearbyZombies = player
      ? zombieList.filter(z => {
          const dx = z.x - player.x, dy = z.y - player.y;
          return z.isBoss || Math.sqrt(dx * dx + dy * dy) <= this.ZOMBIE_SHOW_RADIUS;
        })
      : zombieList;

    if (nearbyZombies.length > 0) {
      this._buildHeatmap(mapWidth, mapHeight, nearbyZombies, scaleX, scaleY);
      minimapCtx.drawImage(this._heatCanvas, 0, 0);
    }

    // Zombies (nearby only — bosses always shown)
    nearbyZombies.forEach(zombie => {
      if (zombie.isBoss) {
        // Pulsing skull marker
        const pulse = 0.6 + 0.4 * Math.abs(Math.sin(this._bossPhase));
        const r = 7 * pulse;
        minimapCtx.save();
        minimapCtx.fillStyle = `rgba(220,0,0,${0.7 + 0.3 * pulse})`;
        minimapCtx.shadowColor = 'red';
        minimapCtx.shadowBlur = 8 * pulse;
        minimapCtx.beginPath();
        minimapCtx.arc(zombie.x * scaleX, zombie.y * scaleY, r, 0, Math.PI * 2);
        minimapCtx.fill();
        // Skull "X"
        minimapCtx.strokeStyle = '#fff';
        minimapCtx.lineWidth = 1.5;
        const cx = zombie.x * scaleX, cy = zombie.y * scaleY;
        minimapCtx.beginPath();
        minimapCtx.moveTo(cx - r * 0.5, cy - r * 0.5);
        minimapCtx.lineTo(cx + r * 0.5, cy + r * 0.5);
        minimapCtx.moveTo(cx + r * 0.5, cy - r * 0.5);
        minimapCtx.lineTo(cx - r * 0.5, cy + r * 0.5);
        minimapCtx.stroke();
        minimapCtx.restore();
      } else {
        minimapCtx.fillStyle = '#ff4444';
        minimapCtx.beginPath();
        minimapCtx.arc(zombie.x * scaleX, zombie.y * scaleY, 2.5, 0, Math.PI * 2);
        minimapCtx.fill();
      }
    });

    // Loot
    minimapCtx.fillStyle = '#ffd700';
    Object.values(gameState.state.loot).forEach(loot => {
      minimapCtx.beginPath();
      minimapCtx.arc(loot.x * scaleX, loot.y * scaleY, 2, 0, Math.PI * 2);
      minimapCtx.fill();
    });

    // Powerups
    minimapCtx.fillStyle = '#ffff00';
    Object.values(gameState.state.powerups).forEach(powerup => {
      minimapCtx.beginPath();
      minimapCtx.arc(powerup.x * scaleX, powerup.y * scaleY, 3, 0, Math.PI * 2);
      minimapCtx.fill();
    });

    // Other players (bleu = humain, gris = bot)
    Object.entries(gameState.state.players).forEach(([pid, p]) => {
      if (pid === playerId || !p.alive || !p.hasNickname) {
        return;
      }
      const isBot = p.isBot || p.bot || false;
      minimapCtx.fillStyle = isBot ? '#888888' : '#4488ff';
      minimapCtx.beginPath();
      minimapCtx.arc(p.x * scaleX, p.y * scaleY, 4, 0, Math.PI * 2);
      minimapCtx.fill();
    });

    // Current player — vert
    if (player && player.alive) {
      minimapCtx.fillStyle = '#00dd44';
      minimapCtx.beginPath();
      minimapCtx.arc(player.x * scaleX, player.y * scaleY, 5, 0, Math.PI * 2);
      minimapCtx.fill();

      // Direction
      minimapCtx.strokeStyle = '#00ffaa';
      minimapCtx.lineWidth = 2;
      minimapCtx.beginPath();
      minimapCtx.moveTo(player.x * scaleX, player.y * scaleY);
      minimapCtx.lineTo(
        player.x * scaleX + Math.cos(player.angle) * 10,
        player.y * scaleY + Math.sin(player.angle) * 10
      );
      minimapCtx.stroke();
    }

    // End zoom clip+transform
    minimapCtx.restore();

    // Border (drawn after zoom restore — always at canvas edges)
    minimapCtx.strokeStyle = this._zoomed ? '#ffcc00' : '#00ff00';
    minimapCtx.lineWidth = 2;
    minimapCtx.strokeRect(0, 0, baseWidth, baseHeight);

    // Zoom indicator
    if (this._zoomed) {
      minimapCtx.fillStyle = 'rgba(255,204,0,0.85)';
      minimapCtx.font = 'bold 9px monospace';
      minimapCtx.fillText('2x', 4, baseHeight - 4);
    }

    minimapCtx.restore();
  }
}

window.MinimapRenderer = MinimapRenderer;
