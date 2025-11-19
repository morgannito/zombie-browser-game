/**
 * CONSTANTS & CONFIGURATION
 * Global game configuration constants
 * @module Constants
 * @author Claude Code
 * @version 2.0.0
 */

const CONSTANTS = {
  NICKNAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 15
  },
  SPAWN_PROTECTION: {
    DURATION: 3000, // 3 seconds
    UPDATE_INTERVAL: 100
  },
  MINIMAP: {
    WIDTH: 200,
    HEIGHT: 200
  },
  CANVAS: {
    GRID_SIZE: 50
  },
  ANIMATIONS: {
    SHOP_DELAY: 2000,
    MILESTONE_DELAY: 2500,
    BOSS_ANNOUNCEMENT: 2500
  },
  MOBILE: {
    AUTO_SHOOT_INTERVAL: 250, // ms between auto-shoot attempts
    GESTURE_THRESHOLD: 50, // minimum distance for swipe detection
    LONG_PRESS_DURATION: 500, // ms for long press detection
    DOUBLE_TAP_DELAY: 300 // ms between taps for double-tap
  },
  BOSS_NAMES: {
    boss: 'BOSS ZOMBIE',
    bossCharnier: 'RAIIVY',
    bossInfect: 'SORENZA',
    bossColosse: 'HAIER',
    bossRoi: 'KUROI TO SUTA',
    bossOmega: 'MORGANNITO'
  }
};

// Export to window
window.CONSTANTS = CONSTANTS;
