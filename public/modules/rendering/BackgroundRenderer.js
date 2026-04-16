/**
 * BACKGROUND RENDERER
 * Handles rendering of grid, sky, parallax background, floor, walls, doors, static/dynamic props
 * @module BackgroundRenderer
 * @author Claude Code
 * @version 1.0.0
 */

class BackgroundRenderer {
  constructor() {
    this.gridCanvas = null;
    this.gridConfig = null;
    this.decorSeed = 0;
    // Sky gradient cache: invalidated when config key or canvas size changes
    this._skyGradient = null;
    this._skyGradientKey = '';
    this._skyCanvasH = 0;
    // Moon glow gradient cache: keyed by moonX,moonY,radius
    this._moonGradient = null;
    this._moonGradientKey = '';
  }

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

  createGridCanvas(config) {
    if (
      this.gridCanvas &&
      this.gridConfig &&
      this.gridConfig.ROOM_WIDTH === config.ROOM_WIDTH &&
      this.gridConfig.ROOM_HEIGHT === config.ROOM_HEIGHT
    ) {
      return;
    }

    this.gridCanvas = document.createElement('canvas');
    this.gridCanvas.width = config.ROOM_WIDTH;
    this.gridCanvas.height = config.ROOM_HEIGHT;
    const gridCtx = this.gridCanvas.getContext('2d');

    gridCtx.strokeStyle = '#252541';
    gridCtx.lineWidth = 1;

    const gridSize = CONSTANTS.CANVAS.GRID_SIZE;

    for (let x = 0; x < config.ROOM_WIDTH; x += gridSize) {
      gridCtx.beginPath();
      gridCtx.moveTo(x, 0);
      gridCtx.lineTo(x, config.ROOM_HEIGHT);
      gridCtx.stroke();
    }

    for (let y = 0; y < config.ROOM_HEIGHT; y += gridSize) {
      gridCtx.beginPath();
      gridCtx.moveTo(0, y);
      gridCtx.lineTo(config.ROOM_WIDTH, y);
      gridCtx.stroke();
    }

    this.gridConfig = {
      ROOM_WIDTH: config.ROOM_WIDTH,
      ROOM_HEIGHT: config.ROOM_HEIGHT
    };
  }

  renderFloor(ctx, config, dayNight) {
    let floorColor = '#1a1a2e';

    if (dayNight && dayNight.config) {
      const ambient = dayNight.config.ambient;
      const darken = Math.floor((1 - ambient) * 100);
      floorColor = `hsl(240, 25%, ${Math.max(5, 12 - darken)}%)`;
    }

    ctx.fillStyle = floorColor;
    ctx.fillRect(0, 0, config.ROOM_WIDTH, config.ROOM_HEIGHT);

    this.renderGroundTextures(ctx, config);
  }

  renderGroundTextures(ctx, config) {
    if (window.performanceSettings && !window.performanceSettings.shouldRenderGrid()) {
      return;
    }

    ctx.save();
    ctx.globalAlpha = 0.15;

    const patchSize = 80;
    const patchCount = 50;

    for (let i = 0; i < patchCount; i++) {
      const x = (i * 1337) % config.ROOM_WIDTH;
      const y = (i * 7331) % config.ROOM_HEIGHT;

      ctx.fillStyle = i % 2 === 0 ? '#2a2a3e' : '#151525';
      ctx.beginPath();
      ctx.ellipse(x, y, patchSize * (0.7 + (i % 10) / 20), patchSize * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = '#0a0a1e';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.1;

    for (let i = 0; i < 30; i++) {
      const startX = (i * 2341) % config.ROOM_WIDTH;
      const startY = (i * 4567) % config.ROOM_HEIGHT;
      const endX = startX + ((i * 89) % 100) - 50;
      const endY = startY + ((i * 137) % 100) - 50;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    ctx.restore();
  }

  renderGrid(ctx, config) {
    if (window.performanceSettings && !window.performanceSettings.shouldRenderGrid()) {
      return;
    }

    if (!this.gridCanvas) {
      this.createGridCanvas(config);
    }

    ctx.drawImage(this.gridCanvas, 0, 0);
  }

  renderWalls(ctx, camera, walls) {
    ctx.fillStyle = '#2d2d44';

    walls.forEach(wall => {
      const maxDimension = Math.max(wall.width, wall.height);
      if (!camera.isInViewport(wall.x + wall.width / 2, wall.y + wall.height / 2, maxDimension)) {
        return;
      }

      ctx.fillRect(wall.x, wall.y, wall.width, wall.height);

      this.renderWallDecorations(ctx, wall);

      ctx.strokeStyle = '#3d3d54';
      ctx.lineWidth = 2;
      ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
    });
  }

  renderWallDecorations(ctx, wall) {
    if (window.performanceSettings && !window.performanceSettings.shouldRenderGrid()) {
      return;
    }

    ctx.save();

    const seed = Math.floor(wall.x / 100) * 1000 + Math.floor(wall.y / 100);
    const random = () => {
      const x = Math.sin(seed + this.decorSeed++) * 10000;
      return x - Math.floor(x);
    };
    this.decorSeed = seed;

    if (random() < 0.3) {
      ctx.strokeStyle = '#1d1d34';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;

      const crackX = wall.x + wall.width * random();
      const crackY = wall.y + wall.height * random();
      const crackLength = 20 + random() * 30;

      ctx.beginPath();
      ctx.moveTo(crackX, crackY);
      ctx.lineTo(crackX + (random() - 0.5) * crackLength, crackY + crackLength * random());
      ctx.stroke();
    }

    if (random() < 0.2) {
      ctx.fillStyle = random() > 0.5 ? '#ff6b6b' : '#4ecdc4';
      ctx.globalAlpha = 0.3;

      const grafX = wall.x + wall.width * 0.3;
      const grafY = wall.y + wall.height * 0.5;

      ctx.font = 'bold 24px Arial';
      ctx.fillText('X', grafX, grafY);
    }

    if (random() < 0.15 && wall.width > 80) {
      ctx.fillStyle = '#f4e4c1';
      ctx.globalAlpha = 0.4;

      const posterX = wall.x + wall.width * 0.4;
      const posterY = wall.y + wall.height * 0.3;
      const posterW = 30;
      const posterH = 40;

      ctx.fillRect(posterX, posterY, posterW, posterH);

      ctx.fillStyle = '#d4c4a1';
      ctx.fillRect(posterX, posterY + posterH - 5, posterW * 0.6, 5);
    }

    ctx.restore();
  }

  renderDoors(ctx, camera, doors) {
    if (!doors || !Array.isArray(doors)) {
      return;
    }

    doors.forEach(door => {
      const maxDimension = Math.max(door.width, door.height);
      if (!camera.isInViewport(door.x + door.width / 2, door.y + door.height / 2, maxDimension)) {
        return;
      }

      ctx.fillStyle = door.active ? '#00ff00' : '#ff0000';
      ctx.fillRect(door.x, door.y, door.width, door.height);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(door.active ? '▲' : '✖', door.x + door.width / 2, door.y + 15);
    });
  }

  renderStaticProps(ctx, camera, props, layer) {
    if (!props || props.length === 0) {
      return;
    }

    props.forEach(prop => {
      if (layer === 'ground' && prop.renderLayers) {
        return;
      }
      if (layer === 'overlay' && !prop.renderLayers) {
        return;
      }

      if (!camera.isInViewport(prop.x, prop.y, Math.max(prop.width, prop.height) * 2)) {
        return;
      }

      ctx.save();
      ctx.translate(prop.x, prop.y);
      ctx.rotate(prop.rotation || 0);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(
        3,
        prop.height / 4,
        (prop.width / 2) * (prop.shadowSize || 1),
        prop.height / 8,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      switch (prop.type) {
        case 'tree':
          this.renderTree(ctx, prop);
          break;
        case 'rock':
          this.renderRock(ctx, prop);
          break;
        case 'car':
          this.renderCar(ctx, prop);
          break;
        case 'bush':
          this.renderBush(ctx, prop);
          break;
        case 'lampPost':
          this.renderLampPost(ctx, prop);
          break;
        case 'fence':
          this.renderFence(ctx, prop);
          break;
        case 'sign':
          this.renderSign(ctx, prop);
          break;
        case 'bench':
          this.renderBench(ctx, prop);
          break;
        default:
          ctx.fillStyle = prop.color || '#888';
          ctx.fillRect(-prop.width / 2, -prop.height / 2, prop.width, prop.height);
      }

      ctx.restore();
    });
  }

  renderTree(ctx, prop) {
    ctx.fillStyle = prop.trunkColor || '#4a3520';
    ctx.fillRect(-8, -10, 16, 40);

    const colors = ['#2d5016', '#3a6b35', '#4a7d45'];
    const sizes = [40, 35, 30];

    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.ellipse(0, -40 - i * 10, sizes[i], sizes[i] * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.ellipse(-10, -50, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  renderRock(ctx, prop) {
    ctx.fillStyle = prop.color || '#5a5a5a';
    ctx.strokeStyle = this.darkenColor(prop.color || '#5a5a5a', 30);
    ctx.lineWidth = 2;

    ctx.beginPath();
    const points = 8;
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const variance = 0.7 + Math.sin(i + prop.variant) * 0.3;
      const x = ((Math.cos(angle) * prop.width) / 2) * variance;
      const y = ((Math.sin(angle) * prop.height) / 2) * variance;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = this.darkenColor(prop.color, 50);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-5, -5);
    ctx.lineTo(8, 5);
    ctx.moveTo(0, -8);
    ctx.lineTo(-6, 8);
    ctx.stroke();
  }

  renderCar(ctx, prop) {
    ctx.fillStyle = prop.color || '#c0c0c0';
    ctx.fillRect(-prop.width / 2, -prop.height / 2, prop.width, prop.height);

    ctx.fillStyle = '#4a7d9d';
    ctx.fillRect(-prop.width / 2 + 10, -prop.height / 2 + 5, prop.width / 3, prop.height - 10);

    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(-prop.width / 3, prop.height / 2, 8, 0, Math.PI * 2);
    ctx.arc(prop.width / 3, prop.height / 2, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffff99';
    ctx.fillRect(prop.width / 2 - 5, -prop.height / 2 + 8, 5, 8);
    ctx.fillRect(prop.width / 2 - 5, prop.height / 2 - 16, 5, 8);
  }

  renderBush(ctx, prop) {
    ctx.fillStyle = prop.color || '#3a6b35';

    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 8;
      const y = Math.sin(i) * 5;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  renderLampPost(ctx, prop) {
    ctx.fillStyle = prop.color || '#4a4a4a';
    ctx.fillRect(-5, -prop.height / 2, 10, prop.height);

    ctx.fillStyle = '#6a6a6a';
    ctx.beginPath();
    ctx.arc(0, -prop.height / 2, 12, 0, Math.PI * 2);
    ctx.fill();

    const gradient = ctx.createRadialGradient(0, -prop.height / 2, 0, 0, -prop.height / 2, 30);
    gradient.addColorStop(0, 'rgba(255, 255, 153, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 255, 153, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, -prop.height / 2, 30, 0, Math.PI * 2);
    ctx.fill();
  }

  renderFence(ctx, prop) {
    ctx.fillStyle = prop.color || '#6b4423';
    ctx.strokeStyle = this.darkenColor(prop.color || '#6b4423', 30);
    ctx.lineWidth = 2;

    ctx.fillRect(-prop.width / 2, -5, prop.width, 3);
    ctx.fillRect(-prop.width / 2, 5, prop.width, 3);

    for (let i = -prop.width / 2; i <= prop.width / 2; i += 15) {
      ctx.fillRect(i - 2, -prop.height / 2, 4, prop.height);
    }
  }

  renderSign(ctx, prop) {
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(-3, 0, 6, prop.height / 2);

    ctx.fillStyle = prop.color || '#d4a574';
    ctx.strokeStyle = '#4a3520';
    ctx.lineWidth = 2;
    ctx.fillRect(-prop.width / 2, -prop.height / 2, prop.width, prop.height / 2);
    ctx.strokeRect(-prop.width / 2, -prop.height / 2, prop.width, prop.height / 2);

    ctx.fillStyle = '#4a3520';
    ctx.fillRect(-10, -prop.height / 2 + 8, 20, 2);
    ctx.fillRect(-10, -prop.height / 2 + 14, 20, 2);
  }

  renderBench(ctx, prop) {
    ctx.fillStyle = prop.color || '#6b4423';
    ctx.strokeStyle = this.darkenColor(prop.color || '#6b4423', 30);
    ctx.lineWidth = 2;

    ctx.fillRect(-prop.width / 2, -8, prop.width, 8);

    ctx.fillRect(-prop.width / 2, -prop.height / 2, 5, 20);
    ctx.fillRect(prop.width / 2 - 5, -prop.height / 2, 5, 20);
    ctx.fillRect(-prop.width / 2, -prop.height / 2, prop.width, 5);

    ctx.fillRect(-prop.width / 2 + 5, 0, 4, 10);
    ctx.fillRect(prop.width / 2 - 9, 0, 4, 10);
  }

  renderDynamicProps(ctx, camera, props) {
    if (!props || props.length === 0) {
      return;
    }

    props.forEach(prop => {
      if (!camera.isInViewport(prop.x, prop.y, prop.lightRadius || 100)) {
        return;
      }

      ctx.save();
      ctx.translate(prop.x, prop.y);

      if (prop.lightRadius && prop.lightColor) {
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, prop.lightRadius);
        gradient.addColorStop(0, prop.lightColor);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, prop.lightRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      switch (prop.type) {
        case 'fire':
          this.renderFireBase(ctx, prop);
          break;
        case 'smoke':
          break;
        case 'sparks':
          this.renderSparksBase(ctx, prop);
          break;
        case 'steam':
          break;
        case 'torch':
          this.renderTorchBase(ctx, prop);
          break;
      }

      ctx.restore();
    });
  }

  renderFireBase(ctx, _prop) {
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(-15, 0, 10, 6);
    ctx.fillRect(5, 0, 10, 6);
    ctx.fillRect(-8, -3, 16, 5);
  }

  renderSparksBase(ctx, _prop) {
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(10, 0);
    ctx.stroke();

    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  renderTorchBase(ctx, prop) {
    ctx.fillStyle = '#4a3520';
    ctx.fillRect(-4, -prop.height / 2, 8, prop.height);

    ctx.fillStyle = '#6b4423';
    ctx.beginPath();
    ctx.arc(0, -prop.height / 2, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  renderSky(ctx, canvas, dayNight) {
    if (!dayNight || !dayNight.config) {
      return;
    }

    const { config, stars, moon } = dayNight;

    // Cache sky gradient — recreate only when palette or canvas height changes
    const skyKey = config.zenith.join(',') + '|' + config.horizon.join(',');
    if (
      this._skyGradient === null ||
      this._skyGradientKey !== skyKey ||
      this._skyCanvasH !== canvas.height
    ) {
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      config.zenith.forEach((color, i) => {
        gradient.addColorStop(i * 0.2, color);
      });
      config.horizon.forEach((color, i) => {
        gradient.addColorStop(0.6 + i * 0.13, color);
      });
      this._skyGradient = gradient;
      this._skyGradientKey = skyKey;
      this._skyCanvasH = canvas.height;
    }

    ctx.fillStyle = this._skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (stars && stars.length > 0) {
      ctx.save();
      const time = Date.now() / 1000;

      stars.forEach(star => {
        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness * twinkle * config.ambient})`;
        ctx.fillRect(star.x * canvas.width, star.y * canvas.height, star.size, star.size);
      });

      ctx.restore();
    }

    if (moon) {
      ctx.save();

      const moonX = moon.x * canvas.width;
      const moonY = moon.y * canvas.height;
      const moonRadius = 40;

      // Cache moon glow gradient — recreate only when moon position changes significantly
      const moonKey = `${Math.round(moonX)}|${Math.round(moonY)}`;
      if (this._moonGradient === null || this._moonGradientKey !== moonKey) {
        const moonGlowGrad = ctx.createRadialGradient(
          moonX,
          moonY,
          moonRadius * 0.5,
          moonX,
          moonY,
          moonRadius * 2
        );
        moonGlowGrad.addColorStop(0, 'rgba(220, 220, 255, 0.3)');
        moonGlowGrad.addColorStop(1, 'rgba(220, 220, 255, 0)');
        this._moonGradient = moonGlowGrad;
        this._moonGradientKey = moonKey;
      }
      ctx.fillStyle = this._moonGradient;
      ctx.fillRect(moonX - moonRadius * 2, moonY - moonRadius * 2, moonRadius * 4, moonRadius * 4);

      ctx.fillStyle = '#f0f0ff';
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
      ctx.fill();

      if (moon.phase < 0.4 || moon.phase > 0.6) {
        ctx.fillStyle = 'rgba(10, 20, 40, 0.4)';
        ctx.beginPath();
        const crescent = moon.phase < 0.5 ? (0.5 - moon.phase) * 2 : (moon.phase - 0.5) * 2;
        ctx.arc(moonX, moonY, moonRadius, Math.PI * 0.5, Math.PI * 1.5);
        ctx.arc(
          moonX + moonRadius * crescent,
          moonY,
          moonRadius * (1 - crescent),
          Math.PI * 1.5,
          Math.PI * 0.5,
          true
        );
        ctx.fill();
      }

      ctx.restore();
    }
  }

  renderParallaxBackground(ctx, parallax, camera, _viewport) {
    if (!parallax) {
      return;
    }

    const layers = parallax.layers || [];
    if (layers.length === 0) {
      return;
    }

    layers.forEach(layer => {
      ctx.save();

      const offsetX = camera.x * layer.parallaxSpeed;
      const offsetY = camera.y * layer.parallaxSpeed * 0.5;

      ctx.fillStyle = layer.color;
      ctx.globalAlpha = 0.6;

      (layer.visibleElements || []).forEach(elem => {
        const screenX = elem.x - offsetX;
        const screenY = elem.y - offsetY;

        if (layer.shapes === 'mountains') {
          ctx.beginPath();
          ctx.moveTo(screenX, screenY);
          ctx.lineTo(screenX + elem.width * 0.5, screenY - elem.height);
          ctx.lineTo(screenX + elem.width, screenY);
          ctx.fill();
        } else if (layer.shapes === 'trees') {
          ctx.fillRect(
            screenX + elem.width * 0.4,
            screenY - elem.height * 0.3,
            elem.width * 0.2,
            elem.height * 0.3
          );
          ctx.beginPath();
          ctx.ellipse(
            screenX + elem.width * 0.5,
            screenY - elem.height * 0.6,
            elem.width * 0.4,
            elem.height * 0.5,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
        } else if (layer.shapes === 'grass') {
          for (let i = 0; i < 5; i++) {
            ctx.fillRect(screenX + (i / 5) * elem.width, screenY - elem.height, 2, elem.height);
          }
        }
      });

      ctx.restore();
    });
  }
}

window.BackgroundRenderer = BackgroundRenderer;
