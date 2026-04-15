/**
 * Unit tests for contexts/zombie/modules/updater/separation.js
 */

jest.mock('../wallCollision', () => ({
  clampToRoomBounds: (_z, x, y) => ({ finalX: x, finalY: y }),
  resolveWallCollisions: (_z, x, y) => ({ finalX: x, finalY: y })
}));

const { applyZombieSeparation } = require('../separation');

function makeCollisionManager(zombies, roomManager = null) {
  return {
    gameState: { roomManager },
    findZombiesInRadius: () => zombies
  };
}

describe('applyZombieSeparation', () => {
  test('no-op when no nearby zombies', () => {
    const zombie = { id: 'z1', x: 100, y: 100, size: 20 };
    const cm = makeCollisionManager([]);
    const originalX = zombie.x;
    applyZombieSeparation(zombie, 'z1', cm);
    expect(zombie.x).toBe(originalX);
  });

  test('skips self when iterating neighbours', () => {
    const zombie = { id: 'z1', x: 100, y: 100, size: 20 };
    const cm = makeCollisionManager([zombie]);
    applyZombieSeparation(zombie, 'z1', cm);
    expect(zombie.x).toBe(100); // unchanged — only self
  });

  test('pushes away from overlapping neighbour', () => {
    const zombie = { id: 'z1', x: 100, y: 100, size: 20 };
    // Neighbour at (110,100) — overlap since (20+20)*0.8 = 32 > 10
    const other = { id: 'z2', x: 110, y: 100, size: 20 };
    const cm = makeCollisionManager([other]);
    applyZombieSeparation(zombie, 'z1', cm);
    // Zombie pushed in -x direction (away from other)
    expect(zombie.x).toBeLessThan(100);
  });

  test('no push when neighbours outside min distance', () => {
    const zombie = { id: 'z1', x: 100, y: 100, size: 20 };
    const far = { id: 'z2', x: 200, y: 100, size: 20 };
    const cm = makeCollisionManager([far]);
    applyZombieSeparation(zombie, 'z1', cm);
    expect(zombie.x).toBe(100);
  });

  test('handles null neighbour entries gracefully', () => {
    const zombie = { id: 'z1', x: 100, y: 100, size: 20 };
    const cm = makeCollisionManager([null, undefined]);
    expect(() => applyZombieSeparation(zombie, 'z1', cm)).not.toThrow();
  });

  test('respects wall collision fallback (axis-separate)', () => {
    const other = { id: 'z2', x: 110, y: 100, size: 20 };
    const zombie = { id: 'z1', x: 100, y: 100, size: 20 };
    const roomManager = {
      // Y axis clear, X axis blocked
      checkWallCollision: (_x, y) => y !== 100
    };
    const cm = makeCollisionManager([other], roomManager);
    applyZombieSeparation(zombie, 'z1', cm);
    // X should move (Y axis was clear), Y unchanged
    expect(zombie.x).not.toBe(100);
  });
});
