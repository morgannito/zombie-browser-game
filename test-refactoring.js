// Test rapide pour vérifier que tous les modules se chargent correctement
const modules = [
  './game/gameLoop.js',
  './game/modules/zombie/ZombieUpdater.js',
  './game/modules/zombie/ZombieEffects.js',
  './game/modules/zombie/BossUpdater.js',
  './game/modules/bullet/BulletUpdater.js',
  './game/modules/bullet/BulletCollisionHandler.js',
  './game/modules/bullet/BulletEffects.js',
  './game/modules/player/PlayerProgression.js',
  './game/modules/player/PlayerEffects.js',
  './game/modules/loot/PowerupUpdater.js',
  './game/modules/loot/LootUpdater.js',
  './game/modules/wave/WaveManager.js'
];

console.log('Testing module imports...\n');

let passed = 0;
let failed = 0;

for (const modulePath of modules) {
  try {
    const module = require(modulePath);
    const exports = Object.keys(module);
    console.log(`✅ ${modulePath.split('/').pop()} - Exports: ${exports.join(', ')}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${modulePath.split('/').pop()} - Error: ${error.message}`);
    failed++;
  }
}

console.log(`\n${passed}/${modules.length} modules loaded successfully`);
console.log(failed > 0 ? `❌ ${failed} modules failed` : '✅ All modules loaded successfully');

process.exit(failed > 0 ? 1 : 0);
