/**
 * EVENT SYSTEM - Événements spéciaux limités
 * @version 1.0.0
 */

class EventSystem {
  constructor() {
    this.activeEvents = [];
    this.eventHistory = this.loadEventHistory();
    this.events = this.initializeEvents();

    this.checkActiveEvents();
  }

  // Helper pour créer des dates dynamiques basées sur l'année en cours
  _createSeasonalDate(month, day) {
    const currentYear = new Date().getFullYear();
    const currentDate = new Date();
    const eventDate = new Date(currentYear, month - 1, day); // month is 0-indexed

    // Si l'événement est déjà passé cette année, utiliser l'année prochaine
    if (eventDate < currentDate) {
      return new Date(currentYear + 1, month - 1, day);
    }
    return eventDate;
  }

  // Initialiser les événements disponibles
  initializeEvents() {
    return {
      horde_night: {
        id: 'horde_night',
        name: '🌙 Horde Night',
        description: '2x zombies mais 2x XP et Gold!',
        startDay: 5, // Vendredi
        endDay: 0,   // Dimanche
        duration: 'weekend',
        effects: {
          zombieMultiplier: 2,
          xpMultiplier: 2,
          goldMultiplier: 2
        },
        rewards: {
          participation: { gold: 100, gems: 10 },
          completion: { gold: 500, gems: 50, skin: 'horde_survivor' }
        },
        icon: '🌙',
        color: '#8b00ff'
      },

      boss_rush: {
        id: 'boss_rush',
        name: '👹 Boss Rush',
        description: 'Que des boss! Récompenses massives!',
        startDay: 6, // Samedi
        endDay: 6,
        duration: 'daily',
        effects: {
          onlyBosses: true,
          xpMultiplier: 3,
          goldMultiplier: 2.5
        },
        rewards: {
          participation: { gold: 150, gems: 15 },
          top10: { gold: 1000, gems: 100, title: 'Boss Hunter' }
        },
        icon: '👹',
        color: '#ff0000'
      },

      speed_run_challenge: {
        id: 'speed_run_challenge',
        name: '⏱️ Speed Run Challenge',
        description: 'Terminez le plus vite possible!',
        startDay: 1, // Lundi
        endDay: 1,
        duration: 'daily',
        effects: {
          timerActive: true,
          speedMultiplier: 1.5
        },
        rewards: {
          under_10min: { gold: 300, gems: 30 },
          under_5min: { gold: 750, gems: 75, title: 'Speedrunner' }
        },
        icon: '⏱️',
        color: '#00ff00'
      },

      double_gems: {
        id: 'double_gems',
        name: '💎 Double Gems',
        description: 'Toutes les récompenses en gems sont doublées!',
        startDay: 0, // Dimanche
        endDay: 0,
        duration: 'daily',
        effects: {
          gemMultiplier: 2
        },
        rewards: {
          participation: { gems: 20 }
        },
        icon: '💎',
        color: '#00ffff'
      },

      halloween: {
        id: 'halloween',
        name: '🎃 Halloween Event',
        description: 'Zombies spéciaux et skins exclusifs!',
        startDate: this._createSeasonalDate(10, 25), // 25 octobre
        endDate: this._createSeasonalDate(11, 1),    // 1er novembre
        duration: 'seasonal',
        effects: {
          specialZombies: true,
          decorations: 'halloween',
          goldMultiplier: 1.5
        },
        rewards: {
          participation: { gold: 200, gems: 20 },
          collection: { skins: ['pumpkin_hero', 'ghost_hunter', 'vampire_slayer'] }
        },
        icon: '🎃',
        color: '#ff6600'
      },

      christmas: {
        id: 'christmas',
        name: '🎄 Winter Wonderland',
        description: 'Événement de Noël avec cadeaux!',
        startDate: this._createSeasonalDate(12, 20), // 20 décembre
        endDate: this._createSeasonalDate(12, 26),   // 26 décembre
        duration: 'seasonal',
        effects: {
          decorations: 'christmas',
          giftDrops: true,
          xpMultiplier: 1.5
        },
        rewards: {
          daily_login: { gems: 50 },
          collection: { skins: ['santa_survivor', 'elf_shooter', 'snowman_tank'] }
        },
        icon: '🎄',
        color: '#00ff00'
      },

      new_year: {
        id: 'new_year',
        name: '🎆 New Year Celebration',
        description: 'Commencez l\'année en beauté!',
        startDate: this._createSeasonalDate(12, 31), // 31 décembre
        endDate: this._createSeasonalDate(1, 2),      // 2 janvier
        duration: 'seasonal',
        effects: {
          fireworks: true,
          xpMultiplier: 2,
          goldMultiplier: 2
        },
        rewards: {
          participation: { gold: 2025, gems: 100 },
          title: 'New Year Champion'
        },
        icon: '🎆',
        color: '#ffff00'
      }
    };
  }

  // Vérifier les événements actifs
  checkActiveEvents() {
    const now = new Date();
    const dayOfWeek = now.getDay();

    this.activeEvents = [];

    for (const event of Object.values(this.events)) {
      let isActive = false;

      if (event.duration === 'daily') {
        isActive = dayOfWeek === event.startDay;
      } else if (event.duration === 'weekend') {
        isActive = dayOfWeek >= event.startDay || dayOfWeek <= event.endDay;
      } else if (event.duration === 'seasonal') {
        isActive = now >= event.startDate && now <= event.endDate;
      }

      if (isActive) {
        this.activeEvents.push(event);
      }
    }

    // Notifier les nouveaux événements
    this.notifyNewEvents();

    return this.activeEvents;
  }

  // Notifier les nouveaux événements
  notifyNewEvents() {
    for (const event of this.activeEvents) {
      if (!this.eventHistory[event.id] || this.eventHistory[event.id].lastSeen < Date.now() - 86400000) {
        this.showEventAnnouncement(event);
        this.eventHistory[event.id] = {
          lastSeen: Date.now(),
          participated: false
        };
        this.saveEventHistory();
      }
    }
  }

  // Afficher annonce d'événement
  showEventAnnouncement(event) {
    const announcement = document.createElement('div');
    announcement.className = 'event-announcement';
    announcement.style.borderColor = event.color;

    announcement.innerHTML = `
      <div class="event-announcement-inner" style="background: linear-gradient(135deg, ${event.color}22, ${event.color}44)">
        <div class="event-icon-large">${event.icon}</div>
        <div class="event-content">
          <div class="event-header">ÉVÉNEMENT SPÉCIAL!</div>
          <div class="event-name" style="color: ${event.color}">${event.name}</div>
          <div class="event-desc">${event.description}</div>
          <div class="event-effects">
            ${this.renderEffects(event.effects)}
          </div>
          <div class="event-rewards">
            Récompenses: ${this.renderRewards(event.rewards)}
          </div>
        </div>
        <button class="event-close-btn">×</button>
      </div>
    `;

    document.body.appendChild(announcement);

    announcement.querySelector('.event-close-btn').addEventListener('click', () => {
      announcement.classList.remove('show');
      setTimeout(() => announcement.remove(), 500);
    });

    setTimeout(() => announcement.classList.add('show'), 100);

    // Auto-fermer après 10 secondes
    setTimeout(() => {
      announcement.classList.remove('show');
      setTimeout(() => announcement.remove(), 500);
    }, 10000);

    // Toast aussi
    if (window.toastManager) {
      window.toastManager.show(
        `${event.icon} ÉVÉNEMENT: ${event.name}`,
        'event',
        7000
      );
    }
  }

  // Rendre les effets
  renderEffects(effects) {
    const parts = [];

    if (effects.zombieMultiplier && effects.zombieMultiplier !== 1) {
      parts.push(`${effects.zombieMultiplier}x Zombies`);
    }
    if (effects.xpMultiplier && effects.xpMultiplier !== 1) {
      parts.push(`${effects.xpMultiplier}x XP`);
    }
    if (effects.goldMultiplier && effects.goldMultiplier !== 1) {
      parts.push(`${effects.goldMultiplier}x Or`);
    }
    if (effects.gemMultiplier && effects.gemMultiplier !== 1) {
      parts.push(`${effects.gemMultiplier}x Gems`);
    }
    if (effects.onlyBosses) {
      parts.push('Que des Boss');
    }
    if (effects.timerActive) {
      parts.push('Mode Chrono');
    }
    if (effects.specialZombies) {
      parts.push('Zombies Spéciaux');
    }

    return parts.join(' | ');
  }

  // Rendre les récompenses
  renderRewards(rewards) {
    const parts = [];

    if (rewards.participation) {
      if (rewards.participation.gold) parts.push(`💰 ${rewards.participation.gold}`);
      if (rewards.participation.gems) parts.push(`💎 ${rewards.participation.gems}`);
    }

    if (rewards.completion) {
      if (rewards.completion.gold) parts.push(`💰 ${rewards.completion.gold} (Complétion)`);
      if (rewards.completion.gems) parts.push(`💎 ${rewards.completion.gems} (Complétion)`);
      if (rewards.completion.skin) parts.push(`🎨 Skin: ${rewards.completion.skin}`);
    }

    if (rewards.top10) {
      parts.push(`🏆 Top 10: ${rewards.top10.gold} Or | ${rewards.top10.gems} Gems`);
    }

    return parts.join(' | ');
  }

  // Marquer la participation
  markParticipation(eventId) {
    if (this.eventHistory[eventId]) {
      this.eventHistory[eventId].participated = true;
      this.eventHistory[eventId].participatedAt = Date.now();
      this.saveEventHistory();
    }
  }

  // Obtenir les événements actifs
  getActiveEvents() {
    return this.activeEvents;
  }

  // Appliquer les effets d'événement
  applyEventEffects(baseValues) {
    let modified = { ...baseValues };

    for (const event of this.activeEvents) {
      const effects = event.effects;

      if (effects.xpMultiplier) {
        modified.xp = (modified.xp || 0) * effects.xpMultiplier;
      }

      if (effects.goldMultiplier) {
        modified.gold = (modified.gold || 0) * effects.goldMultiplier;
      }

      if (effects.gemMultiplier) {
        modified.gems = (modified.gems || 0) * effects.gemMultiplier;
      }

      if (effects.zombieMultiplier) {
        modified.zombieCount = Math.floor((modified.zombieCount || 1) * effects.zombieMultiplier);
      }

      if (effects.speedMultiplier) {
        modified.playerSpeed = (modified.playerSpeed || 1) * effects.speedMultiplier;
      }
    }

    return modified;
  }

  // Vérifier si un événement spécifique est actif
  isEventActive(eventId) {
    return this.activeEvents.some(e => e.id === eventId);
  }

  // Sauvegarder/charger historique
  saveEventHistory() {
    localStorage.setItem('event_history', JSON.stringify(this.eventHistory));
  }

  loadEventHistory() {
    const saved = localStorage.getItem('event_history');
    return saved ? JSON.parse(saved) : {};
  }

  // Créer widget d'événements
  createEventWidget() {
    if (this.activeEvents.length === 0) {
      return null;
    }

    const widget = document.createElement('div');
    widget.className = 'event-widget';

    widget.innerHTML = `
      <div class="event-widget-header">
        <h4>🎉 Événements Actifs</h4>
      </div>
      <div class="event-widget-list">
        ${this.activeEvents.map(event => `
          <div class="event-widget-item" style="border-left: 4px solid ${event.color}">
            <div class="event-widget-icon">${event.icon}</div>
            <div class="event-widget-content">
              <div class="event-widget-name">${event.name}</div>
              <div class="event-widget-desc">${event.description}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    return widget;
  }

  // Créer bannière pour l'écran principal
  createEventBanner() {
    if (this.activeEvents.length === 0) {
      return null;
    }

    const event = this.activeEvents[0]; // Premier événement actif

    const banner = document.createElement('div');
    banner.className = 'event-banner';
    banner.style.background = `linear-gradient(90deg, ${event.color}44, ${event.color}22)`;
    banner.style.borderColor = event.color;

    banner.innerHTML = `
      <div class="event-banner-icon">${event.icon}</div>
      <div class="event-banner-content">
        <div class="event-banner-name">${event.name}</div>
        <div class="event-banner-desc">${event.description}</div>
      </div>
      <button class="event-banner-close">×</button>
    `;

    banner.querySelector('.event-banner-close').addEventListener('click', () => {
      banner.remove();
    });

    return banner;
  }
}

// Initialiser le système global
window.eventSystem = new EventSystem();
