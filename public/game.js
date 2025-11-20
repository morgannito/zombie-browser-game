/**
 * ZOMBIE SURVIVAL - Game Initialization
 * @version 2.0.0 (Modularized)
 * @description Minimal initialization file - all classes moved to /modules/
 */

/* ============================================
   EXPORT CLASSES FOR GAME PATCHES
   ============================================ */

// Export classes to window for gamePatch.js (already exported in modules)
// These are just aliases to maintain compatibility
window.GameEngine = window.GameEngine || GameEngine;
window.Renderer = window.Renderer || Renderer;
window.PlayerController = window.PlayerController || PlayerController;

/* ============================================
   GAME INITIALIZATION
   ============================================ */

// Start the game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initInstructionsToggle();
    initMinimapToggle();
    initCameraRecenter();
    new GameEngine();
  });
} else {
  initInstructionsToggle();
  initMinimapToggle();
  initCameraRecenter();
  new GameEngine();
}
