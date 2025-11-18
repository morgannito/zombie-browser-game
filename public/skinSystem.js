/**
 * SKIN SYSTEM
 * Player and weapon customization system
 * @version 1.0.0
 */

/* ============================================
   SKIN DEFINITIONS
   ============================================ */

const PLAYER_SKINS = {
  default: {
    id: 'default',
    name: 'Classique',
    color: '#00ff00',
    strokeColor: '#00aa00',
    trail: false,
    glow: false,
    unlocked: true,
    cost: 0
  },
  neon: {
    id: 'neon',
    name: 'Néon',
    color: '#00ffff',
    strokeColor: '#0088ff',
    trail: true,
    trailColor: 'rgba(0, 255, 255, 0.5)',
    glow: true,
    glowColor: 'rgba(0, 255, 255, 0.8)',
    unlocked: false,
    cost: 100
  },
  fire: {
    id: 'fire',
    name: 'Flammes',
    color: '#ff6600',
    strokeColor: '#ff0000',
    trail: true,
    trailColor: 'rgba(255, 100, 0, 0.6)',
    glow: true,
    glowColor: 'rgba(255, 100, 0, 0.9)',
    unlocked: false,
    cost: 150
  },
  shadow: {
    id: 'shadow',
    name: 'Ombre',
    color: '#4a0080',
    strokeColor: '#2a0050',
    trail: true,
    trailColor: 'rgba(74, 0, 128, 0.4)',
    glow: true,
    glowColor: 'rgba(138, 43, 226, 0.7)',
    unlocked: false,
    cost: 200
  },
  gold: {
    id: 'gold',
    name: 'Or',
    color: '#ffd700',
    strokeColor: '#ffaa00',
    trail: true,
    trailColor: 'rgba(255, 215, 0, 0.5)',
    glow: true,
    glowColor: 'rgba(255, 215, 0, 0.8)',
    particles: true,
    particleColor: '#ffd700',
    unlocked: false,
    cost: 300
  },
  rainbow: {
    id: 'rainbow',
    name: 'Arc-en-ciel',
    rainbow: true,
    trail: true,
    glow: true,
    unlocked: false,
    cost: 500
  },
  toxic: {
    id: 'toxic',
    name: 'Toxique',
    color: '#88ff00',
    strokeColor: '#44aa00',
    trail: true,
    trailColor: 'rgba(136, 255, 0, 0.6)',
    glow: true,
    glowColor: 'rgba(136, 255, 0, 0.8)',
    unlocked: false,
    cost: 150
  },
  ice: {
    id: 'ice',
    name: 'Glace',
    color: '#88ddff',
    strokeColor: '#4488ff',
    trail: true,
    trailColor: 'rgba(136, 221, 255, 0.5)',
    glow: true,
    glowColor: 'rgba(136, 221, 255, 0.7)',
    unlocked: false,
    cost: 150
  },
  blood: {
    id: 'blood',
    name: 'Sang',
    color: '#cc0000',
    strokeColor: '#880000',
    trail: true,
    trailColor: 'rgba(204, 0, 0, 0.6)',
    glow: true,
    glowColor: 'rgba(204, 0, 0, 0.8)',
    unlocked: false,
    cost: 200
  }
};

const WEAPON_SKINS = {
  default: {
    id: 'default',
    name: 'Standard',
    bulletColor: '#ffffff',
    bulletTrail: false,
    unlocked: true,
    cost: 0
  },
  laser: {
    id: 'laser',
    name: 'Laser',
    bulletColor: '#ff0000',
    bulletTrail: true,
    trailColor: 'rgba(255, 0, 0, 0.5)',
    glowEffect: true,
    unlocked: false,
    cost: 100
  },
  plasma: {
    id: 'plasma',
    name: 'Plasma',
    bulletColor: '#00ffff',
    bulletTrail: true,
    trailColor: 'rgba(0, 255, 255, 0.6)',
    glowEffect: true,
    particles: true,
    unlocked: false,
    cost: 150
  },
  explosive: {
    id: 'explosive',
    name: 'Explosif',
    bulletColor: '#ff6600',
    bulletTrail: true,
    trailColor: 'rgba(255, 100, 0, 0.7)',
    glowEffect: true,
    unlocked: false,
    cost: 200
  },
  electric: {
    id: 'electric',
    name: 'Électrique',
    bulletColor: '#ffff00',
    bulletTrail: true,
    trailColor: 'rgba(255, 255, 0, 0.6)',
    glowEffect: true,
    lightning: true,
    unlocked: false,
    cost: 200
  },
  rainbow: {
    id: 'rainbow',
    name: 'Arc-en-ciel',
    rainbow: true,
    bulletTrail: true,
    glowEffect: true,
    unlocked: false,
    cost: 300
  }
};

/* ============================================
   SKIN RENDERER
   ============================================ */

class SkinRenderer {
  constructor() {
    this.rainbowHue = 0;
    this.trailParticles = [];
  }

  /**
   * Met à jour l'effet arc-en-ciel
   */
  updateRainbow() {
    this.rainbowHue = (this.rainbowHue + 2) % 360;
  }

  /**
   * Dessine un joueur avec son skin
   */
  drawPlayer(ctx, x, y, radius, skin) {
    ctx.save();

    // Calcul de la couleur
    let color = skin.color;
    let strokeColor = skin.strokeColor;

    if (skin.rainbow) {
      color = `hsl(${this.rainbowHue}, 100%, 50%)`;
      strokeColor = `hsl(${this.rainbowHue}, 100%, 30%)`;
    }

    // Effet de glow
    if (skin.glow) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = skin.glowColor || color;
    }

    // Cercle principal
    ctx.fillStyle = color;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Particules autour (pour skin gold par exemple)
    if (skin.particles) {
      for (let i = 0; i < 5; i++) {
        const angle = (Date.now() / 1000 + i * (Math.PI * 2 / 5)) % (Math.PI * 2);
        const px = x + Math.cos(angle) * (radius + 5);
        const py = y + Math.sin(angle) * (radius + 5);

        ctx.fillStyle = skin.particleColor || color;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  /**
   * Dessine une traînée (trail)
   */
  drawTrail(ctx, x, y, skin) {
    if (!skin.trail) return;

    this.trailParticles.push({
      x,
      y,
      color: skin.trailColor || skin.color,
      life: 1,
      size: 8
    });

    // Limite de particules
    if (this.trailParticles.length > 50) {
      this.trailParticles.shift();
    }

    // Mise à jour et dessin
    for (let i = this.trailParticles.length - 1; i >= 0; i--) {
      const p = this.trailParticles[i];
      p.life -= 0.02;
      p.size *= 0.98;

      if (p.life <= 0) {
        this.trailParticles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.life * 0.5;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * Dessine une balle avec skin d'arme
   */
  drawBullet(ctx, x, y, radius, weaponSkin) {
    ctx.save();

    let color = weaponSkin.bulletColor;

    if (weaponSkin.rainbow) {
      color = `hsl(${this.rainbowHue}, 100%, 50%)`;
    }

    // Effet de glow
    if (weaponSkin.glowEffect) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = color;
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Effet de lightning (éclair)
    if (weaponSkin.lightning && Math.random() > 0.7) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - radius, y);
      ctx.lineTo(x + radius, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - radius);
      ctx.lineTo(x, y + radius);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Nettoie les traînées
   */
  clearTrails() {
    this.trailParticles = [];
  }
}

/* ============================================
   SKIN MANAGER
   ============================================ */

class SkinManager {
  constructor() {
    this.playerSkins = { ...PLAYER_SKINS };
    this.weaponSkins = { ...WEAPON_SKINS };
    this.currentPlayerSkin = 'default';
    this.currentWeaponSkin = 'default';
    this.renderer = new SkinRenderer();

    this.loadFromLocalStorage();
  }

  /**
   * Charge les skins débloqués depuis localStorage
   */
  loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('zombie_skins');
      if (saved) {
        const data = JSON.parse(saved);

        // Débloquer les skins sauvegardés
        if (data.unlockedPlayerSkins) {
          data.unlockedPlayerSkins.forEach(skinId => {
            if (this.playerSkins[skinId]) {
              this.playerSkins[skinId].unlocked = true;
            }
          });
        }

        if (data.unlockedWeaponSkins) {
          data.unlockedWeaponSkins.forEach(skinId => {
            if (this.weaponSkins[skinId]) {
              this.weaponSkins[skinId].unlocked = true;
            }
          });
        }

        // Charger les skins équipés
        if (data.currentPlayerSkin && this.playerSkins[data.currentPlayerSkin]) {
          this.currentPlayerSkin = data.currentPlayerSkin;
        }

        if (data.currentWeaponSkin && this.weaponSkins[data.currentWeaponSkin]) {
          this.currentWeaponSkin = data.currentWeaponSkin;
        }
      }
    } catch (e) {
      console.error('Error loading skins:', e);
    }
  }

  /**
   * Sauvegarde les skins dans localStorage
   */
  saveToLocalStorage() {
    try {
      const unlockedPlayerSkins = Object.keys(this.playerSkins)
        .filter(id => this.playerSkins[id].unlocked);

      const unlockedWeaponSkins = Object.keys(this.weaponSkins)
        .filter(id => this.weaponSkins[id].unlocked);

      const data = {
        unlockedPlayerSkins,
        unlockedWeaponSkins,
        currentPlayerSkin: this.currentPlayerSkin,
        currentWeaponSkin: this.currentWeaponSkin
      };

      localStorage.setItem('zombie_skins', JSON.stringify(data));
    } catch (e) {
      console.error('Error saving skins:', e);
    }
  }

  /**
   * Débloque un skin de joueur
   */
  unlockPlayerSkin(skinId) {
    if (this.playerSkins[skinId]) {
      this.playerSkins[skinId].unlocked = true;
      this.saveToLocalStorage();
      return true;
    }
    return false;
  }

  /**
   * Débloque un skin d'arme
   */
  unlockWeaponSkin(skinId) {
    if (this.weaponSkins[skinId]) {
      this.weaponSkins[skinId].unlocked = true;
      this.saveToLocalStorage();
      return true;
    }
    return false;
  }

  /**
   * Équipe un skin de joueur
   */
  equipPlayerSkin(skinId) {
    if (this.playerSkins[skinId] && this.playerSkins[skinId].unlocked) {
      this.currentPlayerSkin = skinId;
      this.saveToLocalStorage();
      return true;
    }
    return false;
  }

  /**
   * Équipe un skin d'arme
   */
  equipWeaponSkin(skinId) {
    if (this.weaponSkins[skinId] && this.weaponSkins[skinId].unlocked) {
      this.currentWeaponSkin = skinId;
      this.saveToLocalStorage();
      return true;
    }
    return false;
  }

  /**
   * Obtient le skin de joueur actuel
   */
  getCurrentPlayerSkin() {
    return this.playerSkins[this.currentPlayerSkin];
  }

  /**
   * Obtient le skin d'arme actuel
   */
  getCurrentWeaponSkin() {
    return this.weaponSkins[this.currentWeaponSkin];
  }

  /**
   * Obtient tous les skins de joueur
   */
  getAllPlayerSkins() {
    return Object.values(this.playerSkins);
  }

  /**
   * Obtient tous les skins d'arme
   */
  getAllWeaponSkins() {
    return Object.values(this.weaponSkins);
  }

  /**
   * Dessine un joueur avec son skin
   */
  drawPlayer(ctx, x, y, radius) {
    const skin = this.getCurrentPlayerSkin();
    this.renderer.drawPlayer(ctx, x, y, radius, skin);
    this.renderer.drawTrail(ctx, x, y, skin);
  }

  /**
   * Dessine une balle avec le skin d'arme
   */
  drawBullet(ctx, x, y, radius) {
    const skin = this.getCurrentWeaponSkin();
    this.renderer.drawBullet(ctx, x, y, radius, skin);
  }

  /**
   * Met à jour le rendu (pour effets animés)
   */
  update() {
    this.renderer.updateRainbow();
  }

  /**
   * Nettoie le rendu
   */
  clear() {
    this.renderer.clearTrails();
  }
}

// Export pour utilisation globale
if (typeof window !== 'undefined') {
  window.SkinManager = SkinManager;
  window.PLAYER_SKINS = PLAYER_SKINS;
  window.WEAPON_SKINS = WEAPON_SKINS;
}
