# Database Implementation Guide

Step-by-step guide to integrate the database with your existing zombie multiplayer game.

## Phase 1: Installation (15 minutes)

### 1.1 Install Dependencies

```bash
# Navigate to project root
cd /Users/mriu/Downloads/zombie-jeu-claude-zombie-browser-game-01LsByqwV5Bu53dYRWW7nWbA

# Install better-sqlite3
npm install better-sqlite3 --save

# Install uuid for player identification
npm install uuid --save
```

### 1.2 Create Data Directory

```bash
mkdir -p data
mkdir -p backups
```

### 1.3 Initialize Database

```javascript
// Create: scripts/init-database.js
const DatabaseManager = require('./database/DatabaseManager');

const dbManager = new DatabaseManager('./data/game.db');
dbManager.connect();
dbManager.initializeSchema();
dbManager.seedDatabase();

console.log('Database initialized successfully!');
console.log(dbManager.getStats());
dbManager.close();
```

Run it:
```bash
node scripts/init-database.js
```

Expected output:
```
[DatabaseManager] Connected to database: ./data/game.db
[DatabaseManager] Schema initialized successfully
[DatabaseManager] Database seeded successfully
Database initialized successfully!
{
  sizeMB: '0.12',
  freeMB: '0.00',
  pageCount: 31,
  pageSize: 4096,
  walMode: 'wal'
}
```

## Phase 2: Minimal Integration (30 minutes)

### 2.1 Add Database to server.js

At the top of `server.js`, add:

```javascript
// Database imports
const DatabaseManager = require('./database/DatabaseManager');
const PlayerRepository = require('./database/repositories/PlayerRepository');
const { v4: uuidv4 } = require('uuid');

// Initialize database
const dbManager = new DatabaseManager('./data/game.db', {
  verbose: process.env.NODE_ENV === 'development' ? console.log : null
});
dbManager.connect();
dbManager.initializeSchema();

const db = dbManager.getDatabase();
const playerRepo = new PlayerRepository(db);

// Map socket IDs to database player IDs
const socketToPlayerId = new Map();
```

### 2.2 Modify Player Join Event

Replace your existing `playerJoin` handler with:

```javascript
socket.on('playerJoin', async (nickname) => {
  try {
    // Validate nickname
    if (!nickname || nickname.length < 3 || nickname.length > 20) {
      socket.emit('error', { message: 'Nickname must be 3-20 characters' });
      return;
    }

    // Check if player exists in database
    let dbPlayer = await playerRepo.findByNickname(nickname);

    if (!dbPlayer) {
      // Create new player
      dbPlayer = await playerRepo.create({
        playerUuid: uuidv4(),
        nickname
      });
      console.log(`[DB] New player created: ${nickname} (ID: ${dbPlayer.id})`);
    } else {
      // Update last login
      await playerRepo.updateLastLogin(dbPlayer.id);
      console.log(`[DB] Player reconnected: ${nickname} (ID: ${dbPlayer.id})`);
    }

    // Check if banned
    const isBanned = await playerRepo.isBanned(dbPlayer.id);
    if (isBanned) {
      socket.emit('error', { message: 'You are banned from this server' });
      socket.disconnect();
      return;
    }

    // Store mapping
    socketToPlayerId.set(socket.id, dbPlayer.id);

    // Continue with existing game logic
    const player = playerManager.createPlayer(socket.id);
    player.nickname = nickname;
    player.hasNickname = true;

    gameState.players[socket.id] = player;

    // ... rest of your existing code
    socket.emit('joinSuccess', {
      playerId: socket.id,
      playerData: player,
      dbPlayerId: dbPlayer.id
    });

  } catch (error) {
    console.error('[DB] Error in playerJoin:', error);
    socket.emit('error', { message: 'Failed to join game' });
  }
});
```

### 2.3 Track Stats on Player Death

Add this to your player death/game over logic:

```javascript
socket.on('playerDied', async () => {
  const player = gameState.players[socket.id];
  if (!player) return;

  const dbPlayerId = socketToPlayerId.get(socket.id);
  if (!dbPlayerId) return;

  try {
    // Calculate survival time
    const survivalTime = Math.floor((Date.now() - player.survivalTime) / 1000);

    // Update player stats
    await playerRepo.updateStats(dbPlayerId, {
      totalKills: player.zombiesKilled || 0,
      zombiesKilled: player.zombiesKilled || 0,
      highestCombo: player.highestCombo || 0,
      totalXpEarned: player.xp || 0,
      totalGoldEarned: player.gold || 0
    });

    console.log(`[DB] Updated stats for player ${player.nickname}`);
  } catch (error) {
    console.error('[DB] Error updating stats:', error);
  }
});
```

### 2.4 Cleanup on Disconnect

Add to your disconnect handler:

```javascript
socket.on('disconnect', () => {
  // Remove mapping
  socketToPlayerId.delete(socket.id);

  // ... rest of your disconnect logic
});
```

### 2.5 Graceful Shutdown

Add at the end of `server.js`:

```javascript
// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  dbManager.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  dbManager.close();
  process.exit(0);
});
```

## Phase 3: Test the Integration (10 minutes)

### 3.1 Start the Server

```bash
npm start
```

### 3.2 Connect with Multiple Players

1. Open browser: http://localhost:3000
2. Enter nickname: "TestPlayer1"
3. Open another browser/incognito window
4. Enter nickname: "TestPlayer2"
5. Play the game for a bit

### 3.3 Verify Database

```bash
# Install sqlite3 CLI (if not already installed)
# macOS: brew install sqlite3
# Ubuntu: sudo apt-get install sqlite3

# Query the database
sqlite3 data/game.db

# Check players
SELECT * FROM players;

# Check stats
SELECT p.nickname, ps.zombies_killed, ps.total_gold_earned
FROM players p
JOIN player_stats ps ON p.id = ps.player_id;

# Exit
.quit
```

## Phase 4: Advanced Features (Optional)

### 4.1 Session Recovery

Add session tracking for disconnect recovery:

```javascript
const SessionRepository = require('./database/repositories/SessionRepository');
const sessionRepo = new SessionRepository(db);

// In playerJoin handler, after creating/finding player:
const activeSession = await sessionRepo.getActiveSession(dbPlayer.id);
if (activeSession) {
  const sessionAge = Math.floor(Date.now() / 1000) - activeSession.last_heartbeat;
  if (sessionAge < 300) { // 5 minutes
    const savedState = JSON.parse(activeSession.game_state_json);
    // Restore player state
    player.health = savedState.health;
    player.level = savedState.level;
    player.gold = savedState.gold;
    // ... restore other state
    console.log(`[DB] Recovered session for ${nickname}`);
  }
}

// Create new session
const session = await sessionRepo.create({
  sessionUuid: uuidv4(),
  playerId: dbPlayer.id
});

// Auto-save every 30 seconds
const saveInterval = setInterval(async () => {
  const player = gameState.players[socket.id];
  if (player && player.alive) {
    await sessionRepo.saveActiveSession(
      session.id,
      socket.id,
      {
        health: player.health,
        level: player.level,
        gold: player.gold,
        xp: player.xp,
        x: player.x,
        y: player.y
      }
    );
  }
}, 30000);

// Clear on disconnect
socket.on('disconnect', () => {
  clearInterval(saveInterval);
  // ... existing disconnect code
});
```

### 4.2 Leaderboard Integration

```javascript
const LeaderboardRepository = require('./database/repositories/LeaderboardRepository');
const leaderboardRepo = new LeaderboardRepository(db);

// On player death, submit score
socket.on('playerDied', async () => {
  const player = gameState.players[socket.id];
  const dbPlayerId = socketToPlayerId.get(socket.id);

  if (!player || !dbPlayerId) return;

  try {
    // Submit to leaderboard
    await leaderboardRepo.submitScore({
      playerId: dbPlayerId,
      score: player.score || 0,
      leaderboardType: 'all_time',
      levelReached: player.level,
      waveReached: gameState.currentWave,
      zombiesKilled: player.zombiesKilled,
      playTimeSeconds: Math.floor((Date.now() - player.survivalTime) / 1000)
    });

    console.log(`[DB] Submitted score: ${player.score} for ${player.nickname}`);
  } catch (error) {
    console.error('[DB] Error submitting score:', error);
  }
});

// Add endpoint to get leaderboard
socket.on('getLeaderboard', async (type = 'all_time') => {
  try {
    const leaderboard = await leaderboardRepo.getTopScores(type, 100);
    socket.emit('leaderboardData', leaderboard);
  } catch (error) {
    console.error('[DB] Error getting leaderboard:', error);
  }
});
```

### 4.3 Permanent Upgrades (Shop)

```javascript
// Purchase upgrade endpoint
socket.on('purchaseUpgrade', async ({ upgradeType, cost }) => {
  const dbPlayerId = socketToPlayerId.get(socket.id);
  if (!dbPlayerId) return;

  try {
    const success = await playerRepo.purchaseUpgrade(dbPlayerId, upgradeType, cost);

    if (success) {
      socket.emit('purchaseSuccess', { upgradeType });

      // Apply upgrade to current game
      const player = gameState.players[socket.id];
      if (player) {
        switch (upgradeType) {
          case 'max_health':
            player.maxHealth += 10;
            player.health = Math.min(player.health + 10, player.maxHealth);
            break;
          case 'damage':
            player.damageMultiplier += 0.1;
            break;
          case 'speed':
            player.speedMultiplier += 0.05;
            break;
          case 'fire_rate':
            player.fireRateMultiplier += 0.1;
            break;
        }
      }
    } else {
      socket.emit('purchaseFailed', { reason: 'Insufficient gold' });
    }
  } catch (error) {
    console.error('[DB] Purchase error:', error);
    socket.emit('purchaseFailed', { reason: 'Server error' });
  }
});

// Load upgrades on player join
socket.on('playerJoin', async (nickname) => {
  // ... existing code ...

  // Load permanent upgrades
  const upgrades = await playerRepo.getPermanentUpgrades(dbPlayer.id);

  // Apply upgrades to player
  for (const [upgradeType, data] of Object.entries(upgrades)) {
    const level = data.level;
    switch (upgradeType) {
      case 'max_health':
        player.maxHealth += level * 10;
        player.health = player.maxHealth;
        break;
      case 'damage':
        player.damageMultiplier += level * 0.1;
        break;
      case 'speed':
        player.speedMultiplier += level * 0.05;
        break;
      case 'fire_rate':
        player.fireRateMultiplier += level * 0.1;
        break;
    }
  }

  // ... rest of code ...
});
```

## Phase 5: Maintenance & Monitoring

### 5.1 Automatic Backups

Create `scripts/backup-database.js`:

```javascript
const DatabaseManager = require('../database/DatabaseManager');
const dbManager = new DatabaseManager('./data/game.db');

dbManager.connect();

const timestamp = new Date().toISOString().split('T')[0];
const backupPath = `./backups/game_${timestamp}.db`;

dbManager.backup(backupPath);
console.log(`Backup created: ${backupPath}`);

dbManager.close();
```

Add to crontab (daily at 3 AM):
```bash
crontab -e
# Add:
0 3 * * * cd /path/to/game && node scripts/backup-database.js
```

### 5.2 Database Stats Endpoint

```javascript
socket.on('getDbStats', async () => {
  try {
    const stats = dbManager.getStats();
    const playerCount = db.prepare('SELECT COUNT(*) as count FROM players').get();
    const activeToday = db.prepare(`
      SELECT COUNT(DISTINCT player_id) as count
      FROM game_sessions
      WHERE started_at >= strftime('%s', 'now', 'start of day')
    `).get();

    socket.emit('dbStats', {
      databaseSize: stats.sizeMB + ' MB',
      totalPlayers: playerCount.count,
      activeToday: activeToday.count
    });
  } catch (error) {
    console.error('[DB] Error getting stats:', error);
  }
});
```

### 5.3 Database Health Check

Create `scripts/health-check.js`:

```javascript
const DatabaseManager = require('../database/DatabaseManager');

const dbManager = new DatabaseManager('./data/game.db');
dbManager.connect();

const db = dbManager.getDatabase();

// Check integrity
const integrity = db.pragma('integrity_check');
console.log('Integrity check:', integrity);

// Check foreign keys
const fkCheck = db.pragma('foreign_key_check');
console.log('Foreign key check:', fkCheck.length === 0 ? 'OK' : 'ERRORS FOUND');

// Check stats
const stats = dbManager.getStats();
console.log('\nDatabase Stats:');
console.log(`  Size: ${stats.sizeMB} MB`);
console.log(`  Free: ${stats.freeMB} MB`);
console.log(`  Fragmentation: ${((stats.freelistCount / stats.pageCount) * 100).toFixed(2)}%`);

// Check table counts
const tables = ['players', 'player_stats', 'game_sessions', 'leaderboards'];
console.log('\nTable Counts:');
for (const table of tables) {
  const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
  console.log(`  ${table}: ${count.count}`);
}

dbManager.close();
```

Run it:
```bash
node scripts/health-check.js
```

## Troubleshooting

### Issue: "Cannot find module 'better-sqlite3'"

**Solution:**
```bash
npm install better-sqlite3 --save
# If on Linux, you may need build tools:
sudo apt-get install build-essential python3
```

### Issue: "Database is locked"

**Solution:**
- Close any SQLite GUI tools (DB Browser for SQLite, etc.)
- Increase timeout in DatabaseManager options:
```javascript
const dbManager = new DatabaseManager('./data/game.db', {
  timeout: 10000 // 10 seconds
});
```

### Issue: Slow queries

**Solution:**
1. Enable verbose mode to identify slow queries:
```javascript
const dbManager = new DatabaseManager('./data/game.db', {
  verbose: (sql, time) => {
    if (time > 10) console.log(`[SLOW] ${time}ms: ${sql}`);
  }
});
```

2. Run ANALYZE to update query planner statistics:
```bash
sqlite3 data/game.db "ANALYZE;"
```

3. Check missing indexes in `database/schema.sql`

### Issue: Database file growing too large

**Solution:**
1. Archive old data:
```sql
DELETE FROM game_sessions WHERE ended_at < strftime('%s', 'now', '-90 days');
```

2. Vacuum to reclaim space:
```bash
sqlite3 data/game.db "VACUUM;"
```

3. Enable auto-vacuum (requires rebuild):
```sql
PRAGMA auto_vacuum = FULL;
VACUUM;
```

## Performance Tips

1. **Use Prepared Statements**: Always use prepared statements (already done in repositories)

2. **Batch Inserts**: Use transactions for multiple inserts:
```javascript
const insertMany = db.transaction((items) => {
  const stmt = db.prepare('INSERT INTO table VALUES (?, ?)');
  for (const item of items) stmt.run(item.a, item.b);
});
insertMany(arrayOfItems); // All or nothing
```

3. **Index Foreign Keys**: Already done in schema, but verify:
```sql
SELECT name FROM sqlite_master WHERE type='index';
```

4. **Monitor WAL Size**: WAL file should checkpoint regularly:
```javascript
db.pragma('wal_checkpoint(TRUNCATE)'); // Force checkpoint
```

5. **Use Views for Complex Queries**: Already created in schema (v_current_leaderboard, v_player_profiles)

## Next Steps

1. **Implement Achievement System**: Use `AchievementRepository` (to be created)
2. **Add Daily Challenges**: Use `DailyChallengeRepository` (to be created)
3. **Analytics Dashboard**: Query analytics_events table
4. **Admin Panel**: Create web interface for database management
5. **API Endpoints**: Expose REST API for mobile app integration

## Support

For issues or questions:
- Check `database/README.md` for detailed documentation
- Review `database/queries.md` for SQL query examples
- Examine `database/example_integration.js` for advanced patterns