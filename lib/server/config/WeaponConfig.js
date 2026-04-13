/**
 * WEAPON CONFIG - Definitions de toutes les armes du jeu
 * @version 1.1.0
 *
 * DPS REFERENCE (damage / fireRate * 1000, bullets excluded):
 *   pistol          ~222 dps  (40 / 180ms)
 *   rifle           ~250 dps  (30 / 120ms)
 *   minigun         ~150 dps  (12 / 80ms)  — compensé par cadence de feu extrème
 *   shotgun         ~333 dps  (25×8 / 600ms) — AoE spread, portée réduite
 *   laser           ~300 dps  (45 / 150ms) — hitscan + no spread, tier premium
 *   sniper          ~100 dps  (120 / 1200ms) — one-shot + portée max
 *   teslaCoil       ~400 dps  (8×5 cibles / 100ms) — zone, nécessite proximité
 *   chainLightning  ~157 dps  direct (55 / 700ms) + chain bonus
 *   crossbow        ~100 dps  (90 / 900ms) — piercing×2, niche anti-groupe
 *   plasmaRifle     ~240 dps  (48 / 200ms) — piercing×3 + ignoreWalls, tier premium
 *   flamethrower    ~562 dps  (15×3 / 80ms) — point-blank, lifetime limité
 *   launcher        ~53 dps   direct + 60 AoE splash
 *   grenadeLauncher ~62 dps   direct + 40 AoE splash
 *   iceCannon       ~76 dps   + slow/freeze utility
 *   poisonDart      ~78 dps   + 3/tick poison
 */

const WEAPONS = {
  pistol: {
    name: 'Pistolet',
    damage: 40,
    fireRate: 180, // ~222 dps | arme de départ, référence
    bulletSpeed: 14,
    bulletCount: 1,
    spread: 0,
    color: '#ffff00'
  },
  shotgun: {
    name: 'Shotgun',
    damage: 25,
    fireRate: 600, // ~333 dps spread | compensé par portée et dispersion
    bulletSpeed: 11,
    bulletCount: 8,
    spread: 0.4,
    color: '#ff6600'
  },
  rifle: {
    name: "Fusil d'Assaut",
    damage: 30,
    fireRate: 120, // ~250 dps | arme mid-tier équilibrée
    bulletSpeed: 16,
    bulletCount: 1,
    spread: 0.05,
    color: '#00ff00'
  },
  sniper: {
    name: 'Sniper',
    damage: 120,
    fireRate: 1200, // ~100 dps | compense par portée max et one-shot potentiel
    bulletSpeed: 25,
    bulletCount: 1,
    spread: 0,
    color: '#00ffff'
  },
  minigun: {
    name: 'Minigun',
    damage: 12,
    fireRate: 80, // ~150 dps | point fort: suppression continue, pas de rechargement
    bulletSpeed: 13,
    bulletCount: 1,
    spread: 0.2,
    color: '#ff00ff'
  },
  launcher: {
    name: 'Lance-Roquettes',
    damage: 80,
    fireRate: 1500, // ~53 dps direct + 60 AoE | force: contrôle de zone
    bulletSpeed: 8,
    bulletCount: 1,
    spread: 0,
    color: '#ff0000',
    explosionRadius: 120,
    explosionDamage: 60,
    hasExplosion: true
  },
  flamethrower: {
    name: 'Lance-Flammes',
    damage: 15,
    fireRate: 80, // ~562 dps point-blank | forte DPS mais portée très courte
    bulletSpeed: 7,
    bulletCount: 3,
    spread: 0.3,
    color: '#ff8800',
    lifetime: 500,
    isFlame: true
  },
  laser: {
    // FIX BALANCE: était fireRate:100 → 450 dps (trop OP pour arme hitscan/no-spread)
    // Rééquilibré à 150ms → ~300 dps, cohérent avec le tier premium
    name: 'Laser',
    damage: 45,
    fireRate: 150, // ~300 dps | hitscan + no spread justifie un tier au-dessus du rifle
    bulletSpeed: 30,
    bulletCount: 1,
    spread: 0,
    color: '#00ffff',
    isLaser: true
  },
  grenadeLauncher: {
    name: 'Lance-Grenades',
    damage: 50,
    fireRate: 800, // ~62 dps direct + 40 AoE | niche: contrôle zone, gravité réaliste
    bulletSpeed: 10,
    bulletCount: 1,
    spread: 0,
    color: '#88ff00',
    explosionRadius: 100,
    explosionDamage: 40,
    gravity: 0.2,
    hasExplosion: true,
    isGrenade: true
  },
  crossbow: {
    name: 'Arbalete',
    damage: 90,
    fireRate: 900, // ~100 dps | piercing×2, niche anti-groupes alignés
    bulletSpeed: 18,
    bulletCount: 1,
    spread: 0,
    color: '#8800ff',
    piercing: 2,
    isCrossbow: true
  },
  chainLightning: {
    name: 'Fusil Eclair',
    damage: 55,
    fireRate: 700, // ~157 dps direct + bonus chain (4 cibles, ×0.7 dmg) | anti-groupes
    bulletSpeed: 20,
    bulletCount: 1,
    spread: 0,
    color: '#00ffff',
    isChainLightning: true,
    chainMaxJumps: 4,
    chainRange: 200,
    chainDamageReduction: 0.7
  },
  poisonDart: {
    name: 'Flechettes Toxiques',
    damage: 35,
    fireRate: 450, // ~78 dps direct + 3/tick poison sur 5s + spread 30% | DoT utility
    bulletSpeed: 16,
    bulletCount: 1,
    spread: 0,
    color: '#88ff00',
    isPoisonDart: true,
    poisonDamage: 3,
    poisonDuration: 5000,
    poisonSpreadRadius: 100,
    poisonSpreadChance: 0.3
  },
  teslaCoil: {
    // FIX BALANCE: damage 8→12 pour compenser la contrainte de proximité
    // Effective: 12×5 cibles / 100ms = 600 dps zone mais nécessite <250px
    name: 'Bobine Tesla',
    damage: 12,
    fireRate: 100, // ~600 dps zone (5 cibles max) | contrainte: portée 250px seulement
    bulletSpeed: 0,
    bulletCount: 1,
    spread: 0,
    color: '#00ccff',
    isTeslaCoil: true,
    teslaRange: 250,
    teslaMaxTargets: 5,
    teslaChainDelay: 50
  },
  iceCannon: {
    name: 'Canon de Glace',
    damage: 65,
    fireRate: 850, // ~76 dps + slow 50% (3s) + freeze 15% (2s) | utility > dps
    bulletSpeed: 12,
    bulletCount: 1,
    spread: 0,
    color: '#aaddff',
    isIceCannon: true,
    slowAmount: 0.5,
    slowDuration: 3000,
    freezeChance: 0.15,
    freezeDuration: 2000,
    iceExplosionRadius: 80
  },
  plasmaRifle: {
    name: 'Fusil Plasma',
    damage: 48,
    fireRate: 200, // ~240 dps + piercing×3 + ignoreWalls | tier premium justifié
    bulletSpeed: 22,
    bulletCount: 1,
    spread: 0.02,
    color: '#ff00ff',
    isPlasmaRifle: true,
    ignoresWalls: true,
    plasmaTrailInterval: 10,
    plasmaPiercing: 3
  }
};

const Joi = require('joi');

const weaponSchema = Joi.object({
  name: Joi.string().required(),
  damage: Joi.number().positive().required(),
  fireRate: Joi.number().positive().required(),
  // teslaCoil has bulletSpeed=0 (passive arc, no projectile)
  bulletSpeed: Joi.number().min(0).required(),
  bulletCount: Joi.number().integer().min(1).required(),
  color: Joi.string()
    .pattern(/^#[0-9a-fA-F]{6}$/)
    .required()
}).unknown(true);

function validateWeaponConfig(weapons) {
  const errors = [];
  for (const [key, def] of Object.entries(weapons)) {
    const { error } = weaponSchema.validate(def);
    if (error) {
      errors.push(`${key}: ${error.message}`);
    }
  }
  if (errors.length > 0) {
    console.error(
      `[FATAL] WeaponConfig validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`
    );
    process.exit(1);
  }
}

validateWeaponConfig(WEAPONS);

module.exports = { WEAPONS };
