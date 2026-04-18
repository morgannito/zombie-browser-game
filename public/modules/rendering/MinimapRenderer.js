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

    const pixelRatio = window.devicePixelRatio || 1;
    minimapCtx.save();
    minimapCtx.scale(pixelRatio, pixelRatio);

    const mapWidth = minimapCanvas.width / pixelRatio;
    const mapHeight = minimapCanvas.height / pixelRatio;
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

    // Zombie density heatmap
    const zombieList = Object.values(gameState.state.zombies);
    if (zombieList.length > 0) {
      this._buildHeatmap(mapWidth, mapHeight, zombieList, scaleX, scaleY);
      minimapCtx.drawImage(this._heatCanvas, 0, 0);
    }

    // Zombies
    Object.values(gameState.state.zombies).forEach(zombie => {
      minimapCtx.fillStyle = zombie.isBoss ? '#ff0000' : zombie.color;
      minimapCtx.beginPath();
      minimapCtx.arc(zombie.x * scaleX, zombie.y * scaleY, zombie.isBoss ? 6 : 3, 0, Math.PI * 2);
      minimapCtx.fill();
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

    // Other players
    minimapCtx.fillStyle = '#ff8800';
    Object.entries(gameState.state.players).forEach(([pid, p]) => {
      if (pid === playerId || !p.alive || !p.hasNickname) {
        return;
      }
      minimapCtx.beginPath();
      minimapCtx.arc(p.x * scaleX, p.y * scaleY, 4, 0, Math.PI * 2);
      minimapCtx.fill();
    });

    // Current player
    const player = gameState.state.players[playerId];
    if (player && player.alive) {
      minimapCtx.fillStyle = '#0088ff';
      minimapCtx.beginPath();
      minimapCtx.arc(player.x * scaleX, player.y * scaleY, 5, 0, Math.PI * 2);
      minimapCtx.fill();

      // Direction
      minimapCtx.strokeStyle = '#00ffff';
      minimapCtx.lineWidth = 2;
      minimapCtx.beginPath();
      minimapCtx.moveTo(player.x * scaleX, player.y * scaleY);
      minimapCtx.lineTo(
        player.x * scaleX + Math.cos(player.angle) * 10,
        player.y * scaleY + Math.sin(player.angle) * 10
      );
      minimapCtx.stroke();
    }

    // Border
    minimapCtx.strokeStyle = '#00ff00';
    minimapCtx.lineWidth = 2;
    minimapCtx.strokeRect(0, 0, mapWidth, mapHeight);

    minimapCtx.restore();
  }
}

window.MinimapRenderer = MinimapRenderer;
