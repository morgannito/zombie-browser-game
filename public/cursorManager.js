/**
 * CURSOR MANAGER
 * - Custom reticle cursor on body, gauntlet on buttons (via CSS)
 * - Auto-hide cursor after 2s of inactivity inside the game canvas
 * - "Disable custom cursor" setting integration with SettingsMenu
 */

const CursorManager = (() => {
  const HIDE_DELAY_MS = 2000;
  const STORAGE_KEY   = 'zbg-custom-cursor';

  let _hideTimer   = null;
  let _gameActive  = false;
  let _enabled     = true;

  // ── Helpers ──────────────────────────────────────────────────────────────

  function _applyEnabled(val) {
    _enabled = val;
    if (val) {
      document.body.classList.remove('cursor-default');
    } else {
      document.body.classList.add('cursor-default');
      _cancelHide();
    }
    try {
 localStorage.setItem(STORAGE_KEY, val ? '1' : '0');
} catch (_) { /* ignore storage errors */ }
  }

  function _cancelHide() {
    if (_hideTimer) {
 clearTimeout(_hideTimer); _hideTimer = null;
}
    const gc = document.getElementById('game-container');
    if (gc) {
gc.classList.remove('cursor-hidden');
}
  }

  function _scheduleHide() {
    if (!_enabled || !_gameActive) {
return;
}
    _cancelHide();
    _hideTimer = setTimeout(() => {
      const gc = document.getElementById('game-container');
      if (gc) {
gc.classList.add('cursor-hidden');
}
    }, HIDE_DELAY_MS);
  }

  // ── Canvas auto-hide ──────────────────────────────────────────────────────

  function _initCanvasHide() {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
return;
}

    canvas.addEventListener('mousemove', () => {
      if (!_gameActive) {
return;
}
      _cancelHide();
      _scheduleHide();
    });

    canvas.addEventListener('mouseleave', _cancelHide);
  }

  // ── Settings integration ──────────────────────────────────────────────────

  function _hookSettings() {
    const toggle = document.getElementById('custom-cursor-toggle');
    if (!toggle) {
return;
}

    toggle.checked = _enabled;

    toggle.addEventListener('change', (e) => {
      _applyEnabled(e.target.checked);
      // Sync into SettingsMenu currentSettings if available
      if (window.gameSettingsMenu?.currentSettings?.graphics) {
        window.gameSettingsMenu.currentSettings.graphics.customCursor = e.target.checked;
      }
    });
  }

  function _loadPersisted() {
    // Priority: SettingsMenu saved > localStorage
    try {
      const saved = localStorage.getItem('zombie-game-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.graphics?.customCursor === 'boolean') {
          return parsed.graphics.customCursor;
        }
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
return raw === '1';
}
    } catch (_) { /* ignore storage errors */ }
    return true; // default: enabled
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Toggle game-active state; starts or stops the cursor auto-hide timer.
   * @param {boolean} active
   */
  function setGameActive(active) {
    _gameActive = active;
    if (!active) {
_cancelHide();
} else {
_scheduleHide();
}
  }

  /**
   * Initialise the cursor manager: load persisted preference, wire up canvas
   * auto-hide, hook the settings toggle, and listen for game lifecycle events.
   */
  function init() {
    const persisted = _loadPersisted();
    _applyEnabled(persisted);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        _initCanvasHide();
        _hookSettings();
      });
    } else {
      _initCanvasHide();
      _hookSettings();
    }

    // Activate auto-hide when the game actually starts
    document.addEventListener('game_started', () => setGameActive(true));
    // Deactivate on game over / disconnect
    document.addEventListener('game_over',    () => setGameActive(false));
    document.addEventListener('disconnected', () => setGameActive(false));
  }

  return { init, setGameActive, setEnabled: _applyEnabled };
})();

window.CursorManager = CursorManager;
CursorManager.init();
