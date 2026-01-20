/**
 * RUN MUTATORS - Rotating modifiers for each run.
 * @version 1.0.0
 */

(function() {
  'use strict';

  class RunMutatorsSystem {
    constructor() {
      this.activeMutators = [];
      this.mutatorState = {};
      this.panel = null;
      this.currentWave = 1;
      this.useServerMutators = false;
      this.nextRotationWave = null;
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
    }

    bindEvents() {
      const safeAdd = (target, event, handler) => {
        if (window.eventListenerManager) {
          window.eventListenerManager.add(target, event, handler);
        } else {
          target.addEventListener(event, handler);
        }
      };

      safeAdd(document, 'game_started', () => this.startRun());
      safeAdd(document, 'game_over', (e) => this.finishRun(e.detail));
      safeAdd(document, 'zombie_killed', () => this.updateProgress('kills', 1));
      safeAdd(document, 'gold_collected', (e) => this.updateProgress('gold', e.detail?.amount || 0));
      safeAdd(document, 'player_damage', () => this.onPlayerDamaged());
      safeAdd(document, 'wave_changed', (e) => {
        this.currentWave = e.detail?.wave || this.currentWave;
        this.updateProgress('waves', 1);
        this.updateProgress('no_damage_waves', 1);
      });
    }

    createPanel() {
      if (document.getElementById('mutators-panel')) {
        this.panel = document.getElementById('mutators-panel');
        return;
      }

      const panel = document.createElement('div');
      panel.id = 'mutators-panel';
      panel.className = 'mutators-panel hidden';
      panel.innerHTML = `
        <div class="mutators-title">Mutateurs de run</div>
        <div class="mutators-list"></div>
        <div class="mutators-footer"></div>
      `;
      document.body.appendChild(panel);
      this.panel = panel;
    }

    startRun() {
      if (this.useServerMutators && this.activeMutators.length) {
        this.mutatorState = {};
        this.refreshPanel();
        if (this.panel) {
          this.panel.classList.remove('hidden');
        }
        return;
      }

      this.activeMutators = this.pickMutators();
      this.mutatorState = {};
      this.currentWave = 1;

      this.activeMutators.forEach((mutator) => {
        this.mutatorState[mutator.id] = {
          progress: 0,
          completed: false,
          failed: false
        };
      });

      this.refreshPanel();
      this.flashPanel();
      this.playMutatorSound('reward');
      if (this.panel) {
        this.panel.classList.remove('hidden');
      }

    }

    finishRun(_stats) {
      if (!this.activeMutators.length) {
        return;
      }

      const rewardSummary = { gems: 0 };
      this.activeMutators.forEach((mutator) => {
        const state = this.mutatorState[mutator.id];
        const eligible = !mutator.goal || (state && state.completed && !state.failed);
        if (eligible && mutator.reward?.gems) {
          rewardSummary.gems += mutator.reward.gems;
        }
      });

      if (rewardSummary.gems > 0 && window.gemSystem) {
        window.gemSystem.addGems(rewardSummary.gems, 'Mutateurs de run');
        if (window.toastManager) {
          window.toastManager.show(`✨ Bonus mutateurs: +${rewardSummary.gems} gems`, 'success', 3500);
        }
      }

      if (this.panel) {
        this.panel.classList.add('hidden');
      }
    }

    updateProgress(type, amount) {
      let changed = false;
      this.activeMutators.forEach((mutator) => {
        if (!mutator.goal || mutator.goal.type !== type) {
          return;
        }

        const state = this.mutatorState[mutator.id];
        if (!state || state.completed || state.failed) {
          return;
        }

        state.progress += amount;
        if (state.progress >= mutator.goal.target) {
          state.completed = true;
          state.progress = mutator.goal.target;
          if (window.toastManager) {
            window.toastManager.show(`✅ Mutateur réussi: ${mutator.name}`, 'success', 2500);
          }
        }

        changed = true;
      });

      if (changed) {
        this.refreshPanel();
      }
    }

    onPlayerDamaged() {
      let changed = false;
      this.activeMutators.forEach((mutator) => {
        if (!mutator.goal || mutator.goal.type !== 'no_damage_waves') {
          return;
        }
        const state = this.mutatorState[mutator.id];
        if (state && !state.completed && !state.failed) {
          state.failed = true;
          changed = true;
          if (window.toastManager) {
            window.toastManager.show(`❌ Mutateur échoué: ${mutator.name}`, 'warning', 2500);
          }
        }
      });

      if (changed) {
        this.refreshPanel();
      }
    }

    refreshPanel() {
      if (!this.panel) {
        return;
      }

      const list = this.panel.querySelector('.mutators-list');
      if (!list) {
        return;
      }

      list.innerHTML = this.activeMutators.map((mutator) => {
        const state = this.mutatorState[mutator.id] || {};
        const statusClass = state.failed ? 'failed' : (state.completed ? 'completed' : '');
        const goalText = mutator.goal
          ? `${Math.min(state.progress || 0, mutator.goal.target)}/${mutator.goal.target}`
          : 'Actif';
        const rewardText = mutator.reward?.gems ? `+${mutator.reward.gems} 💎` : '';
        const tagText = Array.isArray(mutator.tags) ? mutator.tags : [];
        return `
          <div class="mutator-card ${statusClass}">
            <div class="mutator-name">${mutator.name}</div>
            <div class="mutator-desc">${mutator.description}</div>
            <div class="mutator-tags">
              <span class="mutator-tag">${goalText}</span>
              ${rewardText ? `<span class="mutator-tag">${rewardText}</span>` : ''}
              ${tagText.map(tag => `<span class="mutator-tag alt">${tag}</span>`).join('')}
            </div>
          </div>
        `;
      }).join('');

      const footer = this.panel.querySelector('.mutators-footer');
      if (footer) {
        footer.textContent = this.nextRotationWave
          ? `Rotation à la vague ${this.nextRotationWave}`
          : '';
      }
    }

    applyServerMutators(mutators, metadata = {}) {
      if (!Array.isArray(mutators) || mutators.length === 0) {
        return;
      }

      this.useServerMutators = true;
      this.activeMutators = mutators;
      this.mutatorState = {};
      this.nextRotationWave = metadata.nextRotationWave || metadata.nextMutatorWave || this.nextRotationWave;

      this.activeMutators.forEach((mutator) => {
        this.mutatorState[mutator.id] = {
          progress: 0,
          completed: false,
          failed: false
        };
      });

      this.refreshPanel();
      this.flashPanel();
      this.playMutatorSound('reward');
      if (this.panel) {
        this.panel.classList.remove('hidden');
      }

      if (window.toastManager && metadata.wave && metadata.wave > 1) {
        const names = this.activeMutators.map((mutator) => mutator.name).join(' • ');
        window.toastManager.show(`⚙️ Mutateurs actifs: ${names}`, 'info', 3000);
      }
    }

    flashPanel() {
      if (!this.panel) {
        return;
      }
      this.panel.classList.remove('flash');
      void this.panel.offsetWidth;
      this.panel.classList.add('flash');
      setTimeout(() => this.panel && this.panel.classList.remove('flash'), 800);
    }

    playMutatorSound(type = 'click') {
      const audio = window.advancedAudio || window.audioManager;
      if (audio && audio.playSound) {
        audio.playSound('ui', type);
      }
    }

    pickMutators() {
      const pool = this.getAvailableMutators();
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 2);
    }

    getAvailableMutators() {
      return [
        {
          id: 'blood_moon',
          name: '🌒 Lune de sang',
          description: 'Nuit permanente et brouillard épais.',
          reward: { gems: 6 },
          environment: {
            timeOfDay: 22,
            weather: 'fog',
            weatherIntensity: 0.7,
            particles: 'ash',
            windX: 0.2
          }
        },
        {
          id: 'ember_storm',
          name: '🔥 Tempête de braises',
          description: 'Cendres flottantes et orages violents.',
          reward: { gems: 6 },
          environment: {
            weather: 'storm',
            weatherIntensity: 0.8,
            particles: 'ember',
            windX: 0.6,
            windY: 0.2
          }
        },
        {
          id: 'clean_sweep',
          name: '🧹 Nettoyage',
          description: 'Tuez 120 zombies pour valider le bonus.',
          goal: { type: 'kills', target: 120 },
          reward: { gems: 8 }
        },
        {
          id: 'gold_surge',
          name: '💰 Fièvre de l\'or',
          description: 'Collectez 800 or durant la run.',
          goal: { type: 'gold', target: 800 },
          reward: { gems: 8 }
        },
        {
          id: 'untouched',
          name: '🛡️ Intouchable',
          description: 'Survivez 3 vagues sans prendre de dégâts.',
          goal: { type: 'no_damage_waves', target: 3 },
          reward: { gems: 10 }
        }
      ];
    }

    getEnvironmentOverrides() {
      const overrides = {};
      this.activeMutators.forEach((mutator) => {
        if (mutator.environment) {
          Object.assign(overrides, mutator.environment);
        }
      });
      return overrides;
    }
  }

  window.runMutatorsSystem = new RunMutatorsSystem();
})();
