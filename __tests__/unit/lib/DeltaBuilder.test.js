'use strict';

const DeltaBuilder = require('../../../lib/server/network/DeltaBuilder');

function makeState(player) {
  return {
    players: { [player.id]: player },
    zombies: {},
    bullets: {},
    particles: {},
    poisonTrails: {},
    explosions: {},
    powerups: {},
    loot: {},
    wave: 1,
    currentRoom: 0,
    bossSpawned: false,
    walls: []
  };
}

describe('DeltaBuilder', () => {
  test('does not leak stale undefined keys from pooled patch objects', () => {
    const builder = new DeltaBuilder();
    const player = {
      id: 'p1',
      x: 100,
      y: 200,
      health: 100,
      maxHealth: 100,
      alive: true,
      nickname: 'CodexBot',
      hasNickname: true,
      spawnProtection: true,
      angle: 0
    };

    const firstState = makeState(player);
    const firstDelta = builder.calculateDelta(firstState, {});
    expect(firstDelta.updated.players.p1.health).toBe(100);
    expect(firstDelta.updated.players.p1.maxHealth).toBe(100);
    expect(firstDelta.updated.players.p1.alive).toBe(true);

    const previous = builder.cloneState(firstState);
    const movedState = makeState({ ...player, x: 110, angle: Math.PI / 4 });
    const secondDelta = builder.calculateDelta(movedState, previous);
    const secondPatch = secondDelta.updated.players.p1;

    expect(secondPatch).toBeDefined();
    expect(secondPatch.x).toBe(110);
    expect(secondPatch).not.toHaveProperty('health');
    expect(secondPatch).not.toHaveProperty('maxHealth');
    expect(secondPatch).not.toHaveProperty('alive');
    expect(secondPatch).not.toHaveProperty('nickname');
    expect(secondPatch).not.toHaveProperty('hasNickname');
    expect(secondPatch).not.toHaveProperty('spawnProtection');
  });
});
