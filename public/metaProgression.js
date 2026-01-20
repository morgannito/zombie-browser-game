/**
 * META PROGRESSION PANEL - Skill tree and account progression.
 * @version 1.0.0
 */

(function() {
  'use strict';

  class MetaProgressionSystem {
    constructor() {
      this.panel = null;
      this.progression = null;
      this.skills = [];
      this.playerId = null;
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
      this.resolvePlayerId();
    }

    resolvePlayerId() {
      if (window.authManager && window.authManager.getPlayer) {
        this.playerId = window.authManager.getPlayer()?.id || null;
      }
    }

    createPanel() {
      if (document.getElementById('meta-progression-panel')) {
        this.panel = document.getElementById('meta-progression-panel');
        return;
      }

      const container = document.createElement('div');
      container.id = 'meta-progression-panel';
      container.className = 'meta-progression-panel';
      container.style.display = 'none';
      container.innerHTML = `
        <div class="meta-progression-header">
          <h2>🧬 PROGRESSION</h2>
          <button class="meta-progression-close-btn">×</button>
        </div>
        <div class="meta-progression-content">
          <div class="meta-progression-summary"></div>
          <div class="meta-skill-grid"></div>
        </div>
      `;

      document.body.appendChild(container);
      this.panel = container;

      const closeBtn = container.querySelector('.meta-progression-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closePanel());
      }

      container.addEventListener('click', (event) => {
        const target = event.target;
        if (target && target.classList.contains('meta-skill-btn')) {
          const skillId = target.getAttribute('data-skill');
          if (skillId) {
            this.unlockSkill(skillId);
          }
        }
        if (target && target.classList.contains('meta-prestige-btn')) {
          this.prestige();
        }
      });
    }

    async openPanel() {
      if (!this.panel) {
        return;
      }
      this.panel.style.display = 'block';
      await this.loadData();
    }

    closePanel() {
      if (this.panel) {
        this.panel.style.display = 'none';
      }
    }

    async loadData() {
      if (!this.playerId) {
        this.resolvePlayerId();
      }
      if (!this.playerId) {
        this.renderError('Connectez-vous pour voir la progression.');
        return;
      }

      try {
        const headers = { 'Content-Type': 'application/json' };
        const token = window.authManager?.getToken?.();
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const [progressionRes, skillsRes] = await Promise.all([
          fetch(`/api/progression/${this.playerId}`, { headers }),
          fetch('/api/progression/skills/all', { headers })
        ]);

        const progressionData = await progressionRes.json();
        const skillsData = await skillsRes.json();

        if (!progressionData.success || !skillsData.success) {
          throw new Error('Failed to load progression data');
        }

        this.progression = progressionData.data;
        this.skills = skillsData.data.skills || [];
        this.render();
      } catch (error) {
        console.error('Progression load failed', error);
        this.renderError('Impossible de charger la progression.');
      }
    }

    renderError(message) {
      if (!this.panel) {
        return;
      }
      const summary = this.panel.querySelector('.meta-progression-summary');
      const grid = this.panel.querySelector('.meta-skill-grid');
      if (summary) {
        summary.innerHTML = `<div class="meta-progression-chip">${message}</div>`;
      }
      if (grid) {
        grid.innerHTML = '';
      }
    }

    render() {
      if (!this.panel || !this.progression) {
        return;
      }

      const stats = this.progression.stats || {};
      const summary = this.panel.querySelector('.meta-progression-summary');
      const grid = this.panel.querySelector('.meta-skill-grid');
      if (summary) {
        summary.innerHTML = `
          <div class="meta-progression-chip">Niveau: ${stats.accountLevel || 1}</div>
          <div class="meta-progression-chip">XP: ${stats.accountXP || 0}/${stats.xpForNextLevel || 0}</div>
          <div class="meta-progression-chip">Points: ${stats.skillPoints || 0}</div>
          <div class="meta-progression-chip">Prestige: ${stats.prestigeLevel || 0}</div>
          ${this.renderPrestigeButton(stats)}
        `;
      }

      if (grid) {
        const skills = [...this.skills].sort((a, b) => {
          if (a.category === b.category) {
            return (a.tier || 0) - (b.tier || 0);
          }
          return a.category.localeCompare(b.category);
        });

        grid.innerHTML = skills.map((skill) => this.renderSkillCard(skill, stats)).join('');
      }
    }

    renderPrestigeButton(stats) {
      if (!stats || (stats.accountLevel || 0) < 50) {
        return '';
      }
      return '<button class="meta-skill-btn meta-prestige-btn">Prestige</button>';
    }

    renderSkillCard(skill, stats) {
      const unlocked = (this.progression.unlockedSkills || []).includes(skill.skillId);
      const cost = skill.cost || 1;
      const canUnlock = this.canUnlockSkill(skill, stats);
      const statusClass = unlocked ? 'unlocked' : 'locked';
      const actionHtml = unlocked
        ? '<span>✔️ Débloqué</span>'
        : `<button class="meta-skill-btn" data-skill="${skill.skillId}" ${canUnlock ? '' : 'disabled'}>Débloquer</button>`;

      return `
        <div class="meta-skill-card ${statusClass}">
          <h4>${skill.icon ? `${skill.icon} ` : ''}${skill.skillName}</h4>
          <div class="meta-skill-desc">${skill.description || 'Amélioration passive.'}</div>
          <div class="meta-skill-footer">
            <span>Coût: ${cost}</span>
            ${actionHtml}
          </div>
        </div>
      `;
    }

    canUnlockSkill(skill, stats) {
      if (!stats) {
        return false;
      }
      const unlocked = this.progression.unlockedSkills || [];
      const prerequisites = skill.prerequisites || [];
      const hasPrereqs = prerequisites.every(req => unlocked.includes(req));
      return (stats.skillPoints || 0) >= (skill.cost || 1) && hasPrereqs && !unlocked.includes(skill.skillId);
    }

    async unlockSkill(skillId) {
      if (!this.playerId) {
        this.renderError('Connexion requise.');
        return;
      }

      try {
        const headers = { 'Content-Type': 'application/json' };
        const token = window.authManager?.getToken?.();
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const res = await fetch(`/api/progression/${this.playerId}/unlock-skill`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ skillId })
        });

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Unlock failed');
        }

        if (window.toastManager) {
          window.toastManager.show('✨ Compétence débloquée!', 'success', 2500);
        }
        await this.loadData();
      } catch (error) {
        console.error('Unlock failed', error);
        if (window.toastManager) {
          window.toastManager.show('❌ Déblocage impossible', 'error', 2500);
        }
      }
    }

    async prestige() {
      if (!this.playerId) {
        return;
      }

      try {
        const headers = { 'Content-Type': 'application/json' };
        const token = window.authManager?.getToken?.();
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const res = await fetch(`/api/progression/${this.playerId}/prestige`, {
          method: 'POST',
          headers
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Prestige failed');
        }

        if (window.toastManager) {
          window.toastManager.show('🌟 Prestige activé!', 'success', 3000);
        }
        await this.loadData();
      } catch (error) {
        console.error('Prestige failed', error);
        if (window.toastManager) {
          window.toastManager.show('⚠️ Prestige indisponible', 'warning', 2500);
        }
      }
    }
  }

  window.metaProgressionSystem = new MetaProgressionSystem();
})();
