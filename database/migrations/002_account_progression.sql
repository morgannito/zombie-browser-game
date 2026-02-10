-- ================================================================================================
-- MIGRATION 002: Account Progression + Skill Tree + Achievement Tables
-- Description: Add persistent account progression structures used by runtime.
-- ================================================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS account_progression (
  player_id TEXT PRIMARY KEY,
  account_level INTEGER DEFAULT 1,
  account_xp INTEGER DEFAULT 0,
  total_xp_earned INTEGER DEFAULT 0,
  skill_points INTEGER DEFAULT 0,
  prestige_level INTEGER DEFAULT 0,
  prestige_tokens INTEGER DEFAULT 0,
  unlocked_skills TEXT DEFAULT '[]',
  last_updated INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_progression_level ON account_progression(account_level DESC);
CREATE INDEX IF NOT EXISTS idx_progression_prestige ON account_progression(prestige_level DESC);

CREATE TABLE IF NOT EXISTS skill_tree (
  skill_id TEXT PRIMARY KEY,
  skill_name TEXT NOT NULL,
  skill_description TEXT,
  skill_category TEXT NOT NULL,
  tier INTEGER NOT NULL,
  skill_cost INTEGER NOT NULL,
  max_rank INTEGER DEFAULT 1,
  icon_emoji TEXT,
  prerequisite_skills TEXT DEFAULT '[]',
  effects_json TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_skill_category ON skill_tree(skill_category);
CREATE INDEX IF NOT EXISTS idx_skill_tier ON skill_tree(tier);

CREATE TABLE IF NOT EXISTS achievements (
  achievement_id TEXT PRIMARY KEY,
  achievement_name TEXT NOT NULL,
  achievement_description TEXT,
  category TEXT NOT NULL,
  tier TEXT DEFAULT 'bronze',
  unlock_criteria_json TEXT NOT NULL,
  reward_type TEXT,
  reward_value INTEGER DEFAULT 0,
  icon_emoji TEXT,
  is_secret INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS player_achievements (
  player_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  unlocked_at INTEGER DEFAULT (strftime('%s', 'now')),
  progress_current INTEGER DEFAULT 0,
  progress_required INTEGER NOT NULL,
  PRIMARY KEY (player_id, achievement_id),
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (achievement_id) REFERENCES achievements(achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_player_achievements ON player_achievements(player_id);
CREATE INDEX IF NOT EXISTS idx_achievement_unlocked ON player_achievements(unlocked_at DESC);

-- Seed minimal default skill tree (idempotent)
INSERT OR IGNORE INTO skill_tree (
  skill_id,
  skill_name,
  skill_description,
  skill_category,
  tier,
  skill_cost,
  max_rank,
  icon_emoji,
  prerequisite_skills,
  effects_json,
  sort_order
)
VALUES
  ('damage_boost_1', 'Damage Boost I', '+10% weapon damage', 'damage', 1, 1, 5, '⚔️', '[]', '{"damageMultiplier":0.1}', 1),
  ('health_boost_1', 'Health Boost I', '+20 max health', 'defense', 1, 1, 5, '❤️', '[]', '{"maxHealthBonus":20}', 2),
  ('speed_boost_1', 'Speed Boost I', '+10% movement speed', 'utility', 1, 1, 5, '⚡', '[]', '{"speedMultiplier":0.1}', 3),
  ('gold_magnet_1', 'Gold Magnet I', '+20% loot radius', 'economic', 1, 1, 5, '💰', '[]', '{"goldRadiusMultiplier":0.2}', 4),
  ('critical_hit_1', 'Critical Strike', '15% crit chance', 'damage', 3, 3, 3, '💥', '["damage_boost_1"]', '{"critChance":0.15,"critMultiplier":2.0}', 20),
  ('life_steal_1', 'Life Steal', 'Steal 10% of damage dealt', 'defense', 3, 3, 3, '🩸', '["health_boost_1"]', '{"lifeSteal":0.1}', 22),
  ('explosive_rounds_1', 'Explosive Rounds', 'Bullets explode on impact', 'damage', 4, 4, 1, '💣', '["critical_hit_1"]', '{"explosiveRounds":true,"explosionRadius":100}', 30),
  ('second_chance_1', 'Second Chance', 'Revive once per run', 'defense', 4, 4, 1, '👼', '["life_steal_1"]', '{"secondChance":true}', 33),
  ('treasure_hunter_1', 'Treasure Hunter', '+100% gold drops', 'economic', 5, 5, 1, '🏆', '["gold_magnet_1"]', '{"goldMultiplier":1.0}', 43);
