/**
 * SESSION ACHIEVEMENTS — client-only, no server persistence.
 * Tracks in-memory counters via document events and shows gold-border toasts.
 */
class SessionAchievements {
  constructor() {
    this._unlocked = new Set();
    this._counters = {
      sessionKills: 0,
      streakKills: 0,
      consecutiveCritKills: 0,
      lastCritPending: false
    };
    this._definitions = [
      { id: 'first_blood',    icon: '🩸', title: 'First Blood',    desc: '1er kill de la session',      check: c => c.sessionKills >= 1 },
      { id: 'killing_spree', icon: '🔥', title: 'Killing Spree',  desc: '10 kills sans mourir',         check: c => c.streakKills >= 10 },
      { id: 'wave_survivor', icon: '🌊', title: 'Wave Survivor',  desc: 'Survit à la wave 5',           check: (_c, wave) => wave >= 5 },
      { id: 'high_roller',   icon: '💰', title: 'High Roller',    desc: '1000 gold atteints',           check: (_c, _w, gold) => gold >= 1000 },
      { id: 'sharpshooter',  icon: '🎯', title: 'Sharpshooter',   desc: '5 crit kills consécutifs',     check: c => c.consecutiveCritKills >= 5 }
    ];
    this._wave = 0;
    this._gold = 0;
    this._bindEvents();
  }

  _bindEvents() {
    this._handlers = {
      session_kill: e => {
        const delta = (e.detail && e.detail.delta) || 1;
        this._counters.sessionKills += delta;
        if (this._counters.lastCritPending) {
          this._counters.consecutiveCritKills += delta;
        } else {
          this._counters.consecutiveCritKills = 0;
        }
        this._counters.lastCritPending = false;
        this._counters.streakKills += delta;
        this._checkAll();
      },
      session_death: () => {
        this._counters.streakKills = 0;
        this._counters.consecutiveCritKills = 0;
        this._counters.lastCritPending = false;
      },
      session_gold: e => {
        this._gold = (e.detail && e.detail.gold) || 0;
        this._checkAll();
      },
      wave_changed: e => {
        this._wave = (e.detail && e.detail.wave) || 0;
        this._checkAll();
      },
      crit_damage: () => {
        this._counters.lastCritPending = true;
      }
    };

    for (const [event, handler] of Object.entries(this._handlers)) {
      document.addEventListener(event, handler);
    }
  }

  /**
   * Removes all document event listeners.
   * Call on game teardown to prevent stacking across sessions.
   */
  cleanup() {
    if (!this._handlers) {
return;
}
    for (const [event, handler] of Object.entries(this._handlers)) {
      document.removeEventListener(event, handler);
    }
    this._handlers = null;
  }

  _checkAll() {
    for (const def of this._definitions) {
      if (this._unlocked.has(def.id)) {
        continue;
      }
      if (def.check(this._counters, this._wave, this._gold)) {
        this._unlock(def);
      }
    }
  }

  _unlock(def) {
    this._unlocked.add(def.id);
    this._showToast(def);
    this._playDing();
  }

  _showToast(def) {
    const container = document.getElementById('toast-container');
    if (!container) {
      return;
    }
    const toast = document.createElement('div');
    toast.className = 'toast toast-achievement';
    toast.style.cssText = 'border:2px solid #ffd700;box-shadow:0 0 12px rgba(255,215,0,0.5);';

    const iconEl = document.createElement('div');
    iconEl.className = 'toast-icon';
    iconEl.textContent = def.icon;

    const content = document.createElement('div');
    content.className = 'toast-content';

    const titleEl = document.createElement('div');
    titleEl.className = 'toast-title';
    titleEl.style.color = '#ffd700';
    titleEl.textContent = 'ACHIEVEMENT';

    const msgEl = document.createElement('div');
    msgEl.className = 'toast-message';
    const strong = document.createElement('strong');
    strong.textContent = def.title;
    msgEl.appendChild(strong);
    msgEl.appendChild(document.createTextNode(' \u2014 ' + def.desc));

    content.appendChild(titleEl);
    content.appendChild(msgEl);
    toast.appendChild(iconEl);
    toast.appendChild(content);
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s';
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 350);
    }, 3000);
  }

  _playDing() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
      osc.onended = () => ctx.close();
    } catch (_e) {
      // Audio not available
    }
  }
}

window.sessionAchievements = new SessionAchievements();
