/**
 * WEAPON RECORDS - Track and display personal bests per weapon.
 * @version 1.0.0
 */

(function() {
  'use strict';

  class WeaponRecordsSystem {
    constructor() {
      this.storageKey = 'weapon_records_v1';
      this.records = this.load();
      this.container = null;
      this.init();
    }

    init() {
      const ready = () => {
        this.ensureContainer();
        this.bindEvents();
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ready);
      } else {
        ready();
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

      safeAdd(document, 'game_over', (e) => this.onGameOver(e.detail));
    }

    ensureContainer() {
      const gameOver = document.getElementById('game-over');
      if (!gameOver) {
        return;
      }

      let container = document.getElementById('weapon-records');
      if (!container) {
        container = document.createElement('div');
        container.id = 'weapon-records';
        gameOver.querySelector('.game-over-stats')?.appendChild(container);
      }
      this.container = container;
    }

    onGameOver(stats) {
      if (!stats) {
        return;
      }

      const weapon = stats.weapon || 'pistol';
      const record = this.records[weapon] || { bestWave: 0, bestScore: 0 };
      const prevBestWave = record.bestWave;
      const prevBestScore = record.bestScore;

      const nextBestWave = Math.max(record.bestWave || 0, stats.wave || 0);
      const nextBestScore = Math.max(record.bestScore || 0, stats.score || 0);

      this.records[weapon] = {
        bestWave: nextBestWave,
        bestScore: nextBestScore,
        lastUpdated: Date.now()
      };

      this.save();
      this.render(weapon);

      if (window.toastManager) {
        if ((stats.wave || 0) > (prevBestWave || 0)) {
          window.toastManager.show(`🏆 Record de vague avec ${this.formatWeapon(weapon)}!`, 'success', 3000);
          this.highlightRecords();
        } else if ((stats.score || 0) > (prevBestScore || 0)) {
          window.toastManager.show(`✨ Nouveau record de score avec ${this.formatWeapon(weapon)}!`, 'success', 3000);
          this.highlightRecords();
        }
      }
    }

    render(currentWeapon) {
      if (!this.container) {
        this.ensureContainer();
      }
      if (!this.container) {
        return;
      }

      const bestOverall = this.getBestRecord();
      const topRecords = Object.entries(this.records)
        .sort((a, b) => (b[1].bestWave || 0) - (a[1].bestWave || 0))
        .slice(0, 3);

      const current = currentWeapon ? this.records[currentWeapon] : null;
      const currentLine = current
        ? `<div class="weapon-record-row">Arme actuelle: ${this.formatWeapon(currentWeapon)} • Vague ${current.bestWave} • Score ${this.formatNumber(current.bestScore)}</div>`
        : '';

      const bestLine = bestOverall
        ? `<div class="weapon-record-row">Meilleur global: ${this.formatWeapon(bestOverall.weapon)} • Vague ${bestOverall.bestWave}</div>`
        : '';

      const topLines = topRecords.map(([weapon, data]) => `
        <div class="weapon-record-row">${this.formatWeapon(weapon)} • Vague ${data.bestWave} • Score ${this.formatNumber(data.bestScore)}</div>
      `).join('');

      this.container.innerHTML = `
        <div class="weapon-records-title">📌 Records d'armes</div>
        ${currentLine}
        ${bestLine}
        ${topLines}
      `;
    }

    getRecord(weapon) {
      return this.records[weapon] || null;
    }

    getBestRecord() {
      let best = null;
      Object.entries(this.records).forEach(([weapon, data]) => {
        if (!best || (data.bestWave || 0) > best.bestWave) {
          best = { weapon, ...data };
        }
      });
      return best;
    }

    formatWeapon(weapon) {
      return weapon
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    formatNumber(value) {
      return Number(value || 0).toLocaleString();
    }

    load() {
      try {
        const raw = localStorage.getItem(this.storageKey);
        return raw ? JSON.parse(raw) : {};
      } catch (error) {
        console.warn('Weapon record load failed', error);
        return {};
      }
    }

    save() {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.records));
      } catch (error) {
        console.warn('Weapon record save failed', error);
      }
    }

    highlightRecords() {
      if (!this.container) {
        return;
      }
      this.container.classList.remove('weapon-records-highlight');
      void this.container.offsetWidth;
      this.container.classList.add('weapon-records-highlight');
      setTimeout(() => {
        if (this.container) {
          this.container.classList.remove('weapon-records-highlight');
        }
      }, 800);
    }
  }

  window.weaponRecordsSystem = new WeaponRecordsSystem();
})();
