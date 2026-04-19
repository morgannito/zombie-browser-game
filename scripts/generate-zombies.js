const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'assets', 'sprites', 'zombies');
const SIZE = 128;
const HALF = SIZE / 2;

// Ensure output directory exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── Utility helpers ─────────────────────────────────────────────────────────

function parseColor(color) {
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return { r, g, b };
  }
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
  }
  return { r: 128, g: 128, b: 128 };
}

function darken(color, factor = 0.6) {
  const { r, g, b } = parseColor(color);
  return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
}

function lighten(color, factor = 1.4) {
  const { r, g, b } = parseColor(color);
  return `rgb(${Math.min(255, Math.floor(r * factor))},${Math.min(255, Math.floor(g * factor))},${Math.min(255, Math.floor(b * factor))})`;
}

function withAlpha(color, alpha) {
  const { r, g, b } = parseColor(color);
  return `rgba(${r},${g},${b},${alpha})`;
}

function newCanvas() {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, SIZE, SIZE);
  return { canvas, ctx };
}

function save(canvas, filename) {
  const buf = canvas.toBuffer('image/png');
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, buf);
  console.log(`  -> ${filename} (${buf.length} bytes)`);
}

// ─── Drawing primitives ──────────────────────────────────────────────────────

function drawOutlinedEllipse(ctx, cx, cy, rx, ry, fill, outlineWidth = 2.5) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = outlineWidth;
  ctx.stroke();
}

function _drawOutlinedRect(ctx, x, y, w, h, fill, outlineWidth = 2) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = outlineWidth;
  ctx.strokeRect(x, y, w, h);
}

function drawOutlinedRoundRect(ctx, x, y, w, h, radius, fill, outlineWidth = 2) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = outlineWidth;
  ctx.stroke();
}

function drawGlowingEyes(ctx, cx, cy, spacing = 8, color = '#ff4444', size = 3) {
  for (const dx of [-spacing, spacing]) {
    // Outer glow
    const grd = ctx.createRadialGradient(cx + dx, cy, 0, cx + dx, cy, size * 3);
    grd.addColorStop(0, withAlpha(color, 0.8));
    grd.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = grd;
    ctx.fillRect(cx + dx - size * 3, cy - size * 3, size * 6, size * 6);
    // Core
    ctx.beginPath();
    ctx.arc(cx + dx, cy, size, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + dx, cy, size * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function addTopLeftHighlight(ctx, cx, cy, rx, ry, color) {
  const grd = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.3, 0, cx, cy, Math.max(rx, ry));
  grd.addColorStop(0, withAlpha(color, 0.5));
  grd.addColorStop(0.6, withAlpha(color, 0));
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function addBodyShading(ctx, cx, cy, rx, ry) {
  // Bottom-right shadow
  const grd = ctx.createRadialGradient(
    cx + rx * 0.3,
    cy + ry * 0.3,
    0,
    cx,
    cy,
    Math.max(rx, ry) * 1.2
  );
  grd.addColorStop(0, 'rgba(0,0,0,0.35)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawTornClothes(ctx, cx, cy, rx, ry, color) {
  ctx.strokeStyle = darken(color, 0.4);
  ctx.lineWidth = 1.5;
  // Random torn lines across the body
  for (let i = 0; i < 6; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 0.4 + Math.random() * 0.4;
    const sx = cx + Math.cos(angle) * rx * dist;
    const sy = cy + Math.sin(angle) * ry * dist;
    const len = 5 + Math.random() * 10;
    const a2 = angle + (Math.random() - 0.5) * 1.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(a2) * len, sy + Math.sin(a2) * len);
    ctx.stroke();
  }
}

function drawScar(ctx, x, y, len, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = 'rgba(100,0,0,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-len / 2, 0);
  ctx.lineTo(len / 2, 0);
  ctx.stroke();
  // cross lines
  for (let i = -len / 2 + 3; i < len / 2; i += 5) {
    ctx.beginPath();
    ctx.moveTo(i, -2);
    ctx.lineTo(i, 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ─── Generic zombie body (top-down humanoid) ─────────────────────────────────

function drawZombieBody(ctx, color, opts = {}) {
  const {
    bodyRx = 22,
    bodyRy = 28,
    headRx = 16,
    headRy = 14,
    armLen = 26,
    armWidth = 9,
    legLen = 18,
    legWidth = 10,
    armsForward = true,
    bodyOffsetY = 4
  } = opts;

  const cx = HALF;
  const cy = HALF + bodyOffsetY;
  const darkColor = darken(color);
  const lightColor = lighten(color, 1.3);

  // Shadow under body
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx + 3, cy + 3, bodyRx + 4, bodyRy + 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (behind body)
  for (const side of [-1, 1]) {
    const lx = cx + side * (bodyRx * 0.5);
    const ly = cy + bodyRy * 0.4;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(side * 0.2 + 0.5);
    drawOutlinedRoundRect(ctx, -legWidth / 2, 0, legWidth, legLen, 3, darkColor);
    ctx.restore();
  }

  // Body (torso oval)
  drawOutlinedEllipse(ctx, cx, cy, bodyRx, bodyRy, color, 2.5);
  addBodyShading(ctx, cx, cy, bodyRx, bodyRy);
  addTopLeftHighlight(ctx, cx, cy, bodyRx, bodyRy, lightColor);
  drawTornClothes(ctx, cx, cy, bodyRx, bodyRy, color);

  // Arms
  for (const side of [-1, 1]) {
    const ax = cx + side * (bodyRx + 2);
    const ay = cy - bodyRy * 0.2;
    ctx.save();
    ctx.translate(ax, ay);
    if (armsForward) {
      ctx.rotate(side * 0.3 - 0.8);
    } else {
      ctx.rotate(side * 0.5 + 0.6);
    }
    drawOutlinedRoundRect(ctx, -armWidth / 2, -armLen, armWidth, armLen, 3, color);
    // Hand
    ctx.beginPath();
    ctx.arc(0, -armLen, armWidth * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = lightColor;
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  // Head
  const headY = cy - bodyRy + headRy * 0.3;
  drawOutlinedEllipse(ctx, cx, headY, headRx, headRy, lighten(color, 1.15), 2.5);
  addTopLeftHighlight(ctx, cx, headY, headRx, headRy, '#ffffff');
  addBodyShading(ctx, cx, headY, headRx, headRy);

  // Eyes
  drawGlowingEyes(ctx, cx, headY - 1, headRx * 0.4, '#ff3333', 2.5);

  return { cx, cy, headY, bodyRx, bodyRy, headRx, headRy };
}

// ─── 1. Normal Zombie ────────────────────────────────────────────────────────

function generateNormalZombie() {
  const { canvas, ctx } = newCanvas();
  drawZombieBody(ctx, '#2d8c2d');
  drawScar(ctx, HALF + 8, HALF + 10, 12, 0.3);
  save(canvas, 'zombie_normal.png');
}

// ─── 2. Fast Zombie ──────────────────────────────────────────────────────────

function generateFastZombie() {
  const { canvas, ctx } = newCanvas();

  // Speed blur lines behind
  ctx.strokeStyle = 'rgba(204,204,0,0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const y = 30 + i * 10;
    ctx.beginPath();
    ctx.moveTo(80 + Math.random() * 20, y);
    ctx.lineTo(120 + Math.random() * 10, y);
    ctx.stroke();
  }

  drawZombieBody(ctx, '#cccc00', {
    bodyRx: 18,
    bodyRy: 26,
    armLen: 22,
    armWidth: 7,
    armsForward: false, // arms swept back
    legLen: 20
  });

  // Additional speed lines on edges
  ctx.strokeStyle = 'rgba(255,255,100,0.35)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    const y = HALF - 20 + i * 12;
    ctx.beginPath();
    ctx.moveTo(HALF + 25, y);
    ctx.lineTo(HALF + 45 + Math.random() * 15, y + 3);
    ctx.stroke();
  }

  save(canvas, 'zombie_fast.png');
}

// ─── 3. Tank Zombie ──────────────────────────────────────────────────────────

function generateTankZombie() {
  const { canvas, ctx } = newCanvas();

  drawZombieBody(ctx, '#cc6600', {
    bodyRx: 34,
    bodyRy: 38,
    headRx: 18,
    headRy: 15,
    armLen: 30,
    armWidth: 14,
    legLen: 20,
    legWidth: 14,
    bodyOffsetY: 6
  });

  // Shoulder armor plates
  for (const side of [-1, 1]) {
    const px = HALF + side * 32;
    const py = HALF - 12;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(side * 0.1);
    // Plate
    drawOutlinedRoundRect(ctx, -10, -8, 20, 16, 4, '#885500', 2);
    // Rivets
    ctx.fillStyle = '#aa8833';
    ctx.beginPath();
    ctx.arc(-5, -3, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, -3, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 4, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  save(canvas, 'zombie_tank.png');
}

// ─── 4. Explosive Zombie ─────────────────────────────────────────────────────

function generateExplosiveZombie() {
  const { canvas, ctx } = newCanvas();

  // Pulsing bright center glow
  const grd = ctx.createRadialGradient(HALF, HALF, 5, HALF, HALF, 55);
  grd.addColorStop(0, 'rgba(255,100,255,0.5)');
  grd.addColorStop(0.5, 'rgba(200,0,200,0.15)');
  grd.addColorStop(1, 'rgba(200,0,200,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, SIZE, SIZE);

  drawZombieBody(ctx, '#cc00cc', { bodyRx: 24, bodyRy: 30 });

  // Glowing cracks on body
  ctx.strokeStyle = '#ff88ff';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#ff00ff';
  ctx.shadowBlur = 6;
  const cracks = [
    [HALF - 10, HALF - 5, HALF - 3, HALF + 8],
    [HALF + 5, HALF - 10, HALF + 12, HALF + 3],
    [HALF - 6, HALF + 5, HALF + 8, HALF + 15],
    [HALF + 2, HALF - 2, HALF - 5, HALF + 12]
  ];
  for (const [x1, y1, x2, y2] of cracks) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo((x1 + x2) / 2 + (Math.random() - 0.5) * 6, (y1 + y2) / 2);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Sparks around edges
  ctx.fillStyle = '#ffaaff';
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const dist = 38 + Math.random() * 15;
    const sx = HALF + Math.cos(angle) * dist;
    const sy = HALF + Math.sin(angle) * dist;
    const sparkSize = 1.5 + Math.random() * 2;
    ctx.beginPath();
    ctx.arc(sx, sy, sparkSize, 0, Math.PI * 2);
    ctx.fill();
  }

  save(canvas, 'zombie_explosive.png');
}

// ─── 5. Healer Zombie ────────────────────────────────────────────────────────

function generateHealerZombie() {
  const { canvas, ctx } = newCanvas();

  // Green aura glow
  const aura = ctx.createRadialGradient(HALF, HALF, 15, HALF, HALF, 58);
  aura.addColorStop(0, 'rgba(0,255,200,0.3)');
  aura.addColorStop(0.6, 'rgba(0,200,180,0.12)');
  aura.addColorStop(1, 'rgba(0,200,180,0)');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, SIZE, SIZE);

  drawZombieBody(ctx, '#00cccc');

  // Cross/plus symbol on back
  const crossColor = '#00ff99';
  ctx.fillStyle = crossColor;
  ctx.shadowColor = crossColor;
  ctx.shadowBlur = 8;
  ctx.fillRect(HALF - 3, HALF - 12, 6, 24);
  ctx.fillRect(HALF - 12, HALF - 3, 24, 6);
  ctx.shadowBlur = 0;

  // Outline the cross
  ctx.strokeStyle = '#009966';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(HALF - 3, HALF - 12, 6, 24);
  ctx.strokeRect(HALF - 12, HALF - 3, 24, 6);

  // Gentle radial glow particles
  ctx.fillStyle = 'rgba(0,255,200,0.5)';
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const dist = 42 + Math.sin(i * 1.7) * 8;
    ctx.beginPath();
    ctx.arc(HALF + Math.cos(angle) * dist, HALF + Math.sin(angle) * dist, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  save(canvas, 'zombie_healer.png');
}

// ─── 6. Slower Zombie ────────────────────────────────────────────────────────

function generateSlowerZombie() {
  const { canvas, ctx } = newCanvas();

  // Purple rings emanating outward
  for (let r = 55; r > 25; r -= 10) {
    ctx.beginPath();
    ctx.arc(HALF, HALF, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(102,0,204,${0.15 + (55 - r) / 100})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  drawZombieBody(ctx, '#6600cc');

  // Arcane symbols around body
  ctx.font = '14px serif';
  ctx.fillStyle = 'rgba(180,100,255,0.7)';
  const symbols = ['\u2606', '\u2726', '\u2605', '\u2735', '\u2742', '\u2743'];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const dist = 44;
    const sx = HALF + Math.cos(angle) * dist;
    const sy = HALF + Math.sin(angle) * dist;
    ctx.fillText(symbols[i % symbols.length], sx - 5, sy + 5);
  }

  save(canvas, 'zombie_slower.png');
}

// ─── 7. Poison Zombie ────────────────────────────────────────────────────────

function generatePoisonZombie() {
  const { canvas, ctx } = newCanvas();

  // Green glow background
  const glow = ctx.createRadialGradient(HALF, HALF, 10, HALF, HALF, 60);
  glow.addColorStop(0, 'rgba(0,220,0,0.25)');
  glow.addColorStop(1, 'rgba(0,220,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SIZE, SIZE);

  drawZombieBody(ctx, '#00cc00');

  // Dripping poison droplets
  ctx.fillStyle = '#00ff00';
  const drips = [
    [HALF - 15, HALF + 25, 3],
    [HALF + 10, HALF + 30, 2.5],
    [HALF - 5, HALF + 35, 2],
    [HALF + 18, HALF + 28, 2.5],
    [HALF - 20, HALF + 32, 2]
  ];
  for (const [x, y, r] of drips) {
    // Teardrop shape
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.quadraticCurveTo(x, y - r * 3, x + r, y);
    ctx.fill();
  }

  // Toxic bubbles
  ctx.strokeStyle = 'rgba(0,255,0,0.5)';
  ctx.lineWidth = 1.5;
  const bubbles = [
    [HALF - 25, HALF - 10, 5],
    [HALF + 22, HALF + 5, 4],
    [HALF + 30, HALF - 15, 3],
    [HALF - 30, HALF + 10, 3.5],
    [HALF + 15, HALF - 25, 4],
    [HALF - 8, HALF + 40, 3]
  ];
  for (const [x, y, r] of bubbles) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    // Highlight on bubble
    ctx.fillStyle = 'rgba(200,255,200,0.4)';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  save(canvas, 'zombie_poison.png');
}

// ─── 8. Shooter Zombie ───────────────────────────────────────────────────────

function generateShooterZombie() {
  const { canvas, ctx } = newCanvas();

  const cx = HALF;
  const cy = HALF + 4;
  const color = '#cc9900';
  const darkColor = darken(color);
  const lightColor = lighten(color, 1.3);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx + 3, cy + 3, 26, 32, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  for (const side of [-1, 1]) {
    const lx = cx + side * 11;
    const ly = cy + 10;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(side * 0.15 + 0.3);
    drawOutlinedRoundRect(ctx, -5, 0, 10, 18, 3, darkColor);
    ctx.restore();
  }

  // Body
  drawOutlinedEllipse(ctx, cx, cy, 22, 28, color, 2.5);
  addBodyShading(ctx, cx, cy, 22, 28);
  addTopLeftHighlight(ctx, cx, cy, 22, 28, lightColor);

  // Belt/bandolier detail
  ctx.strokeStyle = '#664400';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy - 5);
  ctx.lineTo(cx + 18, cy + 10);
  ctx.stroke();
  // Ammo dots on belt
  ctx.fillStyle = '#ffcc00';
  for (let i = 0; i < 4; i++) {
    const t = (i + 1) / 5;
    const bx = cx - 18 + t * 36;
    const by = cy - 5 + t * 15;
    ctx.beginPath();
    ctx.arc(bx, by, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Left arm (normal, at side)
  ctx.save();
  ctx.translate(cx - 24, cy - 6);
  ctx.rotate(-0.3);
  drawOutlinedRoundRect(ctx, -4, -20, 9, 22, 3, color);
  ctx.restore();

  // Right arm extended forward with projectile
  ctx.save();
  ctx.translate(cx + 24, cy - 8);
  ctx.rotate(-1.2);
  drawOutlinedRoundRect(ctx, -4, -28, 9, 28, 3, color);
  // Hand
  ctx.beginPath();
  ctx.arc(0, -28, 5, 0, Math.PI * 2);
  ctx.fillStyle = lightColor;
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Projectile (glowing orb)
  const projGrd = ctx.createRadialGradient(0, -36, 0, 0, -36, 6);
  projGrd.addColorStop(0, '#ffff88');
  projGrd.addColorStop(0.6, '#ffaa00');
  projGrd.addColorStop(1, 'rgba(255,170,0,0)');
  ctx.fillStyle = projGrd;
  ctx.beginPath();
  ctx.arc(0, -36, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -36, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  // Head
  const headY = cy - 28 + 5;
  drawOutlinedEllipse(ctx, cx, headY, 16, 14, lighten(color, 1.15), 2.5);
  addTopLeftHighlight(ctx, cx, headY, 16, 14, '#ffffff');
  addBodyShading(ctx, cx, headY, 16, 14);
  drawGlowingEyes(ctx, cx, headY - 1, 6, '#ff6600', 2.5);

  save(canvas, 'zombie_shooter.png');
}

// ─── 9. Teleporter Zombie ────────────────────────────────────────────────────

function generateTeleporterZombie() {
  const { canvas, ctx } = newCanvas();

  // Swirling portal effect around feet
  for (let i = 0; i < 3; i++) {
    const r = 25 + i * 12;
    ctx.beginPath();
    ctx.arc(HALF, HALF + 20, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(153,0,204,${0.3 - i * 0.08})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4 + i * 2]);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Semi-transparent body effect
  ctx.globalAlpha = 0.75;
  drawZombieBody(ctx, '#9900cc');
  ctx.globalAlpha = 1.0;

  // Faded edges effect - draw translucent overlay near body edges
  const fadeGrd = ctx.createRadialGradient(HALF, HALF, 20, HALF, HALF, 45);
  fadeGrd.addColorStop(0, 'rgba(0,0,0,0)');
  fadeGrd.addColorStop(0.7, 'rgba(0,0,0,0)');
  fadeGrd.addColorStop(1, 'rgba(153,0,204,0.15)');
  ctx.fillStyle = fadeGrd;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Portal swirl particles
  ctx.fillStyle = 'rgba(200,100,255,0.6)';
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 + 0.3;
    const dist = 30 + i * 2;
    const px = HALF + Math.cos(angle) * dist;
    const py = HALF + 20 + Math.sin(angle) * dist * 0.4;
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  save(canvas, 'zombie_teleporter.png');
}

// ─── 10. Summoner Zombie ─────────────────────────────────────────────────────

function generateSummonerZombie() {
  const { canvas, ctx } = newCanvas();

  // Mystical aura
  const aura = ctx.createRadialGradient(HALF, HALF, 10, HALF, HALF, 60);
  aura.addColorStop(0, 'rgba(0,100,100,0.2)');
  aura.addColorStop(1, 'rgba(0,100,100,0)');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Larger body, hands raised
  const cx = HALF;
  const cy = HALF + 6;
  const color = '#006666';
  const darkColor = darken(color);
  const lightColor = lighten(color, 1.4);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx + 3, cy + 3, 30, 36, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + side * 13, cy + 14);
    ctx.rotate(side * 0.15);
    drawOutlinedRoundRect(ctx, -6, 0, 12, 18, 3, darkColor);
    ctx.restore();
  }

  // Body (larger)
  drawOutlinedEllipse(ctx, cx, cy, 28, 34, color, 2.5);
  addBodyShading(ctx, cx, cy, 28, 34);
  addTopLeftHighlight(ctx, cx, cy, 28, 34, lightColor);

  // Arms raised up
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + side * 30, cy - 10);
    ctx.rotate(side * 0.4 - 1.5);
    drawOutlinedRoundRect(ctx, -5, -30, 11, 30, 3, color);
    // Raised hand
    ctx.beginPath();
    ctx.arc(0, -30, 6, 0, Math.PI * 2);
    ctx.fillStyle = lightColor;
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  // Head
  const headY = cy - 34 + 10;
  drawOutlinedEllipse(ctx, cx, headY, 17, 15, lighten(color, 1.2), 2.5);
  addTopLeftHighlight(ctx, cx, headY, 17, 15, '#ffffff');
  drawGlowingEyes(ctx, cx, headY - 1, 7, '#00ffcc', 2.5);

  // Mystical runes floating around
  ctx.font = 'bold 16px serif';
  ctx.shadowColor = '#00ffcc';
  ctx.shadowBlur = 8;
  const runes = ['\u16A0', '\u16B1', '\u16C1', '\u16D6', '\u16E3', '\u16C7'];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const dist = 48;
    const rx = cx + Math.cos(angle) * dist;
    const ry = cy + Math.sin(angle) * dist;
    ctx.fillStyle = 'rgba(0,255,200,0.7)';
    ctx.fillText(runes[i], rx - 6, ry + 6);
  }
  ctx.shadowBlur = 0;

  save(canvas, 'zombie_summoner.png');
}

// ─── 11. Shielded Zombie ─────────────────────────────────────────────────────

function generateShieldedZombie() {
  const { canvas, ctx } = newCanvas();

  drawZombieBody(ctx, '#999999');

  // Shield/armor plate on front
  ctx.save();
  ctx.translate(HALF, HALF + 2);

  // Shield shape
  ctx.beginPath();
  ctx.moveTo(-16, -18);
  ctx.lineTo(16, -18);
  ctx.quadraticCurveTo(20, -16, 20, -10);
  ctx.lineTo(14, 14);
  ctx.quadraticCurveTo(0, 22, -14, 14);
  ctx.lineTo(-20, -10);
  ctx.quadraticCurveTo(-20, -16, -16, -18);
  ctx.closePath();

  // Metallic gradient
  const shieldGrd = ctx.createLinearGradient(-20, -18, 20, 22);
  shieldGrd.addColorStop(0, '#dddddd');
  shieldGrd.addColorStop(0.3, '#bbbbbb');
  shieldGrd.addColorStop(0.5, '#eeeeee');
  shieldGrd.addColorStop(0.7, '#aaaaaa');
  shieldGrd.addColorStop(1, '#888888');
  ctx.fillStyle = shieldGrd;
  ctx.fill();
  ctx.strokeStyle = '#555555';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Shield emblem (circle)
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.strokeStyle = '#666666';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Metallic highlight
  ctx.beginPath();
  ctx.moveTo(-12, -14);
  ctx.lineTo(8, -14);
  ctx.quadraticCurveTo(10, -12, 10, -8);
  ctx.lineTo(-14, -8);
  ctx.quadraticCurveTo(-14, -12, -12, -14);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fill();

  // Rivets on shield
  ctx.fillStyle = '#777777';
  for (const [rx, ry] of [
    [-12, -12],
    [12, -12],
    [-10, 10],
    [10, 10],
    [0, -16]
  ]) {
    ctx.beginPath();
    ctx.arc(rx, ry, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();

  save(canvas, 'zombie_shielded.png');
}

// ─── 12. Berserker Zombie ────────────────────────────────────────────────────

function generateBerserkerZombie() {
  const { canvas, ctx } = newCanvas();

  // Rage aura (red glow)
  const rage = ctx.createRadialGradient(HALF, HALF, 15, HALF, HALF, 60);
  rage.addColorStop(0, 'rgba(200,0,0,0.3)');
  rage.addColorStop(0.6, 'rgba(150,0,0,0.1)');
  rage.addColorStop(1, 'rgba(150,0,0,0)');
  ctx.fillStyle = rage;
  ctx.fillRect(0, 0, SIZE, SIZE);

  drawZombieBody(ctx, '#990000', {
    bodyRx: 26,
    bodyRy: 30,
    armLen: 28,
    armWidth: 12,
    headRx: 17,
    headRy: 15
  });

  // Claw marks on body
  ctx.strokeStyle = 'rgba(255,50,50,0.7)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(HALF - 10 + i * 8, HALF - 15);
    ctx.quadraticCurveTo(HALF - 8 + i * 8, HALF, HALF - 12 + i * 8, HALF + 15);
    ctx.stroke();
  }

  // Extra rage particles
  ctx.fillStyle = 'rgba(255,100,50,0.5)';
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const dist = 45 + Math.random() * 10;
    const px = HALF + Math.cos(angle) * dist;
    const py = HALF + Math.sin(angle) * dist;
    ctx.beginPath();
    ctx.arc(px, py, 1.5 + Math.random() * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  save(canvas, 'zombie_berserker.png');
}

// ─── 13. Minion Zombie ───────────────────────────────────────────────────────

function generateMinionZombie() {
  const { canvas, ctx } = newCanvas();

  // Drawn at 64x64 area centered in 128x128
  ctx.save();
  ctx.translate(HALF, HALF);
  ctx.scale(0.5, 0.5);
  ctx.translate(-HALF, -HALF);

  drawZombieBody(ctx, '#660066', {
    bodyRx: 20,
    bodyRy: 24,
    headRx: 14,
    headRy: 12,
    armLen: 18,
    armWidth: 7,
    legLen: 14,
    legWidth: 8
  });

  ctx.restore();

  save(canvas, 'zombie_minion.png');
}

// ─── 14. Boss Zombie ─────────────────────────────────────────────────────────

function generateBossZombie() {
  const { canvas, ctx } = newCanvas();

  const cx = HALF;
  const cy = HALF + 4;
  const color = '#660000';
  const darkColor = darken(color);
  const lightColor = lighten(color, 1.5);
  const goldColor = '#ffd700';

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx + 4, cy + 4, 42, 48, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cape/cloak effect (behind body)
  ctx.beginPath();
  ctx.moveTo(cx - 35, cy - 20);
  ctx.quadraticCurveTo(cx - 40, cy + 20, cx - 30, cy + 45);
  ctx.lineTo(cx + 30, cy + 45);
  ctx.quadraticCurveTo(cx + 40, cy + 20, cx + 35, cy - 20);
  ctx.closePath();
  const capeGrd = ctx.createLinearGradient(cx, cy - 20, cx, cy + 45);
  capeGrd.addColorStop(0, '#330000');
  capeGrd.addColorStop(0.5, '#220000');
  capeGrd.addColorStop(1, '#110000');
  ctx.fillStyle = capeGrd;
  ctx.fill();
  ctx.strokeStyle = goldColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Legs (thick)
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + side * 16, cy + 16);
    ctx.rotate(side * 0.1);
    drawOutlinedRoundRect(ctx, -8, 0, 16, 22, 4, darkColor);
    ctx.restore();
  }

  // Body (fills full 128px minus small margin)
  drawOutlinedEllipse(ctx, cx, cy, 36, 42, color, 3);
  addBodyShading(ctx, cx, cy, 36, 42);
  addTopLeftHighlight(ctx, cx, cy, 36, 42, lightColor);

  // Gold trim on body
  ctx.strokeStyle = goldColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 36, 42, 0, -0.3, 0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, cy, 30, 36, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Arms
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + side * 38, cy - 8);
    ctx.rotate(side * 0.3 - 0.7);
    drawOutlinedRoundRect(ctx, -7, -32, 14, 32, 4, color);
    // Clawed hand
    ctx.beginPath();
    ctx.arc(0, -32, 7, 0, Math.PI * 2);
    ctx.fillStyle = lightColor;
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Claws
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 1.5;
    for (let c = -1; c <= 1; c++) {
      ctx.beginPath();
      ctx.moveTo(c * 4, -38);
      ctx.lineTo(c * 5, -44);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Head
  const headY = cy - 42 + 12;
  drawOutlinedEllipse(ctx, cx, headY, 20, 17, lighten(color, 1.3), 3);
  addTopLeftHighlight(ctx, cx, headY, 20, 17, '#ffffff');
  addBodyShading(ctx, cx, headY, 20, 17);

  // Glowing red eyes (larger)
  drawGlowingEyes(ctx, cx, headY - 1, 8, '#ff0000', 3.5);

  // Crown
  ctx.save();
  ctx.translate(cx, headY - 17);
  const crownGrd = ctx.createLinearGradient(-14, -12, 14, 0);
  crownGrd.addColorStop(0, '#ffd700');
  crownGrd.addColorStop(0.5, '#ffee55');
  crownGrd.addColorStop(1, '#cc9900');
  ctx.fillStyle = crownGrd;
  ctx.beginPath();
  ctx.moveTo(-14, 2);
  ctx.lineTo(-14, -6);
  ctx.lineTo(-8, -2);
  ctx.lineTo(-4, -12);
  ctx.lineTo(0, -4);
  ctx.lineTo(4, -12);
  ctx.lineTo(8, -2);
  ctx.lineTo(14, -6);
  ctx.lineTo(14, 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#996600';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Crown jewels
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  ctx.arc(0, -4, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0066ff';
  ctx.beginPath();
  ctx.arc(-8, -2, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(8, -2, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  save(canvas, 'zombie_boss.png');
}

// ─── 15. Elite Zombie ────────────────────────────────────────────────────────

function generateEliteZombie() {
  const { canvas, ctx } = newCanvas();

  // Gold aura border
  for (let r = 58; r > 44; r -= 3) {
    ctx.beginPath();
    ctx.arc(HALF, HALF, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,215,0,${(58 - r) / 40 + 0.05})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Slightly larger body
  drawZombieBody(ctx, '#2d8c2d', {
    bodyRx: 24,
    bodyRy: 30,
    headRx: 17,
    headRy: 15,
    armLen: 28,
    armWidth: 10
  });

  // Gold shimmer overlay on body
  const goldGrd = ctx.createRadialGradient(HALF - 10, HALF - 10, 0, HALF, HALF, 40);
  goldGrd.addColorStop(0, 'rgba(255,215,0,0.2)');
  goldGrd.addColorStop(1, 'rgba(255,215,0,0)');
  ctx.fillStyle = goldGrd;
  ctx.beginPath();
  ctx.ellipse(HALF, HALF + 4, 24, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  // Crown above head
  const crownY = HALF - 30 - 15 + 5 - 14;
  ctx.save();
  ctx.translate(HALF, crownY);
  const crownGrd = ctx.createLinearGradient(-12, -10, 12, 0);
  crownGrd.addColorStop(0, '#ffd700');
  crownGrd.addColorStop(0.5, '#ffee55');
  crownGrd.addColorStop(1, '#cc9900');
  ctx.fillStyle = crownGrd;
  ctx.beginPath();
  ctx.moveTo(-12, 2);
  ctx.lineTo(-12, -5);
  ctx.lineTo(-6, -1);
  ctx.lineTo(-3, -10);
  ctx.lineTo(0, -3);
  ctx.lineTo(3, -10);
  ctx.lineTo(6, -1);
  ctx.lineTo(12, -5);
  ctx.lineTo(12, 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#996600';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Jewel
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  ctx.arc(0, -3, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  save(canvas, 'zombie_elite.png');
}

// ─── 16. Player Default ──────────────────────────────────────────────────────

function generatePlayerDefault() {
  const { canvas, ctx } = newCanvas();

  const cx = HALF;
  const cy = HALF + 4;
  const color = '#0066cc';
  const lightColor = lighten(color, 1.3);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx + 3, cy + 3, 24, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + side * 10, cy + 12);
    ctx.rotate(side * 0.1);
    drawOutlinedRoundRect(ctx, -5, 0, 10, 18, 3, '#333344');
    // Boot
    drawOutlinedRoundRect(ctx, -5, 14, 10, 6, 2, '#222233');
    ctx.restore();
  }

  // Body (military vest)
  drawOutlinedEllipse(ctx, cx, cy, 22, 28, color, 2.5);
  addBodyShading(ctx, cx, cy, 22, 28);
  addTopLeftHighlight(ctx, cx, cy, 22, 28, lightColor);

  // Vest details - pockets
  ctx.strokeStyle = darken(color, 0.7);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - 12, cy - 5, 8, 10);
  ctx.strokeRect(cx + 4, cy - 5, 8, 10);
  // Vest collar
  ctx.strokeStyle = darken(color, 0.5);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 22);
  ctx.lineTo(cx, cy - 16);
  ctx.lineTo(cx + 8, cy - 22);
  ctx.stroke();

  // Left arm
  ctx.save();
  ctx.translate(cx - 24, cy - 6);
  ctx.rotate(-0.4);
  drawOutlinedRoundRect(ctx, -4, -20, 9, 22, 3, color);
  // Hand
  ctx.beginPath();
  ctx.arc(0, -20, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#eebb99';
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Right arm with gun
  ctx.save();
  ctx.translate(cx + 24, cy - 6);
  ctx.rotate(-1.0);
  drawOutlinedRoundRect(ctx, -4, -22, 9, 22, 3, color);
  // Hand holding gun
  ctx.beginPath();
  ctx.arc(0, -22, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#eebb99';
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Gun
  ctx.fillStyle = '#333333';
  ctx.fillRect(-3, -36, 6, 14);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-3, -36, 6, 14);
  // Gun barrel
  ctx.fillStyle = '#444444';
  ctx.fillRect(-1.5, -42, 3, 8);
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  ctx.strokeRect(-1.5, -42, 3, 8);
  // Muzzle flash hint
  ctx.fillStyle = 'rgba(255,200,50,0.3)';
  ctx.beginPath();
  ctx.arc(0, -42, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Head (skin-colored with helmet)
  const headY = cy - 28 + 5;
  // Helmet
  drawOutlinedEllipse(ctx, cx, headY - 2, 17, 15, '#445544', 2.5);
  // Face
  drawOutlinedEllipse(ctx, cx, headY + 2, 14, 11, '#eebb99', 2);
  addTopLeftHighlight(ctx, cx, headY + 2, 14, 11, '#ffffff');

  // Eyes (normal, not glowing)
  for (const dx of [-5, 5]) {
    ctx.beginPath();
    ctx.arc(cx + dx, headY + 1, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + dx, headY + 1, 1, 0, Math.PI * 2);
    ctx.fillStyle = '#2244aa';
    ctx.fill();
  }

  save(canvas, 'player_default.png');
}

// ─── 17. Player Damaged ──────────────────────────────────────────────────────

function generatePlayerDamaged() {
  const { canvas, ctx } = newCanvas();

  const cx = HALF;
  const cy = HALF + 4;
  const color = '#0066cc';
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx + 3, cy + 3, 24, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + side * 10, cy + 12);
    ctx.rotate(side * 0.1);
    drawOutlinedRoundRect(ctx, -5, 0, 10, 18, 3, '#333344');
    drawOutlinedRoundRect(ctx, -5, 14, 10, 6, 2, '#222233');
    ctx.restore();
  }

  // Body
  drawOutlinedEllipse(ctx, cx, cy, 22, 28, color, 2.5);
  addBodyShading(ctx, cx, cy, 22, 28);

  // Red damage tint overlay
  ctx.fillStyle = 'rgba(200,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 22, 28, 0, 0, Math.PI * 2);
  ctx.fill();

  // Vest details
  ctx.strokeStyle = darken(color, 0.7);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - 12, cy - 5, 8, 10);
  ctx.strokeRect(cx + 4, cy - 5, 8, 10);
  ctx.strokeStyle = darken(color, 0.5);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 22);
  ctx.lineTo(cx, cy - 16);
  ctx.lineTo(cx + 8, cy - 22);
  ctx.stroke();

  // Blood splatters on body
  ctx.fillStyle = 'rgba(180,0,0,0.6)';
  const splatters = [
    [cx - 8, cy + 5, 6],
    [cx + 12, cy - 3, 5],
    [cx - 3, cy + 15, 4],
    [cx + 6, cy + 10, 5],
    [cx - 14, cy - 8, 3]
  ];
  for (const [sx, sy, sr] of splatters) {
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
    // Splatter drops
    for (let d = 0; d < 3; d++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = sr + Math.random() * 4;
      ctx.beginPath();
      ctx.arc(
        sx + Math.cos(angle) * dist,
        sy + Math.sin(angle) * dist,
        1 + Math.random(),
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  // Left arm
  ctx.save();
  ctx.translate(cx - 24, cy - 6);
  ctx.rotate(-0.4);
  drawOutlinedRoundRect(ctx, -4, -20, 9, 22, 3, color);
  ctx.beginPath();
  ctx.arc(0, -20, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#eebb99';
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Right arm with gun
  ctx.save();
  ctx.translate(cx + 24, cy - 6);
  ctx.rotate(-1.0);
  drawOutlinedRoundRect(ctx, -4, -22, 9, 22, 3, color);
  ctx.beginPath();
  ctx.arc(0, -22, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#eebb99';
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#333333';
  ctx.fillRect(-3, -36, 6, 14);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-3, -36, 6, 14);
  ctx.fillStyle = '#444444';
  ctx.fillRect(-1.5, -42, 3, 8);
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  ctx.strokeRect(-1.5, -42, 3, 8);
  ctx.restore();

  // Head with damage
  const headY = cy - 28 + 5;
  drawOutlinedEllipse(ctx, cx, headY - 2, 17, 15, '#445544', 2.5);
  drawOutlinedEllipse(ctx, cx, headY + 2, 14, 11, '#eebb99', 2);
  // Red tint on face
  ctx.fillStyle = 'rgba(200,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(cx, headY + 2, 14, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Blood on face
  ctx.fillStyle = 'rgba(160,0,0,0.5)';
  ctx.beginPath();
  ctx.arc(cx + 8, headY + 3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - 5, headY - 3, 2, 0, Math.PI * 2);
  ctx.fill();

  // Eyes (slightly red-tinted)
  for (const dx of [-5, 5]) {
    ctx.beginPath();
    ctx.arc(cx + dx, headY + 1, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffdddd';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + dx, headY + 1, 1, 0, Math.PI * 2);
    ctx.fillStyle = '#cc3333';
    ctx.fill();
  }

  // Overall red vignette
  const vignette = ctx.createRadialGradient(cx, cy, 20, cx, cy, 64);
  vignette.addColorStop(0, 'rgba(200,0,0,0)');
  vignette.addColorStop(1, 'rgba(200,0,0,0.15)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, SIZE, SIZE);

  save(canvas, 'player_damaged.png');
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log('Generating zombie sprite PNGs...');
  console.log(`Output: ${OUTPUT_DIR}\n`);

  generateNormalZombie();
  generateFastZombie();
  generateTankZombie();
  generateExplosiveZombie();
  generateHealerZombie();
  generateSlowerZombie();
  generatePoisonZombie();
  generateShooterZombie();
  generateTeleporterZombie();
  generateSummonerZombie();
  generateShieldedZombie();
  generateBerserkerZombie();
  generateMinionZombie();
  generateBossZombie();
  generateEliteZombie();
  generatePlayerDefault();
  generatePlayerDamaged();

  console.log('\nDone! 17 sprites generated.');
}

main();
