/**
 * Unit tests for contexts/weapons/CollisionManager.js
 * Focus: public API with mocked Quadtree + SpatialGrid (no real spatial index needed).
 */

const mockQuadtreeInstance = {
  insert: jest.fn(),
  queryRadius: jest.fn(() => []),
  size: jest.fn(() => 0),
  bounds: { x: 0, y: 0, width: 1000, height: 1000 }
};
jest.mock('../../../lib/Quadtree', () => jest.fn(() => mockQuadtreeInstance));

const mockGridInstance = {
  clear: jest.fn(),
  insert: jest.fn(),
  nearby: jest.fn(() => [])
};
jest.mock('../../zombie/SpatialGrid', () => ({
  SpatialGrid: jest.fn(() => mockGridInstance)
}));

jest.mock('../../../lib/MathUtils', () => ({
  distanceSquared: (x1, y1, x2, y2) => (x1 - x2) ** 2 + (y1 - y2) ** 2,
  circleCollision: (x1, y1, r1, x2, y2, r2) => {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy <= (r1 + r2) ** 2;
  }
}));

const CollisionManager = require('../CollisionManager');

const CONFIG = {
  ROOM_WIDTH: 2000,
  ROOM_HEIGHT: 2000,
  ZOMBIE_SIZE: 25,
  PLAYER_SIZE: 20,
  BULLET_SIZE: 4,
  WALL_THICKNESS: 30
};

function makeGameState() {
  return {
    players: {},
    zombies: {}
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQuadtreeInstance.queryRadius.mockReturnValue([]);
  mockQuadtreeInstance.size.mockReturnValue(0);
  mockGridInstance.nearby.mockReturnValue([]);
});

describe('constructor', () => {
  test('initializes state, wrapper pool, and grid', () => {
    const gs = makeGameState();
    const cm = new CollisionManager(gs, CONFIG);
    expect(cm.gameState).toBe(gs);
    expect(cm.quadtree).toBeNull();
    expect(cm.currentFrame).toBe(0);
    expect(cm.pathfindingCache.size).toBe(0);
  });
});

describe('rebuildQuadtree', () => {
  test('creates new quadtree and inserts alive players + all zombies', () => {
    const gs = makeGameState();
    gs.players.p1 = { x: 10, y: 20, alive: true };
    gs.players.p2 = { x: 30, y: 40, alive: false }; // dead, should be skipped
    gs.zombies.z1 = { x: 50, y: 60 };
    const cm = new CollisionManager(gs, CONFIG);
    cm.rebuildQuadtree();
    expect(mockQuadtreeInstance.insert).toHaveBeenCalledTimes(2);
    expect(mockGridInstance.clear).toHaveBeenCalled();
    expect(mockGridInstance.insert).toHaveBeenCalledTimes(1);
  });

  test('increments frame counter and clears cache every N frames', () => {
    const cm = new CollisionManager(makeGameState(), CONFIG);
    cm.pathfindingCache.set('z1', { playerId: 'p1', frame: 0 });
    for (let i = 0; i < cm.cacheInvalidationInterval; i++) {
      cm.rebuildQuadtree();
    }
    expect(cm.currentFrame).toBe(cm.cacheInvalidationInterval);
    expect(cm.pathfindingCache.size).toBe(0);
  });

  test('reuses wrapper pool across rebuilds', () => {
    const gs = makeGameState();
    gs.zombies.z1 = { x: 1, y: 1 };
    const cm = new CollisionManager(gs, CONFIG);
    cm.rebuildQuadtree();
    const firstPoolSize = cm._wrapperPool.length;
    cm.rebuildQuadtree();
    expect(cm._wrapperPool.length).toBe(firstPoolSize);
  });
});

describe('findClosestZombie', () => {
  test('returns null when quadtree not built', () => {
    const cm = new CollisionManager(makeGameState(), CONFIG);
    expect(cm.findClosestZombie(100, 100)).toBeNull();
  });

  test('returns closest zombie from candidates', () => {
    const gs = makeGameState();
    gs.zombies.z1 = { x: 100, y: 100 };
    gs.zombies.z2 = { x: 500, y: 500 };
    const cm = new CollisionManager(gs, CONFIG);
    cm.rebuildQuadtree();
    mockQuadtreeInstance.queryRadius.mockReturnValue([
      { type: 'zombie', entityId: 'z1', x: 100, y: 100 },
      { type: 'zombie', entityId: 'z2', x: 500, y: 500 },
      { type: 'player', entityId: 'p1', x: 0, y: 0 }
    ]);
    expect(cm.findClosestZombie(50, 50)).toBe(gs.zombies.z1);
  });

  test('returns null when only players are candidates', () => {
    const cm = new CollisionManager(makeGameState(), CONFIG);
    cm.rebuildQuadtree();
    mockQuadtreeInstance.queryRadius.mockReturnValue([
      { type: 'player', entityId: 'p1', x: 0, y: 0 }
    ]);
    expect(cm.findClosestZombie(0, 0)).toBeNull();
  });
});

describe('findClosestPlayer', () => {
  test('returns null when quadtree not built', () => {
    const cm = new CollisionManager(makeGameState(), CONFIG);
    expect(cm.findClosestPlayer(0, 0)).toBeNull();
  });

  test('skips spawn-protected by default', () => {
    const gs = makeGameState();
    gs.players.p1 = { id: 'p1', x: 10, y: 10, alive: true, spawnProtection: true };
    const cm = new CollisionManager(gs, CONFIG);
    cm.rebuildQuadtree();
    mockQuadtreeInstance.queryRadius.mockReturnValue([
      { type: 'player', entityId: 'p1', x: 10, y: 10 }
    ]);
    expect(cm.findClosestPlayer(0, 0)).toBeNull();
  });

  test('includes spawn-protected when ignoreSpawnProtection', () => {
    const gs = makeGameState();
    gs.players.p1 = { id: 'p1', x: 10, y: 10, alive: true, spawnProtection: true };
    const cm = new CollisionManager(gs, CONFIG);
    cm.rebuildQuadtree();
    mockQuadtreeInstance.queryRadius.mockReturnValue([
      { type: 'player', entityId: 'p1', x: 10, y: 10 }
    ]);
    expect(cm.findClosestPlayer(0, 0, Infinity, { ignoreSpawnProtection: true })).toBe(gs.players.p1);
  });

  test('skips dead players', () => {
    const gs = makeGameState();
    gs.players.p1 = { id: 'p1', x: 10, y: 10, alive: false };
    const cm = new CollisionManager(gs, CONFIG);
    cm.rebuildQuadtree();
    mockQuadtreeInstance.queryRadius.mockReturnValue([
      { type: 'player', entityId: 'p1', x: 10, y: 10 }
    ]);
    expect(cm.findClosestPlayer(0, 0)).toBeNull();
  });

  test('skips invisible by default', () => {
    const gs = makeGameState();
    gs.players.p1 = { id: 'p1', x: 10, y: 10, alive: true, invisible: true };
    const cm = new CollisionManager(gs, CONFIG);
    cm.rebuildQuadtree();
    mockQuadtreeInstance.queryRadius.mockReturnValue([
      { type: 'player', entityId: 'p1', x: 10, y: 10 }
    ]);
    expect(cm.findClosestPlayer(0, 0)).toBeNull();
  });

  test('skips disconnected players (missing from gameState)', () => {
    const cm = new CollisionManager(makeGameState(), CONFIG);
    cm.rebuildQuadtree();
    mockQuadtreeInstance.queryRadius.mockReturnValue([
      { type: 'player', entityId: 'p-gone', x: 10, y: 10 }
    ]);
    expect(cm.findClosestPlayer(0, 0)).toBeNull();
  });

  test('uses room size when maxRange=Infinity', () => {
    const cm = new CollisionManager(makeGameState(), CONFIG);
    cm.rebuildQuadtree();
    cm.findClosestPlayer(0, 0, Infinity);
    expect(mockQuadtreeInstance.queryRadius).toHaveBeenCalledWith(0, 0, 2000);
  });
});

describe('findClosestPlayerCached', () => {
  test('uses cache hit within invalidation window', () => {
    const gs = makeGameState();
    gs.players.p1 = { id: 'p1', alive: true };
    const cm = new CollisionManager(gs, CONFIG);
    cm.pathfindingCache.set('z1', { playerId: 'p1', frame: 0 });
    cm.currentFrame = 1;
    const result = cm.findClosestPlayerCached('z1', 0, 0);
    expect(result).toBe(gs.players.p1);
    expect(mockQuadtreeInstance.queryRadius).not.toHaveBeenCalled();
  });

  test('falls back to full search on cache miss', () => {
    const gs = makeGameState();
    gs.players.p1 = { id: 'p1', x: 10, y: 10, alive: true };
    const cm = new CollisionManager(gs, CONFIG);
    cm.rebuildQuadtree();
    mockQuadtreeInstance.queryRadius.mockReturnValue([
      { type: 'player', entityId: 'p1', x: 10, y: 10 }
    ]);
    const result = cm.findClosestPlayerCached('z1', 0, 0);
    expect(result).toBe(gs.players.p1);
    expect(cm.pathfindingCache.get('z1')).toEqual({ playerId: 'p1', frame: 1 });
  });

  test('ignores cache when player becomes dead', () => {
    const gs = makeGameState();
    gs.players.p1 = { id: 'p1', alive: false };
    const cm = new CollisionManager(gs, CONFIG);
    cm.rebuildQuadtree();
    cm.pathfindingCache.set('z1', { playerId: 'p1', frame: 0 });
    mockQuadtreeInstance.queryRadius.mockReturnValue([]);
    const result = cm.findClosestPlayerCached('z1', 0, 0);
    expect(result).toBeNull();
  });
});

describe('findZombiesInRadius', () => {
  test('returns empty array when quadtree not built', () => {
    const cm = new CollisionManager(makeGameState(), CONFIG);
    expect(cm.findZombiesInRadius(0, 0, 100)).toEqual([]);
  });

  test('returns zombies excluding given id', () => {
    const gs = makeGameState();
    gs.zombies.z1 = { id: 'z1' };
    gs.zombies.z2 = { id: 'z2' };
    const cm = new CollisionManager(gs, CONFIG);
    cm.rebuildQuadtree();
    mockQuadtreeInstance.queryRadius.mockReturnValue([
      { type: 'zombie', entityId: 'z1' },
      { type: 'zombie', entityId: 'z2' },
      { type: 'player', entityId: 'p1' }
    ]);
    const result = cm.findZombiesInRadius(0, 0, 100, 'z1');
    expect(result).toEqual([gs.zombies.z2]);
  });
});

describe('findPlayersInRadius', () => {
  test('returns empty array when quadtree not built', () => {
    const cm = new CollisionManager(makeGameState(), CONFIG);
    expect(cm.findPlayersInRadius(0, 0, 100)).toEqual([]);
  });

  test('filters to alive players only', () => {
    const gs = makeGameState();
    gs.players.p1 = { alive: true };
    gs.players.p2 = { alive: false };
    const cm = new CollisionManager(gs, CONFIG);
    cm.rebuildQuadtree();
    mockQuadtreeInstance.queryRadius.mockReturnValue([
      { type: 'player', entityId: 'p1' },
      { type: 'player', entityId: 'p2' },
      { type: 'zombie', entityId: 'z1' }
    ]);
    const result = cm.findPlayersInRadius(0, 0, 100);
    expect(result).toEqual([gs.players.p1]);
  });
});

describe('checkBulletZombieCollisions', () => {
  test('returns empty array when quadtree not built', () => {
    const cm = new CollisionManager(makeGameState(), CONFIG);
    expect(cm.checkBulletZombieCollisions({ x: 0, y: 0 })).toEqual([]);
  });

  test('returns hit zombies from spatial grid candidates', () => {
    const gs = makeGameState();
    gs.zombies.z1 = { x: 0, y: 0, size: 25 };
    gs.zombies.z2 = { x: 500, y: 500, size: 25 };
    const cm = new CollisionManager(gs, CONFIG);
    cm.rebuildQuadtree();
    mockGridInstance.nearby.mockReturnValue([
      { entityId: 'z1' },
      { entityId: 'z2' }
    ]);
    const hits = cm.checkBulletZombieCollisions({ x: 0, y: 0 });
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe('z1');
  });

  test('skips zombies deleted mid-frame', () => {
    const gs = makeGameState();
    gs.zombies.z1 = { x: 0, y: 0, size: 25 };
    const cm = new CollisionManager(gs, CONFIG);
    cm.rebuildQuadtree();
    mockGridInstance.nearby.mockReturnValue([
      { entityId: 'z1' },
      { entityId: 'z-deleted' }
    ]);
    const hits = cm.checkBulletZombieCollisions({ x: 0, y: 0 });
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe('z1');
  });

  test('uses default ZOMBIE_SIZE when zombie.size missing', () => {
    const gs = makeGameState();
    gs.zombies.z1 = { x: 0, y: 0 };
    const cm = new CollisionManager(gs, CONFIG);
    cm.rebuildQuadtree();
    mockGridInstance.nearby.mockReturnValue([{ entityId: 'z1' }]);
    expect(cm.checkBulletZombieCollisions({ x: 0, y: 0 })).toHaveLength(1);
  });
});

describe('checkZombiePlayerCollisions', () => {
  test('returns pairs excluding protected/invisible players', () => {
    const gs = makeGameState();
    gs.zombies.z1 = { x: 100, y: 100, size: 25 };
    gs.players.p1 = { x: 105, y: 105, alive: true };
    gs.players.p2 = { x: 110, y: 110, alive: true, spawnProtection: true };
    const cm = new CollisionManager(gs, CONFIG);
    cm.rebuildQuadtree();
    mockQuadtreeInstance.queryRadius.mockReturnValue([
      { type: 'player', entityId: 'p1', x: 105, y: 105 },
      { type: 'player', entityId: 'p2', x: 110, y: 110 }
    ]);
    const collisions = cm.checkZombiePlayerCollisions();
    expect(collisions).toHaveLength(1);
    expect(collisions[0].player).toBe(gs.players.p1);
  });

  test('returns empty when no zombies', () => {
    const cm = new CollisionManager(makeGameState(), CONFIG);
    cm.rebuildQuadtree();
    expect(cm.checkZombiePlayerCollisions()).toEqual([]);
  });
});

describe('isOutOfBounds', () => {
  test('detects each of the 4 walls', () => {
    const cm = new CollisionManager(makeGameState(), CONFIG);
    expect(cm.isOutOfBounds(10, 500)).toBe(true);  // left
    expect(cm.isOutOfBounds(1990, 500)).toBe(true); // right
    expect(cm.isOutOfBounds(500, 10)).toBe(true);  // top
    expect(cm.isOutOfBounds(500, 1990)).toBe(true); // bottom
    expect(cm.isOutOfBounds(1000, 1000)).toBe(false); // center
  });
});

describe('getQuadtreeStats', () => {
  test('returns zeros when quadtree not built', () => {
    const cm = new CollisionManager(makeGameState(), CONFIG);
    expect(cm.getQuadtreeStats()).toEqual({ size: 0, bounds: null });
  });

  test('returns stats from underlying quadtree', () => {
    const cm = new CollisionManager(makeGameState(), CONFIG);
    cm.rebuildQuadtree();
    mockQuadtreeInstance.size.mockReturnValue(42);
    const stats = cm.getQuadtreeStats();
    expect(stats.size).toBe(42);
    expect(stats.bounds).toEqual({ x: 0, y: 0, width: 1000, height: 1000 });
  });
});
