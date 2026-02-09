/**
 * ENTITY RENDERER
 * Handles rendering of players, zombies, bullets, loot, powerups, destructible obstacles
 * @module EntityRenderer
 * @author Claude Code
 * @version 1.0.0
 */

class EntityRenderer {
  constructor() {
    // No persistent state needed
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

  renderPowerups(ctx, camera, powerups, powerupTypes, config, now) {
    if (!powerups) {
      return;
    }

    now = now || Date.now();

    for (const powerupId in powerups) {
      const powerup = powerups[powerupId];
      if (!camera.isInViewport(powerup.x, powerup.y, config.POWERUP_SIZE * 2)) {
        continue;
      }

      const type = powerupTypes[powerup.type];
      if (!type) {
        return;
      }

      const pulse = Math.sin(now / 200) * 3 + config.POWERUP_SIZE;

      ctx.fillStyle = type.color;
      ctx.beginPath();
      ctx.arc(powerup.x, powerup.y, pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const symbols = {
        health: '+',
        speed: '»',
        shotgun: 'S',
        machinegun: 'M',
        rocketlauncher: 'R'
      };

      ctx.fillText(symbols[powerup.type] || '?', powerup.x, powerup.y);
    }
  }

  renderLoot(ctx, camera, loot, config, now) {
    if (!loot) {
      return;
    }

    now = now || Date.now();

    for (const lootId in loot) {
      const item = loot[lootId];
      if (!camera.isInViewport(item.x, item.y, 30)) {
        continue;
      }

      const rotation = (now / 500) % (Math.PI * 2);

      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(rotation);

      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.ellipse(0, 0, config.LOOT_SIZE, config.LOOT_SIZE * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ff8c00';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();
    }
  }

  renderDestructibleObstacles(ctx, camera, obstacles) {
    if (!obstacles || obstacles.length === 0) {
      return;
    }

    obstacles.forEach(obstacle => {
      if (obstacle.destroyed) {
        return;
      }

      if (!camera.isInViewport(obstacle.x, obstacle.y, obstacle.width * 2)) {
        return;
      }

      ctx.save();
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

      ctx.fillStyle = obstacle.color || '#8B4513';
      ctx.strokeStyle = this.darkenColor(obstacle.color || '#8B4513', 30);
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

        ctx.strokeStyle = this.darkenColor(obstacle.color, 40);
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

        ctx.strokeStyle = this.darkenColor(obstacle.color, 40);
        ctx.lineWidth = 2;
        for (let i = -obstacle.width / 2 + 10; i < obstacle.width / 2; i += 10) {
          ctx.beginPath();
          ctx.moveTo(i, -obstacle.height / 2);
          ctx.lineTo(i, obstacle.height / 2);
          ctx.stroke();
        }
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

      ctx.restore();
    });
  }

  renderBullets(ctx, camera, bullets, config) {
    if (!bullets || !config) {
      return;
    }

    const bulletsByColor = new Map();
    const defaultColor = '#ffff00';
    const defaultSize = config.BULLET_SIZE || 5;

    const bulletIds = Object.keys(bullets);
    for (let i = 0; i < bulletIds.length; i++) {
      const bullet = bullets[bulletIds[i]];

      if (!bullet || !Number.isFinite(bullet.x) || !Number.isFinite(bullet.y)) {
        continue;
      }

      if (!camera.isInViewport(bullet.x, bullet.y, 50)) {
        continue;
      }

      const color = bullet.color || defaultColor;
      if (!bulletsByColor.has(color)) {
        bulletsByColor.set(color, []);
      }
      bulletsByColor.get(color).push(bullet);
    }

    for (const [color, colorBullets] of bulletsByColor) {
      ctx.fillStyle = color;
      ctx.shadowBlur = 10;
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

  drawZombieSprite(ctx, zombie, timestamp) {
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
      armOffset
    );

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
    armOffset
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
      this._renderTeleporterDetails(ctx, zombie, baseSize, scale, headRadius);
    } else if (zombie.type === 'summoner') {
      this._renderSummonerDetails(ctx, zombie, baseSize, scale, headRadius);
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
      this._renderBossCharnierDetails(ctx, zombie, scale, headRadius);
    } else if (zombie.type === 'bossInfect') {
      this._renderBossInfectDetails(ctx, zombie, baseSize, scale, headRadius);
    } else if (zombie.type === 'bossColosse') {
      this._renderBossColosseDetails(
        ctx,
        zombie,
        baseSize,
        scale,
        bodyWidth,
        bodyHeight,
        headRadius
      );
    } else if (zombie.type === 'bossRoi') {
      this._renderBossRoiDetails(ctx, zombie, baseSize, scale, headRadius);
    } else if (zombie.type === 'bossOmega') {
      this._renderBossOmegaDetails(ctx, zombie, baseSize, scale, headRadius);
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

  _renderShooterDetails(ctx, zombie, baseSize, scale, bodyWidth, armOffset) {
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

  _renderTeleporterDetails(ctx, zombie, baseSize, scale, headRadius) {
    const pulseAmount = Math.sin(Date.now() / 150) * 0.2;
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

  _renderSummonerDetails(ctx, zombie, baseSize, scale, headRadius) {
    const pulseAmount = Math.sin(Date.now() / 250) * 0.2;
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

  _renderShieldedDetails(ctx, zombie, baseSize, scale, headRadius) {
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

  _renderBossCharnierDetails(ctx, zombie, scale, headRadius) {
    ctx.save();

    const pulseAmount = Math.sin(Date.now() / 300) * 0.2;
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
      const x = Math.cos(pos.angle + Date.now() / 1000) * pos.radius;
      const y = Math.sin(pos.angle + Date.now() / 1000) * pos.radius;
      ctx.fillText('\uD83D\uDC80', x, y);
    });

    ctx.restore();
  }

  _renderBossInfectDetails(ctx, zombie, baseSize, scale, headRadius) {
    ctx.save();

    const pulseAmount = Math.sin(Date.now() / 250) * 0.2;
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

  _renderBossColosseDetails(ctx, zombie, baseSize, scale, bodyWidth, bodyHeight, headRadius) {
    ctx.save();

    const isEnraged = zombie.isEnraged || zombie.health / zombie.maxHealth < 0.3;
    const pulseAmount = Math.sin(Date.now() / (isEnraged ? 100 : 300)) * 0.3;
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

  _renderBossRoiDetails(ctx, zombie, baseSize, scale, headRadius) {
    ctx.save();

    const pulseAmount = Math.sin(Date.now() / 200) * 0.15;
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

  _renderBossOmegaDetails(ctx, zombie, baseSize, scale, headRadius) {
    ctx.save();

    const pulseAmount = Math.sin(Date.now() / 150) * 0.2;
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
      const angle = (i * Math.PI * 2) / 6 + Date.now() / 1000;
      const x = Math.cos(angle) * (headRadius + 40);
      const y = Math.sin(angle) * (headRadius + 40);
      ctx.fillText('\u2605', x, y);
    }

    ctx.restore();
  }

  renderZombies(ctx, camera, zombies, timestamp) {
    timestamp = timestamp || performance.now();

    for (const zombieId in zombies) {
      const zombie = zombies[zombieId];
      if (
        !zombie ||
        zombie.health <= 0 ||
        !Number.isFinite(zombie.x) ||
        !Number.isFinite(zombie.y)
      ) {
        continue;
      }

      const cullMargin = zombie.isBoss ? zombie.size * 4 : zombie.size * 2;
      if (!camera.isInViewport(zombie.x, zombie.y, cullMargin)) {
        continue;
      }

      this.drawZombieSprite(ctx, zombie, timestamp);

      if (zombie.maxHealth) {
        const healthPercent = zombie.health / zombie.maxHealth;
        const barWidth = zombie.size * 1.6;
        const barY = zombie.y - zombie.size - 10;

        ctx.fillStyle =
          healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000';
        ctx.fillRect(zombie.x - barWidth / 2, barY, barWidth * healthPercent, 5);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(zombie.x - barWidth / 2, barY, barWidth, 5);
      }

      if (zombie.isElite) {
        ctx.save();
        ctx.globalAlpha = 0.4 + Math.sin(timestamp / 200) * 0.2;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffd700';
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(zombie.x, zombie.y, zombie.size + 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#ffd700';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.strokeText('\uD83D\uDC51', zombie.x, zombie.y - zombie.size - 35);
        ctx.fillText('\uD83D\uDC51', zombie.x, zombie.y - zombie.size - 35);
      }

      if (zombie.isBoss) {
        const bossName = CONSTANTS.BOSS_NAMES[zombie.type] || 'BOSS';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(bossName, zombie.x, zombie.y - zombie.size - 25);
        ctx.fillText(bossName, zombie.x, zombie.y - zombie.size - 25);
      }

      this.renderZombieSpecialIndicator(ctx, zombie);
    }
  }

  renderZombieSpecialIndicator(ctx, zombie) {
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

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
      ctx.arc(
        zombie.x,
        zombie.y,
        zombie.size + 10 + Math.sin(Date.now() / 200) * 5,
        0,
        Math.PI * 2
      );
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
      ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 200) * 0.15;
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
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 150) * 0.2;
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
      this._renderSummonerIndicator(ctx, zombie);
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
      this._renderBerserkerIndicator(ctx, zombie);
    } else if (zombie.type === 'bossCharnier') {
      this._renderBossCharnierIndicator(ctx, zombie);
    } else if (zombie.type === 'bossInfect') {
      this._renderBossInfectIndicator(ctx, zombie);
    } else if (zombie.type === 'bossColosse') {
      this._renderBossColosseIndicator(ctx, zombie);
    } else if (zombie.type === 'bossRoi') {
      this._renderBossRoiIndicator(ctx, zombie);
    } else if (zombie.type === 'bossOmega') {
      this._renderBossOmegaIndicator(ctx, zombie);
    }
  }

  _renderSummonerIndicator(ctx, zombie) {
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(Date.now() / 180) * 0.15;
    ctx.strokeStyle = '#cc00ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(zombie.x, zombie.y, zombie.size + 14 + Math.sin(Date.now() / 250) * 4, 0, Math.PI * 2);
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

  _renderBerserkerIndicator(ctx, zombie) {
    if (zombie.isExtremeRaged) {
      ctx.save();
      ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 100) * 0.3;
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(
        zombie.x,
        zombie.y,
        zombie.size + 15 + Math.sin(Date.now() / 150) * 5,
        0,
        Math.PI * 2
      );
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
      ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 180) * 0.2;
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(
        zombie.x,
        zombie.y,
        zombie.size + 10 + Math.sin(Date.now() / 200) * 3,
        0,
        Math.PI * 2
      );
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

  _renderBossCharnierIndicator(ctx, zombie) {
    ctx.save();
    ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 150) * 0.2;
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

  _renderBossInfectIndicator(ctx, zombie) {
    ctx.save();
    ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 200) * 0.2;
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

  _renderBossColosseIndicator(ctx, zombie) {
    const isEnraged = zombie.isEnraged;
    const auraColor = isEnraged ? '#ff0000' : '#ff4500';

    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(Date.now() / (isEnraged ? 100 : 180)) * 0.3;
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

  _renderBossRoiIndicator(ctx, zombie) {
    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 120) * 0.3;
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

  _renderBossOmegaIndicator(ctx, zombie) {
    const phaseColors = ['#ff00ff', '#ff0088', '#8800ff', '#ff0000'];
    const currentColor = phaseColors[(zombie.phase || 1) - 1];

    ctx.save();
    ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 80) * 0.4;
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

  renderPlayerNameBubble(ctx, x, y, text, isCurrentPlayer, offsetY) {
    offsetY = offsetY || -40;

    ctx.font = 'bold 14px Arial';
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;

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

  drawPlayerSprite(ctx, player, isCurrentPlayer, timestamp) {
    ctx.save();
    ctx.translate(player.x, player.y);

    const velocity = Math.sqrt((player.vx || 0) ** 2 + (player.vy || 0) ** 2);
    const isMoving = velocity > 0.5;

    const walkCycle = isMoving ? Math.sin(timestamp / 150) * 0.3 : 0;
    const baseSize = 20 / 20;

    const primaryColor = isCurrentPlayer ? '#0088ff' : '#ff8800';
    const secondaryColor = isCurrentPlayer ? '#0066cc' : '#cc6600';
    const borderColor = isCurrentPlayer ? '#00ffff' : '#ffaa00';

    ctx.fillStyle = primaryColor;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;

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

    const bodyWidth = 16 * baseSize;
    const bodyHeight = 18 * baseSize;
    ctx.fillStyle = primaryColor;
    ctx.fillRect(-bodyWidth / 2, -4 * baseSize, bodyWidth, bodyHeight);
    ctx.strokeRect(-bodyWidth / 2, -4 * baseSize, bodyWidth, bodyHeight);

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -4 * baseSize);
    ctx.lineTo(0, -4 * baseSize + bodyHeight);
    ctx.stroke();

    const armWidth = 4 * baseSize;
    const armHeight = 12 * baseSize;
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

    const headRadius = 8 * baseSize;
    ctx.fillStyle = '#ffcc99';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -8 * baseSize, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const eyeSize = 2;
    const eyeOffset = 3 * baseSize;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-eyeOffset, -9 * baseSize, eyeSize, 0, Math.PI * 2);
    ctx.arc(eyeOffset, -9 * baseSize, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-eyeOffset, -9 * baseSize, eyeSize / 2, 0, Math.PI * 2);
    ctx.arc(eyeOffset, -9 * baseSize, eyeSize / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -6 * baseSize, 3 * baseSize, 0.2, Math.PI - 0.2);
    ctx.stroke();

    ctx.fillStyle = borderColor;
    ctx.beginPath();
    ctx.arc(0, -12 * baseSize, headRadius * 0.8, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  renderPlayers(ctx, camera, players, currentPlayerId, config, dateNow, timestamp) {
    dateNow = dateNow || Date.now();
    timestamp = timestamp || performance.now();

    Object.entries(players).forEach(([pid, p]) => {
      const isCurrentPlayer = pid === currentPlayerId;
      if (!p.alive) {
        return;
      }

      if (!p.hasNickname && !isCurrentPlayer) {
        return;
      }

      if (!isCurrentPlayer && !camera.isInViewport(p.x, p.y, config.PLAYER_SIZE * 3)) {
        return;
      }

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
      this.renderPlayerNameBubble(
        ctx,
        p.x,
        p.y,
        playerLabel,
        isCurrentPlayer,
        -config.PLAYER_SIZE - 25
      );

      const healthPercent = p.health / p.maxHealth;
      ctx.fillStyle =
        healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000';
      ctx.fillRect(p.x - 20, p.y + config.PLAYER_SIZE + 5, 40 * healthPercent, 5);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x - 20, p.y + config.PLAYER_SIZE + 5, 40, 5);
    });
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
