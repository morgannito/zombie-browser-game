/**
 * SPECTATOR MANAGER
 * Watch-only mode: join as spectator, cycle players (Tab), free camera (WASD).
 * @module SpectatorManager
 */

class SpectatorManager {
  constructor() {
    this.active = false;
    this.targetPlayerId = null;
    this.freeCam = false;   // true = WASD free camera, false = follow target
    this.freeCamSpeed = 400; // px/s

    this._banner = null;
    this._tabHandler = null;
    this._keyHandler = null;
    this._keys = {};
    this._rafId = null;
    this._lastTick = 0;

    this._injectUI();
  }

  // ─── Join-screen button ────────────────────────────────────────────────────

  _injectUI() {
    const btn = document.getElementById('start-game-btn');
    if (!btn) {
return;
}

    const watchBtn = document.createElement('button');
    watchBtn.id = 'spectate-btn';
    watchBtn.textContent = '👁 Observer en spectateur';
    watchBtn.style.cssText = [
      'margin-top:8px', 'width:100%', 'padding:10px 0',
      'background:rgba(255,255,255,0.08)', 'color:#adb5bd',
      'border:1px solid rgba(255,255,255,0.18)', 'border-radius:8px',
      'font-size:0.9rem', 'cursor:pointer', 'transition:background 0.2s'
    ].join(';');
    // Store handler refs so they can be cleaned up
    this._watchBtnEnter = () => {
 watchBtn.style.background = 'rgba(255,255,255,0.15)';
};
    this._watchBtnLeave = () => {
 watchBtn.style.background = 'rgba(255,255,255,0.08)';
};
    this._watchBtnClick = () => this._enterSpectatorMode();
    watchBtn.addEventListener('mouseenter', this._watchBtnEnter);
    watchBtn.addEventListener('mouseleave', this._watchBtnLeave);
    watchBtn.addEventListener('click', this._watchBtnClick);
    this._watchBtn = watchBtn;
    btn.parentNode.insertBefore(watchBtn, btn.nextSibling);
  }

  // ─── Enter / Exit ──────────────────────────────────────────────────────────

  _enterSpectatorMode() {
    const nicknameScreen = document.getElementById('nickname-screen');
    if (nicknameScreen) {
nicknameScreen.style.display = 'none';
}

    // Hide skins button like normal join
    if (window.hideSkinsButton) {
window.hideSkinsButton();
}
    const skinsMenu = document.getElementById('skins-menu');
    if (skinsMenu) {
skinsMenu.style.display = 'none';
}

    this.active = true;
    this._hideWeaponHUD();
    this._createBanner();
    this._attachInputs();
    this._tickLoop();

    // Snap camera to first available player
    this._cycleToNextPlayer();
  }

  exit() {
    this.active = false;
    this._detachInputs();
    if (this._rafId) {
 cancelAnimationFrame(this._rafId); this._rafId = null;
}
    if (this._banner) {
 this._banner.remove(); this._banner = null;
}
    this._showWeaponHUD();
  }

  /**
   * Full cleanup: removes injected button, banner and all listeners.
   * Call when the game tears down to prevent leaks.
   */
  cleanup() {
    this.exit();
    if (this._watchBtn) {
      this._watchBtn.removeEventListener('mouseenter', this._watchBtnEnter);
      this._watchBtn.removeEventListener('mouseleave', this._watchBtnLeave);
      this._watchBtn.removeEventListener('click', this._watchBtnClick);
      this._watchBtn.remove();
      this._watchBtn = null;
    }
  }

  // ─── HUD management ───────────────────────────────────────────────────────

  _hideWeaponHUD() {
    const ww = document.getElementById('weapon-wheel');
    if (ww) {
ww.dataset.specHidden = ww.style.display || '';
}
    // weapon-wheel is display:none by default (only shown on keypress), no action needed
    // Hide stats HUD elements irrelevant to spectator
    ['spawn-protection'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
 el.dataset.specHidden = el.style.display || ''; el.style.display = 'none';
}
    });
  }

  _showWeaponHUD() {
    ['spawn-protection'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.dataset.specHidden !== undefined) {
        el.style.display = el.dataset.specHidden;
        delete el.dataset.specHidden;
      }
    });
  }

  // ─── Banner ───────────────────────────────────────────────────────────────

  _createBanner() {
    if (this._banner) {
return;
}
    const el = document.createElement('div');
    el.id = 'spectator-banner';
    el.style.cssText = [
      'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
      'background:rgba(0,0,0,0.72)', 'color:#e2e8f0',
      'padding:8px 24px', 'border-radius:20px',
      'font-size:0.85rem', 'font-family:monospace', 'letter-spacing:0.05em',
      'border:1px solid rgba(255,255,255,0.15)',
      'pointer-events:none', 'z-index:9000', 'user-select:none'
    ].join(';');
    el.textContent = 'SPECTATEUR — Tab: joueur suivant | WASD: caméra libre';
    document.body.appendChild(el);
    this._banner = el;
  }

  _updateBanner(text) {
    if (this._banner) {
this._banner.textContent = text;
}
  }

  // ─── Player cycling (Tab) ─────────────────────────────────────────────────

  _getAlivePlayers() {
    const players = window.gameState && window.gameState.state && window.gameState.state.players;
    if (!players) {
return [];
}
    return Object.entries(players)
      .filter(([, p]) => p && p.alive !== false)
      .map(([id, p]) => ({ id, name: p.nickname || p.name || id }));
  }

  _cycleToNextPlayer() {
    const alive = this._getAlivePlayers();
    if (!alive.length) {
      this.targetPlayerId = null;
      this.freeCam = true;
      this._updateBanner('SPECTATEUR — Aucun joueur en vie | WASD: caméra libre');
      return;
    }

    const idx = alive.findIndex(p => p.id === this.targetPlayerId);
    const next = alive[(idx + 1) % alive.length];
    this.targetPlayerId = next.id;
    this.freeCam = false;
    this._updateBanner(`SPECTATING [${next.name}] — Tab: suivant | WASD: caméra libre`);

    // Snap camera
    const state = window.gameState.state.players[this.targetPlayerId];
    if (state && window.gameEngine && window.gameEngine.camera) {
      window.gameEngine.camera.recenter(state, window.innerWidth, window.innerHeight);
    }
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  _attachInputs() {
    this._tabHandler = (e) => {
      if (!this.active) {
return;
}
      if (e.key === 'Tab') {
        e.preventDefault();
        this._cycleToNextPlayer();
      }
      if (['w','a','s','d','W','A','S','D'].includes(e.key)) {
        this._keys[e.key.toLowerCase()] = true;
        if (!this.freeCam) {
          this.freeCam = true;
          this._updateBanner('SPECTATEUR (caméra libre) — Tab: joueur suivant');
        }
      }
    };
    this._keyupHandler = (e) => {
      if (['w','a','s','d','W','A','S','D'].includes(e.key)) {
        this._keys[e.key.toLowerCase()] = false;
      }
    };
    window.addEventListener('keydown', this._tabHandler, true);
    window.addEventListener('keyup', this._keyupHandler, true);
  }

  _detachInputs() {
    if (this._tabHandler) {
 window.removeEventListener('keydown', this._tabHandler, true); this._tabHandler = null;
}
    if (this._keyupHandler) {
 window.removeEventListener('keyup', this._keyupHandler, true); this._keyupHandler = null;
}
  }

  // ─── Camera tick ──────────────────────────────────────────────────────────

  _tickLoop() {
    const tick = (ts) => {
      if (!this.active) {
return;
}
      const dt = Math.min(ts - (this._lastTick || ts), 100) / 1000;
      this._lastTick = ts;
      this._updateCamera(dt);
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  _updateCamera(dt) {
    const cam = window.gameEngine && window.gameEngine.camera;
    if (!cam) {
return;
}

    if (this.freeCam) {
      // WASD free camera — directly mutate camera position
      const spd = this.freeCamSpeed * dt;
      const k = this._keys;
      let dx = 0, dy = 0;
      if (k.a) {
dx -= spd;
}
      if (k.d) {
dx += spd;
}
      if (k.w) {
dy -= spd;
}
      if (k.s) {
dy += spd;
}
      if (dx || dy) {
        cam.x += dx;
        cam.y += dy;
        cam._invalidateCache(Math.round(cam.x), Math.round(cam.y));
      }
    } else if (this.targetPlayerId) {
      // Follow targeted player
      const players = window.gameState && window.gameState.state && window.gameState.state.players;
      const target = players && players[this.targetPlayerId];
      if (target) {
        cam.follow(target, window.innerWidth, window.innerHeight, dt * 1000);
      } else {
        // Player died or disconnected — auto-cycle
        this._cycleToNextPlayer();
      }
    }
  }
}

window.SpectatorManager = SpectatorManager;
