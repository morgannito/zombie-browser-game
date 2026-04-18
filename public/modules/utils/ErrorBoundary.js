/**
 * ERROR BOUNDARY
 * - Ring buffer 50 erreurs dans localStorage
 * - Toast "Erreur détectée" max 1/10s
 * - Recovery: relance le rAF loop si crash
 * @module ErrorBoundary
 */
(function () {
  'use strict';

  const LS_KEY = 'eb_errors';
  const RING_SIZE = 50;
  const TOAST_COOLDOWN_MS = 10000;

  // ── Ring buffer ──────────────────────────────────────────────────────────
  function readRing() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (_) { return []; }
  }

  function writeRing(ring) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(ring)); } catch (_) {}
  }

  function pushError(entry) {
    const ring = readRing();
    ring.push(entry);
    if (ring.length > RING_SIZE) ring.splice(0, ring.length - RING_SIZE);
    writeRing(ring);
  }

  function clearErrors() {
    try { localStorage.removeItem(LS_KEY); } catch (_) {}
  }

  // ── Toast rate-limited ───────────────────────────────────────────────────
  let _lastToast = 0;
  function showToast() {
    const now = Date.now();
    if (now - _lastToast < TOAST_COOLDOWN_MS) return;
    _lastToast = now;

    if (window.toastManager) {
      window.toastManager.show({ message: 'Erreur détectée', type: 'error', duration: 4000 });
      return;
    }
    const el = document.createElement('div');
    el.textContent = 'Erreur détectée';
    el.style.cssText = [
      'position:fixed', 'bottom:20px', 'left:50%', 'transform:translateX(-50%)',
      'background:rgba(180,20,20,0.92)', 'color:#fff', 'padding:10px 20px',
      'border-radius:6px', 'font-size:14px', 'z-index:99999',
      'pointer-events:none', 'transition:opacity 0.4s'
    ].join(';');
    document.body.appendChild(el);
    setTimeout(function () {
      el.style.opacity = '0';
      setTimeout(function () { el.parentNode && el.parentNode.removeChild(el); }, 500);
    }, 4000);
  }

  // ── rAF recovery ─────────────────────────────────────────────────────────
  function tryRecoverLoop() {
    try {
      const engine = window.gameEngine || window.game;
      if (engine && typeof engine.startLoop === 'function') {
        engine.startLoop();
      } else if (typeof window._gameLoop === 'function') {
        requestAnimationFrame(window._gameLoop);
      }
    } catch (_) {}
  }

  // ── Capture erreurs ───────────────────────────────────────────────────────
  window.addEventListener('error', function (event) {
    pushError({
      ts: Date.now(), kind: 'error',
      message: event.message || 'unknown',
      source: event.filename,
      line: event.lineno,
      stack: event.error && event.error.stack ? String(event.error.stack).slice(0, 1000) : null
    });
    showToast();
    tryRecoverLoop();
  });

  window.addEventListener('unhandledrejection', function (event) {
    const r = event.reason;
    pushError({
      ts: Date.now(), kind: 'unhandledrejection',
      message: (r && r.message) || String(r) || 'rejected promise',
      stack: r && r.stack ? String(r.stack).slice(0, 1000) : null
    });
    showToast();
    tryRecoverLoop();
  });

  // ── API publique ──────────────────────────────────────────────────────────
  window.ErrorBoundary = { readRing: readRing, clearErrors: clearErrors, pushError: pushError };
})();
