-- ================================================================================================
-- ACCOUNT PROGRESSION MIGRATION
-- Adds meta-progression system (account levels, prestige, skill tree)
-- Version: 2.0.0
-- ================================================================================================

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- ================================================================================================
-- ACCOUNT_PROGRESSION TABLE - Meta progression that persists across runs
-- ================================================================================================
CREATE TABLE IF NOT EXISTS account_progression (
    player_id TEXT PRIMARY KEY,

    -- Account leveling
    account_level INTEGER DEFAULT 1 NOT NULL,
    account_xp INTEGER DEFAULT 0 NOT NULL,
    total_xp_earned INTEGER DEFAULT 0 NOT NULL,
    skill_points INTEGER DEFAULT 0 NOT NULL,

    -- Prestige system
    prestige_level INTEGER DEFAULT 0 NOT NULL,
    prestige_tokens INTEGER DEFAULT 0 NOT NULL,

    -- Unlocked skills (JSON array)
    unlocked_skills TEXT DEFAULT '[]',

    -- Metadata
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    last_updated INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE INDEX idx_account_progression_level ON account_progression(account_level DESC);
CREATE INDEX idx_account_progression_prestige ON account_progression(prestige_level DESC);

-- ================================================================================================
-- SKILL_TREE TABLE - Available skills for unlocking
-- ================================================================================================
CREATE TABLE IF NOT EXISTS skill_tree (
    skill_id TEXT PRIMARY KEY,
    skill_name TEXT NOT NULL,
    skill_description TEXT NOT NULL,
    skill_category TEXT NOT NULL,              -- 'damage', 'defense', 'utility', 'economic'
    tier INTEGER DEFAULT 1,                     -- 1-5 (higher tier = more powerful)
    skill_cost INTEGER DEFAULT 1,               -- Skill points required
    max_rank INTEGER DEFAULT 1,                 -- Max times this skill can be upgraded
    icon_emoji TEXT,                            -- Emoji icon
    prerequisite_skills TEXT,                   -- JSON array of required skill IDs
    effects_json TEXT NOT NULL,                 -- JSON: { damageBonus: 0.1, healthBonus: 20 }
    sort_order INTEGER DEFAULT 0
);

-- ================================================================================================
-- INSERT DEFAULT SKILL TREE
-- ================================================================================================

-- Tier 1 - Basic Skills (cost: 1 point)
INSERT OR IGNORE INTO skill_tree VALUES
('damage_boost_1', 'Damage Boost I', '+10% weapon damage', 'damage', 1, 1, 5, '⚔️', '[]', '{"damageMultiplier": 0.1}', 1),
('health_boost_1', 'Health Boost I', '+20 max health', 'defense', 1, 1, 5, '❤️', '[]', '{"maxHealthBonus": 20}', 2),
('speed_boost_1', 'Speed Boost I', '+10% movement speed', 'utility', 1, 1, 5, '⚡', '[]', '{"speedMultiplier": 0.1}', 3),
('gold_magnet_1', 'Gold Magnet I', '+20% gold collection radius', 'economic', 1, 1, 5, '💰', '[]', '{"goldRadiusMultiplier": 0.2}', 4);

-- Tier 2 - Intermediate Skills (cost: 2 points)
INSERT OR IGNORE INTO skill_tree VALUES
('damage_boost_2', 'Damage Boost II', '+15% weapon damage', 'damage', 2, 2, 5, '⚔️', '["damage_boost_1"]', '{"damageMultiplier": 0.15}', 10),
('fire_rate_1', 'Rapid Fire', '-15% weapon cooldown', 'damage', 2, 2, 5, '🔥', '["damage_boost_1"]', '{"fireRateMultiplier": -0.15}', 11),
('health_regen_1', 'Regeneration', '+2 HP/sec regeneration', 'defense', 2, 2, 3, '💚', '["health_boost_1"]', '{"regeneration": 2}', 12),
('dodge_chance_1', 'Dodge', '10% chance to dodge attacks', 'defense', 2, 2, 3, '🌀', '["speed_boost_1"]', '{"dodgeChance": 0.1}', 13),
('xp_boost_1', 'XP Boost', '+25% XP gain', 'economic', 2, 2, 3, '⭐', '["gold_magnet_1"]', '{"xpMultiplier": 0.25}', 14);

-- Tier 3 - Advanced Skills (cost: 3 points)
INSERT OR IGNORE INTO skill_tree VALUES
('critical_hit_1', 'Critical Strike', '15% crit chance, 2x damage', 'damage', 3, 3, 3, '💥', '["damage_boost_2"]', '{"critChance": 0.15, "critMultiplier": 2.0}', 20),
('piercing_1', 'Piercing Shots', 'Bullets pierce 1 enemy', 'damage', 3, 3, 3, '🎯', '["fire_rate_1"]', '{"piercing": 1}', 21),
('life_steal_1', 'Life Steal', 'Steal 10% of damage dealt as health', 'defense', 3, 3, 3, '🩸', '["health_regen_1"]', '{"lifeSteal": 0.1}', 22),
('thorns_1', 'Thorns', 'Reflect 20% damage to attackers', 'defense', 3, 3, 3, '🛡️', '["health_boost_1"]', '{"thornsDamage": 0.2}', 23),
('starting_gold_1', 'Inheritance', 'Start runs with +200 gold', 'economic', 3, 3, 5, '💎', '["gold_magnet_1"]', '{"startingGold": 200}', 24);

-- Tier 4 - Expert Skills (cost: 4 points)
INSERT OR IGNORE INTO skill_tree VALUES
('explosive_rounds_1', 'Explosive Rounds', 'Bullets explode on impact (100px radius)', 'damage', 4, 4, 1, '💣', '["critical_hit_1"]', '{"explosiveRounds": true, "explosionRadius": 100}', 30),
('multishot_1', 'Multi-Shot', 'Fire 2 bullets per shot', 'damage', 4, 4, 2, '🌟', '["piercing_1"]', '{"multishotCount": 2}', 31),
('damage_immunity_1', 'Iron Skin', 'Immune to damage for 2s after hit (15s cooldown)', 'defense', 4, 4, 1, '🏰', '["thorns_1", "life_steal_1"]', '{"damageImmunity": true, "immunityCooldown": 15000}', 32),
('run_saver_1', 'Second Chance', 'Revive once per run with 50% HP', 'defense', 4, 4, 1, '👼', '["life_steal_1"]', '{"secondChance": true}', 33),
('lucky_1', 'Lucky', '+50% better upgrade rarities', 'economic', 4, 4, 1, '🍀', '["xp_boost_1"]', '{"rarityBonus": 0.5}', 34);

-- Tier 5 - Master Skills (cost: 5 points)
INSERT OR IGNORE INTO skill_tree VALUES
('god_mode_1', 'Berserker Rage', '+50% damage, +30% speed when below 30% HP', 'damage', 5, 5, 1, '😈', '["explosive_rounds_1", "multishot_1"]', '{"berserkerDamage": 0.5, "berserkerSpeed": 0.3, "berserkerThreshold": 0.3}', 40),
('auto_turrets_1', 'Auto Turrets', '+1 automatic turret that shoots nearby enemies', 'damage', 5, 5, 3, '🔫', '["multishot_1"]', '{"autoTurrets": 1}', 41),
('shield_1', 'Energy Shield', '+100 shield (regenerates out of combat)', 'defense', 5, 5, 1, '🛡️', '["damage_immunity_1"]', '{"maxShield": 100, "shieldRegen": 5}', 42),
('treasure_hunter_1', 'Treasure Hunter', '+100% gold drops, better loot quality', 'economic', 5, 5, 1, '🏆', '["lucky_1", "starting_gold_1"]', '{"goldMultiplier": 1.0, "lootQuality": 0.5}', 43);

-- ================================================================================================
-- TRIGGER - Initialize account progression when player is created
-- ================================================================================================
CREATE TRIGGER IF NOT EXISTS tr_init_account_progression
AFTER INSERT ON players
BEGIN
    INSERT INTO account_progression (player_id)
    VALUES (NEW.player_uuid);
END;

-- ================================================================================================
-- VIEW - Player with progression stats
-- ================================================================================================
CREATE VIEW IF NOT EXISTS v_player_with_progression AS
SELECT
    p.id,
    p.nickname,
    ps.total_kills,
    ps.highest_level,
    ps.highest_wave,
    ap.account_level,
    ap.account_xp,
    ap.prestige_level,
    ap.skill_points,
    ap.unlocked_skills
FROM players p
LEFT JOIN player_stats ps ON p.id = ps.player_id
LEFT JOIN account_progression ap ON p.player_uuid = ap.player_id;

-- ================================================================================================
-- INDEXES FOR PERFORMANCE
-- ================================================================================================
CREATE INDEX IF NOT EXISTS idx_skill_tree_category ON skill_tree(skill_category, tier);
CREATE INDEX IF NOT EXISTS idx_skill_tree_tier ON skill_tree(tier);

-- ================================================================================================
-- MIGRATION COMPLETE
-- ================================================================================================
