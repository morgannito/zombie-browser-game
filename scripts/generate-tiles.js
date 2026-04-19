/**
 * generate-tiles.js
 *
 * Generates PNG tile images, backgrounds, item sprites, and effect sprites
 * for a top-down zombie survival game using node-canvas.
 *
 * Output directories (public/assets/ = the folder served by express.static):
 *   public/assets/tiles/        - 64x64 seamless floor/wall tiles
 *   public/assets/backgrounds/  - 512x512 parallax backgrounds
 *   public/assets/sprites/items/ - 64x64 item/powerup sprites
 *   public/assets/sprites/effects/ - various effect sprite sheets
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Directories
// ---------------------------------------------------------------------------
const BASE = path.resolve(__dirname, '..', 'public', 'assets');
const DIRS = {
  tiles: path.join(BASE, 'tiles'),
  backgrounds: path.join(BASE, 'backgrounds'),
  items: path.join(BASE, 'sprites', 'items'),
  effects: path.join(BASE, 'sprites', 'effects')
};

for (const dir of Object.values(DIRS)) {
  fs.mkdirSync(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seeded PRNG (mulberry32) for deterministic output */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rng = mulberry32(42);

function rand(min = 0, max = 1) {
  return min + rng() * (max - min);
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function rgbStr(r, g, b, a = 1) {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
}

function colorVariant(hex, variance = 10) {
  const { r, g, b } = hexToRgb(hex);
  return rgbStr(
    Math.max(0, Math.min(255, r + rand(-variance, variance))),
    Math.max(0, Math.min(255, g + rand(-variance, variance))),
    Math.max(0, Math.min(255, b + rand(-variance, variance)))
  );
}

function save(canvas, dir, filename) {
  const buf = canvas.toBuffer('image/png');
  const fp = path.join(dir, filename);
  fs.writeFileSync(fp, buf);
  console.log(`  [OK] ${path.relative(BASE, fp)}  (${buf.length} bytes)`);
}

/** Fill canvas with noise for texture */
function noiseOverlay(ctx, w, h, _alpha = 0.05) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = rand(-30, 30);
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);
}

/** Draw a seamless-friendly crack */
function drawCrack(ctx, w, h, color = 'rgba(0,0,0,0.3)', count = 3) {
  for (let c = 0; c < count; c++) {
    ctx.beginPath();
    let x = rand(0, w);
    let y = rand(0, h);
    ctx.moveTo(x, y);
    const segs = randInt(3, 7);
    for (let s = 0; s < segs; s++) {
      x += rand(-12, 12);
      y += rand(-12, 12);
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = rand(0.5, 1.5);
    ctx.stroke();
  }
}

/** Draw small debris dots */
function drawDebris(ctx, w, h, color = 'rgba(60,60,60,0.4)', count = 15) {
  for (let i = 0; i < count; i++) {
    const x = rand(0, w);
    const y = rand(0, h);
    const r = rand(0.5, 2);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

/** Make a tile seamless by blending the edges using mirrored overlap */
function makeSeamless(canvas, size, blendWidth = 8) {
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, size, size);
  const d = imgData.data;

  // Blend left-right edges
  for (let y = 0; y < size; y++) {
    for (let b = 0; b < blendWidth; b++) {
      const t = b / blendWidth; // 0..1
      const leftIdx = (y * size + b) * 4;
      const rightIdx = (y * size + (size - blendWidth + b)) * 4;
      for (let c = 0; c < 3; c++) {
        const avg = (d[leftIdx + c] + d[rightIdx + c]) / 2;
        d[leftIdx + c] = Math.round(d[leftIdx + c] * t + avg * (1 - t));
        d[rightIdx + c] = Math.round(d[rightIdx + c] * (1 - t) + avg * t);
      }
    }
  }

  // Blend top-bottom edges
  for (let x = 0; x < size; x++) {
    for (let b = 0; b < blendWidth; b++) {
      const t = b / blendWidth;
      const topIdx = (b * size + x) * 4;
      const botIdx = ((size - blendWidth + b) * size + x) * 4;
      for (let c = 0; c < 3; c++) {
        const avg = (d[topIdx + c] + d[botIdx + c]) / 2;
        d[topIdx + c] = Math.round(d[topIdx + c] * t + avg * (1 - t));
        d[botIdx + c] = Math.round(d[botIdx + c] * (1 - t) + avg * t);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

// ---------------------------------------------------------------------------
// TILES (64x64)
// ---------------------------------------------------------------------------

function generateFloorConcrete() {
  const size = 64;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Base fill
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, size, size);

  // Shade variation patches
  for (let i = 0; i < 20; i++) {
    const x = rand(0, size);
    const y = rand(0, size);
    const r = rand(5, 20);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${randInt(20, 35)},${randInt(20, 35)},${randInt(40, 55)},0.4)`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  // Cracks
  drawCrack(ctx, size, size, 'rgba(0,0,0,0.35)', 5);
  drawCrack(ctx, size, size, 'rgba(40,40,60,0.25)', 3);

  // Debris
  drawDebris(ctx, size, size, 'rgba(50,50,70,0.5)', 20);

  noiseOverlay(ctx, size, size);
  makeSeamless(canvas, size);
  save(canvas, DIRS.tiles, 'floor_concrete.png');
}

function generateFloorDirt() {
  const size = 64;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(0, 0, size, size);

  // Earth variations
  for (let i = 0; i < 30; i++) {
    const x = rand(0, size);
    const y = rand(0, size);
    const r = rand(3, 15);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${randInt(50, 70)},${randInt(35, 50)},${randInt(20, 35)},0.4)`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  // Pebbles
  for (let i = 0; i < 12; i++) {
    const x = rand(2, size - 2);
    const y = rand(2, size - 2);
    const rx = rand(1, 3);
    const ry = rand(1, 2.5);
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rand(0, Math.PI), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${randInt(80, 110)},${randInt(70, 90)},${randInt(50, 70)},0.6)`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Small grass patches at edges
  for (let i = 0; i < 8; i++) {
    const edge = randInt(0, 3);
    let x, y;
    if (edge === 0) {
      x = rand(0, size);
      y = rand(0, 8);
    } else if (edge === 1) {
      x = rand(0, size);
      y = rand(size - 8, size);
    } else if (edge === 2) {
      x = rand(0, 8);
      y = rand(0, size);
    } else {
      x = rand(size - 8, size);
      y = rand(0, size);
    }

    for (let g = 0; g < 3; g++) {
      ctx.beginPath();
      ctx.moveTo(x + rand(-2, 2), y);
      ctx.lineTo(x + rand(-3, 3), y - rand(3, 7));
      ctx.strokeStyle = `rgba(${randInt(30, 60)},${randInt(80, 120)},${randInt(20, 40)},0.5)`;
      ctx.lineWidth = rand(0.5, 1.2);
      ctx.stroke();
    }
  }

  noiseOverlay(ctx, size, size);
  makeSeamless(canvas, size);
  save(canvas, DIRS.tiles, 'floor_dirt.png');
}

function generateFloorMetal() {
  const size = 64;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#2a2a3a';
  ctx.fillRect(0, 0, size, size);

  // Grid pattern
  const gridSize = 16;
  ctx.strokeStyle = 'rgba(60,60,80,0.6)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= size; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  for (let y = 0; y <= size; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  // Inner grid lines (grating holes)
  ctx.strokeStyle = 'rgba(15,15,25,0.5)';
  ctx.lineWidth = 1;
  for (let x = gridSize / 2; x < size; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  for (let y = gridSize / 2; y < size; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  // Rivets at intersections
  for (let x = 0; x <= size; x += gridSize) {
    for (let y = 0; y <= size; y += gridSize) {
      // Rivet base
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(70,70,90,0.8)';
      ctx.fill();
      // Rivet highlight
      ctx.beginPath();
      ctx.arc(x - 0.5, y - 0.5, 1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(120,120,150,0.5)';
      ctx.fill();
    }
  }

  // Slight shine highlights
  for (let i = 0; i < 5; i++) {
    const x = rand(0, size);
    const y = rand(0, size);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, rand(8, 20));
    grad.addColorStop(0, 'rgba(100,100,140,0.15)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  noiseOverlay(ctx, size, size);
  makeSeamless(canvas, size);
  save(canvas, DIRS.tiles, 'floor_metal.png');
}

function generateFloorLab() {
  const size = 64;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1e2e1e';
  ctx.fillRect(0, 0, size, size);

  // Checkered pattern
  const checkSize = 32;
  for (let cx = 0; cx < size; cx += checkSize) {
    for (let cy = 0; cy < size; cy += checkSize) {
      const isLight = (cx / checkSize + cy / checkSize) % 2 === 0;
      ctx.fillStyle = isLight ? 'rgba(35,55,35,0.6)' : 'rgba(25,40,25,0.6)';
      ctx.fillRect(cx, cy, checkSize, checkSize);
    }
  }

  // Grid lines (clean)
  ctx.strokeStyle = 'rgba(50,80,50,0.3)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= size; x += checkSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  for (let y = 0; y <= size; y += checkSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  // Subtle green glow in center
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(50,120,50,0.08)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  noiseOverlay(ctx, size, size);
  makeSeamless(canvas, size);
  save(canvas, DIRS.tiles, 'floor_lab.png');
}

function generateFloorBlood() {
  const size = 64;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Same concrete base
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 20; i++) {
    const x = rand(0, size);
    const y = rand(0, size);
    const r = rand(5, 20);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${randInt(20, 35)},${randInt(20, 35)},${randInt(40, 55)},0.4)`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  drawCrack(ctx, size, size, 'rgba(0,0,0,0.3)', 3);

  // Blood splatters
  for (let i = 0; i < 5; i++) {
    const x = rand(10, size - 10);
    const y = rand(10, size - 10);
    const r = rand(4, 14);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${randInt(120, 180)},${randInt(10, 30)},${randInt(10, 25)},0.7)`);
    grad.addColorStop(0.6, `rgba(${randInt(100, 150)},${randInt(5, 20)},${randInt(5, 15)},0.4)`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  // Blood streaks
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const sx = rand(5, size - 5);
    const sy = rand(5, size - 5);
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(
      sx + rand(-15, 15),
      sy + rand(5, 15),
      sx + rand(-15, 15),
      sy + rand(10, 25),
      sx + rand(-10, 10),
      sy + rand(15, 30)
    );
    ctx.strokeStyle = `rgba(${randInt(130, 170)},${randInt(10, 30)},${randInt(10, 20)},0.5)`;
    ctx.lineWidth = rand(1, 3);
    ctx.stroke();
  }

  noiseOverlay(ctx, size, size);
  makeSeamless(canvas, size);
  save(canvas, DIRS.tiles, 'floor_blood.png');
}

function generateWallBrick() {
  const size = 64;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Mortar base
  ctx.fillStyle = '#1d1d34';
  ctx.fillRect(0, 0, size, size);

  // Draw bricks
  const brickW = 16;
  const brickH = 8;
  const mortar = 1;

  for (let row = 0; row < Math.ceil(size / brickH); row++) {
    const offset = (row % 2) * (brickW / 2);
    for (let col = -1; col < Math.ceil(size / brickW) + 1; col++) {
      const x = col * brickW + offset;
      const y = row * brickH;

      // Brick body
      const baseR = randInt(35, 55);
      const baseG = randInt(35, 55);
      const baseB = randInt(55, 75);
      ctx.fillStyle = rgbStr(baseR, baseG, baseB);
      ctx.fillRect(x + mortar, y + mortar, brickW - mortar * 2, brickH - mortar * 2);

      // Slight top highlight
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x + mortar, y + mortar, brickW - mortar * 2, 1);

      // Slight bottom shadow
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(x + mortar, y + brickH - mortar - 1, brickW - mortar * 2, 1);
    }
  }

  // Slight damage spots
  for (let i = 0; i < 4; i++) {
    const x = rand(0, size);
    const y = rand(0, size);
    const r = rand(2, 5);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,20,35,0.5)';
    ctx.fill();
  }

  drawCrack(ctx, size, size, 'rgba(0,0,0,0.3)', 2);
  noiseOverlay(ctx, size, size);
  makeSeamless(canvas, size);
  save(canvas, DIRS.tiles, 'wall_brick.png');
}

function generateWallMetal() {
  const size = 64;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#3a3a4a';
  ctx.fillRect(0, 0, size, size);

  // Panels
  const panelSize = 32;
  for (let px = 0; px < size; px += panelSize) {
    for (let py = 0; py < size; py += panelSize) {
      // Panel body
      const grad = ctx.createLinearGradient(px, py, px + panelSize, py + panelSize);
      grad.addColorStop(0, 'rgba(70,70,85,0.3)');
      grad.addColorStop(0.5, 'rgba(50,50,65,0.1)');
      grad.addColorStop(1, 'rgba(35,35,50,0.3)');
      ctx.fillStyle = grad;
      ctx.fillRect(px + 1, py + 1, panelSize - 2, panelSize - 2);

      // Panel border
      ctx.strokeStyle = 'rgba(80,80,100,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, panelSize - 1, panelSize - 1);

      // Bolts in corners
      const boltPositions = [
        [px + 4, py + 4],
        [px + panelSize - 4, py + 4],
        [px + 4, py + panelSize - 4],
        [px + panelSize - 4, py + panelSize - 4]
      ];
      for (const [bx, by] of boltPositions) {
        ctx.beginPath();
        ctx.arc(bx, by, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(80,80,100,0.7)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bx - 0.3, by - 0.3, 0.8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(130,130,160,0.5)';
        ctx.fill();
      }
    }
  }

  // Scratches
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    const sx = rand(0, size);
    const sy = rand(0, size);
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + rand(-15, 15), sy + rand(-15, 15));
    ctx.strokeStyle = 'rgba(90,90,110,0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  noiseOverlay(ctx, size, size);
  makeSeamless(canvas, size);
  save(canvas, DIRS.tiles, 'wall_metal.png');
}

function generateWallLab() {
  const size = 64;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#2e3e2e';
  ctx.fillRect(0, 0, size, size);

  // Clean tile grid
  const tileSize = 16;
  for (let tx = 0; tx < size; tx += tileSize) {
    for (let ty = 0; ty < size; ty += tileSize) {
      const brightness = rand(-8, 8);
      ctx.fillStyle = `rgba(${46 + brightness},${62 + brightness},${46 + brightness},0.5)`;
      ctx.fillRect(tx + 0.5, ty + 0.5, tileSize - 1, tileSize - 1);
    }
  }

  // Grout lines
  ctx.strokeStyle = 'rgba(60,90,60,0.4)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= size; x += tileSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  for (let y = 0; y <= size; y += tileSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  // Green glow
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.6);
  grad.addColorStop(0, 'rgba(60,150,60,0.07)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  noiseOverlay(ctx, size, size);
  makeSeamless(canvas, size);
  save(canvas, DIRS.tiles, 'wall_lab.png');
}

function generateWallDamaged() {
  const size = 64;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Start with brick base
  ctx.fillStyle = '#1d1d34';
  ctx.fillRect(0, 0, size, size);

  const brickW = 16;
  const brickH = 8;
  const mortar = 1;

  for (let row = 0; row < Math.ceil(size / brickH); row++) {
    const offset = (row % 2) * (brickW / 2);
    for (let col = -1; col < Math.ceil(size / brickW) + 1; col++) {
      const x = col * brickW + offset;
      const y = row * brickH;
      ctx.fillStyle = colorVariant('#2d2d44', 12);
      ctx.fillRect(x + mortar, y + mortar, brickW - mortar * 2, brickH - mortar * 2);
    }
  }

  // Missing chunks (dark holes)
  for (let i = 0; i < 3; i++) {
    const cx = rand(10, size - 10);
    const cy = rand(10, size - 10);
    const rx = rand(5, 12);
    const ry = rand(4, 10);

    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, rand(0, Math.PI), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,10,18,0.9)';
    ctx.fill();

    // Inner depth gradient
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    grad.addColorStop(0, 'rgba(5,5,10,0.8)');
    grad.addColorStop(1, 'rgba(20,20,35,0.3)');
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Heavy cracks
  drawCrack(ctx, size, size, 'rgba(0,0,0,0.5)', 8);
  drawCrack(ctx, size, size, 'rgba(30,30,50,0.4)', 5);

  // Exposed rebar
  for (let i = 0; i < 2; i++) {
    const sx = rand(15, size - 15);
    const sy = rand(10, size - 10);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + rand(-5, 5), sy + rand(10, 25));
    ctx.strokeStyle = 'rgba(120,80,50,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Rust highlight
    ctx.beginPath();
    ctx.moveTo(sx + 1, sy);
    ctx.lineTo(sx + 1 + rand(-5, 5), sy + rand(10, 25));
    ctx.strokeStyle = 'rgba(150,100,60,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  noiseOverlay(ctx, size, size);
  makeSeamless(canvas, size);
  save(canvas, DIRS.tiles, 'wall_damaged.png');
}

function generateWallFence() {
  const size = 64;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Transparent base
  ctx.clearRect(0, 0, size, size);

  // Chain-link pattern - diamond grid
  const spacing = 8;
  ctx.strokeStyle = 'rgba(150,150,170,0.6)';
  ctx.lineWidth = 1;

  // Diagonal lines one way
  for (let i = -size; i < size * 2; i += spacing) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
  }

  // Diagonal lines other way
  for (let i = -size; i < size * 2; i += spacing) {
    ctx.beginPath();
    ctx.moveTo(i + size, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
  }

  // Thicker wire at intersections (nodes)
  for (let x = 0; x < size; x += spacing) {
    for (let y = 0; y < size; y += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(170,170,190,0.5)';
      ctx.fill();
    }
  }

  // Slight metallic sheen
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, 'rgba(200,200,220,0.05)');
  grad.addColorStop(0.5, 'rgba(200,200,220,0.1)');
  grad.addColorStop(1, 'rgba(200,200,220,0.05)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Fence posts at edges
  ctx.fillStyle = 'rgba(100,100,120,0.7)';
  ctx.fillRect(0, 0, 2, size);
  ctx.fillRect(size - 2, 0, 2, size);

  save(canvas, DIRS.tiles, 'wall_fence.png');
}

// ---------------------------------------------------------------------------
// BACKGROUNDS (512x512)
// ---------------------------------------------------------------------------

function generateBgCity() {
  const w = 512,
    h = 512;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  // Dark sky with orange glow at bottom
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
  skyGrad.addColorStop(0, '#0a0a15');
  skyGrad.addColorStop(0.5, '#151525');
  skyGrad.addColorStop(0.8, '#2a1a15');
  skyGrad.addColorStop(1, '#4a2510');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // Stars
  for (let i = 0; i < 50; i++) {
    const x = rand(0, w);
    const y = rand(0, h * 0.4);
    const r = rand(0.3, 1.2);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${rand(0.2, 0.7)})`;
    ctx.fill();
  }

  // Smoke/haze layers
  for (let i = 0; i < 8; i++) {
    const x = rand(0, w);
    const y = rand(h * 0.3, h * 0.7);
    const rx = rand(60, 150);
    const ry = rand(30, 60);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    grad.addColorStop(0, `rgba(${randInt(40, 70)},${randInt(25, 40)},${randInt(15, 30)},0.2)`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // Building silhouettes - back layer (smaller, darker)
  ctx.fillStyle = 'rgba(10,10,20,0.7)';
  for (let i = 0; i < 12; i++) {
    const bw = rand(20, 60);
    const bh = rand(80, 250);
    const bx = rand(-20, w);
    const by = h - bh - rand(20, 80);
    ctx.fillRect(bx, by, bw, bh + 200);

    // Windows
    for (let wx = bx + 4; wx < bx + bw - 4; wx += 8) {
      for (let wy = by + 6; wy < by + bh - 10; wy += 12) {
        if (rng() < 0.3) {
          ctx.fillStyle = `rgba(${randInt(200, 255)},${randInt(150, 200)},${randInt(50, 100)},${rand(0.1, 0.4)})`;
          ctx.fillRect(wx, wy, 4, 5);
        }
      }
    }
    ctx.fillStyle = 'rgba(10,10,20,0.7)';
  }

  // Building silhouettes - front layer (bigger, darker)
  ctx.fillStyle = 'rgba(5,5,12,0.9)';
  for (let i = 0; i < 8; i++) {
    const bw = rand(30, 80);
    const bh = rand(100, 300);
    const bx = rand(-20, w);
    const by = h - bh - rand(0, 40);
    ctx.fillRect(bx, by, bw, bh + 200);

    // Windows
    for (let wx = bx + 5; wx < bx + bw - 5; wx += 10) {
      for (let wy = by + 8; wy < by + bh - 10; wy += 14) {
        if (rng() < 0.2) {
          ctx.fillStyle = `rgba(${randInt(220, 255)},${randInt(180, 220)},${randInt(80, 120)},${rand(0.15, 0.5)})`;
          ctx.fillRect(wx, wy, 5, 6);
        }
      }
    }
    ctx.fillStyle = 'rgba(5,5,12,0.9)';
  }

  // Fire glow at base
  for (let i = 0; i < 5; i++) {
    const x = rand(50, w - 50);
    const y = h - rand(20, 80);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, rand(30, 70));
    grad.addColorStop(0, `rgba(255,${randInt(100, 160)},0,0.15)`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  save(canvas, DIRS.backgrounds, 'bg_city.png');
}

function generateBgForest() {
  const w = 512,
    h = 512;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  // Night sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
  skyGrad.addColorStop(0, '#050510');
  skyGrad.addColorStop(0.4, '#0a0a1a');
  skyGrad.addColorStop(1, '#0d1a0d');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // Moon
  const moonX = w * 0.75;
  const moonY = h * 0.15;
  const moonGrad = ctx.createRadialGradient(moonX, moonY, 5, moonX, moonY, 40);
  moonGrad.addColorStop(0, 'rgba(220,220,240,0.9)');
  moonGrad.addColorStop(0.3, 'rgba(180,180,210,0.4)');
  moonGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = moonGrad;
  ctx.fillRect(0, 0, w, h);

  // Stars
  for (let i = 0; i < 40; i++) {
    const x = rand(0, w);
    const y = rand(0, h * 0.35);
    ctx.beginPath();
    ctx.arc(x, y, rand(0.3, 1), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${rand(0.2, 0.6)})`;
    ctx.fill();
  }

  // Fog layers
  for (let i = 0; i < 6; i++) {
    const y = rand(h * 0.4, h * 0.8);
    const grad = ctx.createRadialGradient(w / 2, y, 0, w / 2, y, w * 0.6);
    grad.addColorStop(0, 'rgba(100,120,130,0.08)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // Pine tree function
  function drawPineTree(x, baseY, scale, darkness) {
    const treeH = 80 * scale;
    const treeW = 35 * scale;

    // Trunk
    ctx.fillStyle = `rgba(${30 * darkness},${20 * darkness},${15 * darkness},0.9)`;
    ctx.fillRect(x - 3 * scale, baseY - 10 * scale, 6 * scale, 15 * scale);

    // Foliage layers
    for (let layer = 0; layer < 4; layer++) {
      const ly = baseY - 10 * scale - layer * (treeH / 5);
      const lw = treeW * (1 - layer * 0.2);
      ctx.beginPath();
      ctx.moveTo(x, ly - treeH / 4);
      ctx.lineTo(x - lw / 2, ly);
      ctx.lineTo(x + lw / 2, ly);
      ctx.closePath();
      ctx.fillStyle = `rgba(${Math.round(15 * darkness)},${Math.round(30 * darkness)},${Math.round(15 * darkness)},0.9)`;
      ctx.fill();
    }
  }

  // Background trees (smaller, lighter)
  for (let i = 0; i < 20; i++) {
    drawPineTree(rand(0, w), h * 0.5 + rand(0, h * 0.15), rand(0.4, 0.8), rand(0.6, 0.8));
  }

  // Foreground trees (bigger, darker)
  for (let i = 0; i < 12; i++) {
    drawPineTree(rand(0, w), h * 0.65 + rand(0, h * 0.3), rand(0.8, 1.5), rand(0.3, 0.6));
  }

  // Ground fog
  const fogGrad = ctx.createLinearGradient(0, h * 0.7, 0, h);
  fogGrad.addColorStop(0, 'rgba(0,0,0,0)');
  fogGrad.addColorStop(1, 'rgba(60,80,70,0.2)');
  ctx.fillStyle = fogGrad;
  ctx.fillRect(0, 0, w, h);

  save(canvas, DIRS.backgrounds, 'bg_forest.png');
}

function generateBgLab() {
  const w = 512,
    h = 512;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  // Dark base
  ctx.fillStyle = '#0a150a';
  ctx.fillRect(0, 0, w, h);

  // Corridor-like perspective
  // Floor/ceiling lines
  ctx.strokeStyle = 'rgba(40,80,40,0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 20; i++) {
    const y = h * 0.3 + i * 12;
    const perspX = (i / 20) * 100;
    ctx.beginPath();
    ctx.moveTo(perspX, y);
    ctx.lineTo(w - perspX, y);
    ctx.stroke();
  }

  // Wall panels
  for (let x = 0; x < w; x += 60) {
    ctx.strokeStyle = 'rgba(30,60,30,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 5, 30, 50, h - 60);
    ctx.fillStyle = 'rgba(20,40,20,0.3)';
    ctx.fillRect(x + 5, 30, 50, h - 60);
  }

  // Pipes
  for (let i = 0; i < 5; i++) {
    const py = rand(20, 60);
    ctx.strokeStyle = 'rgba(70,70,80,0.6)';
    ctx.lineWidth = rand(3, 8);
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(w, py + rand(-10, 10));
    ctx.stroke();

    // Pipe joints
    for (let jx = rand(30, 80); jx < w; jx += rand(60, 120)) {
      ctx.beginPath();
      ctx.arc(jx, py, ctx.lineWidth * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(80,80,90,0.5)';
      ctx.fill();
    }
  }

  // Bottom pipes
  for (let i = 0; i < 3; i++) {
    const py = h - rand(20, 50);
    ctx.strokeStyle = 'rgba(60,60,70,0.5)';
    ctx.lineWidth = rand(4, 10);
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(w, py);
    ctx.stroke();
  }

  // Green lighting
  for (let i = 0; i < 6; i++) {
    const lx = rand(50, w - 50);
    const ly = rand(40, h - 40);
    const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, rand(50, 120));
    grad.addColorStop(0, `rgba(30,${randInt(100, 180)},30,0.15)`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // Steam/vapor
  for (let i = 0; i < 4; i++) {
    const sx = rand(0, w);
    const sy = rand(h * 0.6, h);
    for (let p = 0; p < 10; p++) {
      const px = sx + rand(-30, 30);
      const py = sy + rand(-40, 0);
      const pr = rand(5, 20);
      const grad = ctx.createRadialGradient(px, py, 0, px, py, pr);
      grad.addColorStop(0, 'rgba(150,200,150,0.06)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  }

  save(canvas, DIRS.backgrounds, 'bg_lab.png');
}

function generateBgCemetery() {
  const w = 512,
    h = 512;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  // Sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
  skyGrad.addColorStop(0, '#08081a');
  skyGrad.addColorStop(0.5, '#121225');
  skyGrad.addColorStop(1, '#1a1a20');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // Moon
  const moonX = w * 0.3;
  const moonY = h * 0.12;
  const moonGrad = ctx.createRadialGradient(moonX, moonY, 3, moonX, moonY, 35);
  moonGrad.addColorStop(0, 'rgba(200,200,230,0.8)');
  moonGrad.addColorStop(0.3, 'rgba(150,150,200,0.3)');
  moonGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = moonGrad;
  ctx.fillRect(0, 0, w, h);

  // Ground
  const groundY = h * 0.65;
  ctx.fillStyle = '#151520';
  ctx.fillRect(0, groundY, w, h - groundY);

  // Ground gradient
  const gGrad = ctx.createLinearGradient(0, groundY, 0, h);
  gGrad.addColorStop(0, 'rgba(25,25,35,0.8)');
  gGrad.addColorStop(1, 'rgba(15,15,20,1)');
  ctx.fillStyle = gGrad;
  ctx.fillRect(0, groundY, w, h - groundY);

  // Tombstones
  function drawTombstone(x, baseY, scale) {
    const tw = 15 * scale;
    const th = 25 * scale;

    ctx.fillStyle = `rgba(${randInt(50, 70)},${randInt(50, 70)},${randInt(60, 80)},0.9)`;

    // Main body
    ctx.fillRect(x - tw / 2, baseY - th, tw, th);

    // Rounded top
    ctx.beginPath();
    ctx.arc(x, baseY - th, tw / 2, Math.PI, 0);
    ctx.fill();

    // Shadow side
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x, baseY - th, tw / 2, th);

    // Cross mark
    ctx.strokeStyle = 'rgba(90,90,100,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, baseY - th * 0.7);
    ctx.lineTo(x, baseY - th * 0.3);
    ctx.moveTo(x - tw * 0.2, baseY - th * 0.55);
    ctx.lineTo(x + tw * 0.2, baseY - th * 0.55);
    ctx.stroke();
  }

  // Back row tombstones
  for (let i = 0; i < 10; i++) {
    drawTombstone(rand(20, w - 20), groundY + rand(-5, 5), rand(0.6, 0.9));
  }

  // Front row tombstones
  for (let i = 0; i < 6; i++) {
    drawTombstone(rand(20, w - 20), groundY + rand(30, 80), rand(1.0, 1.4));
  }

  // Dead trees
  function drawDeadTree(x, baseY, scale) {
    ctx.strokeStyle = `rgba(${randInt(30, 50)},${randInt(25, 40)},${randInt(20, 35)},0.9)`;
    ctx.lineWidth = 3 * scale;

    // Trunk
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x + rand(-5, 5) * scale, baseY - 60 * scale);
    ctx.stroke();

    // Branches
    for (let b = 0; b < 4; b++) {
      const by = baseY - rand(20, 55) * scale;
      const dir = rng() < 0.5 ? -1 : 1;
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      ctx.moveTo(x, by);
      ctx.lineTo(x + dir * rand(15, 35) * scale, by - rand(10, 25) * scale);
      ctx.stroke();
    }
  }

  drawDeadTree(w * 0.15, groundY, 1.2);
  drawDeadTree(w * 0.8, groundY, 1.0);
  drawDeadTree(w * 0.55, groundY, 0.7);

  // Mist
  for (let i = 0; i < 10; i++) {
    const mx = rand(0, w);
    const my = groundY + rand(-20, 40);
    const grad = ctx.createRadialGradient(mx, my, 0, mx, my, rand(40, 100));
    grad.addColorStop(0, 'rgba(120,120,150,0.06)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  save(canvas, DIRS.backgrounds, 'bg_cemetery.png');
}

function generateBgWasteland() {
  const w = 512,
    h = 512;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  // Dark polluted sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
  skyGrad.addColorStop(0, '#0a0808');
  skyGrad.addColorStop(0.3, '#1a1210');
  skyGrad.addColorStop(0.6, '#2a1a12');
  skyGrad.addColorStop(1, '#1a1510');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // Haze/pollution
  for (let i = 0; i < 6; i++) {
    const y = rand(h * 0.2, h * 0.5);
    const grad = ctx.createLinearGradient(0, y - 40, 0, y + 40);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, `rgba(${randInt(40, 70)},${randInt(30, 50)},${randInt(20, 35)},0.1)`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // Ground
  const groundY = h * 0.6;
  const groundGrad = ctx.createLinearGradient(0, groundY, 0, h);
  groundGrad.addColorStop(0, '#2a2015');
  groundGrad.addColorStop(1, '#1a1510');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, groundY, w, h - groundY);

  // Barren land texture
  for (let i = 0; i < 30; i++) {
    const x = rand(0, w);
    const y = rand(groundY, h);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, rand(5, 25));
    grad.addColorStop(0, `rgba(${randInt(35, 55)},${randInt(25, 40)},${randInt(15, 25)},0.3)`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // Rusted vehicles silhouettes
  function drawRustedVehicle(x, baseY, scale) {
    ctx.fillStyle = `rgba(${randInt(40, 60)},${randInt(30, 45)},${randInt(20, 30)},0.8)`;

    // Body
    const bw = 50 * scale;
    const bh = 20 * scale;
    ctx.fillRect(x, baseY - bh, bw, bh);

    // Roof
    ctx.fillRect(x + bw * 0.2, baseY - bh - 12 * scale, bw * 0.5, 12 * scale);

    // Wheels (flat)
    ctx.beginPath();
    ctx.ellipse(x + bw * 0.2, baseY, 6 * scale, 4 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,20,25,0.8)';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + bw * 0.8, baseY, 6 * scale, 4 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rust streaks
    ctx.strokeStyle = `rgba(${randInt(100, 140)},${randInt(60, 80)},${randInt(30, 50)},0.3)`;
    ctx.lineWidth = 1;
    for (let r = 0; r < 3; r++) {
      ctx.beginPath();
      const rx = x + rand(0, bw);
      ctx.moveTo(rx, baseY - bh);
      ctx.lineTo(rx + rand(-5, 5), baseY);
      ctx.stroke();
    }
  }

  drawRustedVehicle(w * 0.1, groundY + 40, 1.2);
  drawRustedVehicle(w * 0.6, groundY + 60, 0.9);
  drawRustedVehicle(w * 0.4, groundY + 25, 0.7);

  // Distant ruined structures
  for (let i = 0; i < 4; i++) {
    const sx = rand(0, w);
    const sh = rand(30, 80);
    const sw = rand(15, 40);
    ctx.fillStyle = `rgba(20,18,15,${rand(0.4, 0.7)})`;
    ctx.fillRect(sx, groundY - sh, sw, sh + 10);

    // Broken top
    ctx.beginPath();
    ctx.moveTo(sx, groundY - sh);
    ctx.lineTo(sx + sw * 0.3, groundY - sh - rand(5, 15));
    ctx.lineTo(sx + sw * 0.7, groundY - sh - rand(0, 10));
    ctx.lineTo(sx + sw, groundY - sh);
    ctx.closePath();
    ctx.fill();
  }

  save(canvas, DIRS.backgrounds, 'bg_wasteland.png');
}

// ---------------------------------------------------------------------------
// ITEM SPRITES (64x64)
// ---------------------------------------------------------------------------

function generateCoinGold() {
  const size = 64;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2,
    cy = size / 2;

  // Outer glow
  const glowGrad = ctx.createRadialGradient(cx, cy, 12, cx, cy, 30);
  glowGrad.addColorStop(0, 'rgba(255,200,50,0.3)');
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, size, size);

  // Coin body
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  const coinGrad = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, 18);
  coinGrad.addColorStop(0, '#ffe066');
  coinGrad.addColorStop(0.5, '#daa520');
  coinGrad.addColorStop(1, '#b8860b');
  ctx.fillStyle = coinGrad;
  ctx.fill();

  // Dark outline
  ctx.strokeStyle = '#8b6914';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner ring
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(180,150,50,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // $ symbol
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8b6914';
  ctx.fillText('$', cx + 1, cy + 1);
  ctx.fillStyle = '#ffe066';
  ctx.fillText('$', cx, cy);

  // Shine highlight
  ctx.beginPath();
  ctx.ellipse(cx - 5, cy - 8, 6, 3, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,220,0.4)';
  ctx.fill();

  save(canvas, DIRS.items, 'coin_gold.png');
}

function generateCoinGem() {
  const size = 64;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2,
    cy = size / 2;

  // Glow
  const glowGrad = ctx.createRadialGradient(cx, cy, 5, cx, cy, 28);
  glowGrad.addColorStop(0, 'rgba(100,80,255,0.3)');
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, size, size);

  // Diamond shape
  ctx.beginPath();
  ctx.moveTo(cx, cy - 20); // top
  ctx.lineTo(cx + 16, cy); // right
  ctx.lineTo(cx, cy + 20); // bottom
  ctx.lineTo(cx - 16, cy); // left
  ctx.closePath();

  const gemGrad = ctx.createLinearGradient(cx - 16, cy - 20, cx + 16, cy + 20);
  gemGrad.addColorStop(0, '#8080ff');
  gemGrad.addColorStop(0.3, '#6060cc');
  gemGrad.addColorStop(0.7, '#a060ff');
  gemGrad.addColorStop(1, '#4040aa');
  ctx.fillStyle = gemGrad;
  ctx.fill();
  ctx.strokeStyle = '#3030aa';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Facet lines
  ctx.strokeStyle = 'rgba(150,150,255,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy);
  ctx.lineTo(cx - 5, cy - 8);
  ctx.lineTo(cx + 5, cy - 8);
  ctx.lineTo(cx + 16, cy);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, cy - 20);
  ctx.lineTo(cx - 5, cy - 8);
  ctx.moveTo(cx, cy - 20);
  ctx.lineTo(cx + 5, cy - 8);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - 5, cy - 8);
  ctx.lineTo(cx, cy + 20);
  ctx.moveTo(cx + 5, cy - 8);
  ctx.lineTo(cx, cy + 20);
  ctx.stroke();

  // Sparkle
  for (const [sx, sy] of [
    [cx - 6, cy - 12],
    [cx + 8, cy - 5],
    [cx - 3, cy + 6]
  ]) {
    ctx.beginPath();
    ctx.moveTo(sx - 3, sy);
    ctx.lineTo(sx, sy - 3);
    ctx.lineTo(sx + 3, sy);
    ctx.lineTo(sx, sy + 3);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
  }

  save(canvas, DIRS.items, 'coin_gem.png');
}

function generateHealthPotion() {
  const size = 64;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2,
    cy = size / 2;

  // Red glow
  const glowGrad = ctx.createRadialGradient(cx, cy + 4, 5, cx, cy + 4, 28);
  glowGrad.addColorStop(0, 'rgba(255,50,50,0.25)');
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, size, size);

  // Bottle body (round bottom)
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 5);
  ctx.lineTo(cx - 12, cy + 2);
  ctx.quadraticCurveTo(cx - 14, cy + 16, cx, cy + 18);
  ctx.quadraticCurveTo(cx + 14, cy + 16, cx + 12, cy + 2);
  ctx.lineTo(cx + 8, cy - 5);
  ctx.closePath();

  const bottleGrad = ctx.createLinearGradient(cx - 14, 0, cx + 14, 0);
  bottleGrad.addColorStop(0, '#cc2020');
  bottleGrad.addColorStop(0.3, '#ff4040');
  bottleGrad.addColorStop(0.7, '#dd3030');
  bottleGrad.addColorStop(1, '#991515');
  ctx.fillStyle = bottleGrad;
  ctx.fill();
  ctx.strokeStyle = '#661010';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Neck
  ctx.fillStyle = '#aa3030';
  ctx.fillRect(cx - 5, cy - 12, 10, 8);
  ctx.strokeStyle = '#661010';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - 5, cy - 12, 10, 8);

  // Cork
  ctx.fillStyle = '#8B7355';
  ctx.fillRect(cx - 4, cy - 16, 8, 5);
  ctx.strokeStyle = '#5a4a35';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - 4, cy - 16, 8, 5);

  // Cross label
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(cx - 1.5, cy + 2, 3, 10);
  ctx.fillRect(cx - 5, cy + 5.5, 10, 3);

  // Liquid highlight
  ctx.beginPath();
  ctx.ellipse(cx - 4, cy + 8, 3, 5, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,100,100,0.3)';
  ctx.fill();

  save(canvas, DIRS.items, 'health_potion.png');
}

function generateAmmoCrate() {
  const size = 64;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2,
    cy = size / 2;

  // Box body
  const bx = cx - 18,
    by = cy - 12;
  const bw = 36,
    bh = 24;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(bx + 3, by + 3, bw, bh);

  // Main body
  const boxGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
  boxGrad.addColorStop(0, '#5a6b3a');
  boxGrad.addColorStop(0.5, '#4a5a2a');
  boxGrad.addColorStop(1, '#3a4a1a');
  ctx.fillStyle = boxGrad;
  ctx.fillRect(bx, by, bw, bh);

  // Outline
  ctx.strokeStyle = '#2a3a10';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh);

  // Lid line
  ctx.beginPath();
  ctx.moveTo(bx, by + 5);
  ctx.lineTo(bx + bw, by + 5);
  ctx.strokeStyle = '#2a3a10';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Metal clasps
  ctx.fillStyle = '#808080';
  ctx.fillRect(bx + bw * 0.25 - 2, by + 2, 4, 6);
  ctx.fillRect(bx + bw * 0.75 - 2, by + 2, 4, 6);

  // Bullet symbol (simple)
  ctx.strokeStyle = '#7a8b5a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 2);
  ctx.lineTo(cx, cy + 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy - 2, 3, Math.PI, 0);
  ctx.stroke();

  // Stencil text
  ctx.font = 'bold 7px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7a8b5a';
  ctx.fillText('AMMO', cx, by + bh - 3);

  save(canvas, DIRS.items, 'ammo_crate.png');
}

function generatePowerup(filename, iconColor, bgColor, drawIcon) {
  const size = 64;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2,
    cy = size / 2;
  const radius = 20;

  // Glow
  const glowGrad = ctx.createRadialGradient(cx, cy, radius - 5, cx, cy, radius + 10);
  glowGrad.addColorStop(0, `${bgColor}40`);
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, size, size);

  // Circle background
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  const circGrad = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, radius);
  circGrad.addColorStop(0, bgColor);
  circGrad.addColorStop(1, shadeColor(bgColor, -40));
  ctx.fillStyle = circGrad;
  ctx.fill();
  ctx.strokeStyle = shadeColor(bgColor, -60);
  ctx.lineWidth = 2;
  ctx.stroke();

  // Icon
  drawIcon(ctx, cx, cy, iconColor);

  // Shine
  ctx.beginPath();
  ctx.ellipse(cx - 5, cy - 10, 8, 4, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fill();

  save(canvas, DIRS.items, filename);
}

function shadeColor(hex, amount) {
  let { r, g, b } = hexToRgb(hex);
  r = Math.max(0, Math.min(255, r + amount));
  g = Math.max(0, Math.min(255, g + amount));
  b = Math.max(0, Math.min(255, b + amount));
  return `rgb(${r},${g},${b})`;
}

function drawLightningBolt(ctx, cx, cy, color) {
  ctx.beginPath();
  ctx.moveTo(cx + 2, cy - 14);
  ctx.lineTo(cx - 4, cy - 2);
  ctx.lineTo(cx + 1, cy - 2);
  ctx.lineTo(cx - 3, cy + 14);
  ctx.lineTo(cx + 5, cy + 2);
  ctx.lineTo(cx, cy + 2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = shadeColor(color.startsWith('#') ? color : '#ffff00', -40);
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawFist(ctx, cx, cy, color) {
  // Simple fist icon
  ctx.fillStyle = color;
  // Palm
  ctx.beginPath();
  ctx.roundRect(cx - 8, cy - 6, 16, 14, 3);
  ctx.fill();
  // Fingers
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.roundRect(cx - 7 + i * 4, cy - 12, 3.5, 8, 1.5);
    ctx.fill();
  }
  // Thumb
  ctx.beginPath();
  ctx.roundRect(cx - 10, cy - 4, 4, 8, 2);
  ctx.fill();

  ctx.strokeStyle = shadeColor(color.startsWith('#') ? color : '#ff4444', -50);
  ctx.lineWidth = 1;
  // Re-draw outlines
  ctx.beginPath();
  ctx.roundRect(cx - 8, cy - 6, 16, 14, 3);
  ctx.stroke();
}

function drawShield(ctx, cx, cy, color) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - 14);
  ctx.lineTo(cx + 13, cy - 7);
  ctx.lineTo(cx + 11, cy + 5);
  ctx.quadraticCurveTo(cx, cy + 16, cx, cy + 16);
  ctx.quadraticCurveTo(cx, cy + 16, cx - 11, cy + 5);
  ctx.lineTo(cx - 13, cy - 7);
  ctx.closePath();

  const shieldGrad = ctx.createLinearGradient(cx - 13, cy - 14, cx + 13, cy + 16);
  shieldGrad.addColorStop(0, color);
  shieldGrad.addColorStop(1, shadeColor(color.startsWith('#') ? color : '#4488ff', -30));
  ctx.fillStyle = shieldGrad;
  ctx.fill();
  ctx.strokeStyle = shadeColor(color.startsWith('#') ? color : '#4488ff', -60);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Inner highlight
  ctx.beginPath();
  ctx.moveTo(cx, cy - 9);
  ctx.lineTo(cx + 7, cy - 4);
  ctx.lineTo(cx + 6, cy + 3);
  ctx.quadraticCurveTo(cx, cy + 10, cx, cy + 10);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fill();
}

function drawCross(ctx, cx, cy, color) {
  ctx.fillStyle = color;
  ctx.fillRect(cx - 3, cy - 12, 6, 24);
  ctx.fillRect(cx - 10, cy - 4, 20, 8);

  ctx.strokeStyle = shadeColor(color.startsWith('#') ? color : '#44cc44', -40);
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - 3, cy - 12, 6, 24);
  ctx.strokeRect(cx - 10, cy - 4, 20, 8);
}

function generateLootBag() {
  const size = 64;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2,
    cy = size / 2 + 4;

  // Shadow
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy + 16, 16, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();

  // Bag body
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy - 5);
  ctx.quadraticCurveTo(cx - 16, cy + 14, cx, cy + 16);
  ctx.quadraticCurveTo(cx + 16, cy + 14, cx + 14, cy - 5);
  ctx.closePath();

  const bagGrad = ctx.createLinearGradient(cx - 16, 0, cx + 16, 0);
  bagGrad.addColorStop(0, '#6b4c2a');
  bagGrad.addColorStop(0.4, '#8b6b3a');
  bagGrad.addColorStop(0.7, '#7b5b30');
  bagGrad.addColorStop(1, '#5a3c1a');
  ctx.fillStyle = bagGrad;
  ctx.fill();
  ctx.strokeStyle = '#3a2a10';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Bag top (cinched)
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy - 5);
  ctx.quadraticCurveTo(cx - 5, cy - 15, cx, cy - 12);
  ctx.quadraticCurveTo(cx + 5, cy - 15, cx + 14, cy - 5);
  ctx.strokeStyle = '#3a2a10';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Tie string
  ctx.beginPath();
  ctx.moveTo(cx - 3, cy - 12);
  ctx.lineTo(cx - 6, cy - 18);
  ctx.moveTo(cx + 3, cy - 12);
  ctx.lineTo(cx + 6, cy - 18);
  ctx.strokeStyle = '#5a4a30';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Gold coins spilling out
  for (const [gx, gy] of [
    [cx - 10, cy + 12],
    [cx + 12, cy + 10],
    [cx + 5, cy + 15]
  ]) {
    ctx.beginPath();
    ctx.ellipse(gx, gy, 5, 4, rand(-0.3, 0.3), 0, Math.PI * 2);
    const coinGrad = ctx.createRadialGradient(gx - 1, gy - 1, 0, gx, gy, 5);
    coinGrad.addColorStop(0, '#ffe066');
    coinGrad.addColorStop(1, '#daa520');
    ctx.fillStyle = coinGrad;
    ctx.fill();
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Bag texture lines
  ctx.strokeStyle = 'rgba(60,40,20,0.2)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    const lx = cx - 10 + i * 5;
    ctx.moveTo(lx, cy - 3);
    ctx.lineTo(lx + rand(-2, 2), cy + 12);
    ctx.stroke();
  }

  save(canvas, DIRS.items, 'loot_bag.png');
}

// ---------------------------------------------------------------------------
// EFFECT SPRITES
// ---------------------------------------------------------------------------

function generateExplosionSheet() {
  const frameSize = 128;
  const frames = 4;
  const w = frameSize * frames;
  const h = frameSize;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  for (let f = 0; f < frames; f++) {
    const ox = f * frameSize;
    const cx = ox + frameSize / 2;
    const cy = frameSize / 2;
    const progress = (f + 1) / frames; // 0.25 -> 1.0
    const maxR = 50 * progress;

    // Outer glow
    const outerGrad = ctx.createRadialGradient(cx, cy, maxR * 0.3, cx, cy, maxR * 1.3);
    outerGrad.addColorStop(
      0,
      `rgba(255,${Math.round(150 - progress * 80)},0,${0.5 - progress * 0.2})`
    );
    outerGrad.addColorStop(
      0.5,
      `rgba(255,${Math.round(100 - progress * 60)},0,${0.3 - progress * 0.15})`
    );
    outerGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = outerGrad;
    ctx.fillRect(ox, 0, frameSize, frameSize);

    // Core fireball
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    coreGrad.addColorStop(0, `rgba(255,255,200,${0.9 - progress * 0.3})`);
    coreGrad.addColorStop(0.3, `rgba(255,200,50,${0.8 - progress * 0.3})`);
    coreGrad.addColorStop(0.6, `rgba(255,120,20,${0.6 - progress * 0.2})`);
    coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.fill();

    // Smoke ring (later frames)
    if (f >= 2) {
      const smokeR = maxR * 1.1;
      const smokeGrad = ctx.createRadialGradient(cx, cy, smokeR * 0.7, cx, cy, smokeR);
      smokeGrad.addColorStop(0, 'rgba(0,0,0,0)');
      smokeGrad.addColorStop(0.5, `rgba(80,60,40,${0.2})`);
      smokeGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = smokeGrad;
      ctx.fillRect(ox, 0, frameSize, frameSize);
    }

    // Sparks
    const sparkCount = Math.round(8 * progress);
    for (let s = 0; s < sparkCount; s++) {
      const angle = (s / sparkCount) * Math.PI * 2 + f * 0.3;
      const dist = maxR * rand(0.5, 1.2);
      const sx = cx + Math.cos(angle) * dist;
      const sy = cy + Math.sin(angle) * dist;
      ctx.beginPath();
      ctx.arc(sx, sy, rand(1, 3), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,${randInt(180, 255)},${randInt(50, 150)},${rand(0.4, 0.8)})`;
      ctx.fill();
    }
  }

  save(canvas, DIRS.effects, 'explosion_sheet.png');
}

function generateMuzzleFlash() {
  const size = 64;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2,
    cy = size / 2;

  // Outer glow
  const outerGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 28);
  outerGrad.addColorStop(0, 'rgba(255,255,200,0.8)');
  outerGrad.addColorStop(0.3, 'rgba(255,220,100,0.5)');
  outerGrad.addColorStop(0.7, 'rgba(255,150,50,0.2)');
  outerGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = outerGrad;
  ctx.fillRect(0, 0, size, size);

  // Star burst
  ctx.fillStyle = 'rgba(255,255,220,0.9)';
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const len = rand(12, 22);
    const spread = 0.15;
    ctx.lineTo(cx + Math.cos(angle - spread) * 5, cy + Math.sin(angle - spread) * 5);
    ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    ctx.lineTo(cx + Math.cos(angle + spread) * 5, cy + Math.sin(angle + spread) * 5);
    ctx.closePath();
    ctx.fill();
  }

  // White core
  const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 8);
  coreGrad.addColorStop(0, 'rgba(255,255,255,1)');
  coreGrad.addColorStop(1, 'rgba(255,255,200,0.5)');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fill();

  save(canvas, DIRS.effects, 'muzzle_flash.png');
}

function generateBulletTrail() {
  const w = 32,
    h = 8;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  const cy = h / 2;

  // Gradient trail (bright at right/tip, fading left)
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, 'rgba(255,255,100,0)');
  grad.addColorStop(0.3, 'rgba(255,255,100,0.3)');
  grad.addColorStop(0.7, 'rgba(255,255,150,0.7)');
  grad.addColorStop(1, 'rgba(255,255,220,1)');
  ctx.fillStyle = grad;

  // Tapered shape
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(w * 0.3, cy - 1);
  ctx.lineTo(w, cy - 2);
  ctx.lineTo(w, cy + 2);
  ctx.lineTo(w * 0.3, cy + 1);
  ctx.closePath();
  ctx.fill();

  // Core bright line
  const coreGrad = ctx.createLinearGradient(w * 0.5, 0, w, 0);
  coreGrad.addColorStop(0, 'rgba(255,255,255,0)');
  coreGrad.addColorStop(1, 'rgba(255,255,255,0.9)');
  ctx.strokeStyle = coreGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, cy);
  ctx.lineTo(w, cy);
  ctx.stroke();

  save(canvas, DIRS.effects, 'bullet_trail.png');
}

function generateBloodSplatter() {
  const size = 64;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2,
    cy = size / 2;

  // Main splatter blobs
  for (let i = 0; i < 8; i++) {
    const angle = rand(0, Math.PI * 2);
    const dist = rand(2, 15);
    const bx = cx + Math.cos(angle) * dist;
    const by = cy + Math.sin(angle) * dist;
    const br = rand(3, 12);

    ctx.beginPath();
    // Irregular blob
    for (let a = 0; a < Math.PI * 2; a += 0.3) {
      const r = br + rand(-3, 3);
      const px = bx + Math.cos(a) * r;
      const py = by + Math.sin(a) * r;
      if (a === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();

    const red = randInt(120, 180);
    ctx.fillStyle = `rgba(${red},${randInt(5, 25)},${randInt(5, 20)},${rand(0.5, 0.85)})`;
    ctx.fill();
  }

  // Splatter droplets
  for (let i = 0; i < 12; i++) {
    const angle = rand(0, Math.PI * 2);
    const dist = rand(10, 28);
    const dx = cx + Math.cos(angle) * dist;
    const dy = cy + Math.sin(angle) * dist;
    const dr = rand(0.5, 3);
    ctx.beginPath();
    ctx.arc(dx, dy, dr, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${randInt(130, 170)},${randInt(10, 25)},${randInt(10, 20)},${rand(0.4, 0.7)})`;
    ctx.fill();
  }

  // Dark center
  const centerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 8);
  centerGrad.addColorStop(0, 'rgba(80,5,5,0.6)');
  centerGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = centerGrad;
  ctx.fillRect(0, 0, size, size);

  save(canvas, DIRS.effects, 'blood_splatter.png');
}

function generatePoisonCloud() {
  const size = 128;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2,
    cy = size / 2;

  // Multiple overlapping cloud blobs
  for (let i = 0; i < 12; i++) {
    const bx = cx + rand(-25, 25);
    const by = cy + rand(-25, 25);
    const br = rand(15, 40);

    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    const green = randInt(120, 200);
    grad.addColorStop(0, `rgba(${randInt(30, 60)},${green},${randInt(20, 50)},${rand(0.15, 0.3)})`);
    grad.addColorStop(
      0.6,
      `rgba(${randInt(20, 40)},${green - 40},${randInt(10, 30)},${rand(0.08, 0.15)})`
    );
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  // Organic edge wisps
  for (let i = 0; i < 8; i++) {
    const angle = rand(0, Math.PI * 2);
    const dist = rand(25, 50);
    const wx = cx + Math.cos(angle) * dist;
    const wy = cy + Math.sin(angle) * dist;
    const wr = rand(8, 20);

    const grad = ctx.createRadialGradient(wx, wy, 0, wx, wy, wr);
    grad.addColorStop(0, `rgba(40,${randInt(140, 180)},30,0.12)`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  // Toxic particles
  for (let i = 0; i < 15; i++) {
    const px = cx + rand(-35, 35);
    const py = cy + rand(-35, 35);
    ctx.beginPath();
    ctx.arc(px, py, rand(0.5, 2), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(100,255,100,${rand(0.2, 0.5)})`;
    ctx.fill();
  }

  save(canvas, DIRS.effects, 'poison_cloud.png');
}

function generateIceEffect() {
  const size = 128;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2,
    cy = size / 2;

  // Blue glow base
  const baseGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 55);
  baseGrad.addColorStop(0, 'rgba(100,180,255,0.2)');
  baseGrad.addColorStop(0.5, 'rgba(60,120,220,0.1)');
  baseGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  // Ice crystals
  function drawCrystal(x, y, length, angle, width) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Crystal body
    ctx.beginPath();
    ctx.moveTo(0, -length);
    ctx.lineTo(width / 2, 0);
    ctx.lineTo(0, length * 0.3);
    ctx.lineTo(-width / 2, 0);
    ctx.closePath();

    const crystGrad = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
    crystGrad.addColorStop(0, 'rgba(100,180,255,0.6)');
    crystGrad.addColorStop(0.4, 'rgba(180,220,255,0.8)');
    crystGrad.addColorStop(0.6, 'rgba(150,200,255,0.7)');
    crystGrad.addColorStop(1, 'rgba(80,140,220,0.5)');
    ctx.fillStyle = crystGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(150,200,255,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Center line
    ctx.beginPath();
    ctx.moveTo(0, -length * 0.8);
    ctx.lineTo(0, length * 0.2);
    ctx.strokeStyle = 'rgba(200,230,255,0.4)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.restore();
  }

  // Main crystals radiating from center
  const crystalCount = 8;
  for (let i = 0; i < crystalCount; i++) {
    const angle = (i / crystalCount) * Math.PI * 2 + rand(-0.2, 0.2);
    const dist = rand(5, 15);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const len = rand(15, 35);
    const w = rand(5, 12);
    drawCrystal(x, y, len, angle - Math.PI / 2, w);
  }

  // Smaller crystals
  for (let i = 0; i < 6; i++) {
    const angle = rand(0, Math.PI * 2);
    const dist = rand(20, 40);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    drawCrystal(x, y, rand(8, 15), rand(0, Math.PI * 2), rand(3, 7));
  }

  // Frost particles
  for (let i = 0; i < 20; i++) {
    const px = cx + rand(-45, 45);
    const py = cy + rand(-45, 45);
    ctx.beginPath();
    ctx.arc(px, py, rand(0.5, 2), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200,230,255,${rand(0.3, 0.7)})`;
    ctx.fill();
  }

  save(canvas, DIRS.effects, 'ice_effect.png');
}

function generateFireEffect() {
  const size = 128;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2,
    cy = size / 2 + 10;

  // Outer glow
  const outerGrad = ctx.createRadialGradient(cx, cy, 5, cx, cy - 10, 55);
  outerGrad.addColorStop(0, 'rgba(255,150,30,0.15)');
  outerGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = outerGrad;
  ctx.fillRect(0, 0, size, size);

  // Flame tongues
  for (let i = 0; i < 10; i++) {
    const fx = cx + rand(-20, 20);
    const fy = cy + rand(-5, 10);
    const fh = rand(20, 50);
    const fw = rand(8, 20);

    ctx.beginPath();
    ctx.moveTo(fx - fw / 2, fy);
    ctx.quadraticCurveTo(fx - fw / 3, fy - fh * 0.5, fx + rand(-5, 5), fy - fh);
    ctx.quadraticCurveTo(fx + fw / 3, fy - fh * 0.5, fx + fw / 2, fy);
    ctx.closePath();

    const flameGrad = ctx.createLinearGradient(fx, fy, fx, fy - fh);
    flameGrad.addColorStop(0, `rgba(255,${randInt(80, 120)},0,${rand(0.3, 0.6)})`);
    flameGrad.addColorStop(
      0.4,
      `rgba(255,${randInt(140, 200)},${randInt(20, 60)},${rand(0.4, 0.7)})`
    );
    flameGrad.addColorStop(
      0.8,
      `rgba(255,${randInt(200, 240)},${randInt(80, 120)},${rand(0.2, 0.4)})`
    );
    flameGrad.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = flameGrad;
    ctx.fill();
  }

  // Core bright area
  const coreGrad = ctx.createRadialGradient(cx, cy - 5, 0, cx, cy - 10, 20);
  coreGrad.addColorStop(0, 'rgba(255,255,200,0.6)');
  coreGrad.addColorStop(0.5, 'rgba(255,200,80,0.3)');
  coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = coreGrad;
  ctx.fillRect(0, 0, size, size);

  // Embers/sparks
  for (let i = 0; i < 15; i++) {
    const ex = cx + rand(-30, 30);
    const ey = cy - rand(20, 55);
    ctx.beginPath();
    ctx.arc(ex, ey, rand(0.5, 2), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,${randInt(180, 255)},${randInt(50, 100)},${rand(0.4, 0.8)})`;
    ctx.fill();
  }

  // Base dark (embers at bottom)
  const baseGrad = ctx.createRadialGradient(cx, cy + 5, 0, cx, cy + 5, 25);
  baseGrad.addColorStop(0, 'rgba(200,80,20,0.25)');
  baseGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  save(canvas, DIRS.effects, 'fire_effect.png');
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

console.log('=== Zombie Survival Tile Generator ===\n');

console.log('[TILES 64x64]');
rng = mulberry32(100);
generateFloorConcrete();
rng = mulberry32(200);
generateFloorDirt();
rng = mulberry32(300);
generateFloorMetal();
rng = mulberry32(400);
generateFloorLab();
rng = mulberry32(500);
generateFloorBlood();
rng = mulberry32(600);
generateWallBrick();
rng = mulberry32(700);
generateWallMetal();
rng = mulberry32(800);
generateWallLab();
rng = mulberry32(900);
generateWallDamaged();
rng = mulberry32(1000);
generateWallFence();

console.log('\n[BACKGROUNDS 512x512]');
rng = mulberry32(1100);
generateBgCity();
rng = mulberry32(1200);
generateBgForest();
rng = mulberry32(1300);
generateBgLab();
rng = mulberry32(1400);
generateBgCemetery();
rng = mulberry32(1500);
generateBgWasteland();

console.log('\n[ITEMS 64x64]');
rng = mulberry32(1600);
generateCoinGold();
rng = mulberry32(1700);
generateCoinGem();
rng = mulberry32(1800);
generateHealthPotion();
rng = mulberry32(1900);
generateAmmoCrate();

rng = mulberry32(2000);
generatePowerup('powerup_speed.png', '#ffee00', '#3366cc', drawLightningBolt);
rng = mulberry32(2100);
generatePowerup('powerup_damage.png', '#ff3333', '#dd6600', drawFist);
rng = mulberry32(2200);
generatePowerup('powerup_shield.png', '#4488ff', '#e8e8f0', drawShield);
rng = mulberry32(2300);
generatePowerup('powerup_health.png', '#33cc33', '#e8f0e8', drawCross);

rng = mulberry32(2400);
generateLootBag();

console.log('\n[EFFECTS]');
rng = mulberry32(2500);
generateExplosionSheet();
rng = mulberry32(2600);
generateMuzzleFlash();
rng = mulberry32(2700);
generateBulletTrail();
rng = mulberry32(2800);
generateBloodSplatter();
rng = mulberry32(2900);
generatePoisonCloud();
rng = mulberry32(3000);
generateIceEffect();
rng = mulberry32(3100);
generateFireEffect();

console.log('\n=== Done! Generated 31 assets ===');
