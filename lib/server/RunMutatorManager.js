/**
 * RUN MUTATOR MANAGER - Server-side gameplay modifiers.
 * @version 1.0.0
 */

class RunMutatorManager {
  constructor(gameState, io, options = {}) {
    this.gameState = gameState;
    this.io = io;
    this.rotationInterval = options.rotationInterval || 10;
    this.lastRotationWave = 0;
    this.activeMutators = [];
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

    this.broadcastMutators(wave);
    return true;
  }

  pickMutators() {
    const pool = this.getMutatorPool();
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 2);
  }

  buildEffects(mutators) {
    const effects = { ...this.defaultEffects };
    mutators.forEach((mutator) => {
      if (!mutator.effects) {
        return;
      }
      Object.entries(mutator.effects).forEach(([key, value]) => {
        if (typeof effects[key] !== 'number' || typeof value !== 'number') {
          return;
        }
        effects[key] *= value;
      });
    });

    effects.spawnIntervalMultiplier = this.clamp(effects.spawnIntervalMultiplier, 0.6, 1.4);
    effects.spawnCountMultiplier = this.clamp(effects.spawnCountMultiplier, 0.75, 1.35);
    effects.zombieHealthMultiplier = this.clamp(effects.zombieHealthMultiplier, 0.7, 1.4);
    effects.zombieDamageMultiplier = this.clamp(effects.zombieDamageMultiplier, 0.8, 1.5);
    effects.zombieSpeedMultiplier = this.clamp(effects.zombieSpeedMultiplier, 0.85, 1.25);
    effects.playerDamageMultiplier = this.clamp(effects.playerDamageMultiplier, 0.85, 1.25);
    effects.playerFireRateCooldownMultiplier = this.clamp(effects.playerFireRateCooldownMultiplier, 0.85, 1.2);

    return effects;
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

  getMutatorPool() {
    return [
      {
        id: 'swarm_protocol',
        name: '🐺 Protocole d\'essaim',
        description: 'Plus de zombies, plus vite, plus mobiles.',
        tags: ['+spawn', '+cadence', '+vitesse'],
        effects: {
          spawnCountMultiplier: 1.2,
          spawnIntervalMultiplier: 0.85,
          zombieSpeedMultiplier: 1.1
        }
      },
      {
        id: 'armored_tide',
        name: '🛡️ Marée blindée',
        description: 'Zombies plus résistants, cadence modérée.',
        tags: ['+pv', '-spawn'],
        effects: {
          zombieHealthMultiplier: 1.25,
          spawnCountMultiplier: 0.9
        }
      },
      {
        id: 'glass_fangs',
        name: '🩸 Crocs fragiles',
        description: 'Zombies plus fragiles mais très dangereux.',
        tags: ['-pv', '+dégâts'],
        effects: {
          zombieHealthMultiplier: 0.85,
          zombieDamageMultiplier: 1.25
        }
      },
      {
        id: 'guns_blazing',
        name: '🔥 Guns blazing',
        description: 'Joueurs plus puissants, cadence plus rapide.',
        tags: ['+dégâts', '+cadence'],
        effects: {
          playerDamageMultiplier: 1.15,
          playerFireRateCooldownMultiplier: 0.9
        }
      },
      {
        id: 'feral_strikes',
        name: '⚡ Frappes sauvages',
        description: 'Zombies frappent plus fort, mais moins nombreux.',
        tags: ['+dégâts', '-spawn'],
        effects: {
          zombieDamageMultiplier: 1.2,
          spawnCountMultiplier: 0.85
        }
      }
    ];
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}

module.exports = RunMutatorManager;
