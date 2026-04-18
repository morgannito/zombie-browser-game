/**
 * RUN MUTATOR MANAGER - Server-side gameplay modifiers.
 * @version 2.0.0
 */

const logger = require('../../infrastructure/logging/Logger');
const { runPRNG } = require('../runPRNG');

class RunMutatorManager {
  constructor(gameState, io, options = {}) {
    this.gameState = gameState;
    this.io = io;
    this.rotationInterval = options.rotationInterval || 10;
    this.lastRotationWave = 0;
    this.activeMutators = [];
    this._effectsCached = false;
    this.defaultEffects = {
      zombieHealthMultiplier: 1,
      zombieDamageMultiplier: 1,
      zombieSpeedMultiplier: 1,
      spawnCountMultiplier: 1,
      spawnIntervalMultiplier: 1,
      playerDamageMultiplier: 1,
      playerFireRateCooldownMultiplier: 1
    };
  }

  initialize() {
    this.rotateIfNeeded(this.gameState.wave || 1, true);
  }

  handleWaveChange(wave) {
    // Skip overhead if next mutator wave is far
    const next = this.gameState.nextMutatorWave;
    if (next > 0 && wave < next) {
return false;
}
    return this.rotateIfNeeded(wave);
  }

  rotateIfNeeded(wave, force = false) {
    if (!force && wave - this.lastRotationWave < this.rotationInterval) {
      return false;
    }

    this.lastRotationWave = wave;
    this.activeMutators = this.pickMutators();
    const effects = this.buildEffects(this.activeMutators);

    this.gameState.activeMutators = this.activeMutators.map(this.toPublicMutator);
    this.gameState.mutatorEffects = effects;
    this.gameState.nextMutatorWave = wave + this.rotationInterval;
    this._effectsCached = true;

    this.broadcastMutators(wave);
    return true;
  }

  hasActiveMutators() {
    return this._effectsCached && this.activeMutators.length > 0;
  }

  /**
   * Reset mutator state to defaults. Call on room load or game end
   * to prevent stale effects from leaking into the next session.
   */
  cleanupWave() {
    this.activeMutators = [];
    this._effectsCached = false;
    this.gameState.activeMutators = [];
    this.gameState.mutatorEffects = { ...this.defaultEffects };
  }

  pickMutators() {
    const pool = this.getMutatorPool();
    const shuffled = pool.slice().sort(() => runPRNG.random() - 0.5);
    const seen = new Set();
    const result = [];
    for (const m of shuffled) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        result.push(m);
        if (result.length === 2) {
break;
}
      }
    }
    return result;
  }

  /**
   * Accumulate numeric effects from mutator list onto a fresh defaultEffects copy.
   * Invalid/unknown keys are warned and skipped. Results are clamped.
   * @param {Array} mutators
   * @returns {object} Clamped effects map
   */
  buildEffects(mutators) {
    const effects = { ...this.defaultEffects };
    mutators.forEach((mutator) => this._applyMutatorEffects(effects, mutator));
    return this._clampEffects(effects);
  }

  /**
   * Apply a single mutator's effects onto an accumulator (mutates in place).
   * @param {object} effects - Accumulator (copy of defaultEffects)
   * @param {object} mutator
   */
  _applyMutatorEffects(effects, mutator) {
    if (!mutator.effects) {
return;
}
    Object.entries(mutator.effects).forEach(([key, value]) => {
      if (typeof value !== 'number' || !isFinite(value)) {
        logger.warn('[MUTATOR] Invalid effect value for key', key, ':', value, '— skipped');
        return;
      }
      if (typeof effects[key] !== 'number') {
        logger.warn('[MUTATOR] Unknown effect key', key, 'in mutator', mutator.id, '— skipped');
        return;
      }
      effects[key] *= value;
    });
  }

  /**
   * Clamp all effect values to their allowed ranges.
   * @param {object} effects
   * @returns {object}
   */
  _clampEffects(effects) {
    effects.spawnIntervalMultiplier = this.clamp(effects.spawnIntervalMultiplier, 0.6, 1.4);
    effects.spawnCountMultiplier = this.clamp(effects.spawnCountMultiplier, 0.75, 1.35);
    effects.zombieHealthMultiplier = this.clamp(effects.zombieHealthMultiplier, 0.7, 1.4);
    effects.zombieDamageMultiplier = this.clamp(effects.zombieDamageMultiplier, 0.8, 1.5);
    effects.zombieSpeedMultiplier = this.clamp(effects.zombieSpeedMultiplier, 0.85, 1.25);
    effects.playerDamageMultiplier = this.clamp(effects.playerDamageMultiplier, 0.85, 1.25);
    effects.playerFireRateCooldownMultiplier = this.clamp(effects.playerFireRateCooldownMultiplier, 0.85, 1.2);
    return effects;
  }

  serialize() {
    return {
      lastRotationWave: this.lastRotationWave,
      activeMutatorIds: this.activeMutators.map((m) => m.id),
      effects: this.gameState.mutatorEffects ? { ...this.gameState.mutatorEffects } : null,
      nextMutatorWave: this.gameState.nextMutatorWave || 0
    };
  }

  restore(snapshot) {
    if (!snapshot) {
return;
}
    this.lastRotationWave = snapshot.lastRotationWave || 0;
    const pool = this.getMutatorPool();
    const ids = new Set(snapshot.activeMutatorIds || []);
    this.activeMutators = pool.filter((m) => ids.has(m.id));
    this.gameState.activeMutators = this.activeMutators.map(this.toPublicMutator);
    if (snapshot.effects) {
      this.gameState.mutatorEffects = { ...snapshot.effects };
      this._effectsCached = true;
    }
    this.gameState.nextMutatorWave = snapshot.nextMutatorWave || 0;
  }

  broadcastMutators(wave) {
    if (!this.io) {
return;
}
    this.io.emit('mutatorsUpdated', {
      wave,
      nextRotationWave: this.gameState.nextMutatorWave,
      mutators: this.gameState.activeMutators,
      effects: this.gameState.mutatorEffects
    });
  }

  toPublicMutator(mutator) {
    return {
      id: mutator.id,
      name: mutator.name,
      description: mutator.description,
      tags: mutator.tags || []
    };
  }

  /**
   * Static pool of available mutators. Each entry defines effects as multipliers
   * applied to defaultEffects keys. Values must be finite positive numbers.
   * @returns {Array<{id: string, name: string, description: string, tags: string[], effects: object}>}
   */
  getMutatorPool() {
    return [
      {
        id: 'swarm_protocol',
        name: '🐺 Protocole d\'essaim',
        description: 'Plus de zombies, plus vite, plus mobiles.',
        tags: ['+spawn', '+cadence', '+vitesse'],
        effects: { spawnCountMultiplier: 1.2, spawnIntervalMultiplier: 0.85, zombieSpeedMultiplier: 1.1 }
      },
      {
        id: 'armored_tide',
        name: '🛡️ Marée blindée',
        description: 'Zombies plus résistants, cadence modérée.',
        tags: ['+pv', '-spawn'],
        effects: { zombieHealthMultiplier: 1.25, spawnCountMultiplier: 0.9 }
      },
      {
        id: 'glass_fangs',
        name: '🩸 Crocs fragiles',
        description: 'Zombies plus fragiles mais très dangereux.',
        tags: ['-pv', '+dégâts'],
        effects: { zombieHealthMultiplier: 0.85, zombieDamageMultiplier: 1.25 }
      },
      {
        id: 'guns_blazing',
        name: '🔥 Guns blazing',
        description: 'Joueurs plus puissants, cadence plus rapide.',
        tags: ['+dégâts', '+cadence'],
        effects: { playerDamageMultiplier: 1.15, playerFireRateCooldownMultiplier: 0.9 }
      },
      {
        id: 'feral_strikes',
        name: '⚡ Frappes sauvages',
        description: 'Zombies frappent plus fort, mais moins nombreux.',
        tags: ['+dégâts', '-spawn'],
        effects: { zombieDamageMultiplier: 1.2, spawnCountMultiplier: 0.85 }
      }
    ];
  }

  /**
   * Clamp value to [min, max]. Returns min if value is not a finite number.
   * @param {number} value
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  clamp(value, min, max) {
    if (!isFinite(value)) {
      logger.warn('[MUTATOR] clamp received non-finite value:', value, '— defaulting to min', min);
      return min;
    }
    return Math.max(min, Math.min(max, value));
  }
}

module.exports = RunMutatorManager;
