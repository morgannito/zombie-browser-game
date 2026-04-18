/**
 * UPGRADE CATALOG
 * Single source of truth for upgrade definitions (cost, maxLevel).
 */

/** @type {Map<string, {cost: number, maxLevel: number}>} */
const UPGRADE_CATALOG = new Map([
  ['speed',     { cost: 300, maxLevel: 10 }],
  ['damage',    { cost: 200, maxLevel: 10 }],
  ['fireRate',  { cost: 400, maxLevel: 10 }],
  ['maxHealth', { cost: 100, maxLevel: 10 }]
]);

/**
 * @param {string} name
 * @returns {{cost: number, maxLevel: number}|undefined}
 */
function getUpgradeDef(name) {
  return UPGRADE_CATALOG.get(name);
}

module.exports = { UPGRADE_CATALOG, getUpgradeDef };
