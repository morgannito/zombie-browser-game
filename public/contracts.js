/**
 * WEEKLY CONTRACTS - Long-form multi-stage goals.
 * @version 1.0.0
 */

(function() {
  'use strict';

  class ContractsSystem {
    constructor() {
      this.contract = null;
      this.panelSection = null;
      this.storageKey = 'weekly_contract_v1';
      this.init();
    }

    init() {
      this.loadOrCreateContract();
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.setup());
      } else {
        this.setup();
      }
    }

    setup() {
      this.injectUI();
      this.bindEvents();
      this.refreshUI();
    }

    bindEvents() {
      const safeAdd = (target, event, handler) => {
        if (window.eventListenerManager) {
          window.eventListenerManager.add(target, event, handler);
        } else {
          target.addEventListener(event, handler);
        }
      };

      safeAdd(document, 'zombie_killed', () => this.updateProgress('kills', 1));
      safeAdd(document, 'wave_changed', () => this.updateProgress('waves', 1));
      safeAdd(document, 'boss_defeated', () => this.updateProgress('boss', 1));
      safeAdd(document, 'gold_collected', (e) => this.updateProgress('gold', e.detail?.amount || 0));
      safeAdd(document, 'game_over', () => this.updateProgress('runs', 1));
    }

    loadOrCreateContract() {
      const saved = this.safeLoad();
      if (saved && this.isSameWeek(new Date(saved.weekStart), new Date())) {
        this.contract = saved.contract;
        return;
      }

      const newContract = this.generateContract();
      this.contract = newContract;
      this.safeSave();
    }

    generateContract() {
      const templates = [
        {
          id: 'elite_hunt',
          name: 'Contrat: Escouade d\'élite',
          description: 'Prouvez que vous êtes l\'arme absolue.',
          stages: [
            { type: 'kills', target: 200, reward: { gems: 10, gold: 150 } },
            { type: 'waves', target: 20, reward: { gems: 14, gold: 200 } },
            { type: 'boss', target: 3, reward: { gems: 20, title: 'Chasseur d\'élite' } }
          ]
        },
        {
          id: 'gold_route',
          name: 'Contrat: Route de l\'or',
          description: 'Accumulez de l\'or sur toute la semaine.',
          stages: [
            { type: 'gold', target: 3000, reward: { gems: 8, gold: 200 } },
            { type: 'gold', target: 7000, reward: { gems: 12, gold: 300 } },
            { type: 'gold', target: 12000, reward: { gems: 20, title: 'Baron de l\'or' } }
          ]
        },
        {
          id: 'endurance',
          name: 'Contrat: Endurance',
          description: 'Tenez la distance avec régularité.',
          stages: [
            { type: 'runs', target: 3, reward: { gems: 10, gold: 150 } },
            { type: 'runs', target: 6, reward: { gems: 14, gold: 200 } },
            { type: 'runs', target: 10, reward: { gems: 22, skin: 'endurance_badge' } }
          ]
        }
      ];

      const template = templates[Math.floor(Math.random() * templates.length)];
      return {
        ...template,
        stages: template.stages.map((stage, index) => ({
          ...stage,
          id: `${template.id}_stage_${index + 1}`,
          progress: 0,
          completed: false,
          claimed: false
        })),
        currentStage: 0
      };
    }

    updateProgress(type, amount) {
      if (!this.contract) {
        return;
      }

      const stage = this.contract.stages[this.contract.currentStage];
      if (!stage || stage.completed || stage.type !== type) {
        return;
      }

      stage.progress += amount;
      if (stage.progress >= stage.target) {
        stage.progress = stage.target;
        stage.completed = true;
        if (window.toastManager) {
          window.toastManager.show(`🎯 Contrat terminé: Étape ${this.contract.currentStage + 1}`, 'success', 3000);
        }
      }

      this.safeSave();
      this.refreshUI();
    }

    claimStage() {
      if (!this.contract) {
        return;
      }

      const stage = this.contract.stages[this.contract.currentStage];
      if (!stage || !stage.completed || stage.claimed) {
        return;
      }

      stage.claimed = true;
      this.applyReward(stage.reward, `${this.contract.name} - Étape ${this.contract.currentStage + 1}`);

      if (this.contract.currentStage < this.contract.stages.length - 1) {
        this.contract.currentStage += 1;
        if (window.toastManager) {
          window.toastManager.show('📜 Nouvelle étape débloquée!', 'info', 2500);
        }
      } else if (window.toastManager) {
        window.toastManager.show('🏁 Contrat complété!', 'success', 3500);
      }

      this.safeSave();
      this.refreshUI();
    }

    applyReward(reward, source) {
      if (window.dailyChallengeSystem && window.dailyChallengeSystem.applyReward) {
        window.dailyChallengeSystem.applyReward(reward, source);
        return;
      }

      if (reward?.gems && window.gemSystem) {
        window.gemSystem.addGems(reward.gems, source);
      }
    }

    injectUI() {
      const panel = document.getElementById('challenges-panel');
      if (!panel) {
        setTimeout(() => this.injectUI(), 300);
        return;
      }

      if (panel.querySelector('.contracts-section')) {
        this.panelSection = panel.querySelector('.contracts-section');
        return;
      }

      const content = panel.querySelector('.challenges-panel-content');
      if (!content) {
        return;
      }

      const section = document.createElement('div');
      section.className = 'contracts-section';
      section.innerHTML = `
        <h3>📜 Contrat Hebdo</h3>
        <div class="contracts-body"></div>
      `;
      content.appendChild(section);
      this.panelSection = section;

      section.addEventListener('click', (event) => {
        const target = event.target;
        if (target && target.classList.contains('contract-claim-btn')) {
          this.claimStage();
        }
      });
    }

    refreshUI() {
      if (!this.panelSection || !this.contract) {
        return;
      }

      const body = this.panelSection.querySelector('.contracts-body');
      if (!body) {
        return;
      }

      const stage = this.contract.stages[this.contract.currentStage];
      const progress = stage ? (stage.progress / stage.target) * 100 : 0;
      const claimable = stage && stage.completed && !stage.claimed;

      body.innerHTML = `
        <div class="contract-card">
          <div class="challenge-card-name">${this.contract.name}</div>
          <div class="challenge-card-desc">${this.contract.description}</div>
          ${this.contract.stages.map((s, index) => `
            <div class="contract-stage ${s.completed ? 'completed' : ''}">
              <span>Étape ${index + 1}: ${this.describeStage(s)}</span>
              <span>${Math.min(s.progress, s.target)}/${s.target}</span>
            </div>
          `).join('')}
          <div class="contract-progress-bar">
            <div class="contract-progress-fill" style="width: ${Math.min(100, progress)}%"></div>
          </div>
          ${claimable ? '<button class="contract-claim-btn">Réclamer la récompense</button>' : ''}
        </div>
      `;
    }

    describeStage(stage) {
      const labels = {
        kills: 'Tuer des zombies',
        waves: 'Atteindre des vagues',
        boss: 'Vaincre des boss',
        gold: 'Collecter de l\'or',
        runs: 'Terminer des runs'
      };
      return labels[stage.type] || stage.type;
    }

    safeLoad() {
      try {
        const raw = localStorage.getItem(this.storageKey);
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        console.warn('Contract load failed', error);
        return null;
      }
    }

    safeSave() {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify({
          weekStart: this.getWeekStart(new Date()).toISOString(),
          contract: this.contract
        }));
      } catch (error) {
        console.warn('Contract save failed', error);
      }
    }

    isSameWeek(date1, date2) {
      return this.getWeekStart(date1).toDateString() === this.getWeekStart(date2).toDateString();
    }

    getWeekStart(date) {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(d.setDate(diff));
    }
  }

  window.contractsSystem = new ContractsSystem();
})();
