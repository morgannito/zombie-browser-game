/**
 * ZBG - Zombie Browser Game global namespace
 *
 * Point d'entrée unique pour les références globales applicatives.
 * Les propriétés sont des getters live sur window.* pour rétrocompatibilité.
 *
 * Usage: window.ZBG.gameState, window.ZBG.networkManager, etc.
 */
(function () {
  'use strict';

  window.ZBG = window.ZBG || {};

  const GLOBALS = [
    'gameState',
    'networkManager',
    'gameEngine',
    'performanceSettings',
    'toastManager',
    'audioManager',
    'inputManager',
    'screenEffects',
    'gameUI',
    'playerController',
    'authManager',
    'mobileControls',
    'spectatorManager',
    'accountProgressionManager',
    'comboSystem',
    'leaderboardSystem',
    'sessionManager',
    'socket',
  ];

  for (const key of GLOBALS) {
    if (!(key in window.ZBG)) {
      Object.defineProperty(window.ZBG, key, {
        get() { return window[key]; },
        set(v) { window[key] = v; },
        enumerable: true,
        configurable: true,
      });
    }
  }

  /**
   * ZBG.get(key) — accès explicite avec warning si manquant
   */
  window.ZBG.get = function (key) {
    const val = window[key];
    if (val === undefined) {
      console.warn(`[ZBG] Global '${key}' is not yet initialized`);
    }
    return val;
  };
})();
