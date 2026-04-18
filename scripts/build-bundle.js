#!/usr/bin/env node
/**
 * Build script: concatenate all 82 client scripts in load order into app.bundle.js
 * Strategy: simple concatenation (no ES modules, all globals via window.*)
 * esbuild is used for minification only (--bundle=false)
 *
 * To activate: run `npm run build`
 * index.html detects app.bundle.js and uses it instead of 82 separate <script> tags
 */

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PUBLIC = path.resolve(__dirname, '../public');

// Exact load order from public/index.html (excluding /socket.io/socket.io.js)
const SCRIPTS = [
  'perfPatches.js',
  'EventListenerManager.js',
  'TimerManager.js',
  'lib/ClientLogger.js',
  'lib/MathUtils.js',
  'lib/PerformanceUtils.js',
  'lib/StorageManager.js',
  'assetManager.js',
  'professionalAssetGenerator.js',
  'demoAssetGenerator.js',
  'assetIntegration.js',
  'visualEffects.js',
  'screenEffects.js',
  'modules/audio/OptimizedAudioCore.js',
  'modules/audio/OptimizedSoundEffects.js',
  'weaponAudioSystem.js',
  'audioSystem.js',
  'skinSystem.js',
  'enhancedUI.js',
  'performanceSettings.js',
  'gameIntegration.js',
  'achievementSystem.js',
  'dailyChallenges.js',
  'unlockSystem.js',
  'synergySystem.js',
  'synergyTracker.js',
  'missionSystem.js',
  'lifetimeStats.js',
  'gemSystem.js',
  'retentionHooks.js',
  'eventSystem.js',
  'contracts.js',
  'runMutators.js',
  'riskRewardSystem.js',
  'telemetrySystem.js',
  'weaponRecords.js',
  'metaProgression.js',
  'biomeSystem.js',
  'addictionIntegration.js',
  'auth.js',
  'modules/core/Constants.js',
  'modules/core/SessionManager.js',
  'modules/state/GameStateManager.js',
  'modules/input/InputManager.js',
  'modules/managers/AudioManager.js',
  'modules/input/MobileControlsManager.js',
  'modules/managers/CameraManager.js',
  'modules/ui/UIManager.js',
  'modules/ui/NicknameManager.js',
  'modules/systems/ComboSystem.js',
  'modules/systems/ToastManager.js',
  'modules/systems/LeaderboardSystem.js',
  'modules/network/NetworkManager.js',
  'modules/systems/AccountProgressionManager.js',
  'modules/entities/DestructibleObstacles.js',
  'modules/entities/StaticProps.js',
  'modules/entities/DynamicProps.js',
  'modules/environment/WeatherSystem.js',
  'modules/environment/DayNightCycle.js',
  'modules/environment/LightingSystem.js',
  'modules/environment/ParallaxBackground.js',
  'modules/environment/EnvironmentalParticles.js',
  'modules/audio/AmbientAudioSystem.js',
  'modules/rendering/BackgroundRenderer.js',
  'modules/rendering/EntityRenderer.js',
  'modules/rendering/EffectsRenderer.js',
  'modules/rendering/MinimapRenderer.js',
  'modules/rendering/UIRenderer.js',
  'modules/rendering/CrosshairRenderer.js',
  'modules/input/PlayerController.js',
  'modules/game/Renderer.js',
  'modules/core/GameEngine.js',
  'modules/utils/initHelpers.js',
  'tutorialSystem.js',
  'settingsMenu.js',
  'pauseMenu.js',
  'weaponWheel.js',
  'enemyMarkers.js',
  'game.js',
  'gamePatch.js'
];

const tmpConcat = path.join(PUBLIC, 'app.bundle.concat.js');
const outFile = path.join(PUBLIC, 'app.bundle.js');

// 1. Verify all files exist
const missing = SCRIPTS.filter(s => !fs.existsSync(path.join(PUBLIC, s)));
if (missing.length > 0) {
  console.error('Missing files:', missing);
  process.exit(1);
}

// 2. Concatenate with file separators (helps debugging)
console.log('Concatenating ' + SCRIPTS.length + ' scripts...');
const parts = SCRIPTS.map(s => {
  const content = fs.readFileSync(path.join(PUBLIC, s), 'utf8');
  return '\n/* === ' + s + ' === */\n' + content;
});
fs.writeFileSync(tmpConcat, parts.join('\n'));

// 3. Minify with esbuild (no bundling, just transform)
console.log('Minifying with esbuild...');
try {
  const esbuildBin = path.resolve(__dirname, '../node_modules/.bin/esbuild');
  execFileSync(esbuildBin, [tmpConcat, '--minify', '--drop:console', '--outfile=' + outFile, '--log-level=warning'], {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  fs.unlinkSync(tmpConcat);

  const size = fs.statSync(outFile).size;
  console.log(
    'app.bundle.js: ' + (size / 1024).toFixed(1) + ' KB (' + SCRIPTS.length + ' scripts)'
  );
} catch (_err) {
  console.error('esbuild minify failed, keeping unminified concat...');
  fs.renameSync(tmpConcat, outFile);
  const size = fs.statSync(outFile).size;
  console.log('app.bundle.js (unminified): ' + (size / 1024).toFixed(1) + ' KB');
}
