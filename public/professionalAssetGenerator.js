/**
 * Professional Asset Generator - Génère des assets de qualité professionnelle
 *
 * Ce générateur crée des sprites pixel-art détaillés qui ressemblent
 * à des assets de jeu professionnel.
 */

class ProfessionalAssetGenerator {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  /**
     * Génère un background détaillé avec plusieurs couches
     */
  generateBackground(theme = 'city') {
    this.canvas.width = 512;
    this.canvas.height = 512;
    const ctx = this.ctx;

    const themes = {
      city: {
        base: '#1a1a2e',
        tile: '#2d2d44',
        accent: '#4a4a6a',
        dark: '#0a0a1a',
        light: '#3d3d54',
        detail: '#5a5a7a'
      },
      forest: {
        base: '#0d1f0d',
        tile: '#1a3a1a',
        accent: '#2a4a2a',
        dark: '#051005',
        light: '#2f4f2f',
        detail: '#3a5a3a'
      },
      lab: {
        base: '#1a1a1a',
        tile: '#2a2a2a',
        accent: '#3a3a3a',
        dark: '#0a0a0a',
        light: '#4a4a4a',
        detail: '#00ff00'
      },
      cemetery: {
        base: '#0a0a1a',
        tile: '#1a1a2a',
        accent: '#2a2a3a',
        dark: '#000000',
        light: '#3a3a4a',
        detail: '#6666aa'
      },
      hospital: {
        base: '#d8d8e8',
        tile: '#e8e8f0',
        accent: '#c0c0d0',
        dark: '#b0b0c0',
        light: '#f8f8ff',
        detail: '#00aa00'
      }
    };

    const colors = themes[theme] || themes.city;

    // Base
    ctx.fillStyle = colors.base;
    ctx.fillRect(0, 0, 512, 512);

    // Pattern de tuiles avec détails
    const tileSize = 64;
    for (let x = 0; x < 512; x += tileSize) {
      for (let y = 0; y < 512; y += tileSize) {
        // Tuile principale
        ctx.fillStyle = colors.tile;
        ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);

        // Bordure sombre
        ctx.strokeStyle = colors.dark;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, tileSize, tileSize);

        // Bordure claire (effet 3D)
        ctx.strokeStyle = colors.light;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1, y + 1, tileSize - 2, tileSize - 2);

        // Détails aléatoires
        const rand = (x + y) % 5;
        if (rand === 0) {
          // Tache sombre
          ctx.fillStyle = colors.dark;
          ctx.fillRect(x + 10, y + 10, 8, 8);
        } else if (rand === 1) {
          // Point de lumière
          ctx.fillStyle = colors.accent;
          ctx.beginPath();
          ctx.arc(x + tileSize / 2, y + tileSize / 2, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (rand === 2) {
          // Ligne de détail
          ctx.strokeStyle = colors.detail;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + 10, y + tileSize / 2);
          ctx.lineTo(x + tileSize - 10, y + tileSize / 2);
          ctx.stroke();
        }
      }
    }

    // Overlay de texture (grunge)
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const size = Math.random() * 10 + 2;
      const alpha = Math.random() * 0.2;

      ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      ctx.fillRect(x, y, size, size);
    }

    // Highlights
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const size = Math.random() * 5 + 1;
      const alpha = Math.random() * 0.1;

      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillRect(x, y, size, size);
    }

    return this.canvas.toDataURL();
  }

  /**
     * Génère un sprite de zombie détaillé (style pixel-art)
     */
  generateZombieSprite(type = 'normal') {
    this.canvas.width = 128;
    this.canvas.height = 128;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, 128, 128);

    const typeConfig = {
      normal: { color: '#00ff00', size: 1.0, features: ['basic'] },
      fast: { color: '#ffff00', size: 0.8, features: ['lean'] },
      tank: { color: '#ff6600', size: 1.5, features: ['armor', 'large'] },
      explosive: { color: '#ff00ff', size: 1.0, features: ['bomb'] },
      healer: { color: '#00ffff', size: 1.0, features: ['cross'] },
      slower: { color: '#8800ff', size: 1.0, features: ['aura'] },
      poison: { color: '#22ff22', size: 1.0, features: ['toxic'] },
      shooter: { color: '#ff9900', size: 1.0, features: ['gun'] },
      boss: { color: '#ff0000', size: 2.0, features: ['crown', 'large', 'armor'] }
    };

    const config = typeConfig[type] || typeConfig.normal;
    const baseSize = 16 * config.size;
    const centerX = 64;
    const centerY = 64;

    // Fonction helper pour assombrir une couleur
    const darken = (color, percent) => {
      const num = parseInt(color.replace('#', ''), 16);
      const amt = Math.round(2.55 * percent);
      const R = Math.max((num >> 16) - amt, 0);
      const G = Math.max(((num >> 8) & 0x00FF) - amt, 0);
      const B = Math.max((num & 0x0000FF) - amt, 0);
      return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
    };

    // Fonction helper pour éclaircir une couleur
    const lighten = (color, percent) => {
      const num = parseInt(color.replace('#', ''), 16);
      const amt = Math.round(2.55 * percent);
      const R = Math.min((num >> 16) + amt, 255);
      const G = Math.min(((num >> 8) & 0x00FF) + amt, 255);
      const B = Math.min((num & 0x0000FF) + amt, 255);
      return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
    };

    const mainColor = config.color;
    const darkColor = darken(mainColor, 40);
    const lightColor = lighten(mainColor, 30);

    // Ombre au sol
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + baseSize * 2.5, baseSize * 1.2, baseSize * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Jambes (pixel-art)
    const legWidth = baseSize * 0.3;
    const legHeight = baseSize * 1.2;

    // Jambe gauche
    ctx.fillStyle = darkColor;
    ctx.fillRect(centerX - baseSize * 0.6, centerY + baseSize * 0.8, legWidth, legHeight);
    // Highlight
    ctx.fillStyle = lightColor;
    ctx.fillRect(centerX - baseSize * 0.6 + 2, centerY + baseSize * 0.8 + 2, 2, legHeight - 4);
    // Ombre
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(centerX - baseSize * 0.3, centerY + baseSize * 0.8, 2, legHeight);

    // Jambe droite
    ctx.fillStyle = darkColor;
    ctx.fillRect(centerX + baseSize * 0.3, centerY + baseSize * 0.8, legWidth, legHeight);
    // Highlight
    ctx.fillStyle = lightColor;
    ctx.fillRect(centerX + baseSize * 0.3 + 2, centerY + baseSize * 0.8 + 2, 2, legHeight - 4);

    // Corps principal
    const bodyWidth = baseSize * 1.2;
    const bodyHeight = baseSize * 1.5;

    // Corps - ombre
    ctx.fillStyle = darkColor;
    ctx.fillRect(centerX - bodyWidth / 2, centerY - baseSize * 0.5, bodyWidth, bodyHeight);

    // Corps - couleur principale
    ctx.fillStyle = mainColor;
    ctx.fillRect(centerX - bodyWidth / 2 + 2, centerY - baseSize * 0.5, bodyWidth - 4, bodyHeight);

    // Corps - highlight gauche
    ctx.fillStyle = lightColor;
    ctx.fillRect(centerX - bodyWidth / 2 + 4, centerY - baseSize * 0.5 + 4, 4, bodyHeight - 8);

    // Corps - ombre droite
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(centerX + bodyWidth / 2 - 6, centerY - baseSize * 0.5 + 4, 4, bodyHeight - 8);

    // Bras gauche
    const armWidth = baseSize * 0.25;
    const armHeight = baseSize * 1.0;

    ctx.fillStyle = darkColor;
    ctx.fillRect(centerX - bodyWidth / 2 - armWidth, centerY - baseSize * 0.3, armWidth, armHeight);
    ctx.fillStyle = lightColor;
    ctx.fillRect(centerX - bodyWidth / 2 - armWidth + 2, centerY - baseSize * 0.3 + 2, 2, armHeight - 4);

    // Bras droit
    ctx.fillStyle = darkColor;
    ctx.fillRect(centerX + bodyWidth / 2, centerY - baseSize * 0.3, armWidth, armHeight);
    ctx.fillStyle = lightColor;
    ctx.fillRect(centerX + bodyWidth / 2 + 2, centerY - baseSize * 0.3 + 2, 2, armHeight - 4);

    // Tête
    const headSize = baseSize * 0.9;

    // Tête - ombre
    ctx.fillStyle = darkColor;
    ctx.beginPath();
    ctx.arc(centerX, centerY - baseSize * 1.3, headSize, 0, Math.PI * 2);
    ctx.fill();

    // Tête - couleur principale
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(centerX - 2, centerY - baseSize * 1.3 - 2, headSize - 2, 0, Math.PI * 2);
    ctx.fill();

    // Highlight sur la tête
    ctx.fillStyle = lightColor;
    ctx.beginPath();
    ctx.arc(centerX - headSize * 0.3, centerY - baseSize * 1.3 - headSize * 0.3, headSize * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Yeux rouges brillants
    const eyeSize = headSize * 0.25;
    const eyeGlow = headSize * 0.4;

    // Lueur des yeux
    const gradient = ctx.createRadialGradient(
      centerX - headSize * 0.35, centerY - baseSize * 1.3,
      0,
      centerX - headSize * 0.35, centerY - baseSize * 1.3,
      eyeGlow
    );
    gradient.addColorStop(0, 'rgba(255, 0, 0, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(centerX - headSize - eyeGlow, centerY - baseSize * 1.3 - eyeGlow, eyeGlow * 2, eyeGlow * 2);

    // Œil gauche
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(centerX - headSize * 0.35, centerY - baseSize * 1.3, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    // Pupille gauche
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(centerX - headSize * 0.35 + 1, centerY - baseSize * 1.3 - 1, eyeSize * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Lueur œil droit
    const gradient2 = ctx.createRadialGradient(
      centerX + headSize * 0.35, centerY - baseSize * 1.3,
      0,
      centerX + headSize * 0.35, centerY - baseSize * 1.3,
      eyeGlow
    );
    gradient2.addColorStop(0, 'rgba(255, 0, 0, 0.6)');
    gradient2.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.fillStyle = gradient2;
    ctx.fillRect(centerX - eyeGlow, centerY - baseSize * 1.3 - eyeGlow, eyeGlow * 2, eyeGlow * 2);

    // Œil droit
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(centerX + headSize * 0.35, centerY - baseSize * 1.3, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    // Pupille droite
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(centerX + headSize * 0.35 + 1, centerY - baseSize * 1.3 - 1, eyeSize * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Bouche (grimaçante)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY - baseSize * 1.1, headSize * 0.4, 0, Math.PI, false);
    ctx.stroke();

    // Dents
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      const toothX = centerX - headSize * 0.3 + i * (headSize * 0.2);
      ctx.fillRect(toothX, centerY - baseSize * 1.1, 3, 4);
    }

    // Features spéciales selon le type
    if (config.features.includes('armor')) {
      // Armure
      ctx.strokeStyle = '#666666';
      ctx.lineWidth = 3;
      ctx.strokeRect(centerX - bodyWidth / 2 + 4, centerY - baseSize * 0.3, bodyWidth - 8, bodyHeight - 10);
    }

    if (config.features.includes('bomb')) {
      // Symbole explosion
      ctx.font = 'bold 20px Arial';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('💣', centerX, centerY);
    }

    if (config.features.includes('cross')) {
      // Croix de soigneur
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - 10);
      ctx.lineTo(centerX, centerY + 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(centerX - 10, centerY);
      ctx.lineTo(centerX + 10, centerY);
      ctx.stroke();
    }

    if (config.features.includes('gun')) {
      // Arme
      ctx.fillStyle = '#444444';
      ctx.fillRect(centerX + bodyWidth / 2, centerY, baseSize * 0.8, baseSize * 0.3);
      ctx.fillStyle = '#222222';
      ctx.fillRect(centerX + bodyWidth / 2 + baseSize * 0.6, centerY + baseSize * 0.1, baseSize * 0.3, baseSize * 0.1);
    }

    if (config.features.includes('crown') && type === 'boss') {
      // Couronne de boss
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.moveTo(centerX - headSize * 0.8, centerY - baseSize * 2);
      ctx.lineTo(centerX - headSize * 0.4, centerY - baseSize * 2.3);
      ctx.lineTo(centerX, centerY - baseSize * 2);
      ctx.lineTo(centerX + headSize * 0.4, centerY - baseSize * 2.3);
      ctx.lineTo(centerX + headSize * 0.8, centerY - baseSize * 2);
      ctx.lineTo(centerX + headSize * 0.6, centerY - baseSize * 1.7);
      ctx.lineTo(centerX - headSize * 0.6, centerY - baseSize * 1.7);
      ctx.closePath();
      ctx.fill();

      // Joyaux sur la couronne
      ctx.fillStyle = '#FF0000';
      ctx.beginPath();
      ctx.arc(centerX, centerY - baseSize * 2.2, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (config.features.includes('toxic')) {
      // Effet toxique
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseSize * 2 + i * 8, 0, Math.PI * 2);
        ctx.globalAlpha = 0.3 - i * 0.1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
    }

    if (config.features.includes('aura')) {
      // Aura ralentissante
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseSize * 2 + i * 6, 0, Math.PI * 2);
        ctx.globalAlpha = 0.4 - i * 0.1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
    }

    return this.canvas.toDataURL();
  }

  /**
     * Génère un sprite de joueur détaillé (style pixel-art)
     */
  generatePlayerSprite() {
    this.canvas.width = 128;
    this.canvas.height = 128;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, 128, 128);

    const baseSize = 16;
    const centerX = 64;
    const centerY = 64;
    const mainColor = '#0088ff';
    const darkColor = '#0055aa';
    const lightColor = '#00aaff';

    // Ombre au sol
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + baseSize * 2.5, baseSize * 1.2, baseSize * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Jambes (pixel-art)
    const legWidth = baseSize * 0.35;
    const legHeight = baseSize * 1.3;

    // Jambe gauche
    ctx.fillStyle = darkColor;
    ctx.fillRect(centerX - baseSize * 0.6, centerY + baseSize * 0.8, legWidth, legHeight);
    ctx.fillStyle = lightColor;
    ctx.fillRect(centerX - baseSize * 0.6 + 2, centerY + baseSize * 0.8 + 2, 2, legHeight - 4);

    // Jambe droite
    ctx.fillStyle = darkColor;
    ctx.fillRect(centerX + baseSize * 0.3, centerY + baseSize * 0.8, legWidth, legHeight);
    ctx.fillStyle = lightColor;
    ctx.fillRect(centerX + baseSize * 0.3 + 2, centerY + baseSize * 0.8 + 2, 2, legHeight - 4);

    // Corps principal (armure)
    const bodyWidth = baseSize * 1.3;
    const bodyHeight = baseSize * 1.6;

    // Corps - ombre
    ctx.fillStyle = darkColor;
    ctx.fillRect(centerX - bodyWidth / 2, centerY - baseSize * 0.5, bodyWidth, bodyHeight);

    // Corps - couleur principale
    ctx.fillStyle = mainColor;
    ctx.fillRect(centerX - bodyWidth / 2 + 2, centerY - baseSize * 0.5, bodyWidth - 4, bodyHeight);

    // Plaque d'armure
    ctx.fillStyle = lightColor;
    ctx.fillRect(centerX - bodyWidth / 2 + 4, centerY - baseSize * 0.5 + 4, bodyWidth - 8, bodyHeight - 8);

    // Détails d'armure
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(centerX - bodyWidth / 2 + 6, centerY - baseSize * 0.3, bodyWidth - 12, bodyHeight * 0.6);

    // Bras gauche
    const armWidth = baseSize * 0.3;
    const armHeight = baseSize * 1.2;

    ctx.fillStyle = darkColor;
    ctx.fillRect(centerX - bodyWidth / 2 - armWidth - 2, centerY - baseSize * 0.3, armWidth, armHeight);
    ctx.fillStyle = lightColor;
    ctx.fillRect(centerX - bodyWidth / 2 - armWidth, centerY - baseSize * 0.3 + 2, 2, armHeight - 4);

    // Bras droit (tenant l'arme)
    ctx.fillStyle = darkColor;
    ctx.fillRect(centerX + bodyWidth / 2 + 2, centerY - baseSize * 0.3, armWidth, armHeight);
    ctx.fillStyle = lightColor;
    ctx.fillRect(centerX + bodyWidth / 2 + 4, centerY - baseSize * 0.3 + 2, 2, armHeight - 4);

    // Arme (fusil)
    const gunLength = baseSize * 1.5;
    const gunWidth = baseSize * 0.4;

    // Canon
    ctx.fillStyle = '#444444';
    ctx.fillRect(centerX + bodyWidth / 2 + armWidth, centerY, gunLength, gunWidth);
    ctx.fillStyle = '#666666';
    ctx.fillRect(centerX + bodyWidth / 2 + armWidth, centerY + 2, gunLength, 2);

    // Poignée
    ctx.fillStyle = '#222222';
    ctx.fillRect(centerX + bodyWidth / 2 + armWidth + gunLength * 0.3, centerY + gunWidth, gunWidth * 0.8, gunWidth);

    // Crosse
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(centerX + bodyWidth / 2 + 2, centerY + gunWidth * 0.5, gunWidth, gunWidth * 1.5);

    // Tête (casque)
    const headSize = baseSize * 1.0;

    // Casque - ombre
    ctx.fillStyle = darkColor;
    ctx.beginPath();
    ctx.arc(centerX, centerY - baseSize * 1.4, headSize, 0, Math.PI * 2);
    ctx.fill();

    // Casque - couleur principale
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(centerX - 2, centerY - baseSize * 1.4 - 2, headSize - 2, 0, Math.PI * 2);
    ctx.fill();

    // Highlight sur le casque
    ctx.fillStyle = lightColor;
    ctx.beginPath();
    ctx.arc(centerX - headSize * 0.4, centerY - baseSize * 1.4 - headSize * 0.4, headSize * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Visière (noir brillant)
    ctx.fillStyle = '#000000';
    ctx.fillRect(centerX - headSize * 0.7, centerY - baseSize * 1.5, headSize * 1.4, headSize * 0.35);

    // Reflet sur la visière
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(centerX - headSize * 0.6, centerY - baseSize * 1.48, headSize * 0.6, headSize * 0.1);

    // Antenne/capteur
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX + headSize * 0.6, centerY - baseSize * 1.8);
    ctx.lineTo(centerX + headSize * 0.8, centerY - baseSize * 2.2);
    ctx.stroke();

    // LED sur l'antenne
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(centerX + headSize * 0.8, centerY - baseSize * 2.2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Badge/insigne
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - baseSize * 0.3);
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * 6;
      const y = centerY - baseSize * 0.3 + Math.sin(angle) * 6;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    return this.canvas.toDataURL();
  }

  /**
     * Génère un sprite de pièce animé
     */
  generateCoinSprite() {
    this.canvas.width = 64;
    this.canvas.height = 64;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, 64, 64);

    const centerX = 32;
    const centerY = 32;
    const size = 24;

    // Ombre
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + 4, size * 0.8, size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pièce principale
    const gradient = ctx.createRadialGradient(centerX - 6, centerY - 6, 0, centerX, centerY, size);
    gradient.addColorStop(0, '#fff4a3');
    gradient.addColorStop(0.5, '#ffd700');
    gradient.addColorStop(1, '#b8860b');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, size, 0, Math.PI * 2);
    ctx.fill();

    // Bordure
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Cercle intérieur
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, size - 6, 0, Math.PI * 2);
    ctx.stroke();

    // Symbole dollar
    ctx.fillStyle = '#b8860b';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', centerX, centerY + 1);

    // Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.ellipse(centerX - 8, centerY - 8, 8, 6, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    return this.canvas.toDataURL();
  }

  /**
     * Génère tous les assets de démonstration professionnels
     */
  async generateAllProfessionalAssets() {
    console.log('🎨 Génération des assets professionnels...');

    const assets = {
      backgrounds: [],
      zombies: {},
      player: null,
      coin: null
    };

    // Générer 5 backgrounds
    const themes = ['city', 'forest', 'lab', 'cemetery', 'hospital'];
    for (let i = 0; i < 5; i++) {
      console.log(`   ⏳ Génération background ${i + 1}/5 (${themes[i]})...`);
      assets.backgrounds.push(this.generateBackground(themes[i]));
    }

    // Générer les sprites de zombies
    const zombieTypes = ['normal', 'fast', 'tank', 'explosive', 'healer', 'slower', 'poison', 'shooter', 'boss'];
    for (const type of zombieTypes) {
      console.log(`   ⏳ Génération zombie ${type}...`);
      assets.zombies[type] = this.generateZombieSprite(type);
    }

    // Générer le sprite du joueur
    console.log('   ⏳ Génération sprite joueur...');
    assets.player = this.generatePlayerSprite();

    // Générer la pièce
    console.log('   ⏳ Génération sprite pièce...');
    assets.coin = this.generateCoinSprite();

    console.log('✅ Assets professionnels générés');
    return assets;
  }

  /**
     * Convertit un data URL en Image
     */
  dataURLToImage(dataURL) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataURL;
    });
  }

  /**
     * Charge les assets professionnels dans l'AssetManager
     */
  async loadProfessionalAssetsIntoManager(assetManager) {
    console.log('📦 Chargement des assets professionnels dans l\'AssetManager...');

    const assets = await this.generateAllProfessionalAssets();

    // Charger les backgrounds
    for (let i = 0; i < assets.backgrounds.length; i++) {
      const img = await this.dataURLToImage(assets.backgrounds[i]);
      assetManager.images.set(`background_${i + 1}`, img);
    }

    // Charger les zombies
    for (const [type, dataURL] of Object.entries(assets.zombies)) {
      const img = await this.dataURLToImage(dataURL);
      assetManager.images.set(`zombie_${type}`, img);
    }

    // Charger le joueur
    const playerImg = await this.dataURLToImage(assets.player);
    assetManager.images.set('player_walk', playerImg);
    assetManager.images.set('player_idle', playerImg);

    // Charger la pièce
    const coinImg = await this.dataURLToImage(assets.coin);
    assetManager.images.set('item_coin', coinImg);

    console.log('✅ Assets professionnels chargés dans l\'AssetManager');
    console.log('🎮 Les assets de haute qualité sont maintenant actifs !');
  }
}

// Export pour utilisation dans d'autres fichiers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProfessionalAssetGenerator;
}
