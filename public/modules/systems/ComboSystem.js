/**
 * COMBO SYSTEM
 * Manages kill combos and score multipliers with visual feedback
 * @module ComboSystem
 * @author Claude Code
 * @version 2.0.0
 */

class ComboSystem {
  constructor() {
    this.combo = 0;
    this.multiplier = 1;
    this.score = 0;
    this.displayCombo = 0; // Pour l'animation
    this.comboElement = null;
    this.scoreElement = null;
    this.createUI();
  }

  createUI() {
    // Détecter si on est sur mobile
    const isMobile = window.innerWidth <= 768;

    // Créer l'élément d'affichage du combo
    this.comboElement = document.createElement('div');
    this.comboElement.id = 'combo-display';

    // Styles adaptés pour mobile ou desktop
    if (isMobile) {
      this.comboElement.style.cssText = `
        position: fixed;
        top: 60px;
        right: 8px;
        background: rgba(255, 100, 0, 0.6);
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 16px;
        font-weight: bold;
        color: white;
        text-align: center;
        z-index: 1000;
        display: none;
        box-shadow: 0 0 15px rgba(255, 100, 0, 0.4);
        border: 2px solid rgba(255, 150, 0, 0.6);
        transform: scale(1);
        transition: transform 0.2s ease;
        backdrop-filter: blur(5px);
        -webkit-backdrop-filter: blur(5px);
      `;
    } else {
      this.comboElement.style.cssText = `
        position: fixed;
        top: 120px;
        right: 20px;
        background: rgba(255, 100, 0, 0.9);
        padding: 15px 25px;
        border-radius: 10px;
        font-size: 32px;
        font-weight: bold;
        color: white;
        text-align: center;
        z-index: 1000;
        display: none;
        box-shadow: 0 0 20px rgba(255, 100, 0, 0.5);
        border: 3px solid rgba(255, 150, 0, 0.8);
        transform: scale(1);
        transition: transform 0.2s ease;
      `;
    }
    document.body.appendChild(this.comboElement);

    // Créer l'élément d'affichage du score
    this.scoreElement = document.createElement('div');
    this.scoreElement.id = 'score-display';

    // Styles adaptés pour mobile ou desktop
    if (isMobile) {
      this.scoreElement.style.cssText = `
        position: fixed;
        top: 8px;
        right: 8px;
        background: rgba(30, 30, 60, 0.6);
        padding: 5px 10px;
        border-radius: 5px;
        font-size: 13px;
        font-weight: bold;
        color: #FFD700;
        z-index: 1000;
        border: 1px solid rgba(255, 215, 0, 0.4);
        backdrop-filter: blur(5px);
        -webkit-backdrop-filter: blur(5px);
      `;
    } else {
      this.scoreElement.style.cssText = `
        position: fixed;
        top: 70px;
        right: 20px;
        background: rgba(30, 30, 60, 0.9);
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 20px;
        font-weight: bold;
        color: #FFD700;
        z-index: 1000;
        border: 2px solid rgba(255, 215, 0, 0.5);
      `;
    }
    this.scoreElement.innerHTML = '🏆 Score: 0';
    document.body.appendChild(this.scoreElement);

    // Stocker si mobile pour les ajustements dynamiques
    this.isMobile = isMobile;
  }

  updateCombo(data) {
    this.combo = data.combo ?? 0;
    this.multiplier = data.multiplier ?? 1;
    this.score = data.score ?? 0;

    // Afficher le combo
    if (this.combo > 1) {
      this.comboElement.style.display = 'block';

      // Couleur selon le multiplicateur
      let color = '#ff6400';
      if (this.multiplier >= 10) color = '#ff0000';
      else if (this.multiplier >= 5) color = '#ff3300';
      else if (this.multiplier >= 3) color = '#ff5500';

      // Adapter l'opacité selon mobile ou desktop
      const opacity = this.isMobile ? 0.6 : 0.9;
      this.comboElement.style.background = `rgba(${parseInt(color.slice(1,3), 16)}, ${parseInt(color.slice(3,5), 16)}, ${parseInt(color.slice(5,7), 16)}, ${opacity})`;

      const shadowSize = this.isMobile ? 15 : 30;
      this.comboElement.style.boxShadow = `0 0 ${shadowSize}px ${color}`;

      // Adapter la taille du texte selon mobile ou desktop
      const multiplierFontSize = this.isMobile ? '12px' : '24px';
      let comboText = `${this.combo} COMBO`;
      if (this.multiplier > 1) {
        comboText += `<br><span style="font-size: ${multiplierFontSize}; color: #FFD700;">x${this.multiplier} MULTI</span>`;
      }

      this.comboElement.innerHTML = comboText;

      // Animation de pulsation (réduite sur mobile)
      const scaleAmount = this.isMobile ? 1.1 : 1.2;
      this.comboElement.style.transform = `scale(${scaleAmount})`;
      setTimeout(() => {
        if (this.comboElement) {
          this.comboElement.style.transform = 'scale(1)';
        }
      }, 200);

      // Animation bonus pour les gros combos (tous les 10 kills)
      if (this.combo % 10 === 0) {
        const bigFontSize = this.isMobile ? '20px' : '40px';
        const normalFontSize = this.isMobile ? '16px' : '32px';
        this.comboElement.style.fontSize = bigFontSize;
        setTimeout(() => {
          if (this.comboElement) {
            this.comboElement.style.fontSize = normalFontSize;
          }
        }, 300);
      }
    }

    // Mettre à jour le score
    this.scoreElement.innerHTML = `🏆 Score: ${this.score.toLocaleString()}`;
  }

  resetCombo() {
    this.combo = 0;
    this.multiplier = 1;

    // Cacher l'affichage du combo avec animation
    if (this.comboElement) {
      this.comboElement.style.transform = 'scale(0.5)';
      this.comboElement.style.opacity = '0';
      setTimeout(() => {
        if (this.comboElement) {
          this.comboElement.style.display = 'none';
          this.comboElement.style.transform = 'scale(1)';
          this.comboElement.style.opacity = '1';
        }
      }, 300);
    }
  }
}

// Export to window
window.ComboSystem = ComboSystem;
