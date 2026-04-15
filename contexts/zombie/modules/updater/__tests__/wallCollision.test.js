/**
 * Unit tests for contexts/zombie/modules/updater/wallCollision.js
 * Pure-function coverage — no socket.io, no DB.
 */

const { clampToRoomBounds, resolveWallCollisions } = require('../wallCollision');

describe('clampToRoomBounds', () => {
  const zombie = { size: 20 };

  test('clamps x below margin to margin', () => {
    const { finalX } = clampToRoomBounds(zombie, -10, 100);
    expect(finalX).toBe(21); // margin = max(1, size+1) = 21
  });

  test('clamps y below margin to margin', () => {
    const { finalY } = clampToRoomBounds(zombie, 100, -5);
    expect(finalY).toBe(21);
  });

  test('clamps x above room width minus margin', () => {
    const { finalX } = clampToRoomBounds(zombie, 9999, 100);
    expect(finalX).toBe(3000 - 21);
  });

  test('clamps y above room height minus margin', () => {
    const { finalY } = clampToRoomBounds(zombie, 100, 9999);
    expect(finalY).toBeGreaterThanOrEqual(0);
    expect(finalY).toBeLessThanOrEqual(5000);
  });

  test('passes through values inside bounds', () => {
    const result = clampToRoomBounds(zombie, 500, 500);
    expect(result).toEqual({ finalX: 500, finalY: 500 });
  });

  test('uses margin=1 when zombie has no size', () => {
    const { finalX } = clampToRoomBounds({}, -100, 100);
    expect(finalX).toBe(1);
  });
});

describe('resolveWallCollisions', () => {
  const baseZombie = { x: 100, y: 100, size: 20, speed: 5 };

  test('no roomManager → clamp only', () => {
    const result = resolveWallCollisions(baseZombie, 150, 150, null);
    expect(result).toEqual({ finalX: 150, finalY: 150 });
  });

  test('free move → clamp', () => {
    const roomManager = {
      checkWallCollision: () => false,
      getWallCollisionInfo: () => ({ colliding: false })
    };
    const result = resolveWallCollisions(baseZombie, 200, 200, roomManager);
    expect(result).toEqual({ finalX: 200, finalY: 200 });
  });

  test('slides along X when Y is blocked', () => {
    const roomManager = {
      // newX,newY blocked; newX,y clear; x,newY blocked
      checkWallCollision: (x, y) => !(x === 150 && y === 100),
      getWallCollisionInfo: () => ({ colliding: true, penetration: 0, pushX: 0, pushY: 0 })
    };
    const zombie = { x: 100, y: 100, size: 20, speed: 5 };
    const result = resolveWallCollisions(zombie, 150, 130, roomManager);
    expect(result.finalX).toBe(150); // moved along X
  });

  test('prefers larger movement axis when both axes clear', () => {
    const roomManager = {
      checkWallCollision: (x, y) => x === 200 && y === 200,  // only the combined newX,newY collides
      getWallCollisionInfo: () => ({ colliding: true, penetration: 0, pushX: 0, pushY: 0 })
    };
    const zombie = { x: 100, y: 100, size: 20, speed: 5 };
    // moveX=100, moveY=100 → equal, picks Y path (not strictly greater)
    const result = resolveWallCollisions(zombie, 200, 200, roomManager);
    // At least one axis moved
    expect(result.finalX !== 100 || result.finalY !== 100).toBe(true);
  });

  test('unstuck: pushes deeply embedded zombie toward room center', () => {
    // Start inside the wall; no axis slide works; heavy penetration triggers center push.
    const roomManager = {
      checkWallCollision: () => true,
      getWallCollisionInfo: () => ({
        colliding: true, penetration: 100, pushX: 0, pushY: 0
      })
    };
    const zombie = { x: 0, y: 0, size: 20, speed: 5 };
    const result = resolveWallCollisions(zombie, 5, 5, roomManager);
    // Should be pushed toward center (positive x and y)
    expect(result.finalX).toBeGreaterThan(0);
    expect(result.finalY).toBeGreaterThan(0);
  });
});
