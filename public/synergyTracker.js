/**
 * SYNERGY TRACKER - Highlights near-complete synergies during a run.
 * @version 1.0.0
 */

(function() {
  'use strict';

  class SynergyTracker {
    constructor() {
      this.panel = null;
      this.visible = false;
      this.lastRender = 0;
      this.renderCooldown = 500;
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
      this.createPanel();
      this.bindEvents();
      this.refresh();
    }

    createPanel() {
      if (document.getElementById('synergy-tracker')) {
        this.panel = document.getElementById('synergy-tracker');
        return;
      }

      const panel = document.createElement('div');
      panel.id = 'synergy-tracker';
      panel.className = 'synergy-tracker hidden';
      panel.innerHTML = `
        <div class="synergy-tracker-title">Synergies proches</div>
        <div class="synergy-tracker-list"></div>
      `;

      document.body.appendChild(panel);
      this.panel = panel;
    }

    bindEvents() {
      const safeAdd = (target, event, handler) => {
        if (window.eventListenerManager) {
          window.eventListenerManager.add(target, event, handler);
        } else {
          target.addEventListener(event, handler);
        }
      };

      safeAdd(document, 'game_started', () => {
        this.visible = true;
        this.refresh(true);
      });

      safeAdd(document, 'game_over', () => {
        this.visible = false;
        this.refresh(true);
      });

      safeAdd(document, 'upgrade_obtained', () => {
        this.refresh();
      });
    }

    refresh(force = false) {
      if (!this.panel || !window.synergySystem) {
        return;
      }

      const now = Date.now();
      if (!force && now - this.lastRender < this.renderCooldown) {
        return;
      }
      this.lastRender = now;

      const listEl = this.panel.querySelector('.synergy-tracker-list');
      if (!listEl) {
        return;
      }

      const synergies = window.synergySystem.synergies || [];
      const current = window.synergySystem.currentUpgrades || [];
      const near = synergies
        .map((synergy) => {
          const missing = synergy.requires.filter(req => !current.includes(req));
          return { synergy, missing };
        })
        .filter((entry) => entry.missing.length <= 1)
        .sort((a, b) => a.missing.length - b.missing.length)
        .slice(0, 4);

      if (!this.visible || near.length === 0) {
        this.panel.classList.add('hidden');
        listEl.innerHTML = '';
        return;
      }

      this.panel.classList.remove('hidden');
      listEl.innerHTML = near.map(({ synergy, missing }) => {
        const ready = missing.length === 0;
        const missingText = ready
          ? 'Synergie active'
          : `Manque: ${missing.map(this.formatUpgradeId).join(', ')}`;
        return `
          <div class="synergy-tracker-item ${ready ? 'ready' : ''}">
            <div class="synergy-tracker-name">${synergy.icon} ${synergy.name}</div>
            <div class="synergy-tracker-missing">${missingText}</div>
          </div>
        `;
      }).join('');
    }

    formatUpgradeId(id) {
      return id
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
    }
  }

  window.synergyTracker = new SynergyTracker();
})();
