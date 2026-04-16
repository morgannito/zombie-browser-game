/**
 * GEM SYSTEM - Systeme de metamonnaie premium
 * @version 1.1.0
 */

class GemSystem {
  constructor() {
    this.gems = this.loadGems();
    this.gemShop = this.initializeGemShop();
  }

  // Charger les gems
  loadGems() {
    const saved = storageManager.get('player_gems');
    return saved !== null ? parseInt(saved) : 0;
  }

  // Sauvegarder les gems
  saveGems() {
    storageManager.set('player_gems', this.gems.toString());
  }

  // Ajouter des gems
  addGems(amount, source = 'unknown') {
    this.gems += amount;
    this.saveGems();

    // Notifier le joueur
    if (window.toastManager && amount > 0) {
      window.toastManager.show({ message: `💎 +${amount} Gems!\n${source}`, type: 'gems', duration: 3000 });
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
        description: "Double l'XP pendant 30 minutes",
        cost: 30,
        duration: 1800000, // 30 min
        icon: '⚡',
        category: 'boost'
      },
      gold_boost: {
        id: 'gold_boost',
        name: '💰 Gold Boost x2',
        description: "Double l'or pendant 30 minutes",
        cost: 30,
        duration: 1800000,
        icon: '💰',
        category: 'boost'
      },
      legendary_reroll: {
        id: 'legendary_reroll',
        name: '🎲 Legendary Reroll',
        description: 'Reroll un upgrade pour en obtenir un legendaire',
        cost: 75,
        icon: '🎲',
        category: 'run'
      },
      instant_shop: {
        id: 'instant_shop',
        name: '🛒 Instant Shop',
        description: 'Ouvrir le shop immediatement',
        cost: 25,
        icon: '🛒',
        category: 'run'
      },
      extra_life: {
        id: 'extra_life',
        name: '❤️ Vie Supplementaire',
        description: '+50 HP pour la run en cours',
        cost: 40,
        icon: '❤️',
        category: 'run'
      },
      skip_wave: {
        id: 'skip_wave',
        name: '⏭️ Skip Wave',
        description: 'Passer instantanement a la prochaine vague',
        cost: 60,
        icon: '⏭️',
        category: 'run'
      },
      rare_skin: {
        id: 'rare_skin_pack',
        name: '🎨 Skin Pack Rare',
        description: 'Pack de 3 skins rares aleatoires',
        cost: 100,
        icon: '🎨',
        category: 'cosmetic'
      },
      epic_skin: {
        id: 'epic_skin_pack',
        name: '👑 Skin Pack Epique',
        description: 'Pack de 2 skins epiques aleatoires',
        cost: 200,
        icon: '👑',
        category: 'cosmetic'
      },
      permanent_gold_boost: {
        id: 'permanent_gold_boost',
        name: '💎 Gold Boost Permanent +10%',
        description: "Augmente definitivement l'or gagne de 10%",
        cost: 500,
        permanent: true,
        icon: '💎',
        category: 'permanent'
      },
      permanent_xp_boost: {
        id: 'permanent_xp_boost',
        name: '⭐ XP Boost Permanent +10%',
        description: "Augmente definitivement l'XP gagnee de 10%",
        cost: 500,
        permanent: true,
        icon: '⭐',
        category: 'permanent'
      },
      starter_boost: {
        id: 'starter_boost',
        name: '🚀 Boost de Depart',
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

    // Verifier les restrictions
    if (item.maxPerRun) {
      const usedThisRun = this.getUsageThisRun(itemId);
      if (usedThisRun >= item.maxPerRun) {
        return { success: false, error: 'Limite atteinte pour cette run' };
      }
    }

    // Depenser les gems
    if (!this.spendGems(item.cost)) {
      return { success: false, error: 'Erreur lors du paiement' };
    }

    // Appliquer l'effet
    this.applyItemEffect(item);

    // Sauvegarder l'achat
    this.recordPurchase(itemId);

    if (window.toastManager) {
      window.toastManager.show({ message: `✅ ${item.name} achete!`, type: 'purchase', duration: 3000 });
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

      // Les autres items seront geres par le jeu principal
    }
  }

  // Accorder un revive
  grantRevive() {
    storageManager.set('gem_revive_available', 'true');
  }

  // Verifier si revive disponible
  hasRevive() {
    return storageManager.get('gem_revive_available') === 'true';
  }

  // Utiliser le revive
  useRevive() {
    storageManager.remove('gem_revive_available');
  }

  // Activer un boost temporaire
  activateBoost(type, multiplier, duration) {
    const boost = {
      type,
      multiplier,
      endTime: Date.now() + duration
    };

    const activeBoosts = storageManager.get('active_boosts', []);
    activeBoosts.push(boost);
    storageManager.set('active_boosts', activeBoosts);

    // Demarrer un timer pour retirer le boost
    setTimeout(() => {
      this.removeBoost(boost);
    }, duration);
  }

  // Retirer un boost
  removeBoost(boost) {
    let activeBoosts = storageManager.get('active_boosts', []);
    activeBoosts = activeBoosts.filter(b => b.endTime !== boost.endTime);
    storageManager.set('active_boosts', activeBoosts);

    if (window.toastManager) {
      window.toastManager.show({ message: `⏰ ${boost.type.toUpperCase()} Boost termine`, type: 'info', duration: 3000 });
    }
  }

  // Obtenir les boosts actifs
  getActiveBoosts() {
    const activeBoosts = storageManager.get('active_boosts', []);
    const now = Date.now();

    // Filtrer les boosts expires
    const validBoosts = activeBoosts.filter(b => b.endTime > now);

    if (validBoosts.length !== activeBoosts.length) {
      storageManager.set('active_boosts', validBoosts);
    }

    return validBoosts;
  }

  // Appliquer un boost permanent
  applyPermanentBoost(type, amount) {
    const boosts = storageManager.get('permanent_boosts', {});
    boosts[type] = (boosts[type] || 0) + amount;
    storageManager.set('permanent_boosts', boosts);
  }

  // Obtenir les boosts permanents
  getPermanentBoosts() {
    return storageManager.get('permanent_boosts', {});
  }

  // Appliquer le starter boost
  applyStarterBoost() {
    storageManager.set('starter_boost', 'true');
  }

  // Verifier si starter boost actif
  hasStarterBoost() {
    return storageManager.get('starter_boost') === 'true';
  }

  // Accorder vie supplementaire
  grantExtraLife(amount) {
    const extraLife = parseInt(storageManager.get('gem_extra_life', '0'));
    storageManager.set('gem_extra_life', (extraLife + amount).toString());
  }

  // Obtenir vie supplementaire
  getExtraLife() {
    return parseInt(storageManager.get('gem_extra_life', '0'));
  }

  // Consommer vie supplementaire
  consumeExtraLife() {
    storageManager.remove('gem_extra_life');
  }

  // Ouvrir le shop instantanement
  openInstantShop() {
    // Sera gere par le jeu principal
    window.dispatchEvent(new CustomEvent('instant_shop_requested'));
  }

  // Enregistrer un achat
  recordPurchase(itemId) {
    const purchases = storageManager.get('gem_purchases', {});
    const runId = this.getCurrentRunId();

    if (!purchases[runId]) {
      purchases[runId] = [];
    }

    purchases[runId].push({
      itemId,
      timestamp: Date.now()
    });

    storageManager.set('gem_purchases', purchases);
  }

  // Obtenir l'usage dans la run actuelle
  getUsageThisRun(itemId) {
    const purchases = storageManager.get('gem_purchases', {});
    const runId = this.getCurrentRunId();

    if (!purchases[runId]) {
      return 0;
    }

    return purchases[runId].filter(p => p.itemId === itemId).length;
  }

  // Obtenir l'ID de la run actuelle
  getCurrentRunId() {
    return storageManager.get('current_run_id', 'no_run');
  }

  // Nouvelle run (reset les achats par run)
  startNewRun() {
    const runId = 'run_' + Date.now();
    storageManager.set('current_run_id', runId);
  }

  // Mettre a jour l'affichage des gems
  updateGemDisplay() {
    const displays = document.querySelectorAll('.gem-balance, #gem-count');
    displays.forEach(display => {
      display.textContent = this.gems.toString();
    });
  }

  // Creer l'UI du shop de gems
  createGemShopUI() {
    const container = document.createElement('div');
    container.id = 'gem-shop-panel';
    container.className = 'gem-shop-panel';
    container.style.display = 'none';

    const categories = {
      run: 'Items de Run',
      boost: 'Boosts Temporaires',
      permanent: 'Ameliorations Permanentes',
      cosmetic: 'Cosmetiques'
    };

    container.innerHTML = `
      <div class="gem-shop-header">
        <h2>💎 GEM SHOP</h2>
        <div class="gem-balance-display">
          Gems: <span id="gem-count">${this.gems}</span> 💎
        </div>
        <button class="gem-shop-close-btn">x</button>
      </div>
      <div class="gem-shop-content">
        ${Object.entries(categories)
          .map(
            ([cat, name]) => `
          <div class="gem-shop-section">
            <h3>${name}</h3>
            <div class="gem-shop-items">
              ${this.renderGemShopItems(cat)}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    document.body.appendChild(container);

    // Event listeners
    container.querySelector('.gem-shop-close-btn').addEventListener('click', () => {
      container.style.display = 'none';
    });

    // Ajouter listeners pour les boutons d'achat
    container.querySelectorAll('.gem-shop-buy-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const itemId = e.target.dataset.itemId;
        this.handlePurchase(itemId);
      });
    });

    return container;
  }

  // Rendre les items du shop
  renderGemShopItems(category) {
    const items = Object.values(this.gemShop).filter(item => item.category === category);

    return items
      .map(item => {
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
            ${isOwned ? 'Possede' : 'Acheter'}
          </button>
        </div>
      `;
      })
      .join('');
  }

  // Verifier si un permanent est possede
  isPermanentOwned(itemId) {
    const owned = storageManager.get('permanent_items_owned', []);
    return owned.includes(itemId);
  }

  // Marquer un permanent comme possede
  markPermanentOwned(itemId) {
    const owned = storageManager.get('permanent_items_owned', []);
    if (!owned.includes(itemId)) {
      owned.push(itemId);
      storageManager.set('permanent_items_owned', owned);
    }
  }

  // Gerer un achat
  handlePurchase(itemId) {
    const result = this.purchaseItem(itemId);

    if (result.success) {
      // Rafraichir l'UI
      const panel = document.getElementById('gem-shop-panel');
      if (panel) {
        const content = panel.querySelector('.gem-shop-content');
        if (content) {
          const categories = {
            run: 'Items de Run',
            boost: 'Boosts Temporaires',
            permanent: 'Ameliorations Permanentes',
            cosmetic: 'Cosmetiques'
          };

          content.innerHTML = Object.entries(categories)
            .map(
              ([cat, name]) => `
            <div class="gem-shop-section">
              <h3>${name}</h3>
              <div class="gem-shop-items">
                ${this.renderGemShopItems(cat)}
              </div>
            </div>
          `
            )
            .join('');

          // Re-attacher les event listeners
          content.querySelectorAll('.gem-shop-buy-btn').forEach(btn => {
            btn.addEventListener('click', e => {
              const itemId = e.target.dataset.itemId;
              this.handlePurchase(itemId);
            });
          });
        }
      }

      // Marquer comme possede si permanent
      if (result.item.permanent) {
        this.markPermanentOwned(itemId);
      }
    } else {
      if (window.toastManager) {
        window.toastManager.show({ message: `❌ ${result.error}`, type: 'error', duration: 3000 });
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

// Initialiser le systeme global
window.gemSystem = new GemSystem();
