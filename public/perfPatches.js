/**
 * Runtime performance patches — loaded BEFORE game modules.
 * Allows disabling expensive Canvas 2D features at once.
 */
(function () {
  'use strict';

  const proto = CanvasRenderingContext2D.prototype;
  if (!proto || !Object.getOwnPropertyDescriptor(proto, 'shadowBlur')) {
    return;
  }

  const shadowBlurDesc = Object.getOwnPropertyDescriptor(proto, 'shadowBlur');
  let shadowsDisabled = false;

  Object.defineProperty(proto, 'shadowBlur', {
    get: shadowBlurDesc.get,
    set(value) {
      shadowBlurDesc.set.call(this, shadowsDisabled ? 0 : value);
    },
    configurable: true
  });

  window.setCanvasShadowsEnabled = function (enabled) {
    shadowsDisabled = !enabled;
    // Auto-tie zombie fast draw to shadows: when shadows off, use simplified sprite
    window.useZombieFastDraw = !enabled;
  };

  // Allow manual override (e.g. dev console)
  window.useZombieFastDraw = false;

  // Honor previously saved setting on load
  try {
    const saved = localStorage.getItem('zombieGamePerformanceSettings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.shadowsEnabled === false) {
        shadowsDisabled = true;
        window.useZombieFastDraw = true;
      }
    }
  } catch (_) {
    /* ignore */
  }
})();
