/**
 * Unit tests for lib/Quadtree.js — pure data structure.
 */

const Quadtree = require('../../../lib/Quadtree');

const BOUNDS = { x: 0, y: 0, width: 1000, height: 1000 };

function makeEntity(x, y, id = `e${x}_${y}`) {
  return { x, y, id, type: 'zombie' };
}

describe('constructor', () => {
  test('uses defaults for capacity, maxDepth, depth', () => {
    const qt = new Quadtree(BOUNDS);
    expect(qt.capacity).toBe(4);
    expect(qt.maxDepth).toBe(8);
    expect(qt.depth).toBe(0);
    expect(qt.entities).toEqual([]);
    expect(qt.divided).toBe(false);
  });

  test('honors custom params', () => {
    const qt = new Quadtree(BOUNDS, 2, 3, 1);
    expect(qt.capacity).toBe(2);
    expect(qt.maxDepth).toBe(3);
    expect(qt.depth).toBe(1);
  });
});

describe('contains', () => {
  test('accepts points inside bounds', () => {
    const qt = new Quadtree(BOUNDS);
    expect(qt.contains({ x: 500, y: 500 })).toBe(true);
    expect(qt.contains({ x: 0, y: 0 })).toBe(true);
  });

  test('rejects points at right/bottom edge (exclusive)', () => {
    const qt = new Quadtree(BOUNDS);
    expect(qt.contains({ x: 1000, y: 500 })).toBe(false);
    expect(qt.contains({ x: 500, y: 1000 })).toBe(false);
  });

  test('rejects points outside bounds', () => {
    const qt = new Quadtree(BOUNDS);
    expect(qt.contains({ x: -1, y: 500 })).toBe(false);
    expect(qt.contains({ x: 2000, y: 500 })).toBe(false);
  });
});

describe('insert', () => {
  test('stores entity within capacity without subdividing', () => {
    const qt = new Quadtree(BOUNDS, 4);
    for (let i = 0; i < 4; i++) {
      expect(qt.insert(makeEntity(i * 100, 0))).toBe(true);
    }
    expect(qt.divided).toBe(false);
    expect(qt.entities).toHaveLength(4);
  });

  test('subdivides when capacity exceeded', () => {
    const qt = new Quadtree(BOUNDS, 2);
    qt.insert(makeEntity(100, 100));
    qt.insert(makeEntity(200, 200));
    qt.insert(makeEntity(800, 800)); // triggers subdivide
    expect(qt.divided).toBe(true);
    expect(qt.northeast).not.toBeNull();
    expect(qt.northwest).not.toBeNull();
    expect(qt.southeast).not.toBeNull();
    expect(qt.southwest).not.toBeNull();
  });

  test('rejects out-of-bounds entity', () => {
    const qt = new Quadtree(BOUNDS);
    expect(qt.insert(makeEntity(-10, 500))).toBe(false);
    expect(qt.insert(makeEntity(2000, 500))).toBe(false);
    expect(qt.entities).toHaveLength(0);
  });

  test('stops subdividing at maxDepth', () => {
    const qt = new Quadtree(BOUNDS, 1, 1); // capacity 1, maxDepth 1
    qt.insert(makeEntity(100, 100));
    qt.insert(makeEntity(200, 200)); // forces subdivide
    const child = qt.northwest;
    // child is at depth 1 = maxDepth, should accept more than capacity
    child.insert(makeEntity(50, 50));
    child.insert(makeEntity(60, 60));
    expect(child.divided).toBe(false); // cannot further subdivide
    expect(child.entities.length).toBeGreaterThanOrEqual(2);
  });
});

describe('size', () => {
  test('counts entities including subdivisions', () => {
    const qt = new Quadtree(BOUNDS, 2);
    qt.insert(makeEntity(100, 100));
    qt.insert(makeEntity(200, 200));
    qt.insert(makeEntity(800, 800));
    qt.insert(makeEntity(900, 900));
    qt.insert(makeEntity(100, 800));
    expect(qt.size()).toBe(5);
  });

  test('returns 0 for empty tree', () => {
    expect(new Quadtree(BOUNDS).size()).toBe(0);
  });
});

describe('query (rect range)', () => {
  test('returns empty when range does not intersect', () => {
    const qt = new Quadtree(BOUNDS);
    qt.insert(makeEntity(500, 500));
    expect(qt.query({ x: 10000, y: 10000, width: 10, height: 10 })).toEqual([]);
  });

  test('returns entities within range', () => {
    const qt = new Quadtree(BOUNDS, 2);
    qt.insert(makeEntity(100, 100));
    qt.insert(makeEntity(200, 200));
    qt.insert(makeEntity(800, 800));
    const found = qt.query({ x: 50, y: 50, width: 200, height: 200 });
    expect(found).toHaveLength(2);
    expect(found.map(e => e.id)).toEqual(['e100_100', 'e200_200']);
  });

  test('recurses into subdivisions', () => {
    const qt = new Quadtree(BOUNDS, 1);
    qt.insert(makeEntity(100, 100));
    qt.insert(makeEntity(900, 900)); // forces subdivide
    const found = qt.query({ x: 0, y: 0, width: 1000, height: 1000 });
    expect(found).toHaveLength(2);
  });
});

describe('intersects', () => {
  test('true when rectangles overlap', () => {
    const qt = new Quadtree({ x: 0, y: 0, width: 100, height: 100 });
    expect(qt.intersects({ x: 50, y: 50, width: 100, height: 100 })).toBe(true);
  });

  test('false when completely separate', () => {
    const qt = new Quadtree({ x: 0, y: 0, width: 100, height: 100 });
    expect(qt.intersects({ x: 200, y: 200, width: 50, height: 50 })).toBe(false);
  });
});

describe('pointInRange', () => {
  test('inclusive bounds', () => {
    const qt = new Quadtree(BOUNDS);
    const range = { x: 0, y: 0, width: 100, height: 100 };
    expect(qt.pointInRange({ x: 0, y: 0 }, range)).toBe(true);
    expect(qt.pointInRange({ x: 100, y: 100 }, range)).toBe(true);
    expect(qt.pointInRange({ x: 101, y: 50 }, range)).toBe(false);
  });
});

describe('queryRadius', () => {
  test('returns only entities within circular radius', () => {
    const qt = new Quadtree(BOUNDS, 4);
    qt.insert(makeEntity(100, 100));
    qt.insert(makeEntity(150, 150));
    qt.insert(makeEntity(500, 500));
    const found = qt.queryRadius(100, 100, 100);
    expect(found).toHaveLength(2); // e100_100 (dist 0) + e150_150 (dist ~71)
    expect(found.find(e => e.id === 'e500_500')).toBeUndefined();
  });

  test('returns empty when no entities in radius', () => {
    const qt = new Quadtree(BOUNDS);
    qt.insert(makeEntity(100, 100));
    expect(qt.queryRadius(900, 900, 50)).toEqual([]);
  });

  test('excludes entities in bounding-box but outside circle', () => {
    const qt = new Quadtree(BOUNDS);
    qt.insert(makeEntity(100, 100));
    qt.insert(makeEntity(199, 199)); // in box 0-200, but > 100 from (100,100)
    const found = qt.queryRadius(100, 100, 100);
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe('e100_100');
  });
});

describe('clear', () => {
  test('wipes entities and resets subdivisions', () => {
    const qt = new Quadtree(BOUNDS, 2);
    qt.insert(makeEntity(100, 100));
    qt.insert(makeEntity(200, 200));
    qt.insert(makeEntity(800, 800));
    expect(qt.size()).toBe(3);
    qt.clear();
    expect(qt.size()).toBe(0);
    expect(qt.divided).toBe(false);
    expect(qt.northeast).toBeNull();
  });

  test('is safe on empty tree', () => {
    const qt = new Quadtree(BOUNDS);
    expect(() => qt.clear()).not.toThrow();
    expect(qt.size()).toBe(0);
  });
});
