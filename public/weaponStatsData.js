/**
 * Client-side weapon stats for shop preview.
 * Subset of server WeaponConfig — damage, fireRate, bulletSpeed, special trait.
 * Max values used to normalize bars:
 *   damage   max: 120  (sniper)
 *   fireRate max: 1500 (launcher) — lower = faster, inverted for display
 *   range    max: 30   (laser bulletSpeed)
 */
window.WEAPON_STATS = {
  pistol: {
    name: 'Pistolet',
    damage: 40,
    fireRate: 180,
    bulletSpeed: 14,
    special: null
  },
  shotgun: {
    name: 'Shotgun',
    damage: 25,
    fireRate: 600,
    bulletSpeed: 11,
    special: '×8 projectiles — AoE spread'
  },
  rifle: {
    name: "Fusil d'Assaut",
    damage: 30,
    fireRate: 120,
    bulletSpeed: 16,
    special: null
  },
  sniper: {
    name: 'Sniper',
    damage: 120,
    fireRate: 1200,
    bulletSpeed: 25,
    special: 'Portée maximale, one-shot potentiel'
  },
  minigun: {
    name: 'Minigun',
    damage: 12,
    fireRate: 80,
    bulletSpeed: 13,
    special: 'Cadence extrême, suppression continue'
  },
  launcher: {
    name: 'Lance-Roquettes',
    damage: 80,
    fireRate: 1500,
    bulletSpeed: 8,
    special: 'Explosion AoE +60 dégâts'
  },
  flamethrower: {
    name: 'Lance-Flammes',
    damage: 15,
    fireRate: 80,
    bulletSpeed: 7,
    special: '×3 flammes, DPS élevé point-blank'
  },
  laser: {
    name: 'Laser',
    damage: 45,
    fireRate: 150,
    bulletSpeed: 30,
    special: 'Hitscan, précision absolue'
  },
  grenadeLauncher: {
    name: 'Lance-Grenades',
    damage: 50,
    fireRate: 800,
    bulletSpeed: 10,
    special: 'Splash AoE +40, gravité réaliste'
  },
  crossbow: {
    name: 'Arbalète',
    damage: 90,
    fireRate: 900,
    bulletSpeed: 18,
    special: 'Perforant ×2 ennemis'
  },
  chainLightning: {
    name: 'Fusil Éclair',
    damage: 55,
    fireRate: 700,
    bulletSpeed: 20,
    special: 'Chaîne sur 4 cibles (×0.7 dmg)'
  },
  poisonDart: {
    name: 'Fléchettes Toxiques',
    damage: 35,
    fireRate: 450,
    bulletSpeed: 16,
    special: 'Poison DoT 3/s pendant 5s'
  },
  teslaCoil: {
    name: 'Bobine Tesla',
    damage: 12,
    fireRate: 100,
    bulletSpeed: 0,
    special: 'Arc zone 5 cibles, portée 250px'
  },
  iceCannon: {
    name: 'Canon de Glace',
    damage: 65,
    fireRate: 850,
    bulletSpeed: 12,
    special: 'Ralentit -50%, gel 15% de chance'
  },
  plasmaRifle: {
    name: 'Fusil Plasma',
    damage: 48,
    fireRate: 200,
    bulletSpeed: 22,
    special: 'Perforant ×3, traverse les murs'
  }
};

window.WEAPON_STATS_MAX = {
  damage: 120,
  fireRate: 1500,
  bulletSpeed: 30
};
