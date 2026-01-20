/**
 * EXAMPLE INTEGRATION
 * How to integrate the database with existing server.js
 * @version 1.0.0
 */

const DatabaseManager = require('./DatabaseManager');
const PlayerRepository = require('./repositories/PlayerRepository');
const SessionRepository = require('./repositories/SessionRepository');
const LeaderboardRepository = require('./repositories/LeaderboardRepository');
const { v4: uuidv4 } = require('uuid');

// ================================================================================================
// 1. INITIALIZE DATABASE ON SERVER START
// ================================================================================================

class GameDatabaseService {
  constructor(dbPath = './data/game.db') {
    this.dbManager = new DatabaseManager(dbPath, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : null
    });

    // Connect and initialize schema
    this.dbManager.connect();
    this.dbManager.initializeSchema();
    this.dbManager.seedDatabase();

    // Initialize repositories
    const db = this.dbManager.getDatabase();
    this.playerRepo = new PlayerRepository(db);
    this.sessionRepo = new SessionRepository(db);
    this.leaderboardRepo = new LeaderboardRepository(db);

    // Setup maintenance tasks
    this._setupMaintenanceTasks();

    console.log('[GameDatabaseService] Initialized successfully');
  }

  /**
   * Setup automated maintenance tasks
   * @private
   */
  _setupMaintenanceTasks() {
    // Cleanup stale sessions every 5 minutes
    setInterval(async () => {
      try {
        const cleaned = await this.sessionRepo.cleanupStaleSessions(300);
        if (cleaned > 0) {
          console.log(`[Maintenance] Cleaned up ${cleaned} stale sessions`);
        }
      } catch (error) {
        console.error('[Maintenance] Session cleanup failed:', error);
      }
    }, 5 * 60 * 1000);

    // Backup database daily at 3 AM (if server runs 24/7)
    const scheduleNextBackup = () => {
      const now = new Date();
      const next = new Date();
      next.setHours(3, 0, 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      const delay = next - now;

      setTimeout(() => {
        this._performBackup();
        scheduleNextBackup(); // Schedule next backup
      }, delay);
    };
    scheduleNextBackup();
  }

  /**
   * Perform database backup
   * @private
   */
  _performBackup() {
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const backupPath = `./backups/game_${timestamp}.db`;
      this.dbManager.backup(backupPath);
      console.log(`[Backup] Database backed up to: ${backupPath}`);
    } catch (error) {
      console.error('[Backup] Failed:', error);
    }
  }

  /**
   * Shutdown gracefully
   */
  shutdown() {
    console.log('[GameDatabaseService] Shutting down...');
    this.dbManager.close();
  }
}

// ================================================================================================
// 2. INTEGRATE WITH SOCKET.IO EVENTS
// ================================================================================================

/**
 * Example integration with server.js socket events
 */
class GameServerIntegration {
  constructor(io, gameState, dbService) {
    this.io = io;
    this.gameState = gameState;
    this.db = dbService;

    // Map socket IDs to player IDs and session IDs
    this.socketToPlayer = new Map(); // socketId -> { playerId, sessionId }
  }

  /**
   * Handle new player connection
   */
  async handlePlayerJoin(socket, nickname) {
    try {
      // Check if player exists
      let player = await this.db.playerRepo.findByNickname(nickname);

      if (!player) {
        // Create new player
        player = await this.db.playerRepo.create({
          playerUuid: uuidv4(),
          nickname
        });
        console.log(`[DB] Created new player: ${nickname} (ID: ${player.id})`);
      } else {
        // Update last login
        await this.db.playerRepo.updateLastLogin(player.id);
        console.log(`[DB] Player reconnected: ${nickname} (ID: ${player.id})`);
      }

      // Check if player is banned
      const isBanned = await this.db.playerRepo.isBanned(player.id);
      if (isBanned) {
        socket.emit('error', { message: 'You are banned from this server' });
        socket.disconnect();
        return null;
      }

      // Check for active session to recover
      const activeSession = await this.db.sessionRepo.getActiveSession(player.id);
      let session;

      if (activeSession) {
        // Recover existing session
        const sessionAge = Math.floor(Date.now() / 1000) - activeSession.last_heartbeat;
        if (sessionAge < 300) { // 5 minutes
          session = {
            id: activeSession.session_id,
            uuid: activeSession.session_uuid
          };
          console.log(`[DB] Recovered session for ${nickname}`);

          // Parse and restore game state
          const _savedState = JSON.parse(activeSession.game_state_json);
          // Apply saved state to player object
          // ... restore HP, level, gold, position, etc
        }
      }

      if (!session) {
        // Create new game session
        const sessionData = await this.db.sessionRepo.create({
          sessionUuid: uuidv4(),
          playerId: player.id,
          clientVersion: '1.0.0',
          clientPlatform: 'web'
        });
        session = sessionData;
        console.log(`[DB] Created new session for ${nickname}`);
      }

      // Map socket to player
      this.socketToPlayer.set(socket.id, {
        playerId: player.id,
        sessionId: session.id,
        nickname: player.nickname
      });

      return { player, session };
    } catch (error) {
      console.error('[DB] Error handling player join:', error);
      return null;
    }
  }

  /**
   * Save game state periodically (heartbeat)
   */
  async saveGameState(socket, gameState) {
    try {
      const mapping = this.socketToPlayer.get(socket.id);
      if (!mapping) {
        return;
      }

      await this.db.sessionRepo.saveActiveSession(
        mapping.sessionId,
        socket.id,
        gameState
      );

      await this.db.sessionRepo.updateHeartbeat(mapping.sessionId);
    } catch (error) {
      console.error('[DB] Error saving game state:', error);
    }
  }

  /**
   * Handle player death / game over
   */
  async handleGameOver(socket, finalStats) {
    try {
      const mapping = this.socketToPlayer.get(socket.id);
      if (!mapping) {
        return;
      }

      // End session
      await this.db.sessionRepo.endSession(mapping.sessionId, {
        endReason: finalStats.reason || 'death',
        finalLevel: finalStats.level,
        finalWave: finalStats.wave,
        finalScore: finalStats.score,
        finalGold: finalStats.gold,
        finalXp: finalStats.xp,
        zombiesKilled: finalStats.zombiesKilled,
        highestCombo: finalStats.highestCombo
      });

      // Submit to leaderboard
      await this.db.leaderboardRepo.submitScore({
        playerId: mapping.playerId,
        sessionId: mapping.sessionId,
        score: finalStats.score,
        leaderboardType: 'all_time',
        levelReached: finalStats.level,
        waveReached: finalStats.wave,
        zombiesKilled: finalStats.zombiesKilled,
        playTimeSeconds: finalStats.survivalTime
      });

      console.log(`[DB] Game over for ${mapping.nickname}: Score ${finalStats.score}`);

      // Note: player_stats are automatically updated by database triggers

    } catch (error) {
      console.error('[DB] Error handling game over:', error);
    }
  }

  /**
   * Handle player disconnect
   */
  async handleDisconnect(socket) {
    try {
      const mapping = this.socketToPlayer.get(socket.id);
      if (!mapping) {
        return;
      }

      // Check if player is still alive - if so, save state for recovery
      const player = this.gameState.players[socket.id];
      if (player && player.alive) {
        // Save current state for potential recovery
        await this.saveGameState(socket, {
          health: player.health,
          maxHealth: player.maxHealth,
          level: player.level,
          xp: player.xp,
          gold: player.gold,
          x: player.x,
          y: player.y,
          weapon: player.weapon,
          score: player.score,
          zombiesKilled: player.zombiesKilled,
          combo: player.combo
          // ... save all relevant state
        });

        console.log(`[DB] Saved state for disconnected player: ${mapping.nickname}`);
      } else {
        // Player was dead, just end the session
        await this.db.sessionRepo.endSession(mapping.sessionId, {
          endReason: 'disconnect',
          finalLevel: player?.level || 1,
          finalScore: player?.score || 0
          // ... other stats
        });
      }

      this.socketToPlayer.delete(socket.id);
    } catch (error) {
      console.error('[DB] Error handling disconnect:', error);
    }
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(type = 'all_time', limit = 100) {
    try {
      return await this.db.leaderboardRepo.getTopScores(type, limit);
    } catch (error) {
      console.error('[DB] Error getting leaderboard:', error);
      return [];
    }
  }

  /**
   * Get player profile
   */
  async getPlayerProfile(playerId) {
    try {
      const profile = await this.db.playerRepo.getPlayerProfile(playerId);
      const upgrades = await this.db.playerRepo.getPermanentUpgrades(playerId);
      const rank = await this.db.leaderboardRepo.getPlayerRank(playerId, 'all_time');

      return {
        ...profile,
        upgrades,
        rank: rank?.rank || null
      };
    } catch (error) {
      console.error('[DB] Error getting player profile:', error);
      return null;
    }
  }

  /**
   * Purchase permanent upgrade
   */
  async purchaseUpgrade(playerId, upgradeType, cost) {
    try {
      const success = await this.db.playerRepo.purchaseUpgrade(
        playerId,
        upgradeType,
        cost
      );
      return success;
    } catch (error) {
      console.error('[DB] Error purchasing upgrade:', error);
      return false;
    }
  }
}

// ================================================================================================
// 3. USAGE IN server.js
// ================================================================================================

/**
 * Example integration in your main server.js file:
 *

// At the top of server.js
const GameDatabaseService = require('./database/example_integration').GameDatabaseService;
const GameServerIntegration = require('./database/example_integration').GameServerIntegration;

// Initialize database service
const dbService = new GameDatabaseService('./data/game.db');

// Initialize game integration
let gameIntegration;

// In your io.on('connection') handler
io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  // Initialize integration if not already done
  if (!gameIntegration) {
    gameIntegration = new GameServerIntegration(io, gameState, dbService);
  }

  // Handle player join
  socket.on('playerJoin', async (nickname) => {
    const result = await gameIntegration.handlePlayerJoin(socket, nickname);
    if (!result) return;

    const { player, session } = result;

    // Continue with your existing game logic
    const newPlayer = playerManager.createPlayer(socket.id);
    newPlayer.nickname = nickname;
    newPlayer.hasNickname = true;
    // ... rest of your player setup

    gameState.players[socket.id] = newPlayer;

    // Emit join success with player data
    socket.emit('joinSuccess', {
      playerId: socket.id,
      playerData: newPlayer,
      dbPlayerId: player.id,
      sessionId: session.id
    });
  });

  // Auto-save game state every 30 seconds
  const saveInterval = setInterval(() => {
    const player = gameState.players[socket.id];
    if (player && player.alive) {
      gameIntegration.saveGameState(socket, {
        health: player.health,
        level: player.level,
        // ... all state
      });
    }
  }, 30000);

  // Handle game over
  socket.on('gameOver', async () => {
    const player = gameState.players[socket.id];
    if (!player) return;

    await gameIntegration.handleGameOver(socket, {
      level: player.level,
      wave: gameState.currentWave,
      score: player.score,
      gold: player.gold,
      xp: player.xp,
      zombiesKilled: player.zombiesKilled,
      highestCombo: player.highestCombo,
      survivalTime: Math.floor((Date.now() - player.survivalTime) / 1000)
    });
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    clearInterval(saveInterval);
    await gameIntegration.handleDisconnect(socket);
    // ... rest of your disconnect logic
  });

  // Leaderboard request
  socket.on('getLeaderboard', async (type) => {
    const leaderboard = await gameIntegration.getLeaderboard(type);
    socket.emit('leaderboardData', leaderboard);
  });

  // Profile request
  socket.on('getProfile', async (playerId) => {
    const profile = await gameIntegration.getPlayerProfile(playerId);
    socket.emit('profileData', profile);
  });

  // Shop purchase
  socket.on('purchaseUpgrade', async ({ playerId, upgradeType, cost }) => {
    const success = await gameIntegration.purchaseUpgrade(playerId, upgradeType, cost);
    socket.emit('purchaseResult', { success, upgradeType });
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  dbService.shutdown();
  process.exit(0);
});

*/

// ================================================================================================
// EXPORTS
// ================================================================================================

module.exports = {
  GameDatabaseService,
  GameServerIntegration
};
