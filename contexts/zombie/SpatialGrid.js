'use strict';

/**
 * SpatialGrid — Uniform grid for O(k) spatial lookups
 * Buckets entities into fixed-size cells; nearby() returns candidates
 * from the 3×3 neighbourhood of cells covering the query rectangle.
 *
 * Cell size is tunable via CELL_SIZE (default 100 px).
 * Rebuild once per tick; query as many times as needed.
 */

const CELL_SIZE = 100;

class SpatialGrid {
  /**
   * @param {number} [cellSize=CELL_SIZE] - Width/height of each grid cell in pixels
   */
  constructor(cellSize = CELL_SIZE) {
    this.cellSize = cellSize;
    /** @type {Map<string, Array>} */
    this.cells = new Map();
  }

  /** Convert world coordinate to cell index */
  _cellIndex(v) {
    return Math.floor(v / this.cellSize);
  }

  /** Canonical map key for (cx, cy) */
  _key(cx, cy) {
    return `${cx},${cy}`;
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
    const key = this._key(this._cellIndex(entity.x), this._cellIndex(entity.y));
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
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
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.cells.get(this._key(cx, cy));
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

module.exports = { SpatialGrid, CELL_SIZE };
