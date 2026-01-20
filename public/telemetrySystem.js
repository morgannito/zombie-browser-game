/**
 * TELEMETRY PROMPTS - Contextual nudges to keep momentum.
 * @version 1.0.0
 */

(function() {
  'use strict';

  class TelemetrySystem {
    constructor() {
      this.currentWeapon = null;
      this.recordHinted = false;
      this.recordBeatenNotified = false;
      this.lastBossToast = 0;
      this.lastEliteToast = 0;
      this.init();
    }

    init() {
      const ready = () => this.bindEvents();
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

      safeAdd(document, 'game_started', (e) => {
        this.currentWeapon = e.detail?.weapon || this.currentWeapon;
        this.recordHinted = false;
        this.recordBeatenNotified = false;
      });

      safeAdd(document, 'wave_changed', (e) => {
        this.onWaveChanged(e.detail?.wave || 1);
      });

      safeAdd(document, 'boss_spawned', () => {
        const now = Date.now();
        if (now - this.lastBossToast > 15000 && window.toastManager) {
          window.toastManager.show('⚔️ Boss en approche, restez focus!', 'warning', 2500);
          this.lastBossToast = now;
        }
      });

      safeAdd(document, 'upgrade_obtained', () => this.checkSynergyHint());
      safeAdd(document, 'zombie_killed', (e) => this.onSpecialKill(e.detail));
    }

    onWaveChanged(wave) {
      const record = this.getWeaponRecord();
      if (!record || !record.bestWave) {
        return;
      }

      if (!this.recordHinted && wave >= record.bestWave - 2 && wave < record.bestWave) {
        if (window.toastManager) {
          window.toastManager.show(`🔥 Plus que ${record.bestWave - wave} vagues pour battre votre record!`, 'info', 2500);
        }
        this.recordHinted = true;
      }

      if (!this.recordBeatenNotified && wave > record.bestWave) {
        if (window.toastManager) {
          window.toastManager.show('🏆 Nouveau record de vague en vue!', 'success', 2500);
        }
        this.recordBeatenNotified = true;
      }
    }

    getWeaponRecord() {
      if (window.weaponRecordsSystem && this.currentWeapon) {
        return window.weaponRecordsSystem.getRecord(this.currentWeapon);
      }
      if (window.weaponRecordsSystem) {
        return window.weaponRecordsSystem.getBestRecord();
      }
      return null;
    }

    checkSynergyHint() {
      if (!window.synergySystem || !window.toastManager) {
        return;
      }

      const current = window.synergySystem.currentUpgrades || [];
      const near = (window.synergySystem.synergies || []).find((synergy) => {
        const missing = synergy.requires.filter(req => !current.includes(req));
        return missing.length === 1;
      });

      if (near) {
        window.toastManager.show(`⚡ Synergie proche: ${near.name}`, 'info', 2200);
      }
    }

    onSpecialKill(detail) {
      if (!detail || !window.toastManager) {
        return;
      }

      if (detail.isBoss) {
        window.toastManager.show('💀 Boss éliminé! Faites monter la pression.', 'success', 2500);
        return;
      }

      if (detail.isElite) {
        const now = Date.now();
        if (now - this.lastEliteToast > 8000) {
          window.toastManager.show('⚡ Elite éliminé! Continuez la série.', 'info', 2000);
          this.lastEliteToast = now;
        }
      }
    }
  }

  window.telemetrySystem = new TelemetrySystem();
})();
