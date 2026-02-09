/**
 * POWERUP CONFIG - Types de power-ups du jeu
 * @version 1.0.0
 */

const POWERUP_TYPES = {
  health: {
    color: '#00ff00',
    effect: player => {
      player.health = Math.min(player.health + 50, player.maxHealth);
    }
  },
  speed: {
    color: '#00ffff',
    effect: player => {
      player.speedBoost = Date.now() + 10000;
    }
  },
  shotgun: {
    color: '#ff6600',
    effect: player => {
      player.weapon = 'shotgun';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  rifle: {
    color: '#00ff00',
    effect: player => {
      player.weapon = 'rifle';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  sniper: {
    color: '#00ffff',
    effect: player => {
      player.weapon = 'sniper';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  minigun: {
    color: '#ff00ff',
    effect: player => {
      player.weapon = 'minigun';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  launcher: {
    color: '#ff0000',
    effect: player => {
      player.weapon = 'launcher';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  flamethrower: {
    color: '#ff8800',
    effect: player => {
      player.weapon = 'flamethrower';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  laser: {
    color: '#00ffff',
    effect: player => {
      player.weapon = 'laser';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  grenadeLauncher: {
    color: '#88ff00',
    effect: player => {
      player.weapon = 'grenadeLauncher';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  crossbow: {
    color: '#8800ff',
    effect: player => {
      player.weapon = 'crossbow';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  chainLightning: {
    color: '#00ffff',
    effect: player => {
      player.weapon = 'chainLightning';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  poisonDart: {
    color: '#88ff00',
    effect: player => {
      player.weapon = 'poisonDart';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  teslaCoil: {
    color: '#00ccff',
    effect: player => {
      player.weapon = 'teslaCoil';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  iceCannon: {
    color: '#aaddff',
    effect: player => {
      player.weapon = 'iceCannon';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  plasmaRifle: {
    color: '#ff00ff',
    effect: player => {
      player.weapon = 'plasmaRifle';
      player.weaponTimer = Date.now() + 30000;
    }
  }
};

module.exports = { POWERUP_TYPES };
