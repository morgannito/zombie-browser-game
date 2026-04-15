/**
 * CROSSHAIR RENDERER
 * Draws a canvas-based crosshair with two feedback behaviours:
 *   1. Spread (gap dilation) during auto-fire, snaps back at rest
 *   2. Red/orange tint when the mouse cursor is over an enemy zombie
 * @module CrosshairRenderer
 * @author Claude Code
 * @version 1.0.0
 */

// ─── Constants ───────────────────────────────────────────────────────────────
const CROSSHAIR_ARM_LENGTH   = 8;   // px — length of each arm
const CROSSHAIR_THICKNESS    = 2;   // px — line width
const CROSSHAIR_GAP_REST     = 4;   // px — gap at rest
const CROSSHAIR_GAP_MAX      = 18;  // px — max gap during full spread
const CROSSHAIR_SPREAD_RATE  = 6;   // gap px added per shot event
const CROSSHAIR_DECAY        = 0.12; // lerp factor toward rest (per frame)
const CROSSHAIR_COLOR_REST   = 'rgba(255, 255, 255, 0.90)';
const CROSSHAIR_COLOR_ENEMY  = 'rgba(255, 80, 20, 0.95)';
const CROSSHAIR_DOT_RADIUS   = 1.5; // px — centre dot
const ZOMBIE_HIT_RADIUS      = 28;  // px screen-space — hover detection slack

class CrosshairRenderer {
  constructor() {
    this._gap = CROSSHAIR_GAP_REST;
  }

  /**
   * Call once per game-loop tick when a shot is fired.
   * Accumulates spread; capped at CROSSHAIR_GAP_MAX.
   */
  onShoot() {
    this._gap = Math.min(this._gap + CROSSHAIR_SPREAD_RATE, CROSSHAIR_GAP_MAX);
  }

  /**
   * Determine whether the mouse screen-position is over any alive zombie.
   * @param {number} mouseX - screen X (CSS pixels)
   * @param {number} mouseY - screen Y (CSS pixels)
   * @param {object} zombies - map keyed by id
   * @param {{x: number, y: number}} cameraPos - world offset
   * @param {number} pixelRatio
   * @returns {boolean}
   */
  _isOverZombie(mouseX, mouseY, zombies, cameraPos, pixelRatio) {
    if (!zombies) {
      return false;
    }
    for (const id in zombies) {
      const z = zombies[id];
      if (!z || z.health <= 0) {
        continue;
      }
      const sx = (z.x - cameraPos.x) / pixelRatio;
      const sy = (z.y - cameraPos.y) / pixelRatio;
      const r  = (z.size || 25) + ZOMBIE_HIT_RADIUS;
      if ((mouseX - sx) ** 2 + (mouseY - sy) ** 2 <= r * r) {
        return true;
      }
    }
    return false;
  }

  /**
   * Draw the crosshair for the current frame and decay spread.
   * Must be called in screen-space (after ctx.restore() for world transform).
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} mouseX - screen X (CSS pixels)
   * @param {number} mouseY - screen Y (CSS pixels)
   * @param {object} zombies - gameState.state.zombies
   * @param {{x: number, y: number}} cameraPos
   * @param {number} pixelRatio
   */
  render(ctx, mouseX, mouseY, zombies, cameraPos, pixelRatio) {
    // Decay gap toward rest value
    this._gap += (CROSSHAIR_GAP_REST - this._gap) * CROSSHAIR_DECAY;

    const gap   = this._gap;
    const reach = gap + CROSSHAIR_ARM_LENGTH;
    const color = this._isOverZombie(mouseX, mouseY, zombies, cameraPos, pixelRatio)
      ? CROSSHAIR_COLOR_ENEMY
      : CROSSHAIR_COLOR_REST;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle   = color;
    ctx.lineWidth   = CROSSHAIR_THICKNESS;
    ctx.lineCap     = 'round';

    // Centre dot
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, CROSSHAIR_DOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Four arms (top, bottom, left, right)
    ctx.beginPath();
    ctx.moveTo(mouseX,        mouseY - gap);
    ctx.lineTo(mouseX,        mouseY - reach);
    ctx.moveTo(mouseX,        mouseY + gap);
    ctx.lineTo(mouseX,        mouseY + reach);
    ctx.moveTo(mouseX - gap,  mouseY);
    ctx.lineTo(mouseX - reach, mouseY);
    ctx.moveTo(mouseX + gap,  mouseY);
    ctx.lineTo(mouseX + reach, mouseY);
    ctx.stroke();

    ctx.restore();
  }
}

window.CrosshairRenderer = CrosshairRenderer;
