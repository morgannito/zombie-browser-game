/**
 * GAME INTEGRATION
 * Intègre les nouveaux systèmes au jeu existant
 * @version 1.0.0
 */

/* ============================================
   INITIALISATION DES SYSTÈMES
   ============================================ */

// Initialisation globale des systèmes
window.enhancedEffects = null;
window.advancedAudio = null;
window.skinManager = null;
window.enhancedUI = null;

/**
 * Initialise tous les nouveaux systèmes
 */
function initializeEnhancedSystems() {
  console.log('Initializing enhanced systems...');

  // Système d'effets visuels
  if (typeof AdvancedEffectsManager !== 'undefined') {
    window.enhancedEffects = new AdvancedEffectsManager();
    console.log('✓ Visual effects system loaded');
  }

  // Système audio
  if (typeof AdvancedAudioManager !== 'undefined') {
    window.advancedAudio = new AdvancedAudioManager();
    console.log('✓ Audio system loaded');

    // Démarrer la musique du menu après interaction utilisateur
    (window.eventListenerManager ? window.eventListenerManager.add(document, 'click', () : (window.eventListenerManager ? window.eventListenerManager.add(document, 'click', ()) : document.addEventListener('click', ())) => {
      if (window.advancedAudio && !window.advancedAudio.music.isPlaying) {
        window.advancedAudio.startMusic('menu');
      }
    }, { once: true });
  }

  // Système de skins
  if (typeof SkinManager !== 'undefined') {
    window.skinManager = new SkinManager();
    console.log('✓ Skin system loaded');
  }

  // Système UI amélioré
  if (typeof EnhancedUIManager !== 'undefined') {
    window.enhancedUI = new EnhancedUIManager();
    console.log('✓ Enhanced UI loaded');
  }

  console.log('All enhanced systems initialized!');
}

/* ============================================
   HOOKS POUR L'INTÉGRATION
   ============================================ */

/**
 * Hook appelé lors d'un tir
 */
window.onPlayerShoot = function(x, y, angle, weaponType) {
  if (window.enhancedEffects) {
    window.enhancedEffects.onPlayerShoot(x, y, angle, weaponType);
  }
  if (window.advancedAudio) {
    window.advancedAudio.playSound('shoot', weaponType);
  }
  if (window.enhancedUI) {
    window.enhancedUI.onPlayerShoot();
  }
};

/**
 * Hook appelé lors d'un impact sur zombie
 */
window.onZombieHit = function(x, y, angle, damage, isCritical, zombieColor) {
  if (window.enhancedEffects) {
    window.enhancedEffects.onZombieHit(x, y, angle, damage, isCritical, zombieColor);
  }
  if (window.advancedAudio) {
    window.advancedAudio.playSound('hit', isCritical);
  }
  if (window.enhancedUI) {
    window.enhancedUI.onPlayerHit();
  }
};

/**
 * Hook appelé lors de la mort d'un zombie
 */
window.onZombieDeath = function(x, y, zombieColor) {
  if (window.enhancedEffects) {
    window.enhancedEffects.onZombieDeath(x, y, zombieColor);
  }
  if (window.advancedAudio) {
    window.advancedAudio.playSound('zombieDeath');
  }
};

/**
 * Hook appelé lors d'une explosion
 */
window.onExplosion = function(x, y, radius) {
  if (window.enhancedEffects) {
    window.enhancedEffects.onExplosion(x, y, radius);
  }
  if (window.advancedAudio) {
    window.advancedAudio.playSound('explosion');
  }
};

/**
 * Hook appelé lors de la collecte d'or
 */
window.onGoldCollect = function(x, y, amount) {
  if (window.enhancedEffects) {
    window.enhancedEffects.onGoldCollect(x, y, amount);
  }
  if (window.advancedAudio) {
    window.advancedAudio.playSound('collect', 'gold');
  }
  if (window.enhancedUI) {
    window.enhancedUI.onGoldCollect(amount);
  }
};

/**
 * Hook appelé lors du gain d'XP
 */
window.onXPGain = function(x, y, amount) {
  if (window.enhancedEffects) {
    window.enhancedEffects.onXPGain(x, y, amount);
  }
};

/**
 * Hook appelé lors d'un level up
 */
window.onLevelUp = function(x, y, level) {
  if (window.enhancedEffects) {
    window.enhancedEffects.onLevelUp(x, y);
  }
  if (window.advancedAudio) {
    window.advancedAudio.playSound('levelup');
  }
  if (window.enhancedUI) {
    window.enhancedUI.onLevelUp(level);
  }
};

/**
 * Hook appelé lors d'un heal
 */
window.onPlayerHeal = function(x, y, amount) {
  if (window.enhancedEffects) {
    window.enhancedEffects.onHeal(x, y, amount);
  }
  if (window.advancedAudio) {
    window.advancedAudio.playSound('heal');
  }
  if (window.enhancedUI) {
    window.enhancedUI.onPlayerHeal(amount);
  }
};

/**
 * Hook appelé lors de dégâts au joueur
 */
window.onPlayerDamage = function(x, y, damage) {
  if (window.enhancedEffects) {
    window.enhancedEffects.onPlayerDamage(x, y, damage);
  }
  if (window.advancedAudio) {
    window.advancedAudio.playSound('playerDamage');
  }
  if (window.enhancedUI) {
    window.enhancedUI.onPlayerDamage();
  }
};

/**
 * Hook appelé lors de l'apparition d'un boss
 */
window.onBossSpawn = function(x, y) {
  if (window.enhancedEffects) {
    window.enhancedEffects.onBossSpawn(x, y);
  }
  if (window.advancedAudio) {
    window.advancedAudio.playSound('bossSpawn');
    // Change la musique pour le thème du boss
    window.advancedAudio.changeMusic('boss');
  }
  if (window.enhancedUI) {
    window.enhancedUI.onBossSpawn();
  }
};

/**
 * Hook appelé lors du début du combat
 */
window.onCombatStart = function() {
  if (window.advancedAudio) {
    window.advancedAudio.changeMusic('combat');
  }
};

/**
 * Hook appelé lors du retour au menu
 */
window.onMenuReturn = function() {
  if (window.advancedAudio) {
    window.advancedAudio.changeMusic('menu');
  }
};

/**
 * Hook appelé pour mettre à jour la barre de vie
 */
window.updateHealthBar = function(health, maxHealth) {
  if (window.enhancedUI) {
    window.enhancedUI.updateProgressBar('health', health, maxHealth);
  }
};

/**
 * Hook appelé pour mettre à jour la barre d'XP
 */
window.updateXPBar = function(xp, maxXP) {
  if (window.enhancedUI) {
    window.enhancedUI.updateProgressBar('xp', xp, maxXP);
  }
};

/**
 * Hook pour le rendu personnalisé du joueur
 */
window.renderPlayer = function(ctx, x, y, radius) {
  if (window.skinManager) {
    window.skinManager.drawPlayer(ctx, x, y, radius);
  }
};

/**
 * Hook pour le rendu personnalisé des balles
 */
window.renderBullet = function(ctx, x, y, radius) {
  if (window.skinManager) {
    window.skinManager.drawBullet(ctx, x, y, radius);
  }
};

/* ============================================
   BOUCLE DE MISE À JOUR
   ============================================ */

/**
 * Boucle de mise à jour des systèmes
 */
function updateEnhancedSystems(deltaTime = 16) {
  if (window.enhancedEffects) {
    window.enhancedEffects.update(deltaTime);
  }
  if (window.skinManager) {
    window.skinManager.update();
  }
  if (window.enhancedUI) {
    window.enhancedUI.update();
  }
}

/**
 * Rendu des effets
 */
function renderEnhancedEffects(ctx, canvasWidth, canvasHeight) {
  if (window.enhancedEffects) {
    window.enhancedEffects.render(ctx, canvasWidth, canvasHeight);
  }
}

// Rendre les fonctions disponibles globalement
window.updateEnhancedSystems = updateEnhancedSystems;
window.renderEnhancedEffects = renderEnhancedEffects;

/* ============================================
   MENU DE SKINS (UI)
   ============================================ */

/**
 * Crée le menu de sélection de skins
 */
function createSkinsMenu() {
  const menu = document.createElement('div');
  menu.id = 'skins-menu';
  menu.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(10, 10, 30, 0.98);
    border: 3px solid #00ff00;
    border-radius: 15px;
    padding: 30px;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    z-index: 1000;
    display: none;
  `;

  menu.innerHTML = `
    <div style="text-align: center; margin-bottom: 20px;">
      <h1 style="color: #00ff00; margin: 0;">🎨 SKINS</h1>
      <button id="close-skins-menu" style="margin-top: 10px;">Fermer</button>
    </div>

    <div style="margin-bottom: 30px;">
      <h2 style="color: #00ffff;">Skins de Joueur</h2>
      <div id="player-skins-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px;"></div>
    </div>

    <div>
      <h2 style="color: #ffaa00;">Skins d'Armes</h2>
      <div id="weapon-skins-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px;"></div>
    </div>
  `;

  document.body.appendChild(menu);

  // Bouton de fermeture
  document.getElementById('close-skins-menu').addEventListener('click', () => {
    menu.style.display = 'none';
  });

  // Populate skins
  if (window.skinManager) {
    populatePlayerSkins();
    populateWeaponSkins();
  }
}

/**
 * Remplit la grille de skins de joueur
 */
function populatePlayerSkins() {
  const grid = document.getElementById('player-skins-grid');
  if (!grid || !window.skinManager) return;

  grid.innerHTML = '';

  window.skinManager.getAllPlayerSkins().forEach(skin => {
    const card = document.createElement('div');
    card.style.cssText = `
      background: rgba(50, 50, 80, 0.8);
      border: 2px solid ${skin.unlocked ? '#00ff00' : '#666'};
      border-radius: 10px;
      padding: 15px;
      text-align: center;
      cursor: ${skin.unlocked ? 'pointer' : 'not-allowed'};
      transition: all 0.3s ease;
    `;

    const isEquipped = window.skinManager.currentPlayerSkin === skin.id;

    card.innerHTML = `
      <div style="width: 50px; height: 50px; margin: 0 auto 10px; background: ${skin.color || '#00ff00'}; border-radius: 50%; border: 3px solid ${skin.strokeColor || '#00aa00'};"></div>
      <div style="color: #fff; font-weight: bold; margin-bottom: 5px;">${skin.name}</div>
      <div style="color: ${skin.unlocked ? '#00ff00' : '#ff0000'}; font-size: 12px;">
        ${isEquipped ? '✓ ÉQUIPÉ' : skin.unlocked ? 'Débloqué' : `${skin.cost} 💰`}
      </div>
    `;

    if (skin.unlocked && !isEquipped) {
      (window.eventListenerManager ? window.eventListenerManager.add(card, 'click', () : (window.eventListenerManager ? window.eventListenerManager.add(card, 'click', ()) : card.addEventListener('click', ())) => {
        window.skinManager.equipPlayerSkin(skin.id);
        populatePlayerSkins(); // Refresh
        if (window.advancedAudio) {
          window.advancedAudio.playSound('ui', 'click');
        }
      });

      (window.eventListenerManager ? window.eventListenerManager.add(card, 'mouseenter', () : (window.eventListenerManager ? window.eventListenerManager.add(card, 'mouseenter', ()) : card.addEventListener('mouseenter', ())) => {
        card.style.transform = 'scale(1.05)';
        card.style.borderColor = '#00ffff';
      });

      (window.eventListenerManager ? window.eventListenerManager.add(card, 'mouseleave', () : (window.eventListenerManager ? window.eventListenerManager.add(card, 'mouseleave', ()) : card.addEventListener('mouseleave', ())) => {
        card.style.transform = 'scale(1)';
        card.style.borderColor = '#00ff00';
      });
    }

    grid.appendChild(card);
  });
}

/**
 * Remplit la grille de skins d'armes
 */
function populateWeaponSkins() {
  const grid = document.getElementById('weapon-skins-grid');
  if (!grid || !window.skinManager) return;

  grid.innerHTML = '';

  window.skinManager.getAllWeaponSkins().forEach(skin => {
    const card = document.createElement('div');
    card.style.cssText = `
      background: rgba(50, 50, 80, 0.8);
      border: 2px solid ${skin.unlocked ? '#ffaa00' : '#666'};
      border-radius: 10px;
      padding: 15px;
      text-align: center;
      cursor: ${skin.unlocked ? 'pointer' : 'not-allowed'};
      transition: all 0.3s ease;
    `;

    const isEquipped = window.skinManager.currentWeaponSkin === skin.id;

    card.innerHTML = `
      <div style="width: 50px; height: 50px; margin: 0 auto 10px; background: ${skin.bulletColor || '#fff'}; border-radius: 50%;"></div>
      <div style="color: #fff; font-weight: bold; margin-bottom: 5px;">${skin.name}</div>
      <div style="color: ${skin.unlocked ? '#ffaa00' : '#ff0000'}; font-size: 12px;">
        ${isEquipped ? '✓ ÉQUIPÉ' : skin.unlocked ? 'Débloqué' : `${skin.cost} 💰`}
      </div>
    `;

    if (skin.unlocked && !isEquipped) {
      (window.eventListenerManager ? window.eventListenerManager.add(card, 'click', () : (window.eventListenerManager ? window.eventListenerManager.add(card, 'click', ()) : card.addEventListener('click', ())) => {
        window.skinManager.equipWeaponSkin(skin.id);
        populateWeaponSkins(); // Refresh
        if (window.advancedAudio) {
          window.advancedAudio.playSound('ui', 'click');
        }
      });

      (window.eventListenerManager ? window.eventListenerManager.add(card, 'mouseenter', () : (window.eventListenerManager ? window.eventListenerManager.add(card, 'mouseenter', ()) : card.addEventListener('mouseenter', ())) => {
        card.style.transform = 'scale(1.05)';
        card.style.borderColor = '#ffff00';
      });

      (window.eventListenerManager ? window.eventListenerManager.add(card, 'mouseleave', () : (window.eventListenerManager ? window.eventListenerManager.add(card, 'mouseleave', ()) : card.addEventListener('mouseleave', ())) => {
        card.style.transform = 'scale(1)';
        card.style.borderColor = '#ffaa00';
      });
    }

    grid.appendChild(card);
  });
}

/**
 * Ajoute un bouton de skins dans l'UI
 */
function addSkinsButton() {
  const button = document.createElement('button');
  button.id = 'open-skins-btn';
  button.textContent = '🎨 SKINS';
  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 15px 25px;
    font-size: 16px;
    font-weight: bold;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: 2px solid #fff;
    border-radius: 10px;
    color: white;
    cursor: pointer;
    z-index: 100;
    transition: all 0.3s ease;
    display: block;
  `;

  (window.eventListenerManager ? window.eventListenerManager.add(button, 'click', () : (window.eventListenerManager ? window.eventListenerManager.add(button, 'click', ()) : button.addEventListener('click', ())) => {
    const menu = document.getElementById('skins-menu');
    if (menu) {
      menu.style.display = 'block';
    }
    if (window.advancedAudio) {
      window.advancedAudio.playSound('ui', 'click');
    }
  });

  (window.eventListenerManager ? window.eventListenerManager.add(button, 'mouseenter', () : (window.eventListenerManager ? window.eventListenerManager.add(button, 'mouseenter', ()) : button.addEventListener('mouseenter', ())) => {
    button.style.transform = 'scale(1.1)';
  });

  (window.eventListenerManager ? window.eventListenerManager.add(button, 'mouseleave', () : (window.eventListenerManager ? window.eventListenerManager.add(button, 'mouseleave', ()) : button.addEventListener('mouseleave', ())) => {
    button.style.transform = 'scale(1)';
  });

  document.body.appendChild(button);
}

/**
 * Cache le bouton skins (quand le jeu est en cours)
 */
function hideSkinsButton() {
  const button = document.getElementById('open-skins-btn');
  if (button) {
    button.style.display = 'none';
  }
}

/**
 * Affiche le bouton skins (au menu principal)
 */
function showSkinsButton() {
  const button = document.getElementById('open-skins-btn');
  if (button) {
    button.style.display = 'block';
  }
}

// Rendre les fonctions disponibles globalement
window.hideSkinsButton = hideSkinsButton;
window.showSkinsButton = showSkinsButton;

/* ============================================
   INITIALISATION AU CHARGEMENT
   ============================================ */

// Initialiser dès que le DOM est prêt
if (document.readyState === 'loading') {
  (window.eventListenerManager ? window.eventListenerManager.add(document, 'DOMContentLoaded', () : (window.eventListenerManager ? window.eventListenerManager.add(document, 'DOMContentLoaded', ()) : document.addEventListener('DOMContentLoaded', ())) => {
    initializeEnhancedSystems();
    createSkinsMenu();
    // addSkinsButton(); // Désactivé - bouton skins retiré
  });
} else {
  initializeEnhancedSystems();
  createSkinsMenu();
  // addSkinsButton(); // Désactivé - bouton skins retiré
}
