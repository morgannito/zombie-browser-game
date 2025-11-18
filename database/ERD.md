# Entity Relationship Diagram (ERD)

## Database Schema Visualization

```mermaid
erDiagram
    players ||--o| player_stats : "has"
    players ||--o{ player_unlocks : "has"
    players ||--o{ permanent_upgrades : "has"
    players ||--o{ game_sessions : "plays"
    players ||--o{ active_sessions : "has active"
    players ||--o{ leaderboards : "submits to"
    players ||--o{ player_achievements : "unlocks"
    players ||--o{ player_daily_challenges : "completes"
    players ||--o{ weapon_stats : "tracks"
    players ||--o{ analytics_events : "generates"
    players ||--o{ chat_logs : "sends"

    game_sessions ||--o| active_sessions : "is active"
    game_sessions ||--o{ leaderboards : "creates"
    game_sessions ||--o{ player_achievements : "unlocks in"
    game_sessions ||--o{ analytics_events : "tracks"
    game_sessions ||--o{ chat_logs : "contains"

    achievements ||--o{ player_achievements : "unlocked by"
    daily_challenges ||--o{ player_daily_challenges : "completed by"

    players {
        INTEGER id PK
        TEXT player_uuid UK
        TEXT nickname UK
        TEXT password_hash
        TEXT email UK
        INTEGER created_at
        INTEGER last_login_at
        BOOLEAN is_banned
        TEXT ban_reason
        INTEGER ban_expires_at
        TEXT settings_json
    }

    player_stats {
        INTEGER player_id PK,FK
        INTEGER total_kills
        INTEGER total_deaths
        INTEGER zombies_killed
        INTEGER boss_kills
        INTEGER highest_combo
        INTEGER total_damage_dealt
        INTEGER total_damage_taken
        INTEGER shots_fired
        INTEGER shots_hit
        INTEGER headshots
        INTEGER total_xp_earned
        INTEGER highest_level
        INTEGER total_gold_earned
        INTEGER total_gold_spent
        INTEGER total_playtime_seconds
        INTEGER longest_survival_seconds
        INTEGER highest_wave
        INTEGER games_played
        INTEGER games_won
        INTEGER achievements_unlocked
        INTEGER total_achievement_points
        INTEGER first_game_at
        INTEGER last_game_at
        TEXT favorite_weapon
    }

    permanent_upgrades {
        INTEGER player_id PK,FK
        TEXT upgrade_type PK
        INTEGER upgrade_level
        INTEGER total_invested
    }

    player_unlocks {
        INTEGER id PK
        INTEGER player_id FK
        TEXT unlock_type
        TEXT unlock_id
        INTEGER unlock_tier
        INTEGER purchased_at
        INTEGER purchase_price
        BOOLEAN equipped
    }

    game_sessions {
        INTEGER id PK
        TEXT session_uuid UK
        INTEGER player_id FK
        INTEGER started_at
        INTEGER ended_at
        INTEGER duration_seconds
        TEXT end_reason
        INTEGER final_level
        INTEGER final_wave
        INTEGER final_score
        INTEGER final_gold
        INTEGER final_xp
        INTEGER zombies_killed
        INTEGER highest_combo
        REAL avg_fps
        INTEGER avg_ping
        INTEGER disconnect_count
        TEXT client_version
        TEXT client_platform
        TEXT ip_country
    }

    active_sessions {
        INTEGER session_id PK,FK
        INTEGER player_id FK
        TEXT socket_id
        TEXT game_state_json
        INTEGER last_heartbeat
        INTEGER started_at
        TEXT room_id
    }

    leaderboards {
        INTEGER id PK
        INTEGER player_id FK
        TEXT leaderboard_type
        INTEGER period_start
        INTEGER period_end
        INTEGER score
        INTEGER rank
        INTEGER level_reached
        INTEGER wave_reached
        INTEGER zombies_killed
        INTEGER play_time_seconds
        INTEGER submitted_at
        INTEGER session_id FK
    }

    achievements {
        TEXT id PK
        TEXT category
        TEXT name
        TEXT description
        TEXT icon_url
        INTEGER points
        TEXT tier
        TEXT requirement_json
        BOOLEAN hidden
        INTEGER sort_order
    }

    player_achievements {
        INTEGER player_id PK,FK
        TEXT achievement_id PK,FK
        INTEGER unlocked_at
        INTEGER progress
        INTEGER session_id FK
    }

    daily_challenges {
        INTEGER id PK
        INTEGER challenge_date UK
        TEXT challenge_type
        TEXT requirement_json
        TEXT reward_type
        INTEGER reward_value
        BOOLEAN active
    }

    player_daily_challenges {
        INTEGER player_id PK,FK
        INTEGER challenge_id PK,FK
        INTEGER progress
        BOOLEAN completed
        INTEGER completed_at
        BOOLEAN reward_claimed
    }

    weapon_stats {
        INTEGER player_id PK,FK
        TEXT weapon_id PK
        INTEGER times_used
        INTEGER shots_fired
        INTEGER shots_hit
        INTEGER headshots
        INTEGER kills
        INTEGER damage_dealt
        INTEGER favorite_rank
    }

    analytics_events {
        INTEGER id PK
        TEXT event_type
        INTEGER player_id FK
        INTEGER session_id FK
        TEXT event_data_json
        INTEGER created_at
    }

    player_relationships {
        INTEGER player_id PK,FK
        INTEGER target_player_id PK,FK
        TEXT relationship_type PK
        INTEGER created_at
    }

    chat_logs {
        INTEGER id PK
        INTEGER player_id FK
        INTEGER session_id FK
        TEXT message
        TEXT channel
        INTEGER recipient_id FK
        INTEGER created_at
        BOOLEAN flagged
    }
```

## Key Relationships

### Core Player Data
- **players → player_stats**: 1:1 relationship
  - Each player has exactly one stats record
  - Created automatically via trigger on player creation

### Game Sessions
- **players → game_sessions**: 1:N relationship
  - One player can have many game sessions over time
  - Tracks historical gameplay data

- **game_sessions → active_sessions**: 1:0..1 relationship
  - A session can have at most one active state
  - Used for disconnect recovery
  - Automatically cleaned up when session ends

### Progression Systems
- **players → permanent_upgrades**: 1:N relationship
  - Tracks shop purchases that persist across games
  - Composite primary key (player_id, upgrade_type)

- **players → player_unlocks**: 1:N relationship
  - Weapons, skins, characters unlocked by player
  - Tracks purchase price and equipped status

### Leaderboards
- **players → leaderboards**: 1:N relationship
  - One entry per leaderboard type per period
  - Supports daily, weekly, monthly, all-time rankings
  - Composite index for fast queries

### Achievements
- **achievements → player_achievements**: N:M relationship
  - Many-to-many through junction table
  - Tracks unlock timestamp and progress
  - Linked to session that unlocked it

### Daily Challenges
- **daily_challenges → player_daily_challenges**: N:M relationship
  - Many-to-many through junction table
  - Tracks progress and completion status
  - Rewards claimed separately

## Indexes for Performance

### Primary Indexes (Automatic)
- All primary keys (PK)
- All unique constraints (UK)

### Secondary Indexes (Explicit)
```sql
-- Player lookups
CREATE INDEX idx_players_nickname ON players(nickname);
CREATE INDEX idx_players_uuid ON players(player_uuid);
CREATE INDEX idx_players_last_login ON players(last_login_at);

-- Stats queries
CREATE INDEX idx_player_stats_kills ON player_stats(total_kills);
CREATE INDEX idx_player_stats_level ON player_stats(highest_level);

-- Session tracking
CREATE INDEX idx_sessions_player ON game_sessions(player_id);
CREATE INDEX idx_sessions_started ON game_sessions(started_at);
CREATE INDEX idx_sessions_score ON game_sessions(final_score);

-- Active session recovery
CREATE INDEX idx_active_sessions_player ON active_sessions(player_id);
CREATE INDEX idx_active_sessions_heartbeat ON active_sessions(last_heartbeat);

-- Leaderboard queries (composite index)
CREATE INDEX idx_leaderboards_type_period_score
  ON leaderboards(leaderboard_type, period_start, score DESC);

-- Analytics
CREATE INDEX idx_analytics_type_time ON analytics_events(event_type, created_at);
CREATE INDEX idx_analytics_player ON analytics_events(player_id);
```

## Data Flow

### Player Registration Flow
```
1. Player connects → Socket ID
2. Check nickname in players table
3. If not exists:
   - INSERT INTO players
   - Trigger creates player_stats record
4. If exists:
   - UPDATE last_login_at
   - Load player_stats
   - Load permanent_upgrades
5. Map socket_id → player_id
```

### Game Session Flow
```
1. Player joins game
2. INSERT INTO game_sessions (started_at)
3. During gameplay:
   - Every 30s: UPSERT active_sessions (heartbeat)
   - Save game_state_json for recovery
4. On death/disconnect:
   - UPDATE game_sessions SET ended_at
   - Trigger updates player_stats automatically
   - INSERT INTO leaderboards
5. active_sessions cleaned up automatically
```

### Disconnect Recovery Flow
```
1. Player disconnects (connection lost)
2. active_sessions remains for 5 minutes
3. Player reconnects within 5 minutes:
   - SELECT FROM active_sessions WHERE player_id
   - Parse game_state_json
   - Restore player position, HP, level, gold, etc.
4. If > 5 minutes:
   - active_sessions cleaned up
   - Start fresh game
```

### Leaderboard Update Flow
```
1. Game session ends
2. Calculate final score
3. INSERT INTO leaderboards
   - One entry per leaderboard_type
   - Period_start determines time window
4. Periodically (hourly):
   - Recalculate ranks
   - UPDATE leaderboards SET rank
5. Client queries:
   - Fast lookup via composite index
   - RANK() window function for live ranking
```

## Storage Estimates

### Per Player (Typical)
- players: ~200 bytes
- player_stats: ~150 bytes
- permanent_upgrades: ~50 bytes × upgrades
- player_unlocks: ~50 bytes × unlocks
- player_achievements: ~30 bytes × achievements
- **Total: ~500-1000 bytes per player**

### Per Game Session
- game_sessions: ~150 bytes
- active_sessions: ~2000 bytes (game state JSON)
- leaderboards: ~100 bytes × 4 (daily/weekly/monthly/all-time)
- analytics_events: ~100 bytes × events
- **Total: ~500-5000 bytes per session**

### Capacity Estimates
- **1,000 players**: ~1 MB player data
- **10,000 players**: ~10 MB player data
- **100,000 sessions**: ~50-500 MB session data
- **1M leaderboard entries**: ~100 MB

**SQLite can handle databases up to 281 TB, so capacity is not a concern for most games.**

## Query Performance (With Indexes)

| Query Type | Rows | Expected Time |
|------------|------|---------------|
| Player by ID | 1 | <0.1ms |
| Player by nickname | 1 | <0.5ms |
| Player profile (with joins) | 1 | <1ms |
| Top 100 leaderboard | 100 | <2ms |
| Player sessions (last 10) | 10 | <1ms |
| Active session lookup | 1 | <0.5ms |
| Achievement progress | 50 | <2ms |
| Stats update | 1 | <1ms |

All queries use prepared statements and are optimized with proper indexes.

## Backup Strategy

### Automatic Backups
- **Daily**: Full database backup at 3 AM
- **Weekly**: Vacuum and optimize (Sunday 4 AM)
- **Retention**: Keep last 30 days of daily backups

### Backup Locations
```
./backups/
  ├── game_2024-01-01.db
  ├── game_2024-01-02.db
  └── game_2024-01-03.db
```

### Recovery Process
```bash
# Stop server
systemctl stop game-server

# Restore from backup
cp ./backups/game_2024-01-01.db ./data/game.db

# Verify integrity
sqlite3 data/game.db "PRAGMA integrity_check;"

# Restart server
systemctl start game-server
```

## Security Considerations

### SQL Injection Prevention
- **All queries use prepared statements** (parameterized queries)
- No dynamic SQL construction
- User input never directly interpolated

### Access Control
- **Row-level security**: Players can only access their own data
- **Ban system**: is_banned flag with expiration support
- **Chat moderation**: flagged column for content review

### Data Privacy
- **Password hashing**: Use bcrypt (not stored in plain text)
- **Email optional**: Not required for gameplay
- **GDPR compliance**: Easy to delete player data:
```sql
-- Delete all player data (cascades automatically)
DELETE FROM players WHERE id = ?;
```

### Audit Trail
- **analytics_events**: Tracks all significant actions
- **chat_logs**: Full chat history for moderation
- **game_sessions**: Complete gameplay history

## Maintenance Tasks

### Daily
- [x] Backup database (automatic)
- [x] Cleanup stale active_sessions (automatic)

### Weekly
- [x] VACUUM (reclaim space)
- [x] ANALYZE (update statistics)
- [ ] Review slow query log

### Monthly
- [ ] Archive old game_sessions (>90 days)
- [ ] Archive old leaderboards (>90 days)
- [ ] Review database growth
- [ ] Check fragmentation

### As Needed
- [ ] Add indexes for new query patterns
- [ ] Optimize slow queries
- [ ] Scale to PostgreSQL (if >10k concurrent users)