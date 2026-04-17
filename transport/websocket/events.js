/**
 * Shared Socket.IO event constants.
 * Used by both server and client to avoid typos and ensure consistency.
 *
 * Convention:
 *   - CLIENT: events emitted FROM the client TO the server (socket.on server-side)
 *   - SERVER: events emitted FROM the server TO the client (socket.emit / io.emit server-side)
 *   - BIDIRECTIONAL: events used in both directions
 *
 * @module socketEvents
 */

const SOCKET_EVENTS = {
  // =========================================
  // Client -> Server
  // =========================================
  CLIENT: {
    PLAYER_MOVE: 'playerMove',
    PLAYER_MOVE_BATCH: 'playerMoveBatch',
    SHOOT: 'shoot',
    RESPAWN: 'respawn',
    SET_NICKNAME: 'setNickname',
    SELECT_UPGRADE: 'selectUpgrade',
    BUY_ITEM: 'buyItem',
    SHOP_OPENED: 'shopOpened',
    SHOP_CLOSED: 'shopClosed',
    END_SPAWN_PROTECTION: 'endSpawnProtection',
    PING: 'app:ping', // BUGFIX: namespaced to avoid Socket.IO heartbeat collision
    ADMIN_COMMAND: 'adminCommand',
    REQUEST_FULL_STATE: 'requestFullState',
    // Leaderboard (public client)
    REQUEST_LEADERBOARD: 'request_leaderboard',
    SUBMIT_SCORE: 'submit_score'
  },

  // =========================================
  // Server -> Client
  // =========================================
  SERVER: {
    // Connection & initialization
    INIT: 'init',
    SERVER_FULL: 'serverFull',
    ERROR: 'error',

    // Game state broadcasting
    GAME_STATE: 'gameState',
    GAME_STATE_DELTA: 'gameStateDelta',
    BATCHED_EVENTS: 'batchedEvents',

    // Player feedback
    POSITION_CORRECTION: 'positionCorrection',
    MOVE_ACK: 'moveAck',
    STUNNED: 'stunned',
    NICKNAME_REJECTED: 'nicknameRejected',
    PLAYER_NICKNAME_SET: 'playerNicknameSet',
    UPGRADE_SELECTED: 'upgradeSelected',
    SHOP_UPDATE: 'shopUpdate',
    SESSION_TIMEOUT: 'sessionTimeout',

    // Progression & combat
    LEVEL_UP: 'levelUp',
    COMBO_UPDATE: 'comboUpdate',
    COMBO_RESET: 'comboReset',
    ACCOUNT_XP_GAINED: 'accountXPGained',
    SKILL_BONUSES_LOADED: 'skillBonusesLoaded',
    ACHIEVEMENTS_UNLOCKED: 'achievementsUnlocked',

    // Waves & rooms
    NEW_WAVE: 'newWave',
    ROOM_CHANGED: 'roomChanged',
    RUN_COMPLETED: 'runCompleted',
    MUTATORS_UPDATED: 'mutatorsUpdated',

    // Boss events
    BOSS_SPAWNED: 'bossSpawned',
    BOSS_ENRAGED: 'bossEnraged',
    BOSS_PHASE_CHANGE: 'bossPhaseChange',
    BOSS_CLONES: 'bossClones',
    BOSS_LASER: 'bossLaser',
    BOSS_METEOR: 'bossMeteor',
    BOSS_FIRE_MINIONS: 'bossFireMinions',
    BOSS_ICE_SPIKES: 'bossIceSpikes',
    BOSS_ICE_CLONES: 'bossIceClones',
    BOSS_BLIZZARD: 'bossBlizzard',
    BOSS_VOID_MINIONS: 'bossVoidMinions',
    BOSS_REALITY_WARP: 'bossRealityWarp',
    BOSS_ICE_PRISON: 'bossIcePrison',
    BOSS_APOCALYPSE: 'bossApocalypse',

    // Admin
    ADMIN_RESPONSE: 'adminResponse',

    // Leaderboard
    LEADERBOARD_UPDATE: 'leaderboard_update'
  },

  // =========================================
  // Bidirectional / Socket.IO built-in
  // =========================================
  SYSTEM: {
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    CONNECT_ERROR: 'connect_error',
    RECONNECT: 'reconnect',
    RECONNECT_ATTEMPT: 'reconnect_attempt',
    RECONNECT_ERROR: 'reconnect_error',
    RECONNECT_FAILED: 'reconnect_failed',
    PING: 'ping',
    PONG: 'pong'
  }
};

// CommonJS for server, also works if loaded via script tag
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SOCKET_EVENTS };
} else if (typeof window !== 'undefined') {
  window.SOCKET_EVENTS = SOCKET_EVENTS; // eslint-disable-line no-undef
}
