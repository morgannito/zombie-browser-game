'use strict';

/**
 * SpatialGrid — Uniform grid for O(k) spatial lookups
 * Buckets entities into fixed-size cells; nearby() returns candidates
 * from the 3×3 neighbourhood of cells covering the query rectangle.
 *
 * Cell size is tunable via CELL_SIZE (default 100 px).
 * Rebuild once per tick; query as many times as needed.
 *
 * PERF: Uses nested Map<integer, Map<integer, Array>> instead of
 * Map<string, Array> to avoid template-literal string allocation on every
 * insert and every cell lookup.  On a tick with 50 zombies and ~20 bullet
 * queries (each scanning ~9 cells) this removes ~230 string allocations per
 * tick — roughly 13 800 per second at 60 FPS — reducing GC pressure.
 */

const CELL_SIZE = 100;

class SpatialGrid {
  /**
   * @param {number} [cellSize=CELL_SIZE] - Width/height of each grid cell in pixels
   */
  constructor(cellSize = CELL_SIZE) {
    this.cellSize = cellSize;
    /** @type {Map<number, Map<number, Array>>} outer key = cx, inner key = cy */
    this.cells = new Map();
  }

  /** Convert world coordinate to cell index */
  _cellIndex(v) {
    return Math.floor(v / this.cellSize);
  }

  /** Remove all entities from the grid */
  clear() {
    this.cells.clear();
  }

  /**
   * Insert an entity into the grid.
   * Entity must have numeric `x` and `y` properties.
   * @param {Object} entity
   */
  insert(entity) {
    const cx = this._cellIndex(entity.x);
    const cy = this._cellIndex(entity.y);

    let row = this.cells.get(cx);
    if (!row) {
      row = new Map();
      this.cells.set(cx, row);
    }
    let cell = row.get(cy);
    if (!cell) {
      cell = [];
      row.set(cy, cell);
    }
    cell.push(entity);
  }

  /**
   * Return all entities whose cell overlaps the AABB
   * [x-radius, x+radius] × [y-radius, y+radius].
   * Callers must still run the precise collision check on results.
   *
   * @param {number} x      - Query centre X
   * @param {number} y      - Query centre Y
   * @param {number} radius - Half-width of the query square
   * @returns {Array} Candidate entities (may include false positives)
   */
  nearby(x, y, radius) {
    const minCX = this._cellIndex(x - radius);
    const maxCX = this._cellIndex(x + radius);
    const minCY = this._cellIndex(y - radius);
    const maxCY = this._cellIndex(y + radius);

    const result = [];
    for (let cx = minCX; cx <= maxCX; cx++) {
      const row = this.cells.get(cx);
      if (!row) {
        continue;
      }
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = row.get(cy);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            result.push(cell[i]);
          }
        }
      }
    }
    return result;
  }
}

module.exports = { SpatialGrid };
