/**
 * Unit tests for contexts/zombie/modules/updater/randomWalk.js
 */

jest.mock('../wallCollision', () => ({
  clampToRoomBounds: (_z, x, y) => ({ finalX: x, finalY: y }),
  resolveWallCollisions: (_z, x, y) => ({ finalX: x, finalY: y })
}));

const { moveRandomly } = require('../randomWalk');

describe('moveRandomly', () => {
  test('initialises random heading on first call', () => {
    const zombie = { x: 100, y: 100, speed: 5 };
    moveRandomly(zombie, 1000, null, 1);
    expect(zombie.randomAngle).toBeDefined();
    expect(zombie.randomMoveTimer).toBe(1000);
  });

  test('refreshes heading after TTL expired', () => {
    const zombie = {
      x: 100, y: 100, speed: 5,
      randomAngle: 0, randomMoveTimer: 0
    };
    moveRandomly(zombie, 3000, null, 1); // 3s > 2s TTL
    expect(zombie.randomMoveTimer).toBe(3000);
  });

  test('keeps heading when TTL not reached', () => {
    const zombie = {
      x: 100, y: 100, speed: 5,
      randomAngle: Math.PI / 4, randomMoveTimer: 1000
    };
    moveRandomly(zombie, 1500, null, 1); // 500ms < 2s
    expect(zombie.randomMoveTimer).toBe(1000);
    expect(zombie.randomAngle).toBe(Math.PI / 4);
  });

  test('moves zombie along current heading (deltaTime=1)', () => {
    const zombie = {
      x: 100, y: 100, speed: 10,
      randomAngle: 0, randomMoveTimer: 1000 // moving +x
    };
    moveRandomly(zombie, 1100, null, 1);
    expect(zombie.x).toBeCloseTo(110, 5);
    expect(zombie.y).toBeCloseTo(100, 5);
  });

  test('deltaTime scales movement', () => {
    const zombie = {
      x: 100, y: 100, speed: 10,
      randomAngle: 0, randomMoveTimer: 1000
    };
    moveRandomly(zombie, 1100, null, 2);
    expect(zombie.x).toBeCloseTo(120, 5);
  });
});
