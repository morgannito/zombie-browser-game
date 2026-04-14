'use strict';

const { SpatialGrid } = require('../../../lib/server/SpatialGrid');

describe('SpatialGrid', () => {
  describe('insert + nearby — 100 zombies', () => {
    test('nearby returns candidates from overlapping cells, excluding far zombies', () => {
      const CELL = 100;
      const grid = new SpatialGrid(CELL);

      // Place 100 zombies on a 10×10 grid, spaced 200 px apart (every other cell)
      const zombies = [];
      for (let i = 0; i < 100; i++) {
        const z = { id: `z${i}`, x: (i % 10) * 200, y: Math.floor(i / 10) * 200 };
        zombies.push(z);
        grid.insert(z);
      }

      // Query centred at (400, 400) with radius 150.
      // The grid is a broadphase filter: it returns all entities whose CELL overlaps
      // the query AABB [250,550]×[250,550].  A zombie at x=200 sits in cell cx=2
      // which covers [200,300) — that cell overlaps [250,550], so it's included.
      const qx = 400;
      const qy = 400;
      const radius = 150;
      const candidates = grid.nearby(qx, qy, radius);

      // 1. No zombie completely outside the cell-extended area should appear.
      //    Cell-extended bounds: floor((qx-radius)/CELL) .. floor((qx+radius)/CELL)
      //    = floor(250/100)=2 .. floor(550/100)=5  → cells 2,3,4,5 → x∈[200,600)
      //    Same for y → y∈[200,600)
      for (const c of candidates) {
        expect(c.x).toBeGreaterThanOrEqual(200);
        expect(c.x).toBeLessThan(600);
        expect(c.y).toBeGreaterThanOrEqual(200);
        expect(c.y).toBeLessThan(600);
      }

      // 2. Every zombie strictly inside the query AABB must appear in candidates.
      const strictlyInside = zombies.filter(
        z => z.x >= qx - radius && z.x <= qx + radius && z.y >= qy - radius && z.y <= qy + radius
      );
      const candidateSet = new Set(candidates.map(c => c.id));
      for (const z of strictlyInside) {
        expect(candidateSet.has(z.id)).toBe(true);
      }

      // 3. Far-away zombies (e.g. x=1800, y=1800) must NOT appear.
      const farZombie = zombies.find(z => z.x === 1800 && z.y === 1800);
      expect(farZombie).toBeDefined();
      expect(candidateSet.has(farZombie.id)).toBe(false);
    });

    test('nearby returns nothing when grid is empty', () => {
      const grid = new SpatialGrid(100);
      expect(grid.nearby(500, 500, 200)).toEqual([]);
    });

    test('clear removes all entities', () => {
      const grid = new SpatialGrid(100);
      for (let i = 0; i < 10; i++) {
        grid.insert({ x: i * 50, y: i * 50 });
      }
      grid.clear();
      expect(grid.nearby(0, 0, 1000)).toEqual([]);
    });

    test('entity exactly on cell boundary is found', () => {
      const grid = new SpatialGrid(100);
      const z = { x: 100, y: 100 };
      grid.insert(z);
      const result = grid.nearby(100, 100, 1);
      expect(result).toContain(z);
    });

    test('zombies outside query radius are not returned', () => {
      const grid = new SpatialGrid(100);
      const far = { x: 1000, y: 1000 };
      grid.insert(far);
      const result = grid.nearby(0, 0, 50);
      expect(result).not.toContain(far);
    });
  });
});
