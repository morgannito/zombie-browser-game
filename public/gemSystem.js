/**
 * GEM SYSTEM - Système de métamonnaie premium
 * @version 1.0.0
 */

class GemSystem {
  constructor() {
    this.gems = this.loadGems();
    this.gemShop = this.initializeGemShop();
  }

  // ===============================================
  // SAFE LOCALSTORAGE HELPERS
  // ===============================================
  _safeGetItem(key, defaultValue = null) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`localStorage.getItem failed for key "${key}":`, e.message);
      return defaultValue;
    }
  }

  _safeSetItem(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn(`localStorage.setItem failed for key "${key}":`, e.message);
      return false;
    }
  }

  _safeRemoveItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn(`localStorage.removeItem failed for key "${key}":`, e.message);
      return false;
    }
  }

  // Charger les gems
  loadGems() {
    const saved = this._safeGetItem('player_gems');
    return saved ? parseInt(saved) : 0;
  }

  // Sauvegarder les gems
  saveGems() {
    this._safeSetItem('player_gems', this.gems.toString());
  }

  // Ajouter des gems
  addGems(amount, source = 'unknown') {
    this.gems += amount;
    this.saveGems();

    // Notifier le joueur
    if (window.toastManager && amount > 0) {
      window.toastManager.show(
        `💎 +${amount} Gems!\n${source}`,
        'gems',
        3000
      );
    }

    this.updateGemDisplay();
  }

  // Retirer des gems
  spendGems(amount) {
    if (this.gems >= amount) {
      this.gems -= amount;
      this.saveGems();
      this.updateGemDisplay();
      return true;
    }
    return false;
  }

  // Obtenir le solde
  getBalance() {
    return this.gems;
  }

  // Initialiser le shop de gems
  initializeGemShop() {
    return {
      revive: {
        id: 'revive',
        name: '🔄 Revive',
        description: 'Revivre une fois pendant la run en cours',
        cost: 50,
        maxPerRun: 1,
        icon: '🔄',
        category: 'run'
      },
      xp_boost: {
        id: 'xp_boost',
        name: '⚡ XP Boost x2',
        description: 'Double l\'XP pendant 30 minutes',
        cost: 30,
        duration: 1800000, // 30 min
        icon: '⚡',
        category: 'boost'
      },
      gold_boost: {
        id: 'gold_boost',
        name: '💰 Gold Boost x2',
        description: 'Double l\'or pendant 30 minutes',
        cost: 30,
        duration: 1800000,
        icon: '💰',
        category: 'boost'
      },
      legendary_reroll: {
        id: 'legendary_reroll',
        name: '🎲 Legendary Reroll',
        description: 'Reroll un upgrade pour en obtenir un légendaire',
        cost: 75,
        icon: '🎲',
        category: 'run'
      },
      instant_shop: {
        id: 'instant_shop',
        name: '🛒 Instant Shop',
        description: 'Ouvrir le shop immédiatement',
        cost: 25,
        icon: '🛒',
        category: 'run'
      },
      extra_life: {
        id: 'extra_life',
        name: '❤️ Vie Supplémentaire',
        description: '+50 HP pour la run en cours',
        cost: 40,
        icon: '❤️',
        category: 'run'
      },
      skip_wave: {
        id: 'skip_wave',
        name: '⏭️ Skip Wave',
        description: 'Passer instantanément à la prochaine vague',
        cost: 60,
        icon: '⏭️',
        category: 'run'
      },
      rare_skin: {
        id: 'rare_skin_pack',
        name: '🎨 Skin Pack Rare',
        description: 'Pack de 3 skins rares aléatoires',
        cost: 100,
        icon: '🎨',
        category: 'cosmetic'
      },
      epic_skin: {
        id: 'epic_skin_pack',
        name: '👑 Skin Pack Épique',
        description: 'Pack de 2 skins épiques aléatoires',
        cost: 200,
        icon: '👑',
        category: 'cosmetic'
      },
      permanent_gold_boost: {
        id: 'permanent_gold_boost',
        name: '💎 Gold Boost Permanent +10%',
        description: 'Augmente définitivement l\'or gagné de 10%',
        cost: 500,
        permanent: true,
        icon: '💎',
        category: 'permanent'
      },
      permanent_xp_boost: {
        id: 'permanent_xp_boost',
        name: '⭐ XP Boost Permanent +10%',
        description: 'Augmente définitivement l\'XP gagnée de 10%',
        cost: 500,
        permanent: true,
        icon: '⭐',
        category: 'permanent'
      },
      starter_boost: {
        id: 'starter_boost',
        name: '🚀 Boost de Départ',
        description: 'Commence chaque run au niveau 5',
        cost: 750,
        permanent: true,
        icon: '🚀',
        category: 'permanent'
      }
    };
  }

  // Acheter un item
  purchaseItem(itemId) {
    const item = this.gemShop[itemId];

    if (!item) {
      return { success: false, error: 'Item introuvable' };
    }

    if (this.gems < item.cost) {
      return { success: false, error: 'Pas assez de gems' };
    }

    // Vérifier les restrictions
    if (item.maxPerRun) {
      const usedThisRun = this.getUsageThisRun(itemId);
      if (usedThisRun >= item.maxPerRun) {
        return { success: false, error: 'Limite atteinte pour cette run' };
      }
    }

    // Dépenser les gems
    if (!this.spendGems(item.cost)) {
      return { success: false, error: 'Erreur lors du paiement' };
    }

    // Appliquer l'effet
    this.applyItemEffect(item);

    // Sauvegarder l'achat
    this.recordPurchase(itemId);

    if (window.toastManager) {
      window.toastManager.show(
        `✅ ${item.name} acheté!`,
        'purchase',
        3000
      );
    }

    return { success: true, item };
  }

  // Appliquer l'effet d'un item
  applyItemEffect(item) {
    switch (item.id) {
      case 'revive':
        this.grantRevive();
        break;

      case 'xp_boost':
        this.activateBoost('xp', 2, item.duration);
        break;

      case 'gold_boost':
        this.activateBoost('gold', 2, item.duration);
        break;

      case 'extra_life':
        this.grantExtraLife(50);
        break;

      case 'instant_shop':
        this.openInstantShop();
        break;

      case 'permanent_gold_boost':
        this.applyPermanentBoost('gold', 0.1);
        break;

      case 'permanent_xp_boost':
        this.applyPermanentBoost('xp', 0.1);
        break;

      case 'starter_boost':
        this.applyStarterBoost();
        break;

      // Les autres items seront gérés par le jeu principal
    }
  }

  // Accorder un revive
  grantRevive() {
    this._safeSetItem('gem_revive_available', 'true');
  }

  // Vérifier si revive disponible
  hasRevive() {
    return this._safeGetItem('gem_revive_available') === 'true';
  }

  // Utiliser le revive
  useRevive() {
    this._safeRemoveItem('gem_revive_available');
  }

  // Activer un boost temporaire
  activateBoost(type, multiplier, duration) {
    const boost = {
      type,
      multiplier,
      endTime: Date.now() + duration
    };

    let activeBoosts = JSON.parse(this._safeGetItem('active_boosts') || '[]');
    activeBoosts.push(boost);
    this._safeSetItem('active_boosts', JSON.stringify(activeBoosts));

    // Démarrer un timer pour retirer le boost
    (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => {
      this.removeBoost(boost);
    }, duration);
  }

  // Retirer un boost
  removeBoost(boost) {
    let activeBoosts = JSON.parse(this._safeGetItem('active_boosts') || '[]');
    activeBoosts = activeBoosts.filter(b => b.endTime !== boost.endTime);
    this._safeSetItem('active_boosts', JSON.stringify(activeBoosts));

    if (window.toastManager) {
      window.toastManager.show(
        `⏰ ${boost.type.toUpperCase()} Boost terminé`,
        'info',
        3000
      );
    }
  }

  // Obtenir les boosts actifs
  getActiveBoosts() {
    const activeBoosts = JSON.parse(this._safeGetItem('active_boosts') || '[]');
    const now = Date.now();

    // Filtrer les boosts expirés
    const validBoosts = activeBoosts.filter(b => b.endTime > now);

    if (validBoosts.length !== activeBoosts.length) {
      this._safeSetItem('active_boosts', JSON.stringify(validBoosts));
    }

    return validBoosts;
  }

  // Appliquer un boost permanent
  applyPermanentBoost(type, amount) {
    const boosts = JSON.parse(this._safeGetItem('permanent_boosts') || '{}');
    boosts[type] = (boosts[type] || 0) + amount;
    this._safeSetItem('permanent_boosts', JSON.stringify(boosts));
  }

  // Obtenir les boosts permanents
  getPermanentBoosts() {
    return JSON.parse(this._safeGetItem('permanent_boosts') || '{}');
  }

  // Appliquer le starter boost
  applyStarterBoost() {
    this._safeSetItem('starter_boost', 'true');
  }

  // Vérifier si starter boost actif
  hasStarterBoost() {
    return this._safeGetItem('starter_boost') === 'true';
  }

  // Accorder vie supplémentaire
  grantExtraLife(amount) {
    const extraLife = parseInt(this._safeGetItem('gem_extra_life') || '0');
    this._safeSetItem('gem_extra_life', (extraLife + amount).toString());
  }

  // Obtenir vie supplémentaire
  getExtraLife() {
    return parseInt(this._safeGetItem('gem_extra_life') || '0');
  }

  // Consommer vie supplémentaire
  consumeExtraLife() {
    this._safeRemoveItem('gem_extra_life');
  }

  // Ouvrir le shop instantanément
  openInstantShop() {
    // Sera géré par le jeu principal
    window.dispatchEvent(new CustomEvent('instant_shop_requested'));
  }

  // Enregistrer un achat
  recordPurchase(itemId) {
    const purchases = JSON.parse(this._safeGetItem('gem_purchases') || '{}');
    const runId = this.getCurrentRunId();

    if (!purchases[runId]) {
      purchases[runId] = [];
    }

    purchases[runId].push({
      itemId,
      timestamp: Date.now()
    });

    this._safeSetItem('gem_purchases', JSON.stringify(purchases));
  }

  // Obtenir l'usage dans la run actuelle
  getUsageThisRun(itemId) {
    const purchases = JSON.parse(this._safeGetItem('gem_purchases') || '{}');
    const runId = this.getCurrentRunId();

    if (!purchases[runId]) {
      return 0;
    }

    return purchases[runId].filter(p => p.itemId === itemId).length;
  }

  // Obtenir l'ID de la run actuelle
  getCurrentRunId() {
    return this._safeGetItem('current_run_id') || 'no_run';
  }

  // Nouvelle run (reset les achats par run)
  startNewRun() {
    const runId = 'run_' + Date.now();
    this._safeSetItem('current_run_id', runId);
  }

  // Mettre à jour l'affichage des gems
  updateGemDisplay() {
    const displays = document.querySelectorAll('.gem-balance, #gem-count');
    displays.forEach(display => {
      display.textContent = this.gems.toString();
    });
  }

  // Créer l'UI du shop de gems
  createGemShopUI() {
    const container = document.createElement('div');
    container.id = 'gem-shop-panel';
    container.className = 'gem-shop-panel';
    container.style.display = 'none';

    const categories = {
      run: 'Items de Run',
      boost: 'Boosts Temporaires',
      permanent: 'Améliorations Permanentes',
      cosmetic: 'Cosmétiques'
    };

    container.innerHTML = `
      <div class="gem-shop-header">
        <h2>💎 GEM SHOP</h2>
        <div class="gem-balance-display">
          Gems: <span id="gem-count">${this.gems}</span> 💎
        </div>
        <button class="gem-shop-close-btn">×</button>
      </div>
      <div class="gem-shop-content">
        ${Object.entries(categories).map(([cat, name]) => `
          <div class="gem-shop-section">
            <h3>${name}</h3>
            <div class="gem-shop-items">
              ${this.renderGemShopItems(cat)}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    document.body.appendChild(container);

    // Event listeners
    container.querySelector('.gem-shop-close-btn').addEventListener('click', () => {
      container.style.display = 'none';
    });

    // Ajouter listeners pour les boutons d'achat
    container.querySelectorAll('.gem-shop-buy-btn').forEach(btn => {
      (window.eventListenerManager ? window.eventListenerManager.add(btn, 'click', (e) : (window.eventListenerManager ? window.eventListenerManager.add(btn, 'click', (e)) : btn.addEventListener('click', (e))) => {
        const itemId = e.target.dataset.itemId;
        this.handlePurchase(itemId);
      });
    });

    return container;
  }

  // Rendre les items du shop
  renderGemShopItems(category) {
    const items = Object.values(this.gemShop).filter(item => item.category === category);

    return items.map(item => {
      const canAfford = this.gems >= item.cost;
      const isPermanent = item.permanent || false;
      const isOwned = isPermanent && this.isPermanentOwned(item.id);

      return `
        <div class="gem-shop-item ${!canAfford ? 'cannot-afford' : ''} ${isOwned ? 'owned' : ''}">
          <div class="gem-shop-item-icon">${item.icon}</div>
          <div class="gem-shop-item-content">
            <div class="gem-shop-item-name">${item.name}</div>
            <div class="gem-shop-item-desc">${item.description}</div>
            <div class="gem-shop-item-cost">
              💎 ${item.cost} Gems
            </div>
          </div>
          <button class="gem-shop-buy-btn" data-item-id="${item.id}" ${!canAfford || isOwned ? 'disabled' : ''}>
            ${isOwned ? 'Possédé' : 'Acheter'}
          </button>
        </div>
      `;
    }).join('');
  }

  // Vérifier si un permanent est possédé
  isPermanentOwned(itemId) {
    const owned = JSON.parse(this._safeGetItem('permanent_items_owned') || '[]');
    return owned.includes(itemId);
  }

  // Marquer un permanent comme possédé
  markPermanentOwned(itemId) {
    const owned = JSON.parse(this._safeGetItem('permanent_items_owned') || '[]');
    if (!owned.includes(itemId)) {
      owned.push(itemId);
      this._safeSetItem('permanent_items_owned', JSON.stringify(owned));
    }
  }

  // Gérer un achat
  handlePurchase(itemId) {
    const result = this.purchaseItem(itemId);

    if (result.success) {
      // Rafraîchir l'UI
      const panel = document.getElementById('gem-shop-panel');
      if (panel) {
        const content = panel.querySelector('.gem-shop-content');
        if (content) {
          const categories = {
            run: 'Items de Run',
            boost: 'Boosts Temporaires',
            permanent: 'Améliorations Permanentes',
            cosmetic: 'Cosmétiques'
          };

          content.innerHTML = Object.entries(categories).map(([cat, name]) => `
            <div class="gem-shop-section">
              <h3>${name}</h3>
              <div class="gem-shop-items">
                ${this.renderGemShopItems(cat)}
              </div>
            </div>
          `).join('');

          // Ré-attacher les event listeners
          content.querySelectorAll('.gem-shop-buy-btn').forEach(btn => {
            (window.eventListenerManager ? window.eventListenerManager.add(btn, 'click', (e) : (window.eventListenerManager ? window.eventListenerManager.add(btn, 'click', (e)) : btn.addEventListener('click', (e))) => {
              const itemId = e.target.dataset.itemId;
              this.handlePurchase(itemId);
            });
          });
        }
      }

      // Marquer comme possédé si permanent
      if (result.item.permanent) {
        this.markPermanentOwned(itemId);
      }
    } else {
      if (window.toastManager) {
        window.toastManager.show(
          `❌ ${result.error}`,
          'error',
          3000
        );
      }
    }
  }

  // Ouvrir le panneau
  openPanel() {
    let panel = document.getElementById('gem-shop-panel');
    if (!panel) {
      panel = this.createGemShopUI();
    }
    panel.style.display = 'block';
  }
}

// Initialiser le système global
window.gemSystem = new GemSystem();
