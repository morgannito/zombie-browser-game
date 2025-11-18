# Common Database Queries

Reference guide for frequently used database queries in the zombie multiplayer game.

## Player Queries

### Get Player Profile with Stats
```sql
SELECT
    p.id,
    p.nickname,
    p.created_at,
    p.last_login_at,
    ps.total_kills,
    ps.zombies_killed,
    ps.boss_kills,
    ps.highest_level,
    ps.highest_wave,
    ps.highest_combo,
    ps.games_played,
    ps.total_playtime_seconds,
    COUNT(DISTINCT pa.achievement_id) as achievements_count,
    (ps.total_gold_earned - ps.total_gold_spent) as available_gold
FROM players p
LEFT JOIN player_stats ps ON p.id = ps.player_id
LEFT JOIN player_achievements pa ON p.id = pa.player_id
WHERE p.id = ?
GROUP BY p.id;
```

### Get Top Players by Kill Count
```sql
SELECT
    p.nickname,
    ps.zombies_killed,
    ps.highest_level,
    ps.highest_wave,
    ps.games_played
FROM players p
JOIN player_stats ps ON p.id = ps.player_id
ORDER BY ps.zombies_killed DESC
LIMIT 10;
```

### Get Most Active Players (Last 7 Days)
```sql
SELECT
    p.nickname,
    COUNT(gs.id) as games_played_week,
    SUM(gs.zombies_killed) as zombies_killed_week,
    MAX(gs.final_score) as best_score_week
FROM players p
JOIN game_sessions gs ON p.id = gs.player_id
WHERE gs.started_at >= strftime('%s', 'now', '-7 days')
GROUP BY p.id
ORDER BY games_played_week DESC
LIMIT 20;
```

### Get Player Weapon Preferences
```sql
SELECT
    w.weapon_id,
    w.times_used,
    w.kills,
    w.damage_dealt,
    ROUND(w.shots_hit * 100.0 / NULLIF(w.shots_fired, 0), 2) as accuracy_percent
FROM weapon_stats w
WHERE w.player_id = ?
ORDER BY w.times_used DESC;
```

## Leaderboard Queries

### All-Time Leaderboard
```sql
SELECT
    p.nickname,
    l.score,
    l.level_reached,
    l.wave_reached,
    l.zombies_killed,
    l.submitted_at,
    RANK() OVER (ORDER BY l.score DESC) as rank
FROM leaderboards l
JOIN players p ON l.player_id = p.id
WHERE l.leaderboard_type = 'all_time'
ORDER BY l.score DESC
LIMIT 100;
```

### Daily Leaderboard (Today)
```sql
SELECT
    p.nickname,
    l.score,
    l.level_reached,
    l.wave_reached,
    RANK() OVER (ORDER BY l.score DESC) as rank
FROM leaderboards l
JOIN players p ON l.player_id = p.id
WHERE l.leaderboard_type = 'daily'
    AND l.period_start = strftime('%s', 'now', 'start of day')
ORDER BY l.score DESC
LIMIT 100;
```

### Player Rank and Surrounding Players
```sql
WITH ranked_leaderboard AS (
    SELECT
        l.player_id,
        p.nickname,
        l.score,
        l.level_reached,
        l.wave_reached,
        RANK() OVER (ORDER BY l.score DESC) as rank
    FROM leaderboards l
    JOIN players p ON l.player_id = p.id
    WHERE l.leaderboard_type = 'all_time'
),
player_rank AS (
    SELECT rank FROM ranked_leaderboard WHERE player_id = ?
)
SELECT *
FROM ranked_leaderboard
WHERE rank BETWEEN (SELECT rank FROM player_rank) - 5
    AND (SELECT rank FROM player_rank) + 5
ORDER BY rank;
```

### Score Progression Over Time
```sql
SELECT
    DATE(gs.started_at, 'unixepoch') as game_date,
    MAX(gs.final_score) as best_score,
    AVG(gs.final_score) as avg_score,
    COUNT(*) as games_played
FROM game_sessions gs
WHERE gs.player_id = ?
    AND gs.ended_at IS NOT NULL
GROUP BY game_date
ORDER BY game_date DESC
LIMIT 30;
```

## Session Queries

### Get Recent Sessions
```sql
SELECT
    gs.session_uuid,
    gs.started_at,
    gs.ended_at,
    gs.duration_seconds,
    gs.end_reason,
    gs.final_level,
    gs.final_wave,
    gs.final_score,
    gs.zombies_killed,
    gs.highest_combo
FROM game_sessions gs
WHERE gs.player_id = ?
    AND gs.ended_at IS NOT NULL
ORDER BY gs.started_at DESC
LIMIT 10;
```

### Average Session Duration
```sql
SELECT
    AVG(duration_seconds) as avg_duration_seconds,
    AVG(duration_seconds) / 60.0 as avg_duration_minutes,
    MIN(duration_seconds) as shortest_session,
    MAX(duration_seconds) as longest_session
FROM game_sessions
WHERE player_id = ?
    AND ended_at IS NOT NULL;
```

### Session Performance Metrics
```sql
SELECT
    COUNT(*) as total_sessions,
    SUM(CASE WHEN end_reason = 'death' THEN 1 ELSE 0 END) as deaths,
    SUM(CASE WHEN end_reason = 'disconnect' THEN 1 ELSE 0 END) as disconnects,
    AVG(final_wave) as avg_wave_reached,
    AVG(final_level) as avg_level_reached,
    AVG(zombies_killed) as avg_zombies_per_session
FROM game_sessions
WHERE player_id = ?
    AND ended_at IS NOT NULL;
```

### Get Active Sessions (for cleanup)
```sql
SELECT
    as_tbl.session_id,
    as_tbl.player_id,
    p.nickname,
    as_tbl.last_heartbeat,
    strftime('%s', 'now') - as_tbl.last_heartbeat as seconds_since_heartbeat
FROM active_sessions as_tbl
JOIN players p ON as_tbl.player_id = p.player_id
WHERE strftime('%s', 'now') - as_tbl.last_heartbeat > 300 -- 5 minutes
ORDER BY as_tbl.last_heartbeat;
```

## Achievement Queries

### Player Achievement Progress
```sql
SELECT
    a.id,
    a.name,
    a.description,
    a.category,
    a.tier,
    a.points,
    a.requirement_json,
    CASE
        WHEN pa.player_id IS NOT NULL THEN 1
        ELSE 0
    END as unlocked,
    pa.unlocked_at,
    pa.progress
FROM achievements a
LEFT JOIN player_achievements pa ON a.id = pa.achievement_id
    AND pa.player_id = ?
ORDER BY a.category, a.sort_order;
```

### Recently Unlocked Achievements
```sql
SELECT
    p.nickname,
    a.name,
    a.tier,
    a.points,
    pa.unlocked_at
FROM player_achievements pa
JOIN players p ON pa.player_id = p.id
JOIN achievements a ON pa.achievement_id = a.id
WHERE pa.unlocked_at >= strftime('%s', 'now', '-7 days')
ORDER BY pa.unlocked_at DESC
LIMIT 50;
```

### Achievement Completion Rate
```sql
SELECT
    a.id,
    a.name,
    a.tier,
    COUNT(pa.player_id) as unlock_count,
    (SELECT COUNT(*) FROM players) as total_players,
    ROUND(COUNT(pa.player_id) * 100.0 / (SELECT COUNT(*) FROM players), 2) as unlock_percent
FROM achievements a
LEFT JOIN player_achievements pa ON a.id = pa.achievement_id
GROUP BY a.id
ORDER BY unlock_percent DESC;
```

### Rarest Achievements
```sql
SELECT
    a.name,
    a.tier,
    a.points,
    COUNT(pa.player_id) as unlock_count,
    ROUND(COUNT(pa.player_id) * 100.0 / (SELECT COUNT(*) FROM players), 2) as unlock_percent
FROM achievements a
LEFT JOIN player_achievements pa ON a.id = pa.achievement_id
GROUP BY a.id
HAVING unlock_percent < 10 -- Less than 10% of players
ORDER BY unlock_percent ASC
LIMIT 10;
```

## Analytics Queries

### Player Retention by Cohort
```sql
SELECT
    DATE(p.created_at, 'unixepoch', 'start of day') as signup_date,
    COUNT(DISTINCT p.id) as signups,
    COUNT(DISTINCT CASE
        WHEN EXISTS (
            SELECT 1 FROM game_sessions gs
            WHERE gs.player_id = p.id
                AND gs.started_at >= p.created_at + 86400 -- Next day
                AND gs.started_at < p.created_at + 172800 -- Within 2 days
        ) THEN p.id
    END) as day1_retention,
    COUNT(DISTINCT CASE
        WHEN EXISTS (
            SELECT 1 FROM game_sessions gs
            WHERE gs.player_id = p.id
                AND gs.started_at >= p.created_at + 604800 -- 7 days later
        ) THEN p.id
    END) as day7_retention
FROM players p
WHERE p.created_at >= strftime('%s', 'now', '-30 days')
GROUP BY signup_date
ORDER BY signup_date DESC;
```

### Daily Active Users (DAU)
```sql
SELECT
    DATE(gs.started_at, 'unixepoch') as game_date,
    COUNT(DISTINCT gs.player_id) as active_players,
    COUNT(DISTINCT gs.id) as total_sessions,
    SUM(gs.zombies_killed) as total_zombies_killed
FROM game_sessions gs
WHERE gs.started_at >= strftime('%s', 'now', '-30 days')
GROUP BY game_date
ORDER BY game_date DESC;
```

### Average Revenue per User (ARPU) - Gold Spent
```sql
SELECT
    AVG(ps.total_gold_spent) as avg_gold_spent,
    PERCENTILE(ps.total_gold_spent, 50) as median_gold_spent,
    PERCENTILE(ps.total_gold_spent, 90) as p90_gold_spent
FROM player_stats ps
WHERE EXISTS (
    SELECT 1 FROM game_sessions gs
    WHERE gs.player_id = ps.player_id
        AND gs.started_at >= strftime('%s', 'now', '-30 days')
);
```

### Upgrade Purchase Distribution
```sql
SELECT
    pu.upgrade_type,
    COUNT(DISTINCT pu.player_id) as buyers,
    AVG(pu.upgrade_level) as avg_level,
    SUM(pu.total_invested) as total_gold_invested,
    AVG(pu.total_invested) as avg_gold_per_player
FROM permanent_upgrades pu
GROUP BY pu.upgrade_type
ORDER BY buyers DESC;
```

### Player Progression Funnel
```sql
SELECT
    'Level 1' as milestone,
    COUNT(DISTINCT ps.player_id) as players
FROM player_stats ps
WHERE ps.highest_level >= 1
UNION ALL
SELECT
    'Level 5' as milestone,
    COUNT(DISTINCT ps.player_id) as players
FROM player_stats ps
WHERE ps.highest_level >= 5
UNION ALL
SELECT
    'Level 10' as milestone,
    COUNT(DISTINCT ps.player_id) as players
FROM player_stats ps
WHERE ps.highest_level >= 10
UNION ALL
SELECT
    'Level 25' as milestone,
    COUNT(DISTINCT ps.player_id) as players
FROM player_stats ps
WHERE ps.highest_level >= 25
UNION ALL
SELECT
    'Level 50' as milestone,
    COUNT(DISTINCT ps.player_id) as players
FROM player_stats ps
WHERE ps.highest_level >= 50;
```

### Churn Analysis
```sql
SELECT
    CASE
        WHEN p.last_login_at >= strftime('%s', 'now', '-1 day') THEN 'Active (< 1 day)'
        WHEN p.last_login_at >= strftime('%s', 'now', '-7 days') THEN 'Recent (< 7 days)'
        WHEN p.last_login_at >= strftime('%s', 'now', '-30 days') THEN 'Inactive (< 30 days)'
        ELSE 'Churned (> 30 days)'
    END as status,
    COUNT(*) as player_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM players), 2) as percentage
FROM players p
GROUP BY status
ORDER BY
    CASE status
        WHEN 'Active (< 1 day)' THEN 1
        WHEN 'Recent (< 7 days)' THEN 2
        WHEN 'Inactive (< 30 days)' THEN 3
        ELSE 4
    END;
```

## Maintenance Queries

### Cleanup Old Sessions
```sql
DELETE FROM game_sessions
WHERE ended_at < strftime('%s', 'now', '-90 days'); -- Older than 90 days
```

### Cleanup Stale Active Sessions
```sql
DELETE FROM active_sessions
WHERE last_heartbeat < strftime('%s', 'now', '-300'); -- 5 minutes ago
```

### Archive Old Leaderboards
```sql
-- Copy to archive table first
INSERT INTO leaderboards_archive
SELECT * FROM leaderboards
WHERE leaderboard_type = 'daily'
    AND period_start < strftime('%s', 'now', '-90 days');

-- Then delete
DELETE FROM leaderboards
WHERE leaderboard_type = 'daily'
    AND period_start < strftime('%s', 'now', '-90 days');
```

### Find Database Bloat
```sql
PRAGMA page_count;
PRAGMA page_size;
PRAGMA freelist_count;

-- Calculate fragmentation
SELECT
    (freelist_count * page_size) / 1024.0 / 1024.0 as free_mb,
    ((page_count - freelist_count) * page_size) / 1024.0 / 1024.0 as used_mb,
    ROUND((freelist_count * 100.0 / page_count), 2) as fragmentation_percent
FROM (
    SELECT
        (SELECT * FROM pragma_page_count) as page_count,
        (SELECT * FROM pragma_page_size) as page_size,
        (SELECT * FROM pragma_freelist_count) as freelist_count
);
```

### Table Sizes
```sql
SELECT
    name,
    SUM("pgsize") / 1024.0 / 1024.0 as size_mb
FROM "dbstat"
WHERE name NOT LIKE 'sqlite_%'
GROUP BY name
ORDER BY size_mb DESC;
```

## Performance Queries

### Slowest Queries (with query log enabled)
```sql
-- This requires enabling query profiling
-- In better-sqlite3:
-- db.profile((sql, time) => { if (time > 10) log(sql, time); });
```

### Index Usage Statistics
```sql
SELECT
    name,
    tbl_name,
    rootpage
FROM sqlite_master
WHERE type = 'index'
    AND tbl_name NOT LIKE 'sqlite_%'
ORDER BY tbl_name, name;
```

### Analyze Tables
```sql
ANALYZE;

-- Check statistics
SELECT * FROM sqlite_stat1 ORDER BY tbl;
```

## Backup and Recovery

### Create Backup
```sql
VACUUM INTO '/path/to/backup.db';
```

### Check Database Integrity
```sql
PRAGMA integrity_check;
PRAGMA foreign_key_check;
```

### Optimize Database
```sql
PRAGMA optimize;
VACUUM;
ANALYZE;
```