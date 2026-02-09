/**
 * MINIMAP RENDERER
 * Handles rendering of the minimap overlay
 * @module MinimapRenderer
 * @author Claude Code
 * @version 1.0.0
 */

class MinimapRenderer {
  constructor() {
    // No persistent state needed
  }

  renderMinimap(minimapCanvas, minimapCtx, gameState, playerId) {
    if (!gameState.config.ROOM_WIDTH) {
      return;
    }

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
