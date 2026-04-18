/**
 * DEBUG OVERLAY
 * Toggle with F3. Zero-cost when OFF. Updates at 4Hz.
 * @module DebugOverlay
 */

class DebugOverlay {
  constructor(options = {}) {
    this.key = options.key || 'F3';
    this.enabled = false;
    this._panel = null;
    this._lastUpdate = 0;
    this._updateInterval = 250; // 4 Hz
    this._fps = 0;
    this._frameTime = 0;
    this._lastFrameTs = performance.now();
    this._frameCount = 0;
    this._fpsAccum = 0;
    this._boundKey = this._onKey.bind(this);
    document.addEventListener('keydown', this._boundKey);
  }

  _onKey(e) {
    if (e.code === this.key || e.key === this.key) {
      this.enabled = !this.enabled;
      if (this.enabled) {
        this._ensurePanel();
        this._panel.style.display = 'block';
      } else if (this._panel) {
        this._panel.style.display = 'none';
      }
    }
  }

  _ensurePanel() {
    if (this._panel) {
return;
}
    const el = document.createElement('div');
    el.id = 'debug-overlay';
    Object.assign(el.style, {
      position: 'fixed', top: '8px', left: '8px',
      background: 'rgba(0,0,0,0.55)', color: '#0f0',
      fontFamily: 'monospace', fontSize: '11px',
      padding: '6px 10px', borderRadius: '4px',
      pointerEvents: 'none', zIndex: '9999',
      lineHeight: '1.5', whiteSpace: 'pre',
      userSelect: 'none'
    });
    document.body.appendChild(el);
    this._panel = el;
  }

  _collectStats(gsm, net) {
    const counts = gsm && gsm.debugStats && gsm.debugStats.entitiesCount
      ? gsm.debugStats.entitiesCount : {};
    const nm = window.networkManager || net;
    const ping = nm && typeof nm.getAverageLatency === 'function'
      ? Math.round(nm.getAverageLatency())
      : nm ? Math.round(nm.latency || 0) : 0;

    const myId = gsm && gsm.playerId;
    const player = myId && gsm.state.players[myId];
    const cx = player ? Math.round(player.x) : '?';
    const cy = player ? Math.round(player.y) : '?';
    const state = gsm && gsm.interpolation.entityStates.players.get(myId);
    const dx = state ? Math.round((player.x || 0) - (state.serverX || player.x || 0)) : 0;
    const dy = state ? Math.round((player.y || 0) - (state.serverY || player.y || 0)) : 0;

    return { counts, ping, cx, cy, dx, dy };
  }

  _render(s) {
    const z = s.counts.zombies || 0;
    const b = s.counts.bullets || 0;
    const p = s.counts.particles || 0;
    const cull = window._cullingStats || { culled: 0, rendered: 0 };
    this._panel.textContent =
      '[DEBUG] F3 to hide\n' +
      `FPS: ${this._fps}  ft: ${this._frameTime}ms\n` +
      `Ping: ${s.ping}ms\n` +
      `Pos: ${s.cx}, ${s.cy}  drift: ${s.dx},${s.dy}\n` +
      `Z: ${z}  B: ${b}  P: ${p}\n` +
      `Rendered: ${cull.rendered}  Culled: ${cull.culled}`;
  }

  /**
   * Call every frame from game loop. gsm = GameStateManager, net = NetworkManager.
   */
  update(gsm, net) {
    const now = performance.now();
    const dt = now - this._lastFrameTs;
    this._lastFrameTs = now;
    this._frameCount++;
    this._fpsAccum += dt;

    if (!this.enabled) {
return;
}

    if (this._fpsAccum >= 500) {
      this._fps = Math.round((this._frameCount / this._fpsAccum) * 1000);
      this._frameTime = Math.round(this._fpsAccum / this._frameCount);
      this._frameCount = 0;
      this._fpsAccum = 0;
    }

    if (now - this._lastUpdate < this._updateInterval) {
return;
}
    this._lastUpdate = now;

    this._ensurePanel();
    this._render(this._collectStats(gsm, net));
  }

  destroy() {
    document.removeEventListener('keydown', this._boundKey);
    if (this._panel) {
this._panel.remove();
}
  }
}

if (typeof module !== 'undefined') {
module.exports = DebugOverlay;
}
