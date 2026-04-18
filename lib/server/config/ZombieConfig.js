/**
 * ZOMBIE CONFIG - Types de zombies du jeu
 * @version 1.2.0
 *
 * WAVE SCALING (ZombieManager.js):
 *   waveMultiplier  = 1 + (min(wave,130) - 1) × 0.15   → ×1.0 wave1, ×2.35 wave10, ×20.35 wave130 (cap)
 *   speedCap        = type.speed × 1.8                  → évite les zombies trop rapides (wall-clip)
 *   bossMultiplier  = 1 + (min(wave,130) - 1) × 0.20   → scaling plus agressif pour les boss
 *   eliteChance     = 5% après vague 5                  → ×2 hp/dmg, ×3 gold
 *   zombieCount     = ZOMBIES_PER_ROOM + (wave-1) × 7   → vague 1: ~10, vague 20: ~143 (cap wave 130)
 *
 * GOLD/XP RATIO GUIDE (valeurs base):
 *   normal  : 5g / 10xp  — ratio 0.5 g/xp
 *   fast    : 8g / 15xp  — ratio 0.53 g/xp (bonus mobilité)
 *   tank    : 20g / 30xp — ratio 0.67 g/xp (bonus durabilité)
 *   boss    : 200g/500xp — ratio 0.40 g/xp (boss standard toutes vagues)
 *   elites  : ×3 gold base (ZombieManager applique le multiplicateur)
 */

const path = require('path');
const Joi = require('joi');

const CATEGORIES = ['basic', 'elite', 'boss', 'special'];

const ZOMBIE_TYPES = CATEGORIES.reduce((acc, cat) => {
  const defs = require(path.join(__dirname, 'zombies', `${cat}.json`));
  return Object.assign(acc, defs);
}, {});

const zombieSchema = Joi.object({
  name: Joi.string().required(),
  health: Joi.number().positive().required(),
  // speed=0 allowed for stationary types (e.g. turret)
  speed: Joi.number().min(0).required(),
  damage: Joi.number().positive().required(),
  color: Joi.string()
    .pattern(/^#[0-9a-fA-F]{6}$/)
    .required()
}).unknown(true);

function validateZombieConfig(types) {
  const errors = [];
  for (const [key, def] of Object.entries(types)) {
    const { error } = zombieSchema.validate(def);
    if (error) {
      errors.push(`${key}: ${error.message}`);
    }
  }
  if (errors.length > 0) {
    console.error(
      `[FATAL] ZombieConfig validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`
    );
    process.exit(1);
  }
}

validateZombieConfig(ZOMBIE_TYPES);

module.exports = { ZOMBIE_TYPES };
