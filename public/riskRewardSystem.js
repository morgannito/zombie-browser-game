/**
 * RISK / REWARD SYSTEM - Optional altar challenges mid-run.
 * @version 1.0.0
 */

(function() {
  'use strict';

  class RiskRewardSystem {
    constructor() {
      this.activeChallenge = null;
      this.pendingOffer = null;
      this.modal = null;
      this.statusPill = null;
      this.offerTimeout = null;
      this.init();
    }

    init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.setup());
      } else {
        this.setup();
      }
    }

    setup() {
      this.createUI();
      this.bindEvents();
    }

    createUI() {
      if (!document.getElementById('altar-modal')) {
        const modal = document.createElement('div');
        modal.id = 'altar-modal';
        modal.className = 'altar-modal';
        modal.innerHTML = `
          <div class="altar-card">
            <div class="altar-title">⚖️ Autel du risque</div>
            <div class="altar-desc"></div>
            <div class="altar-tags"></div>
            <div class="altar-actions">
              <button class="altar-accept">Accepter</button>
              <button class="altar-decline">Refuser</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }

      if (!document.getElementById('altar-status')) {
        const status = document.createElement('div');
        status.id = 'altar-status';
        status.className = 'altar-status';
        status.style.display = 'none';
        document.body.appendChild(status);
      }

      this.modal = document.getElementById('altar-modal');
      this.statusPill = document.getElementById('altar-status');

      const acceptBtn = this.modal?.querySelector('.altar-accept');
      const declineBtn = this.modal?.querySelector('.altar-decline');

      if (acceptBtn) {
        acceptBtn.addEventListener('click', () => this.acceptOffer());
      }
      if (declineBtn) {
        declineBtn.addEventListener('click', () => this.declineOffer());
      }
    }

    bindEvents() {
      const safeAdd = (target, event, handler) => {
        if (window.eventListenerManager) {
          window.eventListenerManager.add(target, event, handler);
        } else {
          target.addEventListener(event, handler);
        }
      };

      safeAdd(document, 'wave_changed', (e) => {
        const wave = e.detail?.wave || 1;
        this.maybeOffer(wave);
        this.updateProgress('no_damage_waves', 1);
      });
      safeAdd(document, 'zombie_killed', () => this.updateProgress('kills', 1));
      safeAdd(document, 'player_damage', () => this.failOnDamage());
      safeAdd(document, 'boss_defeated', () => this.updateProgress('boss', 1));
      safeAdd(document, 'game_over', () => this.reset());
    }

    maybeOffer(wave) {
      if (this.activeChallenge || this.pendingOffer) {
        return;
      }

      if (wave < 5 || wave % 5 !== 0) {
        return;
      }

      if (Math.random() > 0.7) {
        return;
      }

      const offer = this.pickOffer();
      this.pendingOffer = offer;
      this.showOffer(offer, wave);
    }

    pickOffer() {
      const offers = [
        {
          id: 'no_damage',
          title: 'Sans une égratignure',
          description: 'Survivez 3 vagues sans prendre de dégâts.',
          tags: ['Risque: 1 hit = échec', 'Récompense: +12 💎'],
          goal: { type: 'no_damage_waves', target: 3 },
          reward: { gems: 12 }
        },
        {
          id: 'kill_rush',
          title: 'Massacre express',
          description: 'Tuez 150 zombies pour récolter le pacte.',
          tags: ['Risque: tempo élevé', 'Récompense: +10 💎'],
          goal: { type: 'kills', target: 150 },
          reward: { gems: 10 }
        },
        {
          id: 'boss_hunt',
          title: 'Chasseur de boss',
          description: 'Éliminez un boss avant la fin de la vague.',
          tags: ['Risque: boss prioritaire', 'Récompense: +14 💎'],
          goal: { type: 'boss', target: 1 },
          reward: { gems: 14 }
        }
      ];

      return offers[Math.floor(Math.random() * offers.length)];
    }

    showOffer(offer, wave) {
      if (!this.modal) {
        return;
      }

      const desc = this.modal.querySelector('.altar-desc');
      const tags = this.modal.querySelector('.altar-tags');

      if (desc) {
        desc.textContent = `${offer.description} (Vague ${wave})`;
      }

      if (tags) {
        tags.innerHTML = offer.tags.map(tag => `<span class="altar-tag">${tag}</span>`).join('');
      }

      this.modal.classList.add('active');

      if (this.offerTimeout) {
        clearTimeout(this.offerTimeout);
      }

      this.offerTimeout = setTimeout(() => {
        this.declineOffer();
      }, 15000);
    }

    acceptOffer() {
      if (!this.pendingOffer) {
        return;
      }

      this.activeChallenge = {
        ...this.pendingOffer,
        progress: 0,
        failed: false
      };
      this.pendingOffer = null;
      this.hideOffer();
      this.updateStatus();
    }

    declineOffer() {
      this.pendingOffer = null;
      this.hideOffer();
    }

    hideOffer() {
      if (this.modal) {
        this.modal.classList.remove('active');
      }
      if (this.offerTimeout) {
        clearTimeout(this.offerTimeout);
        this.offerTimeout = null;
      }
    }

    updateProgress(type, amount) {
      if (!this.activeChallenge || this.activeChallenge.failed) {
        return;
      }

      if (this.activeChallenge.goal.type !== type) {
        return;
      }

      this.activeChallenge.progress += amount;
      if (this.activeChallenge.progress >= this.activeChallenge.goal.target) {
        this.completeChallenge();
      } else {
        this.updateStatus();
      }
    }

    failOnDamage() {
      if (!this.activeChallenge || this.activeChallenge.failed) {
        return;
      }

      if (this.activeChallenge.goal.type !== 'no_damage_waves') {
        return;
      }

      const failedTitle = this.activeChallenge.title;
      this.activeChallenge.failed = true;
      this.activeChallenge = null;
      this.updateStatus();
      if (window.toastManager) {
        window.toastManager.show(`💥 Pacte échoué: ${failedTitle}`, 'warning', 3000);
      }
    }

    completeChallenge() {
      const challenge = this.activeChallenge;
      if (!challenge) {
        return;
      }

      if (challenge.reward?.gems && window.gemSystem) {
        window.gemSystem.addGems(challenge.reward.gems, 'Pacte risqué');
      }

      if (window.toastManager) {
        window.toastManager.show(`🎉 Pacte rempli: ${challenge.title}`, 'success', 3500);
      }

      this.activeChallenge = null;
      this.updateStatus();
    }

    updateStatus() {
      if (!this.statusPill) {
        return;
      }

      if (!this.activeChallenge) {
        this.statusPill.style.display = 'none';
        return;
      }

      const goal = this.activeChallenge.goal;
      const progress = Math.min(this.activeChallenge.progress, goal.target);
      const status = this.activeChallenge.failed ? 'Échec' : `${progress}/${goal.target}`;
      this.statusPill.textContent = `⚖️ ${this.activeChallenge.title} • ${status}`;
      this.statusPill.style.display = 'block';
    }

    reset() {
      this.pendingOffer = null;
      this.activeChallenge = null;
      this.hideOffer();
      this.updateStatus();
    }
  }

  window.riskRewardSystem = new RiskRewardSystem();
})();
